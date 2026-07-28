# Shiloh — the church app

Shiloh Baptist Church's installable, offline-capable church app: service times and
events on the front door, a prayer wall the whole family can see and pray over, a
connect card that follows up on its own, and an admin back office built to the same
level of functionality as Airbnb's host dashboard — a listings catalog, a booking
engine, a unified inbox, and role-based access, all sized for a 20-member church and
built to grow with it.

This is **Phase 1** of a larger plan. The full design proposal — architecture, the
complete feature roadmap through megachurch scale, the Airbnb-capability-by-capability
mapping, and the open questions still waiting on real answers — lives in
[`docs/DESIGN.md`](docs/DESIGN.md). Read that first if you're wondering why something
below is built the way it is, or why something obvious isn't here yet.

**Built to be forked.** Nothing church-specific lives in code — name, colors, tagline,
ministries, and events all live in `data/*.json`. Forking this repo, editing those
files, and swapping the church name and colors is the whole rebranding process for
another congregation. See `docs/MANAGE.md`.

## The app

- **Home** — service times, announcements, and quick links to what matters most.
- **Events** — a calendar that sorts itself (future rises, past archives), one-tap
  RSVPs with a running headcount, and a real calendar subscription (`events.ics`) so
  members never have to open the app to know what's next.
- **Prayer wall** — every request carries its own visibility, chosen by the person
  sharing it: the whole church, the prayer team, or the pastor alone. Support is a
  single tap ("🙏 Praying"), never a comment box.
- **Connect** — a visitor/member-update card that fires straight into automated
  follow-up the moment it's submitted.
- **Ministries & spaces** — the ministry/small-group/bookable-facility catalog
  (`data/ministries.json`), with "I'm interested" for ministries and "Request to book"
  (with a basic double-booking check) for bookable spaces.
- **A skippable onboarding walkthrough** — an equal-weight "Show me around" / "Skip"
  choice, never a forced tour, with a permanent "Watch the tour again" in Help. Built
  for people who have never really used an app before.
- **Elder-first design**, ported from the Faith & Results sister app: self-hosted
  Atkinson Hyperlegible body type, Fraunces display type, 20px base size, 48px+ tap
  targets, no fine print anywhere — plus a one-tap Comfort mode.

## The admin backend (`admin.html`)

Dashboard stat tiles, a consolidated **Inbox** (visitor cards, reservation requests,
and new prayer requests in one filterable list — the church-sized version of a unified
host inbox), **People**, **Ministries & facilities** with reservation approve/deny,
**Events & RSVPs** with roster email/text blasts, **Prayer** at every visibility tier,
**Volunteers & safety status** (background-check tracking — independent of church
size, so it's here from day one), a read-only **Brand & Settings** preview, and
**Automations** (webhook test send).

## Files

- `index.html` — the app (shell, screens, router, onboarding)
- `admin.html` — the admin backend
- `js/store.js` — the shared data layer (demo / Supabase / webhook adapters)
- `data/config.json` — backend mode, webhook URL, admin passcode
- `data/theme.json` — **branding only**: church name, tagline, colors
- `data/church.json` — real church facts: address, phone, pastor, service times
- `data/ministries.json` — the ministry/small-group/facility catalog
- `data/events.json` / `data/news.json` — the calendar and the announcement feed
- `scripts/build-ics.js` — generates `events.ics` from `data/events.json` at deploy time
- `docs/BACKEND.md` — go-live guide for Supabase + automations
- `docs/MANAGE.md` — the one-page content-editing guide
- `docs/supabase-setup.sql` — schema + Row Level Security policies for live mode
- `docs/DESIGN.md` — the full design proposal this build follows
- `docs/APPLIANCE-SETUP.md` — turning a Mac mini into the Church OS "brain and pipe" appliance
- `scripts/appliance/gateway.js` — the local service that runs on that box
- `manifest.webmanifest` / `sw.js` — install metadata and the offline service worker
- `assets/icons/` — home-screen icons: a stained-glass-window mark in the blues of the church's own logo
- `assets/media/` — all 60 photos from shilohchurchbpt.org
- `assets/fonts/` — self-hosted type: Atkinson Hyperlegible (body) + Fraunces variable (display)

## Go live

1. One-time setup: in the repo's **Settings → Pages**, set Source to **GitHub
   Actions**.
2. **On every push to `main`**, GitHub Actions builds `events.ics` and deploys the
   site to GitHub Pages (`.github/workflows/deploy-pages.yml`). A keepalive job
   (`.github/workflows/keepalive.yml`) makes sure GitHub never silently disables that
   automation after 60 quiet days. This branch (`claude/shiloh-church-bpt-design-x9lnin`)
   doesn't auto-deploy until it's merged — use **Actions → Deploy to GitHub Pages →
   Run workflow** to preview it manually before then.
3. Open the deployed link on a phone → **Add to Home Screen** → it's an app.
4. Everything works in demo mode (this browser's storage) with zero setup. Flip
   `data/config.json` to Supabase mode when it's time for a real, shared database —
   see `docs/BACKEND.md`.

## Real content

Everything church-specific is now mirrored from the church's own website,
shilohchurchbpt.org (July 2026): the tagline ("Where Christ Is Lifted Up"), address,
phone, service times, the prayer line, 14 real ministries with their scripture and
mission statements, staff with bios, six giving methods with the church's real
handles, recent sermons, the pastor's greeting, and the site's own FAQ — plus all 60
photos, in `assets/media/`. The accent palette and app icon now follow the blues of
Shiloh's own stained-glass-window logo.

Known content notes (also flagged in the data files):
- The site disagrees with itself on Sunday prayer time (hero says 8:30 AM, FAQ and
  About say 8:15 AM) — the app uses 8:15; confirm with the office.
- The website's "Our History" section is lorem-ipsum placeholder on the live site, so
  the app deliberately has no history section yet.
- Sunday services are seeded as events through early September 2026; the recurring
  event engine is a Phase 2 feature.

## The community-impact story

`data/impact.json` carries the part of Shiloh's story its own website doesn't tell,
sourced from the Faith & Results / Freedom, Inc. records and shown on the About
screen with citations attached to every claim:

- **The monopole fight.** United Illuminating's Docket 516R would have run
  high-voltage transmission monopoles past Shiloh's building and the historic Mary &
  Eliza Freeman Houses. The Connecticut Siting Council denied the application 5–3 on
  October 16, 2025, rejected UI's appeal, and closed the docket on February 5, 2026 —
  independently verified against CT Mirror and the Council's own record.
- **First African-American church in Connecticut to go solar** — and the first church
  in Southern Connecticut on fully solar power — with CT Green Bank financing, a
  recognized state leader in the EPA's "God Goes Green" initiative. The unveiling also
  launched Solar for All with PosiGen.
- **The Shiloh Bethel Centre** — a 66-unit mixed-use development (15 studios, 25
  one-bed, 20 two-bed, 6 live/work units, retail, conference space, parking) using a
  panelized off-site green building system, from the project one-pager.
- **Faith Community Development Corporation**, chartered by Shiloh.
- **A voice for the city** — Faith Acts for Education, the police chief search, the
  PSEG gas plant, CCJEF school funding, and the Indiaspora Civil Rights Town Hall
  alongside DJ Patil and Vanita Gupta.
- Pastor McCluster's fuller civic and professional record, from his leadership
  biography.

**A note on photography.** Shiloh's own website mixes real congregation photos with
stock imagery — the Ushers and Music ministry images and the About page's "PASSION LED
US HERE" shot are stock. The genuinely-Shiloh photos are used where they matter (the
congregation on About, the fellowship hall, staff portraits). The impact section's
image is verifiably Rev. McCluster — it matches the church's own portrait — but its
location and occasion are unconfirmed, so the caption claims neither. A second archive
photo of clergy in a sanctuary (`impact-solidarity.jpg`) is kept but unused for the
same reason. Getting real photographs of the ushers, the choir and the building is the
single biggest content upgrade still available to this app.

See `docs/DESIGN.md` for the roadmap for everything after Phase 1.
