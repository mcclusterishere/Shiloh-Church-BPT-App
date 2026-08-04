# Building access — passes today, real locks when they arrive

The Rent screen makes a promise: an approved guest can get into the building
for the hours they booked. This is the guide to how that promise is kept —
with zero hardware today, and with real smart locks and cameras whenever the
church decides to buy them, without the app changing in between.

## The model: a pass, not a lock brand

The app manages **access passes**. A pass says four things: **who** (a name),
**which doors** (the list in `data/access.json`), **what time window** (a
date, a start, an end), and **a door code**. Approving a rental in **Admin →
Rentals** creates the pass for that booking; **Admin → Building** lists every
pass, and revoking one is a single tap.

The pass is the product. Everything below — the bridge, the shopping options,
the checklist — exists only to make the same pass do more, never to change
what a pass is.

## Zero hardware: what "works today" honestly means

With nothing bought and nothing installed, a pass still does its job:

- The app generates a readable six-digit door code for each pass. The office
  hands it to the guest however it likes — text, email, or the webhook
  automation (`docs/BACKEND.md`) firing an `access-grant` event that emails it
  automatically.
- "Which doors" and "what window" are printed instructions and, if the church
  wants one, a person at the door with the pass list open — exactly how the
  building is let in and out of today, just written down in one place instead
  of on sticky notes.
- Revoking a pass is one tap; the list updates immediately.

Two honesty notes about this phase, because they're real:

1. **Those codes are demo-grade by design.** They're generated in the browser
   and enforce nothing by themselves — a human checks them. That's fine when a
   person is the lock. The moment a bridge is connected (below), the lock
   system's own scheduled code takes over and the browser-generated one
   retires.
2. **The pass list lives on the admin device.** Passes are stored in the
   admin's own browser (and fired to the webhook), not in the shared database
   yet — the `access_grants` table in `docs/supabase-setup.sql` is created
   ready, admin-only, for when pass sync ships. Until then, run passes from
   one admin device and let the webhook carry copies out.

Passes are **admin-only**, per the Church OS tiered-access rule. An editor
can approve rentals all day without ever seeing a door code; the Building
screen belongs to the admin tier alone.

## The bridge: six routes between the app and any lock system

A **bridge** is a small HTTP service that speaks for whatever hardware the
church ends up owning. The app doesn't know or care what's behind it — Seam,
UniFi, something else entirely. It only speaks this contract (this is
exactly what `js/store.js` sends and expects, nothing more):

Every request carries `Authorization: Bearer <token>` and JSON bodies.

| Route | What the app expects |
| --- | --- |
| `GET /doors` | `{"doors":[{"id":"front","name":"Front doors (Broad Street)","locked":true}]}` — `locked` optional. If this call fails, the app quietly falls back to the door names in `data/access.json`, so the admin still sees the doors, just without live state. |
| `GET /cameras` | `{"cameras":[{"id":"lot","name":"Parking lot","snapshotUrl":"…","streamUrl":"…"}]}` — both URL fields optional (a still, a live view). |
| `POST /doors/:id/lock` and `POST /doors/:id/unlock` | Any 2xx means done. Remote lock/unlock only exists once a bridge does — without one the app never pretends it can. |
| `POST /grants` | Body is the whole pass — `name`, `doorIds`, `date`, `startTime`, `endTime`, `doorCode`, plus the app's own `id`, `rentalId`, `status`, `createdAt`. Reply is optionally `{"id":"…","code":"…"}`: if `code` comes back, **the lock system's code wins** and replaces the app's demo-grade one; `id` (the bridge's own id for the grant) is remembered for revocation. A minimal bridge can accept the app's `doorCode` as-is; a real one asks the lock to schedule its own and returns it. |
| `DELETE /grants/:id` | Revoke. The `:id` here is the **bridge's** id — the one it returned from `POST /grants` — not the app's pass id. |

Failure is handled honestly on the app side: if `POST /grants` fails, the
pass is still saved locally with a sync-error flag the UI shows, so the
office knows that code is not on any lock yet. Revoking marks the pass
revoked in the app first, then tries the `DELETE` and shrugs off failure —
if the bridge was down, check the lock system directly.

**Where the URL and token live:** entered once per admin device, in **Admin →
Building**, stored in that device's localStorage — the same pattern as the
Go Live studio's publish password. They are **never** put in a data file:
every `data/*.json` file is served to every visitor, which is also why
`data/access.json` holds only door names and ids.

## What to buy, honestly

No prices here on purpose — they change, and this document shouldn't lie to
a budget meeting. Check the vendors' sites when the decision is real.

### Route 1: Seam — one API, many lock brands

[Seam](https://seam.co) is an API company whose whole product is being the
one integration layer across many smart-lock brands — August, Yale, Schlage
and others — including **scheduled access codes**, which is precisely what a
pass is. This is the fastest route to "integrates with whatever lock we end
up buying": the church buys consumer smart locks it likes, connects them to
Seam, and a small adapter service translates the six routes above into Seam
API calls. The Mac mini appliance can host that adapter with the same
LaunchAgent pattern as the assistant gateway (`docs/APPLIANCE-SETUP.md`,
section 3). Seam is a paid service — check current pricing and the supported
device list on their site before buying locks, not after.

### Route 2: Ubiquiti UniFi Access + Protect — own the hardware

The own-it-outright route: UniFi Access door controllers and readers for the
doors, UniFi Protect cameras for the eyes, all managed from a controller on
the church's own network with a local API. Ubiquiti's pattern, as of this
writing, is buy-the-hardware with no monthly per-door fees — verify that on
their current terms before budgeting, but it's the reason this route exists
here. Same adapter approach: a small service on the Mac mini maps the six
routes onto the local UniFi APIs. More install work than Route 1 (real
door hardware, possibly an electrician for strikes/maglocks), and in
exchange nothing recurring and nothing leaving the building.

### The fingerprint truth

Said plainly, because it shapes the whole design: **most fingerprint locks
enroll fingerprints at the door, not remotely.** Someone stands there,
presses their finger to the reader a few times, and the print lives in that
lock. That's perfectly good for staff — enroll once, done — but it cannot be
issued to next month's guest congregation from the church office, and it
cannot expire on a schedule.

The credential every system — consumer smart locks, Seam, UniFi, the
commercial panels — can be given **remotely and on a schedule** is a door
code. That is why passes center on codes: a time-boxed code is the guest's
key, exactly how Airbnb hosts have run smart locks for years. Fingerprints,
where the hardware supports them, are a staff convenience layered on top;
they are never the guest story.

## Security notes

- **HTTPS, always.** The app is served over HTTPS and a secure page cannot
  call a plain `http://` bridge — the browser blocks it before it leaves the
  device. The appliance's Cloudflare Tunnel already solves this for the
  assistant gateway and the broadcast relay; the bridge rides the same
  tunnel — one more hostname in `~/.cloudflared/config.yml` pointing at the
  adapter's local port (`docs/APPLIANCE-SETUP.md`, section 4).
- **One long random token,** set on the bridge, typed into each admin device
  that should control doors. Rotate it by changing it on the box and
  re-entering it — same habit as the appliance token.
- **Revoke is one tap** and works in every phase: hardware-free it strikes
  the pass from the list the door-person checks; bridged, it also deletes
  the scheduled code from the lock.
- **Demo-grade codes are labeled as such above** — browser-generated until a
  bridge exists, replaced by the lock system's own code after.
- **The pass list is admin-only,** per the Church OS tiered-access rule, and
  `data/access.json` is public — so it carries names and ids only, never a
  bridge URL, never a token, never a code.

## When the box and the locks arrive

None of this is claimed as tested — the hardware doesn't exist yet. This is
the order to do things when the boxes show up, written down now so nobody
has to reconstruct it later.

1. **Get the locks working with their own vendor app first.** Seam route:
   install the locks, connect them in the vendor's app, then link them in
   Seam's console. UniFi route: adopt the Access controller and readers,
   confirm a door opens from the UniFi app. Don't touch the bridge until a
   door demonstrably obeys the vendor's own software.
2. **Stand up the adapter** speaking the six routes above, on the Mac mini,
   with the same LaunchAgent pattern as the gateway — its own label (say,
   `org.shiloh.access-bridge`), its own port, its own log files.
3. **Give it a token.** Long and random, and make the adapter refuse to
   start without one — copy the gateway's habit.
4. **Put it on the tunnel.** Add a hostname (say,
   `access.yourchurchdomain.org`) to `~/.cloudflared/config.yml`, route the
   DNS, restart the tunnel service.
5. **curl before browser.** `GET /doors` with the token should list real
   doors; without the token it should be refused.
6. **Connect one admin device.** Admin → Building → enter the URL and
   token. The doors list should go live.
7. **Issue yourself a test pass** — one door, a window later today. Confirm
   in the lock vendor's own app that the code was actually scheduled, and
   that the pass shows as synced in the app.
8. **Stand at the door.** Code works inside the window; try it before the
   window opens and confirm the lock refuses — the window is enforced by the
   lock, so verify the lock, not the app.
9. **Revoke the test pass** and confirm the code stops working.
10. **Cameras, if bought:** `GET /cameras` returns them and a snapshot loads
    on the Building screen.
11. Only after all of that: enter the bridge on the other admin devices and
    start attaching passes to real rentals.
