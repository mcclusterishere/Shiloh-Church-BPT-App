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
  Atkinson Hyperlegible body type, Bitter display type, 20px base size, 48px+ tap
  targets, no fine print anywhere.

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
- `manifest.webmanifest` / `sw.js` — install metadata and the offline service worker
- `assets/icons/` — home-screen icons (**placeholder** — see "Still needed," below)
- `assets/fonts/` — self-hosted type, copied from the Faith & Results sister app

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

## Still needed before this is really Shiloh's app

- **Real branding** — an actual logo, a firmer color preference, and a tagline. The
  palette in `data/theme.json` right now is the design proposal's starting direction,
  not a final answer, and the icons in `assets/icons/` are a plain placeholder mark —
  regenerate them once real branding lands.
- **Real church facts** — address, phone, pastor's name, and service times in
  `data/church.json` are blank on purpose rather than guessed.
- **The real ministries list** — `data/ministries.json` is seeded with common
  Baptist-church ministry names as placeholders, not Shiloh's actual ones.
- **The on-premises appliance question** — this build is cloud-first (Supabase) per
  the design proposal, with the data layer built to point at a local box later without
  a rewrite. Whether to also pursue that hardware track now is still open.

See `docs/DESIGN.md` for the complete list of open questions and the roadmap for
everything after Phase 1.
