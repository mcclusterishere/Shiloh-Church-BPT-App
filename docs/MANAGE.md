# Running the app — the one-page guide

Everything on the site is data. Edit a file, commit, push to the branch this
deploys from — the site redeploys itself in about a minute. No code changes needed
for any of this.

| I want to… | Edit this | Notes |
| --- | --- | --- |
| Change the church **name, tagline, or colors** | `data/theme.json` | Name and tagline apply live everywhere. The color fields are honest-to-a-point: the app's rendered palette lives in `css/system.css`, so changing a hex here updates previews and exports but re-skinning the actual look means editing the custom properties at the top of `css/system.css` too — the fork checklist (`docs/TEMPLATE.md`) walks through exactly which ones. Also update `manifest.webmanifest`'s `theme_color`/`background_color` by hand. |
| Change the church's **address, phone, pastor, or service times** | `data/church.json` | Kept separate from branding on purpose. |
| Add or change a **ministry, small group, or bookable space** | `data/ministries.json` | Set `"bookable": true` on anything that should show "Request to book" instead of "I'm interested." |
| Change the **spaces outside groups can rent** | `data/rentals.json` | The spaces, what each is good for, and the house rules. Leave a `rate` as `""` and the app shows "Ask about rates" — the office quotes and invoices; the app never takes a payment. |
| Add or change an **event** | `data/events.json` | Future events rise to the top and past ones archive themselves. Or draft in **Admin → Events** and download the merged file. If Pages deploys via the workflow, `events.ics` regenerates automatically; in deploy-from-branch mode, also run `node scripts/build-ics.js` and commit the refreshed `events.ics` alongside your change. |
| Post **news** | `data/news.json` | Anything older than 18 months hides itself. |
| Change **giving methods** | `data/giving.json` | Handles/links mirror the church's real accounts; the app only links out, never processes money. |
| Change **about / staff / anniversary** | `data/about.json` | Staff photos live in `assets/media/`. |
| Feature **recent sermons** | `data/sermons.json` | Links out to the site's sermon pages / Facebook Live. |
| Edit the **visitor FAQ** | `data/faq.json` | Mirrored verbatim from the site's own FAQ. |
| Change the **community-impact story** | `data/impact.json` | Every item should carry its `links` (sources). Don't add a claim you can't cite, and don't attach a photo to an event unless it actually documents that event. |
| Add or swap **photos** | `assets/media/` | All 60 images from shilohchurchbpt.org live here; cached on first view, not at install. |
| Change **backend mode / webhook / staff passcodes** | `data/config.json` | See `docs/BACKEND.md` for going live with Supabase + automations, and "Who can do what" below for the two passcodes. |
| Replace the **app icon / logo** | `assets/icons/` | The current icon is a stained-glass-window mark drawn in the blues of the church's own logo (see `assets/icons/source.svg`) — a crisp stand-in until the church's real vector art is available. To change it, edit the SVG and regenerate the five PNG sizes; icons are fetched statically, so this is the one branding piece that isn't just a JSON edit. |
| Review **visitor cards / RSVPs / prayer requests / reservations / rental requests** | `/admin.html` | Demo passcode is in `data/config.json`. |
| **Re-skin this whole app for another church** | Fork the repo, then edit `data/theme.json`, `data/church.json`, `data/ministries.json`, and `assets/icons/` | That's the entire rebranding process — no other file should need church-specific edits. If you find yourself editing `index.html` or `admin.html` to change something church-specific, something drifted from this convention; fix the data file instead so future template updates still merge cleanly. |

**The one rule:** keep JSON valid — a missing comma stops that file from loading.
Check any edit at jsonlint.com if unsure, or edit through the Admin panel where
possible.

## Who can do what — staff roles

The back office (`admin.html` and the Go Live studio) has two sign-ins, two
tiers:

| Role | Signs in with | What it opens |
| --- | --- | --- |
| **Editor** | `editorPasscode` (`shilohmedia2026` until you change it) | The public face of the church: events, announcements, the ministry catalog, facility reservations, space rentals, the live broadcast studio, and the assistant. |
| **Admin** | `adminPasscode` (`shiloh2026` until you change it) | Everything the editor has, plus everything people-sensitive: visitor cards, member profiles, prayer requests at the team and pastor tiers, volunteer safety status, settings, automations, and the Building screen (access passes, door codes, locks, cameras). |

The line that matters: **pastoral data is the tightest tier.** An editor never
sees team- or pastor-visibility prayer requests, and never sees visitor-card
contact details. Give the media volunteer the editor passcode and they can run
Sunday without ever holding what people trusted only the pastor with.

Both passcodes live in `data/config.json`. Two things to hold in mind:

- They are **courtesy locks** — checked in the browser, readable by anyone who
  opens the file — until `"mode": "supabase"` is on, at which point the
  `staff` table plus Row Level Security enforce the same two tiers for real
  (see `docs/BACKEND.md`).
- **Change both** before handing out any links. The defaults above are in a
  public repo.

## Renting the building

The flow, end to end: an outside group requests a space on the app's **Rent**
screen → the office approves or declines it in **Admin → Rentals** (the app
flags same-day time overlaps against both member reservations and other
rentals) → approving creates a building-access pass for the booked window →
the guest finds their booking and its pass in the app under their
`SHILOH-XXXX` booking code. Rates are whatever the office quotes and
invoices — the app never takes a payment.

Who does what: **editors** handle rental requests like any other queue. The
**Building** screen — access passes, door codes, locks, cameras — is
**admin-only**. Passes work today with no hardware at all (hand the guest
their code, or a person at the door checks the list); wiring them to real
locks and cameras is `docs/ACCESS-SETUP.md`.
