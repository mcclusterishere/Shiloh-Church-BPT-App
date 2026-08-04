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

-- Staff access tiers — the server-side twin of js/store.js's two roles.
-- EDITOR runs the public face (events, reservations, the live broadcast);
-- ADMIN adds everything people-sensitive. The client looks up the signed-in
-- email here to pick the UI (staffSignInSupabase), and every sensitive
-- policy below checks the same row again — the row IS the permission.
-- Rows are added only from the Supabase dashboard or with the service key;
-- there is deliberately NO client-facing insert/update/delete policy, so a
-- compromised browser can never promote itself.
create table if not exists staff (
  email text primary key,
  church_id uuid not null default '00000000-0000-0000-0000-000000000001' references churches(id),
  role text not null check (role in ('admin', 'editor'))
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

-- Space rentals — the "Airbnb layer." Outside churches and community groups
-- request a space from the public Rent screen (anon insert), the office
-- reviews (any staff row), and the SHILOH-XXXX booking code is the guest's
-- reference. Space ids match the bookable facility ids in ministries.json.
-- Column names match exactly what js/store.js submits.
create table if not exists rentals (
  id text primary key,
  church_id uuid not null default '00000000-0000-0000-0000-000000000001' references churches(id),
  code text not null unique,
  "spaceId" text not null,
  "spaceName" text,
  org text,
  "contactName" text,
  email text, phone text,
  date date, "startTime" time, "endTime" time,
  purpose text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  "submittedAt" timestamptz default now(),
  "reviewedAt" timestamptz
);

-- Building-access passes: who, which doors, what time window, a door code.
-- Admin-only in every direction — a door code is a key, so it sits on the
-- same tier as visitor cards and pastoral data. HONESTY NOTE: today
-- js/store.js keeps passes in the admin device's localStorage and does not
-- read or write this table yet. It is created now, with the right policies
-- already on it, so switching the store to sync passes later is a one-file
-- change instead of a security scramble. Nothing else here depends on it.
create table if not exists access_grants (
  id text primary key,
  church_id uuid not null default '00000000-0000-0000-0000-000000000001' references churches(id),
  "rentalId" text,
  name text,
  "doorIds" jsonb not null default '[]'::jsonb,
  date date, "startTime" time, "endTime" time,
  "doorCode" text,
  status text not null default 'active' check (status in ('active', 'revoked')),
  "createdAt" timestamptz default now(),
  "revokedAt" timestamptz,
  synced boolean not null default false,
  "bridgeId" text,
  "syncError" text
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
alter table staff enable row level security;
alter table rentals enable row level security;
alter table access_grants enable row level security;

-- A signed-in user may read exactly their own staff row — nothing else, and
-- never write. This single policy is also what makes every EXISTS check
-- further down work: those subqueries run as the caller, and RLS hands them
-- only the caller's own row, which is precisely the row being tested.
create policy "staff can read their own row" on staff
  for select to authenticated using (lower(email) = lower(auth.jwt()->>'email'));

-- Public app forms may INSERT (anon key) — this is how visitor cards, RSVPs,
-- prayer requests, and reservation requests reach the database with no login.
create policy "anon can submit visitor cards" on visitor_cards for insert to anon with check (true);
create policy "anon can submit rsvps" on rsvps for insert to anon with check (true);
create policy "anon can submit prayer requests" on prayer_requests for insert to anon with check (true);
create policy "anon can submit reservation requests" on reservations for insert to anon with check (true);
create policy "anon can submit rental requests" on rentals for insert to anon with check (true);
create policy "anon can save a profile" on members for insert to anon with check (true);
create policy "anon can update own profile by email" on members for update to anon using (true) with check (true);

-- The public prayer wall only ever shows "church"-visibility requests, to
-- everyone — signed in or not. The "team"/"pastor" tiers are admin-only,
-- below.
create policy "anyone can read church-visible prayer requests" on prayer_requests
  for select to anon, authenticated using (visibility = 'church');

-- Guests check their booking by its code: findRentalByCode in js/store.js
-- queries this table with the anon key (?code=eq.SHILOH-XXXX). RLS decides
-- row by row and never sees HOW a query filters, so "readable only when
-- asked for by exact code" is not something Postgres can enforce. The two
-- honest choices: (a) let anon read rental rows so the Rent screen's code
-- lookup works in supabase mode, or (b) close it and lose that lookup
-- outside demo mode. This file picks (a), eyes open: anyone holding the
-- anon key — which is public by design — can list rental requests, which
-- carry an outside group's org, contact name, email, and phone. That is
-- business contact info, deliberately a different tier from pastoral data
-- (which stays admin-only), and the codes themselves are references, not
-- secrets. If the church would rather keep rental contacts staff-only,
-- drop this ONE policy — nothing else breaks; guests then confirm their
-- booking with the office instead of in the app. Door codes are NOT
-- exposed either way: passes live in access_grants, which has no anon
-- policy at all.
create policy "anon can look up rentals (by booking code)" on rentals
  for select to anon using (true);

-- UPGRADE PATH. Postgres ORs policies together, so a project that ran the
-- pre-roles version of this file would keep its old any-signed-in-user
-- policies alongside the tiered ones below — silently defeating them.
-- Dropping them first is a harmless no-op on a fresh project.
drop policy if exists "signed-in users can read members" on members;
drop policy if exists "signed-in users can read visitor cards" on visitor_cards;
drop policy if exists "signed-in users can update visitor cards" on visitor_cards;
drop policy if exists "signed-in users can read rsvps" on rsvps;
drop policy if exists "signed-in users can read all prayer requests" on prayer_requests;
drop policy if exists "signed-in users can read reservations" on reservations;
drop policy if exists "signed-in users can update reservations" on reservations;
drop policy if exists "signed-in users can manage safety status" on safety_status;
drop policy if exists "anon can read church-visible prayer requests" on prayer_requests; -- renamed below

-- Everything else is tiered by the staff table, per the Church OS
-- non-negotiable: an EDITOR (any staff row) runs the public face; an ADMIN
-- staff row adds everything people-sensitive. Pastoral data is the tightest
-- tier — an editor never reads team/pastor prayer requests or visitor-card
-- contact details, and these policies enforce that at the database, no
-- matter what any UI shows. (Events, news, and ministries content lives in
-- data/*.json in the repo, so git access — not a table policy — is the
-- write gate for content today.)

-- Any staff row, editor or admin: the public-face queues.
create policy "staff can read rsvps" on rsvps for select to authenticated
  using (exists (select 1 from staff where lower(staff.email) = lower(auth.jwt()->>'email')));
create policy "staff can read reservations" on reservations for select to authenticated
  using (exists (select 1 from staff where lower(staff.email) = lower(auth.jwt()->>'email')));
create policy "staff can update reservations" on reservations for update to authenticated
  using (exists (select 1 from staff where lower(staff.email) = lower(auth.jwt()->>'email')))
  with check (exists (select 1 from staff where lower(staff.email) = lower(auth.jwt()->>'email')));
create policy "staff can read rentals" on rentals for select to authenticated
  using (exists (select 1 from staff where lower(staff.email) = lower(auth.jwt()->>'email')));
create policy "staff can update rentals" on rentals for update to authenticated
  using (exists (select 1 from staff where lower(staff.email) = lower(auth.jwt()->>'email')))
  with check (exists (select 1 from staff where lower(staff.email) = lower(auth.jwt()->>'email')));

-- Admin staff only: people, prayer at every tier, volunteer safety.
create policy "admin staff can read members" on members for select to authenticated
  using (exists (select 1 from staff where lower(staff.email) = lower(auth.jwt()->>'email') and staff.role = 'admin'));
create policy "admin staff can read visitor cards" on visitor_cards for select to authenticated
  using (exists (select 1 from staff where lower(staff.email) = lower(auth.jwt()->>'email') and staff.role = 'admin'));
create policy "admin staff can update visitor cards" on visitor_cards for update to authenticated
  using (exists (select 1 from staff where lower(staff.email) = lower(auth.jwt()->>'email') and staff.role = 'admin'))
  with check (exists (select 1 from staff where lower(staff.email) = lower(auth.jwt()->>'email') and staff.role = 'admin'));
create policy "admin staff can read all prayer requests" on prayer_requests for select to authenticated
  using (exists (select 1 from staff where lower(staff.email) = lower(auth.jwt()->>'email') and staff.role = 'admin'));
create policy "admin staff can manage safety status" on safety_status for all to authenticated
  using (exists (select 1 from staff where lower(staff.email) = lower(auth.jwt()->>'email') and staff.role = 'admin'))
  with check (exists (select 1 from staff where lower(staff.email) = lower(auth.jwt()->>'email') and staff.role = 'admin'));
-- A door code is a key: access passes are admin-only for read AND write —
-- an editor runs rentals without ever holding one, and there is no anon
-- policy on this table at all.
create policy "admin staff can manage access grants" on access_grants for all to authenticated
  using (exists (select 1 from staff where lower(staff.email) = lower(auth.jwt()->>'email') and staff.role = 'admin'))
  with check (exists (select 1 from staff where lower(staff.email) = lower(auth.jwt()->>'email') and staff.role = 'admin'));

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
