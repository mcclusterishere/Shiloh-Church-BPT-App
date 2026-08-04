# The media desk — one service, everywhere

The Media pane in the back office (**Admin → Media**) is a composer, not a
poster. One box for the announcement, checkboxes for where it should go, one
button — and the app hands the finished post to an automation that does the
actual publishing. Same for press releases: compose once, send to the whole
local press list. This document is the honest map of everything behind that
button: what each platform actually allows in August 2026, what each one
costs, and where the real work happens.

Every platform claim below was verified against live sources in **August
2026** and carries its link. These rules change often — especially X and
TikTok — so re-check anything load-bearing on setup day.

---

## 1. The shape — three layers, honestly divided

**The APP composes.** Admin → Media is a form. It writes to this device's log
and POSTs one JSON object to the church's `webhookUrl`
(`data/config.json`). That is the app's entire job, and the UI says so: the
success message reads "handed to your automation," never "posted."

**The AUTOMATION posts.** Whatever catches that webhook — n8n on the church's
own box, Zapier, Make, or an Ayrshare-style unified API — holds the platform
credentials and does the publishing. Section 3 compares the routes.

**The STREAMING BOX fans out live.** Multi-platform *live video* is a
different mechanism entirely: the appliance's MediaMTX + ffmpeg tee
(`scripts/appliance/mediamtx.yml`), one RTMP push per destination. Section 2
is that story.

One rule holds the three layers apart: **no platform secret ever touches the
app or its data files.** Every `data/*.json` file is public by construction —
so `data/media.json` holds platform *names* and press-contact *entries*, the
automation holds API tokens, and the streaming box holds stream keys. A
leaked repo leaks nothing.

### What the webhook actually carries

`js/store.js` wraps every event in the same envelope it uses for visitor
cards and RSVPs (`docs/BACKEND.md`):

```json
{
  "source": "shiloh-church-app",
  "type": "media-post",
  "sentAt": "2026-08-04T15:00:00.000Z",
  "data": { "...": "see below" }
}
```

**`type: "media-post"`** — the social composer. `data` is exactly:

```json
{
  "id": "POST-MDQ3X2K1-A7F2",
  "at": "2026-08-04T15:00:00.000Z",
  "kind": "post",
  "text": "Revival service this Friday at 7 — all are welcome.",
  "link": "https://app.shilohchurchbpt.org/#events",
  "platforms": ["facebook", "instagram", "email"]
}
```

`platforms` holds the ids the sender ticked, from the `platforms` list in
`data/media.json` — the automation branches on them. The app does no
per-platform formatting; that is deliberately the automation's job (character
limits, image handling, hashtags all live in one editable place).

**`type: "press-release"`** — the press composer. `data` is exactly:

```json
{
  "id": "PRESS-MDQ3X2K1-B9C4",
  "at": "2026-08-04T15:00:00.000Z",
  "kind": "press",
  "headline": "Shiloh Baptist Church Unveils Community Solar Partnership",
  "dateline": "BRIDGEPORT, Conn., August 4, 2026",
  "body": "…the full release text…",
  "quote": "…optional pull quote…",
  "contactName": "Church office",
  "contactPhone": "(203) 000-0000",
  "recipients": ["newsroom@example.com", "assignmentdesk@example.com"]
}
```

`recipients` is the real email list from `data/media.json` →
`pressContacts` — the automation's only job here is to format and send the
email.

### The `sent: true / false` contract

After the POST, `store.js` stamps the record with `sent` and keeps it in this
device's log (localStorage, last 50 entries, **Admin → Media → log**). Read
it precisely:

- **`sent: true`** means *the webhook URL answered*. Not "posted" — the
  automation can still fail downstream (an expired token, a platform
  rejection). The place to confirm a post actually landed is the
  automation's own run history (n8n's execution list, Zapier's Zap history),
  or the platform itself.
- **`sent: false`** means the hand-off didn't happen: `webhookUrl` is blank,
  the URL is unreachable, or the browser blocked the request. The post is
  still saved to the log; fix the URL and send it again. Because the app
  calls from a browser, the endpoint must accept a cross-origin POST — n8n's
  Webhook node has an "Allowed Origins (CORS)" setting for exactly this, and
  Zapier/Make catch-hooks accept cross-origin posts out of the box.

The UI honors this contract everywhere: it claims a hand-off, never a
publication. Any change that makes the app say "posted" is a lie waiting for
its first expired token.

---

## 2. Go live everywhere — the per-platform truth

The box already fans the Sunday broadcast out to YouTube + Facebook
(`scripts/appliance/mediamtx.yml`, and the whole Route D story in
`docs/GO-LIVE.md`). Adding a destination is *mechanically* one more segment
in the ffmpeg tee — but each platform decides whether it will take that
stream, and they are not equally welcoming. The table, verified August 2026:

| Platform | Verdict | The plain truth |
| --- | --- | --- |
| **YouTube** | **Works with a config line** | Free RTMP ingest (`rtmp://a.rtmp.youtube.com/live2/KEY`), persistent key from the Live Control Room. One first-time gate: the channel must be verified, and ["enabling a live stream for the first time may take up to 24 hours"](https://support.google.com/youtube/answer/2907883) ([requirements](https://support.google.com/youtube/answer/2474026): verified channel, no live restrictions in 90 days). Enable it the week before, not Sunday morning. |
| **Facebook page** | **Works with a config line** | Free RTMPS ingest (`rtmps://live-api-s.facebook.com:443/rtmp/KEY`) from the page's Live Producer; turn on ["Persistent stream key" under Advanced Settings](https://www.vmix.com/knowledgebase/article.aspx/357/streaming-to-facebook-live-using-facebook-stream-key-or-custom-rtmp) so the key survives between Sundays. Already in the shipped config. |
| **Twitch** | **Works with a config line** | Free RTMP ingest (`rtmp://live.twitch.tv/app/KEY` — [official broadcast docs](https://dev.twitch.tv/docs/video-broadcast/)); Twitch [requires two-factor auth on the account before it hands over the stream key](https://stream-rise.com/blog/twitch-stream-key-faq). A gaming-first audience, but the ingest doesn't care what a church streams. |
| **Kick** | **Works with a config line** | Free RTMP ingest (`rtmp://live.kick.com/app` + key from the [Creator Dashboard](https://help.kick.com/en/articles/7066931-how-to-stream-on-kick-com)), no follower gate found. |
| **Rumble** | **Works, one small gate** | RTMP with a static "set and forget" key via [Rumble Studio's Direct RTMP](https://rumble.support/help/how-to-use-rumble-studios-direct-rtmp-feature); the account must first clear one of: [phone verification, 5 followers, or a premium subscription](https://onestream.live/blog/how-to-start-rumble-streaming/). Phone verification is the free five-minute path. |
| **X (Twitter)** | **Gated: paid subscription** | RTMP ingest exists — but only through Media Studio Producer, and [Producer requires a paid X Premium/Premium+ subscription on the account](https://streamlabs.com/content-hub/post/how-to-live-stream-to-twitter) (X moved streaming behind Premium in July 2024; free/Basic accounts get no stream key — [Socialive's setup guide](https://support.socialive.us/support/solutions/articles/67000686130-livestream-to-x-twitter-media-studio-via-rtmp) and [X's own Producer page](https://help.x.com/en/using-x/how-to-use-live-producer)). If the church pays for Premium anyway, it's one more tee line; don't buy it just for this. |
| **Instagram** | **Gated — and doesn't fit the tee** | This one changed: Instagram Live Producer now *officially* hands professional (business/creator) accounts an RTMP URL — but the [stream key is minted per-session, Lives cap at about an hour, and the product expects vertical 9:16](https://streamyard.com/blog/streaming-software-for-instagram-live) (verified January 2026). A per-session key means no set-and-forget config line, and the box sends the sanctuary camera landscape. Third-party tools that fake the mobile app to get around this are ToS-gray — plainly: don't risk the church's account on them. Treat Instagram as a *clips* platform (Section 3), not a simulcast target. |
| **TikTok LIVE** | **Gated: follower threshold + selective key access** | Going LIVE at all requires an account 18+ with [about 1,000 followers](https://www.demandsage.com/followers-needed-for-tiktok-live/) (the standard gate as of 2026). RTMP stream keys are a second, separate gate: [not self-serve](https://www.hollyland.com/blog/topics/get-your-tiktok-stream-key) — TikTok grants them selectively through its own desktop app (TikTok LIVE Studio) and [creator networks/agencies](https://www.toktutorials.com/post/how-to-get-a-tiktok-live-stream-key-in-2026-free-and-use-it-in-obs-streamlabs-or-meld-studio). Verify at setup; this one changes often. |
| **VK, Bilibili, Trovo, anywhere** | **Works where the account does** | RTMP is RTMP worldwide. Any platform that shows the church an ingest URL and a stream key takes the identical tee segment — nothing about the box is US-only. Each platform keeps its own account/eligibility gates; check its live dashboard at setup. |

### The config mechanics — extending the tee

Every destination is one more `|[f=flv:onfail=ignore]...` segment in the
`runOnReady` line of `scripts/appliance/mediamtx.yml` (the file carries this
same example in its comments). Four destinations look like:

```yaml
paths:
  live:
    runOnReady: >
      ffmpeg -rtsp_transport tcp -i rtsp://localhost:$RTSP_PORT/$MTX_PATH
      -c:v copy -c:a aac -b:a 128k -map 0:v -map 0:a -f tee
      "[f=flv:onfail=ignore]rtmp://a.rtmp.youtube.com/live2/YT_KEY|[f=flv:onfail=ignore]rtmps://live-api-s.facebook.com:443/rtmp/FB_KEY|[f=flv:onfail=ignore]rtmp://live.twitch.tv/app/TWITCH_KEY|[f=flv:onfail=ignore]rtmp://live.kick.com/app/KICK_KEY"
    runOnReadyRestart: yes
```

Same conventions as the rest of the file: ALL-CAPS placeholders, real keys
pasted **on the box only**, `onfail=ignore` so one platform rejecting its key
doesn't take down the others.

**The bandwidth math, honestly.** The tee re-encodes nothing — it duplicates
the stream, so every destination is one full copy of the broadcast going up
the church's internet connection. Four destinations of a ~4.5 Mbps broadcast
is **~18 Mbps of steady upload; budget 20+ for headroom**. Run a real speed
test on the church's actual connection *before* adding lines, and watch the
first multi-destination stream end to end. (The phone→box leg rides the
church's Wi-Fi and costs no internet upload.)

**If upload is thin:** send ONE copy to a Restream-style service and let it
fan out from their servers — one tee segment pointed at Restream's RTMP
ingest, their bandwidth, the plans already priced in `docs/GO-LIVE.md`
("The honest pricing fork"). The box still owns ingest, recording, and the
app's own player either way.

After the broadcast lands somewhere new, list it by name in
`data/media.json` → `liveDestinations` so the Media desk displays it. Names
only — the keys stay on the box.

---

## 3. Post everywhere — the three automation routes

Live fan-out was the easy half: RTMP is one open protocol. *Posting* has no
such protocol — every platform has its own API, its own approval process,
and its own idea of who may automate. Three honest routes, in ascending
order of setup work:

### Route A — a unified posting API (Ayrshare-style)

One vendor holds all the platform approvals; the automation makes one HTTP
call and they fan it out. The catch is the price shape:
[Ayrshare's entry plan is **$149/month**](https://www.ayrshare.com/pricing/)
(Premium: 1 social profile, up to 13 networks; 28-day trial, **no free
tier**). That's real money for a small church — this route earns its cost
only at real posting volume or when someone else's TikTok/Meta app approvals
are worth paying for.

### Route B — Zapier / Make in the middle

The webhook lands in a catch-hook; the platform connections are theirs, so
nobody at the church ever opens a developer portal.

- [Zapier's free plan](https://help.zapier.com/hc/en-us/articles/32337438839565-What-s-included-in-Zapier-s-Free-plan):
  100 tasks/month, Zaps capped at **two steps** (one trigger, one action) —
  enough for "webhook → one email," too tight for branching on `type` and
  `platforms`. Paid plans start around $20/month.
- [Make's free plan](https://www.aiapps.com/blog/zapier-vs-make-free-plans-compared/):
  ~1,000 operations/month **with multi-step scenarios and branching** — the
  free plan that actually fits this webhook's shape.
- **Buffer** is the useful sidecar either way: its
  [free plan connects 3 channels](https://buffer.com/pricing) (paid from
  $5/channel/month billed yearly), and "webhook → Buffer queue" turns one
  automation step into posts on several platforms with human review in
  Buffer's UI before anything publishes.

### Route C — n8n on the church's own box ($0 software, real setup work)

[n8n's self-hosted Community Edition is free](https://docs.n8n.io/deploy/host-n8n/community-edition-features)
(fair-code Sustainable Use License — free for the church's own use, not for
reselling as a service). It rides the appliance exactly like the gateway and
the broadcast relay do — same launchd pattern, same Cloudflare Tunnel, one
more hostname (`docs/APPLIANCE-SETUP.md`). The webhook URL becomes
`https://automations.yourchurchdomain.org/webhook/shiloh` and the church
owns the whole pipeline.

The honest cost of Route C is that **each platform needs the church's own
developer credentials**, and they are not equally painful:

| Platform | What it honestly takes (Aug 2026) |
| --- | --- |
| **Facebook page + Instagram** | One free [Meta developer app](https://developers.facebook.com/docs/instagram-platform/): OAuth to the church's page, `pages_manage_posts` + `instagram_content_publish` permissions, Instagram must be a business/creator account linked to the Facebook page. Long-lived tokens last ~60 days unless you set up a system-user token. The best-documented path of the lot; Meta app review applies for live-mode permissions. |
| **X (Twitter)** | The API moved to [pay-per-use as the default in February 2026](https://postproxy.dev/blog/x-api-pricing-2026/): $0.015 per post created ($0.20 if it contains a link), no monthly minimum — the free tier is gone and the old $200/mo Basic tier is closed to new signups. A church posting 30 times a month: under a dollar. The account posting must exist and the app registration is real paperwork, but the price is no longer the obstacle it was. |
| **TikTok** | A [Content Posting API exists](https://developers.tiktok.com/doc/content-posting-api-reference-direct-post), but unaudited apps are restricted: [posts go up private-only, max 5 users per 24h, until TikTok audits the app](https://docs.mixpost.app/services/social/tik-tok/direct-post-audit/) against its UX rules. Honest verdict for one church: not worth the audit — post TikToks by hand, or through a Route A/B vendor that already passed it. |
| **YouTube** | The [Data API is free](https://www.getphyllo.com/post/is-the-youtube-api-free-costs-limits-iv) (10,000 quota units/day — video uploads got dramatically cheaper in December 2025). But note what `data/media.json` actually lists: *community posts* — and [there is **no official API** for creating community posts](https://github.com/gitroomhq/postiz-app/issues/537) (confirmed June 2026). Those stay manual in YouTube Studio; the API route is for uploading clips. |
| **LinkedIn** | Posting to an organization page requires the [Community Management API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview): a [developer-portal application, verified by the page's super admin, open to registered entities](https://singhamandeep.com/linkedin-community-management-api-access/) (an incorporated church qualifies). Free, but a real approval process with a development tier before full access. |
| **Nextdoor** | [No self-serve posting API.](https://developer.nextdoor.com/docs/overview) The partner APIs (ads, approved publishers, public-agency posting) sit behind application approval aimed at agencies and platforms, not individual organizations. For a church: post by hand, honestly. |
| **Email** | The easy one: [Resend's free tier is 3,000 emails/month (100/day)](https://resend.com/pricing), $20/month for 50,000 — which covers both the press desk and a small newsletter. Any SMTP node works too. |

### The recommendation ladder for a small church

1. **Today, $0:** point `webhookUrl` at a Make free-tier scenario (or a
   Zapier two-step Zap) that emails the press list via Resend's free tier,
   and run social posting by hand through Buffer's free plan. The Media desk
   already earns its keep as the one place staff compose and the log of what
   went out.
2. **$0–20/month:** grow the Make/Zapier scenario to post directly —
   Buffer's queue or Meta's own connection — so ticking "Facebook" in
   Admin → Media really publishes to Facebook. This is the sweet spot until
   volume or cost says otherwise.
3. **When the box lands:** move the same recipe into n8n on the appliance —
   $0/month forever, the church holds its own tokens. Graduate platform by
   platform: Meta first (free, best documented), X when someone wants it
   (pennies, pay-per-use), and leave TikTok/Nextdoor manual without
   apology — the table above is why.

---

## 4. The press desk — what a wire costs, and what beats it

The truth about the real wire services, priced August 2026:

- **PR Newswire** requires a membership (commonly cited around
  [$195/year](https://newswirejet.com/pr-newswire-pricing/)) *plus*
  per-release fees — roughly
  [$350 for a local release, ~$805 for national distribution of the first 400 words, ~$275 per additional 100 words](https://www.prezly.com/academy/pr-newswire-pricing)
  — and real invoices with add-ons commonly land
  [$1,500–3,000 per release](https://pressranger.com/blog/how-much-does-a-press-release-cost).
- **Business Wire** publishes no prices at all —
  [quote-based, membership required](https://pressranger.com/blog/how-much-does-a-press-release-cost).
- Neither offers a simple self-serve API a small organization would
  realistically wire a webhook into.
- **Budget wires exist:** [EIN Presswire](https://www.einpresswire.com/pricing)
  sells a single release for $149 (bulk packs bring it to ~$67–83/release).
  Useful for the occasional big announcement that genuinely needs to appear
  in aggregators; not a channel for weekly church news.

**And the honest advice: for a Bridgeport church, a maintained local press
list beats a $400 wire post.** The outlets that would actually cover a
Shiloh story — the Connecticut Post, News 12 Connecticut, WTNH, WSHU,
Bridgeport's local blogs and community calendars — take email to their
newsroom/assignment desks, and a well-formatted release with a real phone
contact and a usable photo gets read there. Those names are *examples to
fill into* `data/media.json` → `pressContacts` — the file ships with a
CHANGE-ME placeholder, not pre-filled addresses, because desk emails rot and
the office should own the list it actually uses.

That is exactly the pipeline the Media desk ships: the press composer
formats the release (headline, dateline, body, quote, contact), the
`press-release` webhook carries it with the real recipient list, and a free
email node sends it. Total cost: $0 and the office's time to keep the list
current — which is the part that was always going to matter anyway.

---

## 5. The hookup — one recipe, two flavors

`webhookUrl` lives in `data/config.json`. Set it, commit, then prove the
pipe with **Admin → Automations → Send a test event** (a `type: "test"`
envelope) before trusting it with a Sunday announcement. Remember the same
URL also receives visitor cards, RSVPs, and the rest (`docs/BACKEND.md`) —
every recipe below needs a default branch that ignores or routes what it
doesn't handle.

### n8n (on the box or anywhere)

```text
[Webhook node]  POST /webhook/shiloh, respond immediately (200)
      |
[Switch node]   on {{$json.body.type}}
      |
      +-- "media-post" ----> [Switch/IF on data.platforms contains…]
      |                        +-- facebook  -> [Facebook Graph API node: page feed]
      |                        +-- instagram -> [HTTP node: IG content publish]
      |                        +-- x         -> [X node: create post]
      |                        +-- email     -> [Resend/SMTP node: newsletter list]
      |
      +-- "press-release" -> [Split data.recipients] -> [Resend/SMTP node:
      |                        subject = data.headline, body = dateline +
      |                        body + quote + contact block]
      |
      +-- default ---------> [existing recipes: visitor-card, rsvp, … or no-op]
```

Set the Webhook node to respond immediately with 200 and do the posting
after — the app's `sent: true` only means "the URL answered," and a slow
platform API shouldn't stall the composer. Set the node's Allowed Origins
(CORS) so the browser's cross-origin POST is accepted. The per-platform
formatting (trim for X, hashtag block for Instagram) lives in small Function
nodes here — one editable place, exactly as the app intends.

### Zapier / Make

Same shape, their vocabulary. Make (free tier handles this): **Custom
webhook → Router** with filters on `type` and `data.platforms[]` → Facebook
Pages / Buffer / email modules, plus a fallback route. Zapier: **Webhooks by
Zapier (Catch Hook)** → filter/paths on `type` → action; on the free plan a
Zap is trigger + one action, so either run one Zap per event type or take
the ~$20/month plan for multi-step paths.

Either way, the contract from Section 1 holds: the app hands off and logs;
the automation's run history is the record of what actually posted; and
nothing in this repo ever holds a platform secret.
