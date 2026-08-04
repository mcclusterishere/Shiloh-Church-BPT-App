# The backend — from demo to live in one config file

Everything the app and admin store or send flows through `js/store.js`, and one file
decides where it goes: **`data/config.json`**.

```json
{
  "mode": "demo",
  "supabaseUrl": "",
  "supabaseAnonKey": "",
  "webhookUrl": "",
  "notifyEmail": "",
  "adminPasscode": "shiloh2026",
  "editorPasscode": "shilohmedia2026",
  "applianceUrl": "",
  "applianceToken": ""
}
```

| Setting | What it does |
| --- | --- |
| `mode: "demo"` | Zero setup. Everything lives in the browser's localStorage. Submissions made on a device appear in **that device's** admin only — perfect for trying the app and for the pilot, useless for a real multi-person church. |
| `mode: "supabase"` | Real database, real admin login. Visitor cards, RSVPs, prayer requests, and reservations insert from the app; staff sign in to review and act on them. |
| `webhookUrl` | **Automations.** Fires in *any* mode: every visitor card, RSVP, prayer request, reservation request, rental request, and access-pass event POSTs JSON to this URL. |
| `adminPasscode` | Demo mode's courtesy lock for the **admin** tier of the back office. Client-side and **not security** — real access control comes with Supabase mode (see "Staff roles" below). |
| `editorPasscode` | Same courtesy lock, **editor** tier: the public-face jobs only, nothing people-sensitive. Change both passcodes before handing out links. |
| `applianceUrl` / `applianceToken` | Points **Admin → Assistant** at the church's own box (or the Gemini edge function) — see `docs/APPLIANCE-SETUP.md`. Both blank is a normal, fully-supported state. |

## Why one Supabase project per church, not a shared one

The design proposal (`docs/DESIGN.md`) is explicit about this: **physical
isolation beats clever multi-tenancy** for a small team holding sensitive pastoral
and giving data. Every table still has a `church_id` column reserved (see
`supabase-setup.sql`) so a future move to a real shared-hosted product is additive,
not a rewrite — but today, each church (starting with Shiloh) gets its own project.

## Automations to other providers (works today, any mode)

Set `webhookUrl` to a catcher from **Zapier** (Webhooks by Zapier → Catch Hook),
**Make.com** (Custom webhook), **n8n** (Webhook node), or a **Resend** endpoint for
email. Each event arrives as:

```json
{
  "source": "shiloh-church-app",
  "type": "visitor-card | rsvp | prayer-request | reservation-request | rental-request | rental-update | access-grant | access-revoke | profile | test",
  "sentAt": "2026-07-26T15:00:00.000Z",
  "data": { "...": "the record itself" }
}
```

Two pre-built recipes worth setting up first, per the research's own highest-ROI
finding:

- **New visitor card → welcome email + notify the pastor.** Filter on
  `type = "visitor-card"`, fan out to a welcome email (Resend/Mailchimp) and a
  Slack/SMS ping to staff.
- **RSVP confirmed → reminder 3 days before the event.** A scheduled step in
  Zapier/Make/n8n reading the RSVP's `eventId` and `email`.

Test it from **Admin → Automations → Send a test event**.

## Going live with Supabase (free tier is fine)

1. Create a project at supabase.com → note the **Project URL** and **anon public key**.
2. In the Supabase **SQL Editor**, run everything in
   [`supabase-setup.sql`](supabase-setup.sql) — it creates every table with Row Level
   Security **on by default** (a table without an explicit policy is fully open
   through Supabase's auto-generated REST API, so this step is not optional).
3. (Recommended) In **Authentication → Settings**, point custom SMTP at Resend
   (`smtp.resend.com`, your verified domain, your Resend API key as the SMTP
   password) so password-reset and invite emails actually land.
4. In **Authentication → Users**, add each staff login (email + password), then
   give each one a role row in the `staff` table — see "Staff roles" below.
5. Edit `data/config.json`:

   ```json
   { "mode": "supabase", "supabaseUrl": "https://YOURPROJECT.supabase.co", "supabaseAnonKey": "eyJ…", "webhookUrl": "…" }
   ```

6. Commit and push. `admin.html` now asks for a real sign-in, and every device's
   submissions land in one real database.

The anon key is designed to be public — safety comes entirely from the RLS policies,
which is why step 2 is not optional. **Never** commit the `service_role` key anywhere;
it bypasses every RLS policy and belongs only in GitHub Actions/Edge Function secrets
if a future automation needs it.

## Staff roles — what actually enforces them

Two tiers run the back office. **Editor** handles the public face: events,
announcements, the ministry catalog, facility reservations, the live
broadcast. **Admin** adds everything people-sensitive: visitor cards, member
profiles, prayer at the team/pastor tiers, volunteer safety status, settings,
automations.

In demo mode, the two passcodes in `data/config.json` pick the role — and
they are **UX only**. They're checked in the browser, in a file anyone can
read; they keep honest people in their lane and nothing more. The real lock
is Supabase + RLS: `supabase-setup.sql` creates a `staff` table (email →
role) and writes every sensitive policy around it. A signed-in account with
no staff row can't do anything staff-shaped, and an editor's account cannot
read members, visitor cards, team/pastor prayer, or safety status — the
database refuses, no matter what any UI shows or any devtools request asks
for. That's the Church OS non-negotiable, enforced where it can't be worked
around.

Adding a staff member is one INSERT, run in the Supabase dashboard's SQL
Editor (clients can't write the `staff` table — by design):

```sql
insert into staff (email, role) values ('media@shilohchurchbpt.org', 'editor');
```

Create the matching login first under **Authentication → Users** (email +
password). The policies compare emails case-insensitively, but keep staff
emails lowercase anyway — it's what the auth system stores. Change a role
with an UPDATE, remove access with a DELETE — same place. No deploy, no
code change.

## Rentals and building access — what lands in the database

`supabase-setup.sql` also creates the two tables behind the space-rental
layer:

- **`rentals`** — every request from the public Rent form. Anon may insert
  (that's the form), any staff row reads and updates (approve/deny). Guests
  look a booking up by its `SHILOH-XXXX` code with the anon key — and since
  RLS can't express "readable only via exact code match," anon read is on,
  eyes open. What that trades away and the one policy to drop if the church
  would rather not are spelled out in a comment right above that policy in
  the SQL file. Door codes are not in this table either way.
- **`access_grants`** — building-access passes: doors, time window, door
  code. Admin-only in every direction, the same tier as visitor cards and
  pastoral data. One honesty note: today `js/store.js` keeps passes on the
  admin device (localStorage) and doesn't sync this table yet — the schema
  and policies are in place now so turning sync on later is a store change,
  not a security scramble.

The bridge that turns passes into real lock schedules is a separate, tiny
HTTP service — see `docs/ACCESS-SETUP.md`. Its URL and token never live in
the database or in a data file; they're entered per admin device in
**Admin → Building**.

## Content management (no code needed)

See `docs/MANAGE.md` for the one-page guide to editing `data/*.json`.

## Alternative: forms-only backend

No database wanted yet? Leave `mode: "demo"` and set `webhookUrl` to a
Formspree/Basin endpoint — every submission still reaches the team by email and demo
mode keeps the in-app experience working.
