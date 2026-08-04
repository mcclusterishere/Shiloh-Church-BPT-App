# Every screen on the planet — the honest coverage map

The app is a standards web app (PWA) on purpose: **the browser is the only
runtime that ships on essentially every device humanity makes.** Every new
device class in thirty years — phones, tablets, TVs, watches, cars, headsets —
shipped a web browser before it shipped an app store. Plain HTML over HTTP
with data as JSON and offline-first caching is the longest-lived runtime bet
available. That's the strategy; below is the device-by-device truth, verified
against primary sources in August 2026. Verdicts: **works today** /
**works with a step** / **roadmap** / **not a real path**.

## Phones

| Device | Verdict | How |
| --- | --- | --- |
| iPhone (Safari) | **works today** | Share → Add to Home Screen. Full app, offline included. The App Store wrapper (docs/APP-STORE.md) adds push notifications on top. |
| Android (Chrome) | **works today** | Install prompt / menu → Add to Home screen (a real WebAPK install). Play Store listing via the same PWA (docs/APP-STORE.md). |
| Old / basic phones | **works with a step** | Any browser from ~2017 on gets the full app; ~2015–2016 browsers get a plainer but working app (see "The floor" below). |

## Computers — including old Macs

| Device | Verdict | How |
| --- | --- | --- |
| Mac, macOS 14 Sonoma+ (≈2018+) | **works today** | Safari → File → **Add to Dock**. Runs as its own app, own icon. |
| Mac, macOS 13 Ventura (≈2017+) | **works today** | Current Chrome/Edge → address-bar Install icon. |
| Mac, Monterey/Big Sur (≈2015–2016) | **works with a step** | Frozen-but-functional Chrome (150/138) still installs the PWA; no further security updates, so a newer browser is better advice when possible. |
| Mac, Catalina (≈2012+) | **works with a step** | Current Firefox still supports Catalina — full app in a browser tab (Firefox has no desktop install button). A ~14-year-old Mac runs this app. |
| Windows 10/11 | **works today** | Chrome/Edge → Install. Taskbar/Start integration. |
| Linux / ChromeOS | **works today** | Same install button; on Chromebooks PWAs are the preferred app model. |

## Tablets

iPad: Add to Home Screen today; the App Store wrapper ships a "Designed for
iPad" build. Android tablets: same as Android phones. Amazon Fire: open in
Silk → menu → Add to Home Screen (a shortcut, not a full install — fine).

## The Apple constellation

- **Apple Vision Pro** ("the glasses"): Safari on visionOS runs the full app
  as a window you pin in the room — **works today**. There's no web-app
  install on visionOS yet, but Apple automatically lists "Designed for iPad"
  apps on the Vision Pro App Store — so the moment our iPad wrapper ships
  (docs/APP-STORE.md) and we simply don't opt out, **Vision Pro App Store
  presence is free**.
- **Apple Watch**: no browser exists on watchOS — no web path, verified. The
  real win: push notifications (web push from the installed PWA on iOS 16.4+,
  or native push from the wrapper) **mirror to a paired Watch automatically**.
  Prayer-request and announcement notifications on the wrist, no Watch app.
- **CarPlay**: Apple gates CarPlay apps to fixed categories (audio,
  communication, navigation, EV charging…), each requiring an Apple-granted
  entitlement — a general church app fits none and would be denied; CarPlay
  Ultra changes nothing about that. The honest car strategy: **sermon audio.**
  (1) Today: play from the phone over Bluetooth/AirPlay — with Media Session
  metadata the car shows title and artwork. (2) When the sound-booth pipeline
  (docs/SOUND-AND-SERVICE.md) starts producing recordings: a **podcast RSS
  feed** puts every sermon in Apple Podcasts/Spotify/Overcast — which already
  live on every CarPlay screen, every HomePod, every smart speaker, with zero
  car-specific development. (3) Distant roadmap: a sermon-audio CarPlay app
  under the audio entitlement, post-wrapper, subject to Apple approval.

## TVs

The **Watch screen is the TV face** of this app. Today: any smart TV browser
reaches it, and the live stream reaches **every TV with a YouTube app** the
moment streaming is on (GO-LIVE.md Route A/D) — no store submissions needed.
Roadmap, in order of effort: Samsung Tizen and LG webOS accept packaged web
apps (free developer accounts, own review queues); Android/Google TV can ride
the Play TWA once the UI learns D-pad navigation; Apple TV requires a true
native app — last on the list, honestly.

## Consoles, e-readers, and browsers in odd places

Xbox's Edge browser renders the full app. PS5's hidden browser and Kindle's
experimental browser can manage text-first pages — which is one reason the
site keeps a no-install, no-service-worker-required path healthy: core
content must never be gated behind an install.

## The floor — how old a device can be

The code is deliberately ES5-with-guarded-modern-APIs. After the August 2026
hardening pass:

- **Full premium experience** (glass, ambient light, view transitions):
  browsers from ~2023 (Chrome/Edge 111+, Safari 16.2+, Firefox 113+).
- **Fully functional, plainer** (solid surfaces instead of glass, instant
  tab switches): browsers back to ~2015–2017 (fetch + Promise era — iOS 10.3+,
  Chrome 42+, Firefox 39+, Edge 14+), widened by the tiny polyfill block at
  the top of js/store.js.
- **Still useful**: anything older gets the static shell and the `<noscript>`
  basics — church name, address, phone, Sunday time. No device gets a blank
  page.
- The genuine hard limit for ~pre-2015 devices is usually **TLS trust**, not
  our code: very old systems can't validate modern certificates at all.

## Devices from the future

Not a joke answer: every claim above rests on W3C/WHATWG standards with
thirty years of backward compatibility, data in plain JSON, and zero
proprietary runtimes. When the next device class arrives, it will ship a
browser first — and this app will already run on it. That is the whole bet,
and history has paid it every single time.
