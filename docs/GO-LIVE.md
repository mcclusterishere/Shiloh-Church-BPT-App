# Go-live runbook

Everything needed to take the app live, hook up live streaming, and switch on the
AI assistant — in the order to do it. Written so it can be followed tonight.

---

## 1. Put the site live (10 minutes)

1. **Merge the branch.** Open a pull request from
   `claude/shiloh-church-bpt-design-x9lnin` into `main` on GitHub and merge it
   (or merge directly from the branch page).
2. **Enable Pages.** Repo **Settings → Pages → Source: GitHub Actions**. The
   next push to `main` (the merge itself) runs `deploy-pages.yml`, builds
   `events.ics`, and publishes the site.
3. The site is now at `https://mcclusterishere.github.io/Shiloh-Church-BPT-App/`.
4. **Custom domain (recommended before the presentation).** In the same Pages
   settings, add e.g. `app.shilohchurchbpt.org`, then at the DNS provider for
   shilohchurchbpt.org add a CNAME record: `app` → `mcclusterishere.github.io`.
   HTTPS provisions automatically in a few minutes. A subdomain like `app.` does
   NOT touch the existing website — both live side by side.
5. On a phone, open the link → Share → **Add to Home Screen**. That's the app.

**Demo passcode for admin.html** is in `data/config.json` (`shiloh2026`) — change
it before handing the link around, and remember it is a courtesy lock until
Supabase mode is on (docs/BACKEND.md).

---

## 2. Live streaming from the church's own site

**How the pieces fit:** the camera/encoder in the sanctuary (OBS, a hardware
encoder, or even the Restream mobile app) pushes ONE stream over RTMP to
Restream. Restream fans it out to destinations. The app's **Watch** screen has a
built-in live player that accepts any iframe embed URL — so whichever route you
pick below, going live on the church's own site is one line in `data/live.json`.

### The honest pricing fork

| Route | What members see | Cost |
| --- | --- | --- |
| **A. Restream Standard/Pro + YouTube embed** | The stream plays inside the app's Watch screen (YouTube player embedded in our design; viewers never leave the site) and also reaches Facebook simultaneously | ~$19–49/month |
| **B. Restream Business "website player"** | Restream's own player embedded in the Watch screen — no YouTube branding anywhere | **$199/month (annual) / $239 monthly** |
| **C. Cloudflare Stream Live** | Cloudflare's player embedded in Watch — no platform branding, pay-per-use | ~$5 per 1,000 minutes watched (≈$50–60/mo at ~30 weekly viewers) |

Recommendation: **start with A.** Same premium experience on the site for a
tenth of the cost; the Business embed player (B) is a later upgrade if the
YouTube wordmark in the player corner ever bothers anyone. Route C is the
middle path if YouTube must be avoided entirely without paying $199.

### Route A setup (once, ~30 minutes)

1. Create/upgrade the Restream account (restream.io), add **YouTube** and
   **Facebook (SHILOHBPT page)** as destinations.
2. In the encoder (OBS etc.): Settings → Stream → Service: Restream.io — it
   fills the RTMP server and stream key automatically.
3. Create the church's YouTube channel if it doesn't exist; schedule a
   **recurring live event**, copy its embed URL:
   `https://www.youtube.com/embed/live_stream?channel=CHANNEL_ID&autoplay=1`
4. In `data/live.json`, set:
   ```json
   "provider": "youtube",
   "embedUrl": "https://www.youtube.com/embed/live_stream?channel=CHANNEL_ID&autoplay=1"
   ```
   Commit and push. Done — the Watch screen now carries the live player.

### Route B setup (if/when upgraded)

Restream dashboard → **Add channel → Embed Player** → copy the iframe `src`
into `data/live.json` as `embedUrl`. Nothing else changes.

### When the player appears

`data/live.json` controls it:
- `"mode": "schedule"` (current setting) — the player shows Sundays
  **8:45–11:00 AM Eastern** automatically, with a LIVE banner on Home. Outside
  the window, Watch shows the "Sundays at 9" card instead.
- `"mode": "manual"` + `"liveNow": true` — for special services, flip it on
  from any phone via GitHub's web editor; push turns it live within a minute.
- `"mode": "always"` / `"off"` — what they say.

The player shows the provider's own "offline" state if the window is open but
nobody is streaming — the app itself never fakes a live signal.

---

## 3. Gemini / Google Workspace — what to buy, and what it does

Two different products get called "Gemini," and the church likely wants both:

**1. Google Workspace (Business Standard, ~$14/user/month annual).** This is
the "suite": church email at @shilohchurchbpt.org, Docs, Drive, Meet — with
Gemini built into all of them for the staff. This is a purchase + admin setup,
no code involved, and it is almost certainly the "$20-something a month" plan.
**A Workspace subscription does NOT include API access** — it cannot power the
app's Assistant by itself.

**2. The Gemini API (Google AI Studio, aistudio.google.com).** This is what
wires Gemini INTO the app's admin Assistant. It's a separate key, with a free
tier (Flash models) that comfortably covers church-office volume; paid usage
at this scale would be pennies. The key can never live in the site's code —
anyone could read it — so it sits in a tiny server function this repo already
ships, ready to deploy:

```sh
# once, with the Supabase CLI (free tier project is fine):
supabase functions deploy assistant-gemini --no-verify-jwt
supabase secrets set GEMINI_API_KEY=<key from aistudio.google.com> \
                     ASSISTANT_TOKEN=<make up a long random string>
```

Then in `data/config.json`:
```json
"applianceUrl":   "https://<project-ref>.supabase.co/functions/v1/assistant-gemini",
"applianceToken": "<the same ASSISTANT_TOKEN>"
```

Push, and **Admin → Assistant** is live, powered by Gemini. Because the
function speaks the same contract as the Mac-mini appliance gateway
(docs/APPLIANCE-SETUP.md), the church can later swap the cloud brain for the
box in the building by changing that one URL — nothing else in the app moves.

The assistant keeps the same hard rules either way: it drafts and answers for
signed-in staff; it has no access to member, giving, or prayer data; it sends
nothing on its own.

---

## 4. Tonight's pre-flight checklist

- [ ] Branch merged, Pages enabled, site loads over HTTPS
- [ ] Add to Home Screen tested on one iPhone and one Android
- [ ] `data/config.json`: `adminPasscode` changed from the default
- [ ] Sunday events in `data/events.json` extend past the current date
- [ ] Real service-time question settled (site says both 8:15 and 8:30 — the
      app currently says 8:15; confirm with the office and fix both places)
- [ ] Live streaming: route chosen, `data/live.json` filled in, one test stream
      run before Sunday
- [ ] Workspace purchased for staff; AI Studio key created; edge function
      deployed; Assistant answering
- [ ] The one thing the app can't fix: the church website's "Our History"
      section is still lorem ipsum — worth fixing on the site too
