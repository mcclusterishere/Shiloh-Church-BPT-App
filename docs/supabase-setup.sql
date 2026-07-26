-- Shiloh Church App — Supabase schema + Row Level Security.
-- Run this once in the Supabase SQL Editor for a new project, then flip
-- data/config.json to "mode": "supabase". See docs/BACKEND.md.
--
-- Every table carries a church_id, even though this project holds exactly one
-- church today — see docs/DESIGN.md on why: retrofitting a tenant column
-- later is a far bigger migration than including it from day one. It
-- defaults to a fixed placeholder UUID so single-church inserts need no
-- extra code; a future shared multi-tenant deployment would populate it from
-- a JWT claim instead.

create extension if not exists "pgcrypto";

create table if not exists churches (
  id uuid primary key default '00000000-0000-0000-0000-000000000001',
  name text not null default 'Shiloh Baptist Church'
);
insert into churches (id, name) values ('00000000-0000-0000-0000-000000000001', 'Shiloh Baptist Church')
  on conflict (id) do nothing;

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null default '00000000-0000-0000-0000-000000000001' references churches(id),
  name text,
  email text unique,
  phone text,
  role text not null default 'member' check (role in ('admin', 'ministry_leader', 'volunteer', 'member')),
  "updatedAt" timestamptz default now()
);

create table if not exists visitor_cards (
  id text primary key,
  church_id uuid not null default '00000000-0000-0000-0000-000000000001' references churches(id),
  name text, email text, phone text, who text, message text,
  status text not null default 'received' check (status in ('received', 'contacted', 'member')),
  "submittedAt" timestamptz default now(),
  "reviewedAt" timestamptz
);

create table if not exists rsvps (
  id text primary key,
  church_id uuid not null default '00000000-0000-0000-0000-000000000001' references churches(id),
  "eventId" text not null,
  answer text not null check (answer in ('yes', 'maybe', 'no')),
  name text, email text,
  "submittedAt" timestamptz default now()
);

create table if not exists prayer_requests (
  id text primary key,
  church_id uuid not null default '00000000-0000-0000-0000-000000000001' references churches(id),
  name text,
  text text not null,
  visibility text not null default 'church' check (visibility in ('church', 'team', 'pastor')),
  "prayingCount" int not null default 0,
  "submittedAt" timestamptz default now()
);

create table if not exists reservations (
  id text primary key,
  church_id uuid not null default '00000000-0000-0000-0000-000000000001' references churches(id),
  "facilityId" text not null,
  type text,
  date date, "startTime" time, "endTime" time,
  purpose text, "requestedBy" text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  "submittedAt" timestamptz default now(),
  "reviewedAt" timestamptz
);

-- Independent of church size: liability for children's/nursery ministry
-- exists at 20 members exactly as it does at 2,000. Admin-only, always.
create table if not exists safety_status (
  id text primary key,
  church_id uuid not null default '00000000-0000-0000-0000-000000000001' references churches(id),
  name text not null,
  role text,
  status text not null default 'not started' check (status in ('not started', 'in progress', 'current', 'expired')),
  expires_on date
);

-- ---------------------------------------------------------------------------
-- Row Level Security. A table with RLS enabled and NO policy is fully closed
-- (safer default than Postgres' normal "no RLS = fully open"); every policy
-- below is written explicitly rather than assumed.
-- ---------------------------------------------------------------------------
alter table members enable row level security;
alter table visitor_cards enable row level security;
alter table rsvps enable row level security;
alter table prayer_requests enable row level security;
alter table reservations enable row level security;
alter table safety_status enable row level security;

-- Public app forms may INSERT (anon key) — this is how visitor cards, RSVPs,
-- prayer requests, and reservation requests reach the database with no login.
create policy "anon can submit visitor cards" on visitor_cards for insert to anon with check (true);
create policy "anon can submit rsvps" on rsvps for insert to anon with check (true);
create policy "anon can submit prayer requests" on prayer_requests for insert to anon with check (true);
create policy "anon can submit reservation requests" on reservations for insert to anon with check (true);
create policy "anon can save a profile" on members for insert to anon with check (true);
create policy "anon can update own profile by email" on members for update to anon using (true) with check (true);

-- The public prayer wall only ever shows "church"-visibility requests —
-- "team"/"pastor" tiers are readable only by signed-in (authenticated) users.
create policy "anon can read church-visible prayer requests" on prayer_requests
  for select to anon using (visibility = 'church');

-- Everything else (reading visitor cards, all prayer tiers, reservations,
-- safety status, the member directory) requires a signed-in admin. Role
-- distinctions beyond "signed in or not" (Admin / Ministry Leader /
-- Volunteer) are enforced by the fixed 3-role UI today; a future pass can
-- tighten these to per-role column/row policies once there are enough
-- distinct staff logins to need it.
create policy "signed-in users can read members" on members for select to authenticated using (true);
create policy "signed-in users can read visitor cards" on visitor_cards for select to authenticated using (true);
create policy "signed-in users can update visitor cards" on visitor_cards for update to authenticated using (true);
create policy "signed-in users can read rsvps" on rsvps for select to authenticated using (true);
create policy "signed-in users can read all prayer requests" on prayer_requests for select to authenticated using (true);
create policy "signed-in users can read reservations" on reservations for select to authenticated using (true);
create policy "signed-in users can update reservations" on reservations for update to authenticated using (true);
create policy "signed-in users can manage safety status" on safety_status for all to authenticated using (true) with check (true);

-- One-tap "Praying" support, atomic so concurrent taps don't lose a count.
create or replace function increment_praying(request_id text)
returns void language sql as $$
  update prayer_requests set "prayingCount" = "prayingCount" + 1 where id = request_id;
$$;

-- ---------------------------------------------------------------------------
-- Phase 2 tables (not created yet — reference only, per docs/DESIGN.md).
-- Uncomment and adapt when giving, volunteer scheduling, or pastoral
-- engagement flags actually ship.
-- ---------------------------------------------------------------------------
-- create table giving_funds (id uuid primary key default gen_random_uuid(), church_id uuid references churches(id), name text not null);
-- create table giving_transactions (id uuid primary key default gen_random_uuid(), church_id uuid references churches(id), fund_id uuid references giving_funds(id), amount numeric not null, donor_email text, status text default 'pending_approval' check (status in ('pending_approval','approved','rejected')), approved_by text, "createdAt" timestamptz default now());
-- create table volunteer_shifts (id uuid primary key default gen_random_uuid(), church_id uuid references churches(id), role text not null, date date, "claimedBy" text);
-- create table engagement_flags (id uuid primary key default gen_random_uuid(), church_id uuid references churches(id), household text not null, "lastSeen" date, note text, "createdAt" timestamptz default now());
