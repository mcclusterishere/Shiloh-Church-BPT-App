# The sound booth and the service-aware assistant

The church already owns the most expensive piece of this whole design: the
**Behringer X32 Producer** mixing console in the sound booth. This document is
the honest architecture for connecting it to the Mac mini appliance (the box
from `docs/APPLIANCE-SETUP.md` — still "when it arrives") so that every Sunday
service records itself, transcribes itself, files itself into the sermon
library, and leaves the Admin → Assistant able to answer "what was Sunday's
message about?"

Status, said up front so nothing below oversells itself:

- **Shipped today:** the video-recording block in
  `scripts/appliance/mediamtx.yml`. It is real config, and it starts working
  the day the broadcast relay runs — no extra step.
- **Spec'd, not built:** everything else — audio capture, transcription, the
  archive hand-off, the assistant's awareness, and all board control. Written
  down now so hardware day is a checklist, not a research project.
- **Verified, not assumed:** every hardware claim about the X32 below was
  checked against the manufacturer's documentation or the community protocol
  reference — sources at the bottom.

---

## 1. What the board already has

The X32 Producer is not just a mixer — it is a digital console that ships with
two connections this design needs, both already on the back of the unit
([Behringer product page](https://www.behringer.com/en/products/0603-ADP)):

| Connection | What it carries | What it enables |
| --- | --- | --- |
| **USB (the X-USB card)** | 32 channels of audio in, 32 out, over USB 2.0 | One cable to the Mac mini and the whole service — every mic, the main mix — is a recordable audio device on the Mac |
| **Ethernet (remote port)** | Console remote control | Plugged into the same network as the mini, the board can be monitored and controlled by software — section 3 |

Two facts to hold onto, both verified:

1. **The Producer model includes the USB interface as standard.** The X32
   PRODUCER ships with the 32×32 X-USB card already installed in its expansion
   slot ([Behringer](https://www.behringer.com/en/products/0603-ADP),
   [Sweetwater](https://www.sweetwater.com/store/detail/XUSB--behringer-by-usb-usb-2.0-expansion-card-for-x32-digital-mixer)) —
   there is nothing to buy for the audio side except one cable. On a Mac the
   card is **CoreAudio class-compliant: no driver install at all**
   ([Sweetwater](https://www.sweetwater.com/store/detail/XUSB--behringer-by-usb-usb-2.0-expansion-card-for-x32-digital-mixer),
   [Behringer wiki — X32 PRODUCER USB Interface Operation Guide](https://behringerwiki.musictribe.com/index.php?title=X32_PRODUCER:_USB_Interface_Operation_Guide)).
   Plug it in and it appears in Audio MIDI Setup like any other interface.
2. **The whole X32 family speaks OSC (Open Sound Control) over UDP port
   10023.** This is an *unofficial but stable* protocol — Behringer documents
   it on its own wiki ([OSC Remote Protocol](https://behringerwiki.musictribe.com/index.php?title=OSC_Remote_Protocol)),
   and the community reference everyone actually builds against is
   Patrick-Gilles Maillot's [UNOFFICIAL X32/M32 OSC REMOTE PROTOCOL](https://x32ram.com/wp-content/uploads/download-files/X32-OSC.pdf),
   maintained for over a decade alongside his
   [open-source X32 tools](https://github.com/pmaillot/X32-Behringer). Mute
   groups, scene recall, and channel levels are all readable and settable
   over it. It is the same mechanism the ecosystem of X32 remote-control
   apps relies on.

So the wiring plan is exactly two cables: **one USB cable** (board → mini)
for the sound, **one Ethernet cable** (board → the same switch/router the
mini is on) for control and monitoring later. Neither changes anything about
how the sound tech mixes on Sunday.

---

## 2. The service pipeline

The goal, end to end: **a service happens → a recording exists → a transcript
exists → the sermon library knows about it → the assistant can talk about
it.** Four stages, each honest about where it stands:

| Stage | What it does | Status |
| --- | --- | --- |
| **(a) Capture** | Board audio + broadcast video recorded during the service window | Video: config shipped in `mediamtx.yml`. Audio: spec'd below |
| **(b) Transcribe** | whisper.cpp turns the audio into text with timestamps, on the box, free | Spec'd |
| **(c) Archive** | Recording + transcript land in the sermons folder; the library gets the entry | Spec'd — with an honest catch about who writes `data/sermons.json` |
| **(d) Awareness** | The gateway hands the latest sermon summary to the assistant as context | Spec'd as a documented extension to `gateway.js` — not edited today |

Everything lands in one folder tree on the mini, referenced by every command
below (and by the recording path in `mediamtx.yml`):

```
/Users/YOURUSER/ShilohSermons/
  video/        ← MediaMTX broadcast recordings (fMP4)
  audio/        ← board captures from the X32 (WAV)
  transcripts/  ← whisper.cpp output: .txt, .vtt, and the -summary.txt files
  models/       ← the downloaded whisper model file(s)
```

### (a) Capture — the board becomes a microphone the Mac can hear

With the USB cable in, the X-USB card shows up on macOS as a CoreAudio input
device. On the board's routing screens, the sound tech chooses what each of
the 32 USB channels carries; for this pipeline only one assignment matters —
**send the main stereo mix to card channels 1–2** (the Behringer wiki's
[USB Interface Operation Guide](https://behringerwiki.musictribe.com/index.php?title=X32_PRODUCER:_USB_Interface_Operation_Guide)
covers the card routing pages). The service then records with ffmpeg — the
same ffmpeg the broadcast relay already installs — using its macOS capture
input, `avfoundation`:

```sh
# Once, to learn the board's device index on this Mac:
ffmpeg -f avfoundation -list_devices true -i ""

# The Sunday capture (":1" = the audio device index found above; no video).
# Takes card channels 1-2 (the main mix), 48 kHz WAV, and stops itself
# after 2h15m — the exact service window, see below.
ffmpeg -f avfoundation -i ":1" \
  -af "pan=stereo|c0=c0|c1=c1" -ar 48000 -c:a pcm_s16le \
  -t 02:15:00 "/Users/YOURUSER/ShilohSermons/audio/$(date +%Y-%m-%d).wav"
```

(Device indexes can shift when USB devices come and go — the real capture
script should list devices and match the Behringer by name rather than
hard-coding `:1`. A hardware-day detail, noted so it isn't forgotten.)

**When it runs:** the same Sunday window the app already believes in.
`data/live.json` defines the live window as day 0 (Sunday), minutes 525–660 —
that is, **8:45 AM to 11:00 AM Eastern**. The capture starts at 8:45 via a
launchd `StartCalendarInterval` (the launchd pattern is already documented in
`docs/APPLIANCE-SETUP.md` section 3 — the only addition for a *timed* job is
this key in place of `KeepAlive`):

```xml
<key>StartCalendarInterval</key>
<dict>
  <key>Weekday</key><integer>0</integer>
  <key>Hour</key><integer>8</integer>
  <key>Minute</key><integer>45</integer>
</dict>
```

launchd fires on the Mac's local clock, so this follows daylight-saving time
exactly like the `America/New_York` window in `live.json` does. The `-t
02:15:00` on ffmpeg closes the window at 11:00. One schedule, two places,
same truth — if the church ever moves the service time, change `live.json`
and this plist together.

**Meanwhile, the video records itself.** The broadcast relay
(`scripts/appliance/mediamtx.yml`) now carries a recording block on the
`live` path: `record: yes`, fragmented MP4 segments into
`ShilohSermons/video/`, kept 30 days. This part is **real, shipped config**,
and it needs no schedule at all — MediaMTX only records *while a stream is
being published*, so the recording starts when the staff phone goes live and
stops when it stops. The comments in the file itself explain the retention
math.

### (b) Transcribe — whisper.cpp, on the box, free

[whisper.cpp](https://github.com/ggml-org/whisper.cpp) is a free, MIT-licensed
C/C++ port of OpenAI's Whisper speech-recognition model that runs entirely
locally — built specifically to run well on Apple Silicon, where it uses the
Mac's GPU (Metal) by default and can use the Neural Engine via Core ML for a
further speed-up. No cloud, no account, no per-minute fee: the same "local
brain" economics as the Ollama assistant. It reads an audio file and writes
text **with timestamps** — plain `.txt` for reading and `.vtt` for anything
that wants captions later.

```sh
brew install whisper-cpp        # installs the whisper-cli binary

# Once: download a model (~1.5GB; English-only "medium" is a good
# accuracy/speed balance for sermon audio on an M4-class mini):
curl -L -o /Users/YOURUSER/ShilohSermons/models/ggml-medium.en.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en.bin

# Post-service, on the capture (whisper.cpp wants 16 kHz mono WAV,
# so downsample a working copy first — the 48 kHz original is the keeper):
ffmpeg -i /Users/YOURUSER/ShilohSermons/audio/2026-08-09.wav \
  -ar 16000 -ac 1 /tmp/sermon-16k.wav
whisper-cli -m /Users/YOURUSER/ShilohSermons/models/ggml-medium.en.bin \
  -f /tmp/sermon-16k.wav -otxt -ovtt \
  -of /Users/YOURUSER/ShilohSermons/transcripts/2026-08-09
```

Runs post-service, not live: the simplest honest design is one Sunday script
that records (a), then converts, then transcribes (b), then summarizes (d) —
each step starting when the previous one finishes, all before lunch is over.
Transcription is not real-time on this hardware and doesn't need to be.

### (c) Archive — the recording meets the library

After (a) and (b), the folder holds everything a sermon entry needs, named by
date: the WAV, the video segments, the transcript. The member-facing sermon
library is `data/sermons.json` today, and its shape is four fields per entry —
`title`, `speaker`, `date`, `url`.

**The honest catch: the appliance cannot quietly edit `data/sermons.json`.**
That file lives in the GitHub repo and deploys with the site; a file on the
mini's disk doesn't touch it. Two real routes to close that gap:

1. **A commit from the appliance (possible today, not recommended yet).** The
   box could call the GitHub API and commit a new entry to
   `data/sermons.json`. It works — but it means storing a GitHub token on the
   box that can push to the repo, which is a far more powerful credential
   than the appliance token (`docs/APPLIANCE-SETUP.md`, "About that token"
   — that reasoning explicitly stops applying here). It also puts a robot in
   charge of a member-facing page with no human look at the title or the
   transcript first.
2. **Supabase mode (recommended timing).** When the back office moves to
   Supabase (`docs/BACKEND.md`), sermons become rows the appliance can
   *insert* with a narrowly-scoped key — and the entry can land as a draft an
   admin approves from the panel before members see it. Right-sized
   credential, human in the loop, no repo access on the box.

**Recommendation:** build the archive stage when Supabase mode is on, not
before. Until then the pipeline still earns its keep every single Sunday —
the recording and transcript are sitting in the folder, and adding the entry
to `sermons.json` stays the same two-minute edit it is today, except the
title no longer has to be remembered: it's in the first lines of the
transcript.

### (d) Awareness — the assistant knows what happened Sunday

This is the payoff stage, and it is deliberately small. Specified here as a
**documented extension to `scripts/appliance/gateway.js`** — the file is not
edited today; this is the contract for when the pipeline exists:

- **New environment variable:** `SERMONS_DIR` (set in the gateway's launchd
  plist, like `OLLAMA_MODEL`). Unset — the default — means the feature is off
  and the gateway behaves byte-for-byte as it does now.
- **Summaries, not transcripts.** A full sermon transcript is tens of
  thousands of words — too much to prepend to every question. So the Sunday
  script's last step asks the box's own Ollama model to boil the transcript
  down to ten lines or so, saved next to it as
  `transcripts/YYYY-MM-DD-summary.txt`.
- **On each `POST /ask`:** if `SERMONS_DIR` is set, the gateway finds the
  newest `*-summary.txt` in `$SERMONS_DIR/transcripts`, and prepends a short
  context block to the prompt it sends Ollama — shape:
  `"Context — the most recent Sunday message at Shiloh (2026-08-09):\n<summary>\n---\n<the admin's actual question>"`.
  The block is capped (~2,000 characters) and added server-side, so it never
  eats into the caller's `MAX_PROMPT_CHARS` budget.
- **Fails open, quietly.** Folder missing, empty, unreadable — the gateway
  answers exactly as it does today, no error surfaced. Awareness is a bonus,
  never a dependency.
- **Nothing else changes.** Same single `/ask` endpoint, same token check,
  same non-negotiables: it answers a question; it still cannot send, spend,
  or touch member data.

Result: Admin → Assistant can answer "what was Sunday's message about?" or
"draft a newsletter blurb about last week's sermon" from the actual sermon —
no cloud service ever hearing a word of it.

---

## 3. Board control — further out, spec only

None of this ships until the pipeline above has proven itself across real
Sundays. Stated plainly: **recording and transcribing can fail silently and
cost nothing; a wrong command to the live board during worship fails out
loud.** Control earns its way in last.

What the OSC protocol (section 1, sources at bottom) makes possible from the
admin panel, once a small OSC bridge service runs on the mini — same
LaunchAgent pattern, its own port and token, same bridge-contract style as
the door bridge in `docs/ACCESS-SETUP.md`:

- **Mute groups from a phone.** The X32's mute groups are OSC-addressable —
  a "mute all mics" tile in the admin panel for the moment a mic is left
  open. One tap, from anywhere in the building.
- **"Service mode" scene recall.** The board can save complete console
  scenes and recall them remotely — so Sunday setup becomes one button that
  puts every fader, mute, and routing assignment where the service needs it,
  instead of trusting that nobody nudged anything since last week.
- **A meter tile.** Channel levels are readable over OSC, so Admin →
  Building (or a future Sound pane) could show a small live VU — "is sound
  actually passing?" — answerable from the lobby without walking to the
  booth.

All of it rides UDP on the local network between the mini and the board, so
the bridge on the mini is what the panel talks to (over the existing
Cloudflare Tunnel, with its own token) — the board itself is never exposed to
the internet. That, and everything else about this section, is design intent,
not built software.

---

## 4. The privacy line

Two truths, and a rule that follows from them:

**A sermon is public proclamation.** It is preached to be heard, streamed to
Facebook and YouTube on purpose, and archived on the church's own website
today. Recording and transcribing it isn't surveillance — it's stewardship of
something already public. Transcribe freely.

**But the board hears everything.** The same mics that carry the sermon also
pick up the prayer huddle before service, the pastoral conversation at the
altar after, the choir's banter at rehearsal. None of that was offered to the
public, and a machine that quietly kept it would break the Church OS
consent-first rule (`docs/DESIGN.md`).

**So the rule, stated as design, not preference: the recorder runs only
inside the scheduled service window.** The audio capture starts at 8:45 and
hard-stops at 11:00 by its own `-t` flag — even if the script is never
cleaned up, it cannot listen past the window. The video side is naturally
bounded the same way: MediaMTX records only while the staff phone is
actually broadcasting. There is no always-on capture mode anywhere in this
design, and none should ever be added. If the church later wants meeting or
rehearsal transcription, that is a *separate* decision requiring the consent
of the people in the room — this pipeline doesn't creep into it by default.

---

## 5. When hardware day comes — the checklist

The board is already in the booth; this list waits only on the Mac mini.
No prices, per house rules — check current ones when the day is real.

1. **One USB 2.0 cable, board to mini.** Look at the X-USB card's socket on
   the back of the board before ordering the cable — and remember the mini's
   ports are USB-C/USB-A. This cable is the entire audio-side shopping list.
2. **One Ethernet cable,** board's remote port to the same switch/router the
   mini is on. Costs nothing to connect now; enables section 3 later.
3. **ffmpeg** — already installed for the broadcast relay
   (`brew install mediamtx ffmpeg`, `docs/APPLIANCE-SETUP.md` section 6).
   Nothing extra.
4. **whisper.cpp** — `brew install whisper-cpp`, then the one-time model
   download from section 2(b).
5. **The folder tree** — `mkdir -p /Users/YOURUSER/ShilohSermons/{video,audio,transcripts,models}`
   (and put the real username into `recordPath` in `mediamtx.yml`).
6. **The Sunday capture job** — the launchd LaunchAgent pattern from
   `docs/APPLIANCE-SETUP.md` section 3, with the `StartCalendarInterval`
   block from section 2(a) here in place of `KeepAlive`, running the
   record→transcribe→summarize script. Own label
   (`org.shiloh.sunday-capture`), own log files, same habits.
7. **Prove it in this order:** the board appears in Audio MIDI Setup → a
   60-second test capture plays back and the *main mix* is what's on
   channels 1–2 → whisper transcribes the test clip → then one full
   rehearsal Sunday with the real service before anyone relies on the
   output. Same discipline as the broadcast relay's "one-line test."

---

## Sources

The hardware claims above, verified against:

- X32 PRODUCER product page (X-USB 32×32 card included): [behringer.com/en/products/0603-ADP](https://www.behringer.com/en/products/0603-ADP)
- X32 PRODUCER USB Interface Operation Guide (card config and routing): [behringerwiki.musictribe.com](https://behringerwiki.musictribe.com/index.php?title=X32_PRODUCER:_USB_Interface_Operation_Guide)
- X-USB card — 32×32 USB 2.0, CoreAudio-compatible on Mac without added drivers: [Sweetwater product page](https://www.sweetwater.com/store/detail/XUSB--behringer-by-usb-usb-2.0-expansion-card-for-x32-digital-mixer), [Behringer X-USB page](https://www.behringer.com/en/products/0606-ABV)
- OSC remote control on UDP 10023 (Behringer's own wiki): [OSC Remote Protocol](https://behringerwiki.musictribe.com/index.php?title=OSC_Remote_Protocol)
- The community protocol reference — Patrick-Gilles Maillot, *Unofficial X32/M32 OSC Remote Protocol* (faders, mute groups, scenes, subscriptions): [x32ram.com PDF](https://x32ram.com/wp-content/uploads/download-files/X32-OSC.pdf) and his [X32-Behringer tools repo](https://github.com/pmaillot/X32-Behringer)
- whisper.cpp — free, MIT, local, Metal-accelerated on Apple Silicon, Core ML/ANE support: [github.com/ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp)
- MediaMTX recording settings (`record`, `recordPath`, `recordFormat`, `recordDeleteAfter` as path-level config): [mediamtx.org/docs/features/record](https://mediamtx.org/docs/features/record)
