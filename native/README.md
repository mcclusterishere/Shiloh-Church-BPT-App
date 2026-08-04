# native/ — the Capacitor shell

This directory turns the Shiloh PWA into a real iOS and Android app for the
Apple App Store and Google Play. The app itself doesn't live here — it lives
one level up, at the repo root, exactly as it always has. This directory only
holds the thin native wrapper around it.

**Read [`docs/APP-STORE.md`](../docs/APP-STORE.md) before doing anything
here.** It is the full store path — accounts, costs, review risks, privacy
answers, screenshots, the works. This file is only the mechanical part.

## Why it's built this way

Capacitor wants a `webDir` — a folder containing the web app — and it must be
**inside** the Capacitor project. Pointing `webDir` at the repo root (`..`)
is not supported, so there are two honest options:

1. **`server.url`** — the native app is an empty shell that loads the live
   website over the network. Simple, but the app is then a browser window in
   a trench coat: it breaks with no signal, and it is exactly the kind of
   thin wrapper Apple's guideline 4.2 rejects.
2. **Bundled copy (what we do)** — the repo root is copied into `native/www`
   before each build, and the app ships with the whole site inside it. It
   opens instantly, works offline, and is a real app.

`npm run sync` does that copy with `rsync`, excluding what the binary doesn't
need: `native/` itself (no recursion), `.git`, `.github`, `docs/`, `scripts/`,
and `supabase/`. Everything generated here — `node_modules/`, `ios/`,
`android/`, `www/` — is gitignored, so this directory stays four small files
in git.

## The CHANGE-ME in capacitor.config.json

JSON can't carry comments, so the note lives here instead:

- **`appId`: `org.shilohchurchbpt.app` is a placeholder suggestion.** It
  becomes the permanent, public bundle identifier on both stores and can
  never be changed after the first upload. Confirm it (or pick your own
  reverse-domain id) **before** the first `npx cap add`, and register the
  same string as the App ID in the Apple Developer portal.
- `appName`: "Shiloh" — the name under the home-screen icon. The full store
  listing name ("Shiloh Baptist Church") is set separately in App Store
  Connect and Play Console.
- `webDir`: "www" — filled by `npm run sync`; never edit files in `www/` by
  hand, they are overwritten on every sync.

## First run

An honest note first: **iOS builds require a Mac with Xcode installed.**
This repo's development container has neither, so the `npx cap ...` commands
below have not been executed here — they are written from the Capacitor
docs, not run and verified in this environment. (`npm run sync` itself *was*
run and verified here: it produces a ~4 MB `www/` with the full app shell
and every exclude honored.) The Android steps need a machine with Android
Studio — Mac, Windows, or Linux all work, but note the sync script uses
`rsync`, which ships with macOS and Linux; on Windows run it from Git Bash
or WSL.

```sh
cd native
npm install            # installs Capacitor (core, cli, ios, android)
npm run sync           # copies the repo root into native/www
npx cap add ios        # once, on the Mac — creates the ios/ Xcode project
npx cap add android    # once, on any machine with Android Studio
```

Then, on **every** rebuild after the web app changes:

```sh
npm run sync           # refresh www/ from the repo root
npx cap copy           # push www/ into the ios/ and android/ projects
```

Open the native projects with:

```sh
npx cap open ios       # opens Xcode (Mac only)
npx cap open android   # opens Android Studio
```

From there, `docs/APP-STORE.md` §2 walks the Xcode signing, icons,
TestFlight, and App Store Connect steps one at a time.

## Version pinning

The `^7.0.0` pins in `package.json` target Capacitor's current major at the
time of writing. Before the first `npm install`, check
[capacitorjs.com](https://capacitorjs.com) for the current major and its
requirements (each major expects a recent Node LTS and a current Xcode /
Android Studio), and bump all four `@capacitor/*` entries together — they
must always share the same major version.
