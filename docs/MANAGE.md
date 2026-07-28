# Running the app — the one-page guide

Everything on the site is data. Edit a file, commit, push to the branch this
deploys from — the site redeploys itself in about a minute. No code changes needed
for any of this.

| I want to… | Edit this | Notes |
| --- | --- | --- |
| Change the church **name, tagline, or colors** | `data/theme.json` | This is branding *only*. If you change a color here, also update `manifest.webmanifest`'s `theme_color`/`background_color` by hand — the browser fetches that file before any of the app's JavaScript runs, so it can't be re-themed live the way the rest of the app can. |
| Change the church's **address, phone, pastor, or service times** | `data/church.json` | Kept separate from branding on purpose. |
| Add or change a **ministry, small group, or bookable space** | `data/ministries.json` | Set `"bookable": true` on anything that should show "Request to book" instead of "I'm interested." |
| Add or change an **event** | `data/events.json` | Future events rise to the top and past ones archive themselves. Or draft in **Admin → Events** and download the merged file. Pushing regenerates `events.ics` automatically. |
| Post **news** | `data/news.json` | Anything older than 18 months hides itself. |
| Change **giving methods** | `data/giving.json` | Handles/links mirror the church's real accounts; the app only links out, never processes money. |
| Change **about / staff / anniversary** | `data/about.json` | Staff photos live in `assets/media/`. |
| Feature **recent sermons** | `data/sermons.json` | Links out to the site's sermon pages / Facebook Live. |
| Edit the **visitor FAQ** | `data/faq.json` | Mirrored verbatim from the site's own FAQ. |
| Add or swap **photos** | `assets/media/` | All 60 images from shilohchurchbpt.org live here; cached on first view, not at install. |
| Change **backend mode / webhook / admin passcode** | `data/config.json` | See `docs/BACKEND.md` for going live with Supabase + automations. |
| Replace the **app icon / logo** | `assets/icons/` | The current icon is a stained-glass-window mark drawn in the blues of the church's own logo (see `assets/icons/source.svg`) — a crisp stand-in until the church's real vector art is available. To change it, edit the SVG and regenerate the five PNG sizes; icons are fetched statically, so this is the one branding piece that isn't just a JSON edit. |
| Review **visitor cards / RSVPs / prayer requests / reservations** | `/admin.html` | Demo passcode is in `data/config.json`. |
| **Re-skin this whole app for another church** | Fork the repo, then edit `data/theme.json`, `data/church.json`, `data/ministries.json`, and `assets/icons/` | That's the entire rebranding process — no other file should need church-specific edits. If you find yourself editing `index.html` or `admin.html` to change something church-specific, something drifted from this convention; fix the data file instead so future template updates still merge cleanly. |

**The one rule:** keep JSON valid — a missing comma stops that file from loading.
Check any edit at jsonlint.com if unsure, or edit through the Admin panel where
possible.
