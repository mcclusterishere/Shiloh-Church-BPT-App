# MCCLUSTER CONTROL PLANE — READ THIS FIRST

This repository (`mcclusterishere/Shiloh-Church-BPT-App`) is a **client** satellite of the McCluster control plane.
Default branch: `claude/shiloh-church-bpt-design-x9lnin`.

# McCluster satellite — read this before you touch anything

This repository is a **satellite** of the McCluster control plane.

Canonical law lives in the control repo. If this file and that file disagree, the control repo wins.

- Control repo: https://github.com/mcclusterishere/mccluster
- Agent law: https://github.com/mcclusterishere/mccluster/blob/main/AGENTS.md
- Ecosystem map: https://github.com/mcclusterishere/mccluster/blob/main/docs/control-plane/ECOSYSTEM.md
- Cloudflare project: `mccluster` (public edge `matthew.mccluster.org` / `mccluster.org`)
- Worker: `mccluster-core` (`api.mccluster.org`)
- Data: Supabase `zmnhbrjyhxzhkxmhkexs`

## What you are allowed to do here

- Product UI, brand, and local features for THIS satellite.
- Call McCluster APIs / Supabase tables that already exist.
- Submit social posts into the McCluster social layer (never as a second source of truth).

## What you must not do

- Create a new auth, database, admin, billing, or social scheduler.
- Auto-push GitHub Actions onto a feature branch (`git push` from CI onto an open PR).
- Rewrite `index.html` or a shipping page unless the owner named that file.
- "Rebuild the backend" inside this repo. The backend is McCluster.

## If you are ChatGPT, Claude, Codex, Cursor, Gemini, or Copilot

You keep failing this ecosystem by treating every repo as greenfield. It is not. McCluster is the plane. Read `CLAUDE.md` next. Then work.

Local product notes, if any, belong below this block. Do not delete this block.
