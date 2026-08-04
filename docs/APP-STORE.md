# App-store kit

The honest, complete path from "the app is a website you add to your home
screen" to "the app is in the App Store and Google Play" — plus the truth
about every other screen (smart TVs, Fire TV, Apple TV) and what "Meta
developer requirements" actually means for us. Written for a first-time app
manager with an Apple Developer budget ($99/year) and zero prior submissions.

One orientation fact before anything else: **the app already works without
any store.** It installs from the browser today (Share → Add to Home Screen),
works offline, and updates itself on every push to `main`. The stores add two
things the browser can't: push notifications, and the legitimacy of being
found by searching "Shiloh Baptist Church" in the App Store. Everything below
is in service of those two things — nothing here is a prerequisite for
members using the app tonight.

---

## 1. The truth up front

**No one can guarantee App Store approval — not us, not any agency, not any
church-app company.** The structural risk for any web-wrapped app is Apple's
own review guideline **4.2, Minimum Functionality**: *"your app should
include features, content, and UI that elevate it beyond a repackaged
website."* An app that is nothing but the website in a native frame is
exactly what that guideline exists to reject. Anyone who promises otherwise
is selling something.

Now the other half of the truth: **church apps are an established App Store
category.** Search the App Store for any large church and you'll find its
app; whole companies (Subsplash, Tithe.ly, Pushpay, Aware3) exist to ship
them, and giving apps like Givelify live on the store. Apple even revised
guideline 4.2.6 in 2018 specifically to allow template-built church and
small-business apps *when submitted by the organization itself under its own
developer account* — which is exactly what we'd be doing, except with an app
built for this church rather than from a commercial template. The category
is not the risk. A lazy wrapper is the risk.

**The mitigation strategy: ship the wrapper WITH native capabilities the
website cannot have.** In review terms, these are the answer to "why does
this need to be an app?":

1. **Push notifications** — the #1 legitimate reason, and the one that
   matters pastorally: a prayer request or announcement that reaches the
   congregation's lock screens. Honest status: **the app has no push code
   today.** The web app can't send them (and web push on iPhone only works
   for home-screen-installed sites anyway); the native layer is where push
   is added — a Capacitor push plugin in the shell, plus a service to send
   from (Firebase Cloud Messaging is free; hosted senders like OneSignal
   have free tiers at our size). This is the one real build task between
   here and a submission worth making — it's on the checklist in §6.
2. **Home-screen quick actions** — press-and-hold the icon → jump straight
   to Watch live / Events / Prayer wall / Give. The web manifest already
   declares these four shortcuts (Android honors them today); on iOS they
   need a small Capacitor app-shortcuts plugin in the shell.
3. **The native share sheet** — the app already calls the share API
   (`index.html`, event sharing); in the shell that becomes the real iOS
   share sheet, and a Capacitor share plugin makes it reliable everywhere.

Also true and worth knowing: **a rejection is a conversation, not a
verdict.** If review pushes back, the response goes through Resolution
Center in App Store Connect — you explain, or fix and resubmit. Plenty of
approved apps were rejected on the first pass.

---

## 2. iOS, step by step (Capacitor)

The wrapper technology is [Capacitor](https://capacitorjs.com) — the
open-source standard for shipping a web app as a native one. The shell lives
in this repo at [`native/`](../native/README.md); the web app stays exactly
where it is and keeps deploying to the website unchanged.

**What you need:** a Mac with Xcode (free, from the Mac App Store — it's a
very large download, start it early), an Apple Developer membership
($99/year), and an iPhone to test on. Honest note: this repo's development
container has no Mac and no Xcode, so the commands in this section are
written from the Capacitor and Apple docs — they have not been executed
here. Expect small prompts and version differences on the real Mac.

### 2.1 Apple Developer enrollment (do this first — approval can take days)

1. Go to **developer.apple.com** → Account → enroll, signed in with the
   Apple ID that should own the app.
2. Choose **Individual**. No D-U-N-S number, no paperwork — just identity
   verification and the **$99/year** fee. One honest trade-off: the App
   Store "seller" line will show the individual's name, not "Shiloh Baptist
   Church." Enrolling as an **Organization** puts the church's name there
   instead, but requires the church's legal entity and a free D-U-N-S
   number (weeks, not hours) — and as a nonprofit distributing a free app,
   the church could then apply for Apple's fee waiver. Reasonable path:
   individual now, migrate to an organization account later if the seller
   name matters.
3. Enrollment approval usually takes a day or two.

### 2.2 Build the shell

On the Mac, with the repo cloned:

```sh
cd native
npm install
npm run sync          # copies the repo root into native/www
npx cap add ios       # creates the ios/ Xcode project (first time only)
npx cap copy ios      # pushes www/ into the Xcode project
npx cap open ios      # opens it in Xcode
```

Before `npx cap add ios`, confirm the bundle id: `native/capacitor.config.json`
ships with the placeholder **`org.shilohchurchbpt.app`** — a fine choice, but
it is permanent once the first build is uploaded, so decide now (the
CHANGE-ME note is in `native/README.md`).

In Xcode:

1. Click the **App** project in the left sidebar → target **App** →
   **Signing & Capabilities** → set **Team** to the developer account.
   Xcode handles certificates and provisioning automatically.
2. Under **General**, set the supported destination to **iPhone only** for
   the first release — it halves the screenshot work (iPad support means a
   second full screenshot set and an iPad-worthy layout review).
3. Plug in an iPhone, pick it in the device menu, press **Run**. The app
   should open full-screen, offline-capable, in the church's design.

### 2.3 Icons and splash screen

iOS needs a **1024×1024** App Store icon with no transparency. The repo's
icons (`assets/icons/icon-512.png` and friends) were generated from the
church's own logo — go back to that source art and export a 1024 master
rather than upscaling the 512. Then let Capacitor's asset tool generate
every required size and the splash screen in one pass:

```sh
cd native
npx @capacitor/assets generate --ios
```

(It wants the master images in `native/assets/` — its prompt tells you the
exact filenames.) A splash in the app's warm alabaster (`#f4f1e6`, the same
background the manifest declares) with the stained-glass mark centered
matches what the web app already does.

### 2.4 App Store Connect — the app record

**appstoreconnect.apple.com** → My Apps → **+** → New App:

- **Platform** iOS · **Name** "Shiloh Baptist Church" (this is the store
  listing name; the icon label stays "Shiloh") · **Bundle ID** — pick the
  one Xcode registered · **SKU** — any internal string, e.g. `shiloh-app-1`.
- **Category:** Lifestyle. **Price:** Free. No in-app purchases.
- **Description / keywords / URLs:** plain description of what the app does
  (events, watch live, prayer wall, connect, giving methods); keywords like
  `church, Bridgeport, Baptist, sermons, prayer, worship`; **Support URL** =
  the church website; **Privacy Policy URL** = required, see §6 — the site
  needs that one page hosted before you can finish this form.
- **Screenshots:** App Store Connect states the exact pixel sizes on the
  upload screen — currently one set at the largest iPhone size (labeled
  6.9-inch) is required, and it reuses down. Take them straight from the
  real app on a big iPhone (or the Xcode simulator: **⌘S** saves a
  correctly-sized screenshot). Home, Events, Prayer wall, Watch, Connect —
  five honest screens, no marketing frames needed.

### 2.5 Privacy nutrition labels — the answers, prewritten

App Store Connect asks a questionnaire and renders the answers as the
listing's privacy label. The truthful answers depend entirely on which mode
`data/config.json` is in **inside the shipped binary** (`npm run sync`
copies whatever the repo has — check before building):

**Demo mode, no webhook (`"mode": "demo"`, `"webhookUrl": ""` — the current
state):** everything a member types stays in their own phone's browser
storage. Nothing is transmitted, there are no analytics, no ads, no
third-party SDKs. Questionnaire answer: **"Data Not Collected."** That's the
whole label, and it's a genuinely great one to ship with.

**Supabase mode (and/or a webhook set):** visitor cards, RSVPs, prayer
requests, and rental requests leave the phone for the church's database.
Answer the questionnaire exactly like this:

| Questionnaire item | Answer | Because (feature) |
| --- | --- | --- |
| Contact Info → Name | Collected · Linked to identity · Not used for tracking · Purpose: App Functionality | Connect card, RSVPs, prayer requests, rental requests |
| Contact Info → Email Address | Same | Connect card, rental requests |
| Contact Info → Phone Number | Same | Connect card, rental requests |
| User Content → Other User Content | Same | Prayer request text, connect-card notes, rental details |
| Every other category (location, health, financial, browsing, identifiers, diagnostics…) | **Not collected** | The app has none of it — no analytics, no ads, no location, and giving opens the church's existing external giving methods rather than taking payment in-app |
| "Do you or your partners use data for tracking?" | **No** | Nothing is shared with data brokers or ad networks — data goes to the church's own database, for the church's own follow-up, full stop |

The same answers feed Google Play's Data safety form in §3 — fill both from
this table so the stores never disagree with each other.

### 2.6 Account deletion — guideline 5.1.1(v)

Apple's rule: **if an app supports account creation, it must offer account
deletion inside the app.** Where we stand, honestly:

- **Demo mode:** there are no accounts. The staff passcodes are shared
  courtesy locks, not accounts; members never sign in at all. The rule does
  not apply. Ship demo mode and this is a non-issue.
- **Supabase mode:** real staff accounts exist. Today they're created by an
  admin, not through in-app sign-up — but before flipping the shipped
  binary to supabase mode, implement both of these so the binary is clean
  under 5.1.1(v) and plain good practice: (1) an in-app path for a
  signed-in staff member to delete their own account, and (2) a stated way
  (in the privacy policy page) for anyone to ask that their submitted
  cards, RSVPs, and prayer requests be erased. If member-facing account
  creation is ever added, in-app deletion becomes flatly mandatory —
  build it in the same release, not after.

Practical consequence: **submit the first release in demo mode.** It's
honest, it's the simplest privacy label, and it defers the deletion work to
the release that actually needs it.

### 2.7 Age rating

Apple's rating comes from a questionnaire, not a choice. Answer everything
truthfully and the result is **4+**: no violence, no sexual content, no
profanity, no drugs/alcohol/tobacco, no gambling, no horror, no unrestricted
web access (the app is its own content; outbound links open the browser).
One question to answer with care: **user-generated content — yes**, the
prayer wall. That answer doesn't raise the rating by itself; be ready to
tell review (see the notes below) that every request has sender-chosen
visibility, the only interaction is a single "Praying" tap — there are no
comments, no replies, no open feed — and church admins can remove any
request. If review asks for more under its UGC guideline (1.2), the standard
ask is a "report this" affordance — a small, honest add if requested.

### 2.8 Review notes — paste this in

App Store Connect → the version page → **App Review Information**. Apple
requires working demo credentials for anything gated. Paste, after checking
the passcodes match what's actually in the shipped `data/config.json`:

> Shiloh Baptist Church (Bridgeport, CT) — the congregation's own app:
> service times, events with RSVP, a prayer wall, a visitor connect card,
> live-stream viewing, and the church's giving methods.
>
> DATA: This build runs in demo mode — everything a user enters is stored
> locally on the device; no account is created and no data is transmitted.
>
> STAFF AREA (demo credentials): from the Profile tab, open the staff
> sign-in and enter passcode `shiloh2026` (full admin) or
> `shilohmedia2026` (editor). The same passcodes open the broadcast studio
> (golive.html), which in this build runs as a camera check only — no
> video leaves the phone.
>
> PRAYER WALL (user-generated content): each request's visibility is chosen
> by its sender (whole church / prayer team / pastor only); the only
> interaction is a one-tap "Praying" acknowledgment — no comments or
> replies exist; church admins can remove any request.
>
> GIVING: the Give screen lists the church's existing giving methods and
> opens them outside the app; the app itself processes no payments and
> contains no in-app purchases.

### 2.9 TestFlight first, then review

1. In Xcode: **Product → Archive** → **Distribute App → App Store
   Connect / Upload**. The build appears in App Store Connect after a short
   processing wait.
2. **TestFlight tab** → add internal testers (up to 100, instant — put the
   build on your own iPhone and a couple of trustees' phones the same day).
   External tester groups are possible too, after a lighter "beta review."
3. Live with it for at least a week. Push, shortcuts, share, offline — the
   things §1 promised review — all get proven here first.
4. When it's solid: version page → attach the build → **Submit for
   Review**. First reviews commonly come back within a day or two, but
   nothing is promised — never schedule an announcement Sunday around a
   pending review.

---

## 3. Android / Google Play — the PWA *is* the app

Android needs no Capacitor shell at all if we don't want one: a **Trusted
Web Activity (TWA)** ships the deployed website itself as a Play Store app —
full screen, no browser chrome, updated the moment the site deploys, no
resubmission for content changes. The tool is Google's own
[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap).

**Cost: $25, one time** (not yearly), at **play.google.com/console**.

1. **Generate the app** (any machine — Bubblewrap offers to install the
   Java/Android bits it needs on first run):

   ```sh
   npm i -g @bubblewrap/cli
   bubblewrap init --manifest="https://<the-app-domain>/manifest.webmanifest"
   bubblewrap build
   ```

   `init` reads our real `manifest.webmanifest` (name, colors, icons,
   shortcuts — the four home-screen quick actions come along for free) and
   asks a few questions; use the same id, `org.shilohchurchbpt.app`.
   `build` produces the signed `.aab` for Play and creates a **signing
   keystore — back up that file and its passwords in two safe places
   immediately; losing it is losing the ability to update the app.**

2. **`assetlinks.json` — the step everyone gets wrong.** A TWA only drops
   the browser address bar if the website publicly vouches for the app.
   That proof is a file this repo must serve at
   **`/.well-known/assetlinks.json`** — create the `.well-known/` directory
   at the **repo root** (next to `index.html`; the Pages deploy workflow
   ships the whole repo, so it deploys automatically) containing the JSON
   that Bubblewrap's `bubblewrap fingerprint generateAssetLinks` prints —
   or, once Play App Signing re-signs the app, the exact JSON Play Console
   itself provides under **Setup → App signing** (use Play's version; it's
   the certificate members' phones actually see).

   One hard requirement hiding in there: the file must sit at the **domain
   root**. On the custom domain (`app.shilohchurchbpt.org`, GO-LIVE.md §1)
   the repo root *is* the domain root, so it just works. On the fallback
   `mcclusterishere.github.io/Shiloh-Church-BPT-App/` address it lands one
   directory down and **does not count** — so the custom domain is a
   prerequisite for the Play app, not just a nicety.

3. **Play Console basics:** create the app → upload the `.aab` → **Store
   listing** (title ≤30 chars, short + full description, at least two phone
   screenshots, a 1024×500 feature graphic) → **Data safety form** (answer
   from the table in §2.5 — demo mode is "no data collected") → **content
   rating questionnaire** (truthful answers land at Everyone) → **privacy
   policy URL** (same page as iOS, §6). One more honesty item: Google has
   required new *personal* developer accounts to run a closed test with a
   set number of testers for a couple of weeks before production access —
   the exact number has changed over time, so read the requirement Play
   Console shows you and plan the church's own members as the testers.

---

## 4. Every other screen, honestly

The pragmatic TV story first, because it's the punchline: **the moment
live streaming is on (GO-LIVE.md §2, Route A or D), the service reaches
every smart TV in every member's home through YouTube's built-in TV apps —
zero store submissions, zero new code, today.** Everything below is about
putting *our own icon* on TV home screens, which is a nice-to-have on top of
that, not the way the service gets watched.

| Screen | Path | Honest status |
| --- | --- | --- |
| Samsung TVs (Tizen) | Packaged web app (`.wgt`) via Tizen Studio; free Samsung TV Seller account | **Roadmap.** They accept web apps and the Watch screen is the natural TV face, but Samsung runs its own review queue with its own quirks (remote-control key handling, per-country release paperwork). Real work, real waiting. |
| LG TVs (webOS) | Packaged web app (`.ipk`) via the webOS TV SDK; free LG Seller Lounge account | **Roadmap.** Same shape as Samsung: web apps welcome, separate review queue, separate quirks. |
| Android TV / Google TV | The same Play TWA can declare TV support | **Roadmap, with a to-do list first.** The app is built for touch; TV means a D-pad. Before targeting TV honestly: full arrow-key/remote navigation with a visible focus ring on every control, a leanback launcher entry + TV banner asset in the package, no touch-only flows, and a 10-foot layout pass (our 20px base type is right for a phone in hand, not a screen across the room). Play also reviews the TV form factor separately. |
| Amazon Fire TV | Amazon Appstore has had a web-app category (free developer account) | **Note it, verify before planning.** Amazon has repeatedly reshaped its web-app submission rules — check the current ones the week it matters, and the same D-pad work as Android TV applies. |
| Apple TV | — | **Honest no.** tvOS has no web view worth shipping — there is no wrapper path at all; an Apple TV app means writing a real native app from scratch. Not worth it for us: the YouTube app on Apple TV already carries the service the day streaming is on. |

---

## 5. "Meta developer requirements," demystified

This one causes confusion out of all proportion to what it governs, so
plainly: **nothing our app currently does involves Meta's developer platform
at all.** Linking to the church's public Facebook page needs no Meta app, no
review, nothing — it's a link. Even streaming *to* Facebook via Route A or D
uses the page's own stream key, not a developer API. Meta App Review only
enters the picture if we someday build one of three specific things: **(1)
"Log in with Facebook"** in our app — requires a Meta developer app, App
Review for the login permissions, and typically business verification of the
church; **(2) publishing live video through the Graph API** (i.e., our
software starting Facebook broadcasts programmatically instead of using the
stream key) — requires a developer app plus review of the live-video/page
permissions; **(3) WhatsApp Business API** for automated texts — requires
Meta business verification and either the Cloud API or a solution provider.
Each is a real project with its own review, for a day that may never come.
Until then, there are no Meta developer requirements to meet.

---

## 6. Pre-submission checklist

Everything above, consolidated. Work top to bottom; nothing ships until all
of it is done.

- [ ] **Change both staff passcodes** in `data/config.json` (`adminPasscode`,
      `editorPasscode`) **and** the `demoStaff` password — the current ones
      are printed in docs and git history. The binary bundles whatever is in
      the repo at `npm run sync` time.
- [ ] **Decide the shipped mode** (`data/config.json`): demo (recommended
      for v1 — "Data Not Collected", no account-deletion obligations) or
      supabase (requires §2.5 supabase answers **and** §2.6 deletion work
      first).
- [ ] **Privacy policy page hosted.** The site needs one plain page — put it
      at the repo root as `privacy.html` (it deploys with everything else;
      link it from the app's Help screen) saying honestly what §2.5 says:
      what's collected in which mode, that nothing is sold or used for ads,
      and who to contact to have information removed. Its URL goes into App
      Store Connect *and* Play Console — both refuse to finish without it.
- [ ] **Push-notification native layer decided** — which Capacitor push
      plugin, which sender (FCM / a hosted service), and who at the church
      sends. This is the §1 guideline-4.2 answer; don't submit a bare
      wrapper without it.
- [ ] **Bundle id confirmed** in `native/capacitor.config.json` (the
      `org.shilohchurchbpt.app` placeholder is permanent after first
      upload — `native/README.md` has the CHANGE-ME note).
- [ ] **1024×1024 icon** re-exported from the original logo art;
      `npx @capacitor/assets generate` run for icons + splash.
- [ ] **Screenshots** captured from the real app: the 6.9-inch iPhone set,
      two-plus Android phone shots, the 1024×500 Play feature graphic.
- [ ] **Review notes pasted** (§2.8) with demo passcodes that match the
      shipped `data/config.json` — if the passcodes were changed above,
      update the notes to the new ones.
- [ ] **TestFlight week completed** on real phones, including push,
      quick actions, share sheet, and airplane-mode offline.
- [ ] **Android keystore + passwords backed up** in two places, before
      anything is uploaded to Play.
- [ ] **`.well-known/assetlinks.json` live at the custom-domain root** and
      verified (open the URL; Play Console also checks it) — custom domain
      first (GO-LIVE.md §1), or the address bar never disappears.
- [ ] **Support URL and contact email** live and answered by a real person.
