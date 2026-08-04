# The church app — a template any congregation can make its own

An installable, offline-capable church app you can fork and launch in an
afternoon: service times and events on the front door, a prayer wall the whole
family can see and pray over, a connect card that follows up on its own, and an
admin back office with a unified inbox, a bookable-facility catalog, and
role-based staff access — all sized for a 20-member church and built to grow
with it.

It was extracted from the Shiloh Baptist Church app — built for a real
congregation in Bridgeport, Connecticut, then generalized so any church can use
it. Everything you see in this repository belongs to a fictional example
church, "Grace Community Church" — placeholder photos, placeholder facts,
placeholder passcodes — waiting to be replaced with your own.

No build step, no framework, no monthly platform fee: vanilla HTML, CSS, and
JavaScript, deployed free on GitHub Pages. Everything church-specific lives in
`data/*.json` and `assets/media/` — not in code.

## Quick start

1. **Fork this repository** and rename it for your church (Settings → General
   → Repository name). The app uses relative paths throughout, so it works at
   any Pages URL without code changes.
2. **Turn on GitHub Pages**: Settings → Pages → Source: **GitHub Actions**.
   Every push to the default branch now deploys the site.
3. **Open `setup.html` on your deployed site** (or locally) and follow the
   Setup Studio. It walks you through the questions a church office can
   actually answer — name, address, service times, ministries, giving — and
   produces the edited data files for you.
4. Open the deployed link on a phone → **Add to Home Screen** → it's an app.

Prefer to do it by hand, or want to see everything the Studio touches? The
complete fork-to-launch checklist — every file, in dependency order, including
an honest map of the handful of hardcoded strings — is
[`docs/TEMPLATE.md`](docs/TEMPLATE.md). The `<title>` and description lines you
must edit by hand are also listed in `template-pack/index-head.txt` if you're
reading this inside the content pack.

## Before your first link goes out

Three things the template ships deliberately unfinished, because honesty beats
convenience:

- **Passcodes.** `data/config.json` ships with `CHANGE-ME-ADMIN` and
  `CHANGE-ME-EDITOR`. Change both. In demo mode they are courtesy locks,
  readable by anyone who opens the file — real enforcement arrives with
  Supabase mode ([`docs/BACKEND.md`](docs/BACKEND.md)).
- **Photos.** Every image is a labeled placeholder telling you exactly which
  file to replace (`assets/media/home-hero.webp` and friends). Use real
  photographs of your actual congregation wherever you can — it is the single
  biggest upgrade available to this app, and no stock photo substitutes for it.
- **Giving handles.** `data/giving.json` links out to giving methods and never
  processes money itself. The handles are `CHANGE-ME` until you paste your
  church's real ones.

## What's inside

- `index.html` — the member app (home, events, prayer wall, connect, watch,
  give, ministries, about)
- `admin.html` — the back office: inbox, people, events & RSVPs, prayer,
  reservations, building access
- `golive.html` — the phone broadcast studio (a staff phone is the camera)
- `guide.html` — a large-print printable paper guide for members who don't do
  apps
- `data/*.json` — every screen's content, one self-describing file each
  (each opens with a `note` field explaining itself)
- `scripts/make-icons.py` — regenerates the full home-screen icon set from
  your logo in one command (the shipped icons come from
  `assets/logo-example.png` — replace it with your own and rerun)
- `docs/` — the honest guides: [`TEMPLATE.md`](docs/TEMPLATE.md) (the fork
  checklist), [`MANAGE.md`](docs/MANAGE.md) (day-to-day content editing),
  [`GO-LIVE.md`](docs/GO-LIVE.md) (launch runbook and streaming routes with
  real costs), [`BACKEND.md`](docs/BACKEND.md) (Supabase and automations),
  [`ACCESS-SETUP.md`](docs/ACCESS-SETUP.md) (building access),
  [`APPLIANCE-SETUP.md`](docs/APPLIANCE-SETUP.md) (the church-owned box), and
  [`DESIGN.md`](docs/DESIGN.md) (why everything is built the way it is)

## The design's non-negotiables

These survived the trip from Shiloh's app into the template, and they're worth
keeping:

- **Elder-first legibility.** 20px body text, 48px tap targets, WCAG AAA
  contrast, a one-tap Comfort mode, self-hosted Atkinson Hyperlegible and
  Fraunces type. No fine print anywhere.
- **The app never touches money.** Giving and rentals link out or hand off to
  the church office; nothing is processed in the app.
- **Data files are public.** Every `data/*.json` is served to every visitor,
  so no secret ever lives in one — the files say so themselves.
- **Honesty is structural.** Nothing in the app claims to be connected,
  streaming, or saved unless it truly is; empty states say so plainly.

## Lineage

Extracted from the Shiloh Baptist Church app, built for Shiloh Baptist Church
of Bridgeport, Connecticut. The architecture, the design system, and the
feature set were shaped by that congregation's real needs — a 20-member-scale
back office, a phone-as-camera broadcast studio, building rentals with access
passes — and this template exists so the next church starts from all of it.
