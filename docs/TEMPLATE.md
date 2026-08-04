# Give this app to another church in an afternoon

This app was built for Shiloh Baptist Church, but almost everything
church-specific lives in `data/*.json` and `assets/media/` — not in code. This
is the complete fork checklist, in dependency order: follow it top to bottom
and you end with a working, installable app for a different congregation.

Two honesty notes before you start:

- **"Almost everything."** A handful of church-name strings still live in the
  HTML and code files. Every one of them is enumerated in
  [step 8](#8-hunt-down-the-hardcoded-shiloh-strings), including the ones that
  are cosmetic and the ones that genuinely matter. Nothing is hidden.
- **Colors are the template's biggest rough edge.** `data/theme.json` carries
  the palette, but the app's *rendered* colors are the token blocks at the top
  of `css/system.css` (plus two values in `manifest.webmanifest`). Step 3
  covers all three places. Editing one without the others leaves the admin
  Brand pane and the real screen disagreeing with each other.

Day-to-day content editing *after* the fork is a different, simpler document:
`docs/MANAGE.md`.

---

## 1. Fork and rename

1. Fork the repository on GitHub.
2. Rename it for the new church (Settings → General → Repository name). The
   app uses relative paths and a `"./"` PWA scope throughout, so it works at
   any Pages URL without code changes.
3. Clone your fork locally. Everything below is file edits, a commit, and a
   push.

## 2. `data/theme.json` — name, tagline, logos

The first file to edit, because half the app reads it at boot:

- `churchName`, `shortName`, `tagline` — the app bar, admin gate, broadcast
  studio, and page titles re-theme themselves from these at runtime.
- `website` — the church's own site.
- `logo` / `logoOnDark` — paths to the church's logo images in
  `assets/media/` (you'll add those files in step 6).
- `colors` — see step 3; keep this in sync with what you actually ship.

## 3. Colors — three places, honestly

If the new church keeps the shipped blue-and-cream palette, skip this step
entirely. If not:

1. **`css/system.css`, the token blocks near the top** (roughly lines
   45–176): the light theme in `:root`, the dark theme in
   `@media (prefers-color-scheme: dark)`, and the two `:root[data-theme]`
   override blocks. Each color is a **hex + OKLCH pair on one line** — change
   both values of a pair, in **all four blocks**. `--shiloh` is the accent
   token; change its *value*, not its name (the name is referenced throughout
   `css/app.css` and would cascade into a rename project). Touch only the
   token values — everything below the token section is off limits (see
   ["What NOT to edit"](#what-not-to-edit)).
2. **`manifest.webmanifest`** — `background_color` and `theme_color` (lines
   10–11). The browser fetches this file before any JavaScript runs, so it
   can never be re-themed live.
3. **`data/theme.json`** — the `colors` block, so Admin → Brand & Settings
   shows the truth.

Keep the contrast discipline: body text on background stays at WCAG AAA. If
you're not sure your new palette clears that bar, check it — the design
system's whole promise is that legibility is never traded away.

## 4. `data/church.json` — the facts

Address, phone, email, pastor's name and photo path, service times, the
prayer line, and the `rightNowMedia` registration link (leave it `""` and the
RightNow card simply never appears). This file also drives the printable
paper guide (`guide.html`), which fetches it at load.

## 5. The content files — one JSON file per screen

Work through these in any order; each one is self-describing (every file
opens with a `note` field explaining itself) and `docs/MANAGE.md` describes
each in a sentence:

| File | What it is |
| --- | --- |
| `data/ministries.json` | The ministry / small-group / bookable-facility catalog. `"bookable": true` turns "I'm interested" into "Request to book." |
| `data/events.json` | The calendar. After editing, `events.ics` regenerates automatically on deploy via the Pages workflow; deploying any other way, run `node scripts/build-ics.js` and commit the refreshed `events.ics`. |
| `data/news.json` | Announcements. Items older than 18 months hide themselves. |
| `data/giving.json` | Giving methods. The app links out; it never processes money — keep it that way. |
| `data/about.json` | Who we are, staff with photos and bios, anniversary block. |
| `data/faq.json` | The visitor FAQ. |
| `data/sermons.json` | Recent sermons — links out to wherever the church posts them. |
| `data/rentals.json` | Spaces outside groups can rent. A `rate` of `""` shows "Ask about rates." |
| `data/access.json` | Door and camera *names* for Admin → Building. Names and ids only — every data file is publicly served, so nothing secret ever goes here. |
| `data/live.json` | The live-stream player: any iframe embed URL, plus the WHIP ingest URL if the church runs its own streaming box later. Blank is a fully supported state. |
| `data/impact.json` | The community-impact story. This one is deeply Shiloh-specific — **replace it with the new church's own documented story, or empty the items array**. House rule stands: every claim carries its sources; no citation, no claim. |

**The one rule from `docs/MANAGE.md` applies to all of these:** keep the JSON
valid — a missing comma stops that file from loading. Paste any edit through
a JSON checker if unsure.

## 6. Swap the photos — `assets/media/`

All of Shiloh's photos live here. Most are referenced *from the data files*,
so when you edit a JSON file, point its `image` fields at the new church's
photos and you're done. Eight images, though, are **load-bearing — hardcoded
in `index.html`** — and must be replaced *by keeping the same filename* (or
by editing the line listed):

| File | Where it's used |
| --- | --- |
| `home-hero.webp` | The front-door hero (`index.html:101`, preloaded at line 15) |
| `pastor-mccluster.webp` | Default pastor portrait (`index.html:150`; also named in `data/about.json`) |
| `home-recent-sermon.webp` | The home "recent sermon" card (`index.html:164`) |
| `about-us-banner.webp` | Home about strip (`index.html:173`) |
| `home-online.webp` | The Watch screen fallback card (`index.html:314`) |
| `new-here-plan-a-visit.webp` | New Here hero (`index.html:392`) |
| `new-here-kids1.webp` | New Here kids card (`index.html:432`) |
| `about-us-hero.webp` | The About screen's first panel (`index.html:1091`) |

Also swap the two logo files named in `data/theme.json` (`logo-header.webp`,
`logo-footer.webp` in the shipped set). Use real photographs of the actual
congregation wherever you can — that was the single biggest content upgrade
identified for Shiloh's own app, and it will be for yours too.

## 7. Regenerate the icons — `scripts/make-icons.py`

The full home-screen icon set regenerates from the new church's logo with one
command (needs Python 3 and Pillow — `python3 -m pip install Pillow`):

```
python3 scripts/make-icons.py path/to/their-logo.jpg
```

It trims the white margins, and — if the logo is a stacked mark-over-wordmark
design — finds the quiet gap between the two and uses the mark alone for the
32px favicon, where a full logo is an unreadable smudge. No gap, no problem:
it falls back to the whole logo (or force that with `--mark-crop none`). It
writes the five files the app references — `icon-512.png`, `icon-192.png`,
`icon-maskable-512.png` (padded inside Android's circular-crop safe zone),
`apple-touch-icon.png`, `favicon-32.png` — straight into `assets/icons/`, on
a white canvas, and prints what it wrote. Use `--out somewhere/` first if you
want to preview before replacing. This is the exact pipeline that produced
Shiloh's shipped icons from `assets/media/shiloh-logo-stacked.jpg`.

Then bump `CACHE_VERSION` in `sw.js` (e.g. `shiloh-v11` → `-v12`) so phones
that already installed the app fetch the new artwork. That version-string
bump is the **only** edit `sw.js` should ever get.

## 8. Hunt down the hardcoded "Shiloh" strings

Run `grep -rn "Shiloh" . --exclude-dir=data --exclude-dir=.git` yourself
after your edits — but here is the honest, complete map of what that grep
finds in the shipped template and what each hit means.

### 8a. Must edit — fetched before JavaScript runs

The app cannot re-theme these; they're what search engines, bookmarks, and
the install prompt see:

- `manifest.webmanifest:2-4` — `name`, `short_name`, `description`
- `index.html:6-7` — `<title>` and the meta description
- `admin.html:6` — `<title>`
- `golive.html:6` — `<title>`
- `guide.html:6-7` — `<title>` and the meta description

### 8b. Must edit — church-specific prose baked into the pages

These are real copy that runtime theming does **not** replace. That they
exist at all is a known rough edge of the template — church prose belongs in
data files, and these lines drifted from that convention:

- `index.html:101` — hero image alt text
- `index.html:104` — "Shiloh Baptist Church · Bridgeport, CT" hero eyebrow
- `index.html:203` — **a hardcoded link to shilohchurchbpt.org's calendar page** — point it at the new church's site or remove the button
- `index.html:317` — Watch screen fallback line
- `index.html:330, 332` — the RightNow Media card copy ("the Shiloh family")
- `index.html:343, 347` — "About Shiloh" heading and Sunday-morning eyebrow
- `index.html:395, 411` — New Here intro and connect-card confirmation
- `index.html:1166` — "Service beyond Shiloh" label in the About renderer
- `index.html:1480` — onboarding title "Welcome to the Shiloh app"
- `index.html:1618, 1625, 1632` — install instructions ("the Shiloh picture on your home screen")
- `admin.html:195` — the Rentals pane explainer ("booking Shiloh's spaces", "the SHILOH code")
- `golive.html:341` — the old-phone fallback message
- `guide.html:163, 203, 236` — the paper guide's title and home-screen steps

### 8c. Self-correcting fallbacks — edit for tidiness, not correctness

These display for a moment (or never) before `data/theme.json` overwrites
them at runtime: `index.html:88`, `admin.html:64, 84`,
`golive.html:240, 268, 404`, `guide.html:162`.

### 8d. Code identifiers and infrastructure — works fine unchanged

Rough edges you can leave alone; none of them are member-visible:

- `ShilohStore` / `ShilohAmbient` — the global JS namespaces
  (`js/store.js`, `js/ambient.js`, used by every page). Renaming them is a
  find-and-replace project with zero user-facing payoff; skip it.
- `SHILOH-` booking-code prefix — `js/store.js:288, 327`, the lookup
  placeholder `index.html:533`, and the "SHILOH code" mention in
  `admin.html:195`. Guests *do* see these codes, so rename the prefix if you
  care — just change all three places together.
- `shiloh.*` localStorage keys (`js/store.js:54` onward, plus the theme
  bootstrap snippets in every HTML head) — invisible.
- CSV export filenames `shiloh-people.csv` / `shiloh-rsvps.csv` —
  `admin.html:722, 790`.
- `scripts/build-ics.js:21, 25` — the ICS `PRODID` and UID domain (and the
  committed `events.ics` generated from them). Calendar apps show neither.
- `sw.js:10-11` — cache names `shiloh-v11` / `shiloh-media-v1`. Bump the
  version; renaming the prefix is optional.
- `--shiloh` CSS token name (`css/system.css:54, 113, 139, 162`,
  `css/app.css:61`, `guide.html:114`) — change its value, keep its name.
- `admin.html:253` — an example placeholder URL in the access-bridge form;
  `admin.html:1127` — the webhook test payload text.
- File-header comments naming Shiloh: `sw.js:1`, `js/store.js:1`,
  `js/ambient.js:1`, `css/system.css:2`, `css/app.css:2`, `css/admin.css:2`,
  plus in-code comments at `index.html:479, 1296`.

### 8e. Edit only if you use that optional tier

- `supabase/functions/assistant-gemini/index.ts:75` — the assistant's system
  prompt names Shiloh and Bridgeport. **Must** be rewritten before deploying
  the assistant, or it will confidently claim to be the wrong church.
- `native/capacitor.config.json:2-3` (`appId`, `appName`) and
  `native/package.json:2, 5` — required before any app-store build
  (`docs/APP-STORE.md`).
- `scripts/appliance/gateway.js:1, 127` and
  `scripts/appliance/mediamtx.yml:1, 35, 100, 106` — log text, the relay
  username, and recording paths on the streaming appliance.

### 8f. Prose about Shiloh that is *supposed* to be there

`README.md` tells Shiloh's story — rewrite it for the new church. The guides
in `docs/` mention Shiloh in examples throughout; they work as-is and need no
edits to ship.

## 9. Change every passcode — before the first link goes out

In `data/config.json`:

- `adminPasscode` and `editorPasscode` — the shipped values are printed in a
  public repository. Change both.
- `demoStaff` — the shipped array contains a named demo account for Shiloh's
  pastor. Replace it with the new church's own demo staff entry (or an empty
  array `[]`).

Remember what `docs/MANAGE.md` says plainly: in demo mode these are courtesy
locks, checked in the browser and readable by anyone who opens the file. Real
enforcement arrives with Supabase mode (`docs/BACKEND.md`).

## 10. Deploy — GitHub Pages

One-time: repo **Settings → Pages → Source: GitHub Actions**. From then on
every push to the default branch builds `events.ics` and deploys
(`.github/workflows/deploy-pages.yml`); a keepalive workflow stops GitHub
from silently disabling the schedule after 60 quiet days. Open the deployed
link on a phone → Add to Home Screen → it's an app. The full launch runbook,
including custom domains, is `docs/GO-LIVE.md`.

## 11. Optional tiers — each has its own guide

All of these are genuinely optional; the app is complete without them.

| Tier | What it adds | Guide |
| --- | --- | --- |
| Supabase | A real shared database, real staff logins, Row Level Security | `docs/BACKEND.md` + `docs/supabase-setup.sql` |
| Streaming | The phone broadcast studio publishing to a real destination | `docs/GO-LIVE.md` (routes and honest costs) |
| Appliance | The church-owned box: local assistant + broadcast relay | `docs/APPLIANCE-SETUP.md` |
| Building access | Real smart locks and cameras behind the access passes | `docs/ACCESS-SETUP.md` |
| App stores | Native wrapper for Apple / Google stores | `native/README.md` + `docs/APP-STORE.md` |

---

## What NOT to edit

The template stays upgradeable — future fixes merge cleanly into your fork —
only if church-specific changes stay out of the machinery:

- **`js/store.js`** — the data layer. Every screen, both back-office pages,
  and the demo/Supabase/webhook adapters flow through it. Nothing
  church-specific belongs in it (the `SHILOH-` prefix noted in 8d is its one
  rough edge).
- **`css/system.css` below the token blocks** — the design system's
  legibility floor lives there: 20px body text, 48px targets, AAA contrast,
  comfort mode. Change token *values* at the top; leave the rest alone.
- **`sw.js` beyond the `CACHE_VERSION` string** — the offline behavior is
  deliberate and tested.
- **`js/ambient.js`** — the light-field layer; it already obeys the theme.
- **`events.ics`** — generated from `data/events.json`; edit the source.
- **Church-specific copy in `index.html` / `admin.html` beyond the lines in
  step 8** — if you find yourself adding *new* church prose to the HTML, the
  right fix is a data file. That convention is what makes the next fork an
  afternoon instead of a rewrite.
