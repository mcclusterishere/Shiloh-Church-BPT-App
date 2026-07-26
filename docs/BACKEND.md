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
  "adminPasscode": "shiloh2026"
}
```

| Setting | What it does |
| --- | --- |
| `mode: "demo"` | Zero setup. Everything lives in the browser's localStorage. Submissions made on a device appear in **that device's** admin only — perfect for trying the app and for the pilot, useless for a real multi-person church. |
| `mode: "supabase"` | Real database, real admin login (magic link). Visitor cards, RSVPs, prayer requests, and reservations insert from the app; admins sign in to review and act on them. |
| `webhookUrl` | **Automations.** Fires in *any* mode: every visitor card, RSVP, prayer request, and reservation request POSTs JSON to this URL. |
| `adminPasscode` | Demo mode's courtesy lock for `admin.html`. It is client-side and **not security** — real access control comes with Supabase mode. |

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
  "type": "visitor-card | rsvp | prayer-request | reservation-request | profile | test",
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
3. In **Authentication → Settings**, turn on email magic-link sign-in, and point
   custom SMTP at Resend (`smtp.resend.com`, your verified domain, your Resend API key
   as the SMTP password) so sign-in emails actually land.
4. In **Authentication → Users**, add the admin user(s).
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

## Content management (no code needed)

See `docs/MANAGE.md` for the one-page guide to editing `data/*.json`.

## Alternative: forms-only backend

No database wanted yet? Leave `mode: "demo"` and set `webhookUrl` to a
Formspree/Basin endpoint — every submission still reaches the team by email and demo
mode keeps the in-app experience working.
