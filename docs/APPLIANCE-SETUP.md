# The appliance — turning a Mac mini into Shiloh's local brain

This is Church OS Phase 1: "the brain and the pipe." One box, in the building,
running a local AI model the admin panel can ask questions. **This does not move
the database.** Members, giving, prayer requests, and everything else stay on
Supabase exactly as they are today — see `docs/DESIGN.md` for why physical
isolation and a proven pipeline come before a bigger migration, not after.

What this gets you: a private assistant for drafting and quick questions that
never leaves the building, doesn't depend on an internet AI provider, and costs
nothing per query once the hardware is bought. What this does *not* do, on
purpose: touch member data, send a message to anyone, move money, or act without
a human reading the result first. It answers a question. That's the whole scope
of Phase 1.

## 1. The hardware

A Mac mini, prioritizing **RAM over everything else** — unified memory is what
determines which model actually fits and runs well, not CPU tier or storage.
Apple's Mac mini lineup and pricing shifted in mid-2026; check apple.com for the
current numbers, but as of this writing the M4 Pro configurations run roughly
$999 (24GB) to $1,599 (64GB), with a 48GB configuration in between. If the
budget allows, take the RAM upgrade over a bigger SSD — 512GB of storage is
plenty for a model cache plus logs; 24GB of RAM is genuinely tight for anything
past a small model.

## 2. Install Ollama and pull a model

[Ollama](https://ollama.com) is the simplest way to run a local model on a Mac
with no separate GPU driver setup — it's built for exactly this.

```sh
brew install ollama
brew services start ollama    # keeps it running in the background permanently
curl http://127.0.0.1:11434   # should say "Ollama is running"
```

Pick a model sized to the RAM actually installed. As a rule of thumb, a model
needs roughly its parameter count in gigabytes at 8-bit quantization, or about
half that at 4-bit — so an 8B model needs ~8GB at 8-bit or ~4-5GB at 4-bit,
leaving headroom for macOS and everything else. Check
[ollama.com/library](https://ollama.com/library) for the current, well-supported
options at setup time rather than trusting a specific name written here months
in advance — the right choice changes faster than this document will. General
sizing guidance:

| RAM installed | Reasonable model size |
| --- | --- |
| 16–24GB | A small model in the 7–8B class, 4-bit quantized |
| 48GB | A mid-size model in the 13–32B class |
| 64GB+ | Comfortably the 32B class, or two smaller models loaded at once |

```sh
ollama pull <model-name-from-the-library>
ollama run <model-name-from-the-library> "Say hello in one sentence."   # sanity check
```

## 3. Get the gateway running

The gateway (`scripts/appliance/gateway.js`) is a small, dependency-free Node
script that wraps Ollama with a shared-secret token and CORS, so the app's
admin panel (running in a browser, on a totally different domain) can call it
safely. It refuses to start without a token configured — see the file's header
comment for why.

```sh
git clone https://github.com/mcclusterishere/Shiloh-Church-BPT-App.git
cd Shiloh-Church-BPT-App
node --version   # any reasonably recent Node works; install via `brew install node` if missing

APPLIANCE_TOKEN="choose-a-long-random-string-here" \
OLLAMA_MODEL="<the model name you pulled>" \
node scripts/appliance/gateway.js
```

You should see `Shiloh appliance gateway listening on :11535`. Test it from
another terminal:

```sh
curl -s http://127.0.0.1:11535/health
curl -s -X POST http://127.0.0.1:11535/ask \
  -H "Authorization: Bearer choose-a-long-random-string-here" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"In one sentence, what is Ollama?"}'
```

### Keep it running: launchd

Ctrl-C stops the gateway the moment you close the terminal. To keep it running
permanently (including across reboots), create
`~/Library/LaunchAgents/org.shiloh.appliance-gateway.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>org.shiloh.appliance-gateway</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/Users/YOURUSER/Shiloh-Church-BPT-App/scripts/appliance/gateway.js</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>APPLIANCE_TOKEN</key><string>choose-a-long-random-string-here</string>
    <key>OLLAMA_MODEL</key><string>YOUR-MODEL-NAME</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/shiloh-gateway.log</string>
  <key>StandardErrorPath</key><string>/tmp/shiloh-gateway.err</string>
</dict>
</plist>
```

```sh
launchctl load ~/Library/LaunchAgents/org.shiloh.appliance-gateway.plist
```

It now starts on login and restarts itself if it ever crashes.

## 4. Make it reachable: Cloudflare Tunnel

The admin panel runs in an ordinary browser, on an ordinary laptop or phone —
not on the church's local network — so it needs a real, secure public URL to
reach the Mac mini, without opening a port on the church's router or getting a
static IP. A [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
does exactly this, for free.

```sh
brew install cloudflared
cloudflared tunnel login                       # opens a browser, pick a domain if you have one
cloudflared tunnel create shiloh-appliance
cloudflared tunnel route dns shiloh-appliance appliance.yourchurchdomain.org
```

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: shiloh-appliance
credentials-file: /Users/YOURUSER/.cloudflared/<tunnel-id>.json
ingress:
  - hostname: appliance.yourchurchdomain.org
    service: http://localhost:11535
  - service: http_status:404
```

```sh
cloudflared service install
```

No domain yet? `cloudflared tunnel --url http://localhost:11535` gives a
temporary `trycloudflare.com` URL — fine for testing, but it changes every
time you restart it, so switch to a real hostname before relying on this day
to day.

## 5. Point the app at it

In `data/config.json`:

```json
{
  "applianceUrl": "https://appliance.yourchurchdomain.org",
  "applianceToken": "choose-a-long-random-string-here"
}
```

Use the **same** token as `APPLIANCE_TOKEN` in the launchd plist. Commit and
push. **Admin → Assistant** now works; with either field blank, it shows a
plain "not connected yet" message instead of erroring.

## About that token sitting in a committed file

Yes, `data/config.json` is a plain file in the repo — same as the demo admin
passcode already there. That's an acceptable trade-off *for this specific
endpoint*, because the gateway can only ever answer a question; it has no
access to members, giving, or prayer data, and can't send a message or move
money. If the token ever leaks, the worst case is someone runs up your
electricity bill asking a local model questions — annoying, not dangerous.
Rotate it (change it in both the plist and `config.json`) if that ever happens.
This reasoning stops applying the moment this gateway grows real data access —
revisit it before that day comes.

## What's next, not now

- **RAG over the church's own records** (so the assistant answers from real
  data instead of general knowledge) — needs an embedding model and an index,
  a genuinely separate piece of work.
- **Whisper transcription** for sermon/meeting audio.
- **Moving real data onto the box** — the actual Church OS "data never leaves
  the building" end state. A different, much bigger project than this one;
  see the open questions in `docs/DESIGN.md`.
