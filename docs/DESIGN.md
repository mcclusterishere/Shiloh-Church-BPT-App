# Design proposal — the Shiloh Church BPT App

This is the design this build follows, agreed on before any code was written. It
builds on the `CHURCH-OS.md` / `CHURCH-OS-PITCH.md` vision already drafted in the
Faith & Results repo, plus research into the church-app landscape, general community-
app engagement patterns, Airbnb's admin/host capabilities, elder-friendly onboarding,
and multi-tenant template architecture. A fuller, browsable version of this document
exists as a Claude Artifact; this file is the durable, version-controlled copy.

## The three rules that don't move

Everything below — every feature, every phase, at every scale — has to survive
contact with these three, straight from the Church OS vision doc:

1. **Tiered, consent-first data.** Pastoral-care notes, giving records, and
   background-check status sit behind the tightest access tier in the system. A
   general ministry-leader login never sees them, even at three total admin users.
2. **The AI never moves money or speaks for a person.** Automation can flag, draft,
   and reconcile. It cannot send a message to a member, contact a visitor, or move a
   dollar without a human approving it first. Every financial action is logged.
3. **It assists the pastor. It doesn't replace him.** The measure of every feature is
   whether it gives the pastor and staff their time back — not whether it can act on
   its own.

## Architecture

**One Supabase project per church**, not a shared multi-tenant database — physical
isolation beats clever multi-tenancy for a small team holding sensitive pastoral and
giving data. Static PWA on GitHub Pages; Supabase (Postgres + Auth + RLS + Edge
Functions) as the entire backend; Resend split into a transactional lane (via
Supabase's own SMTP setting) and a Broadcast lane that never shares unsubscribe state
with transactional mail; GitHub Actions as the free cron layer (with a keepalive job,
since GitHub silently disables scheduled workflows after 60 quiet days); Railway
deliberately not provisioned until something concrete needs it. Every table gets a
`church_id` column from day one, even with one church, so multi-tenancy later isn't a
rewrite.

## Feature roadmap

**MVP — ships for Shiloh now:** reverse-chronological home feed, event RSVP with
headcount + reminders, prayer wall with tiered visibility + one-tap "Praying," digital
visitor connect-card with automated follow-up, basic opt-in member directory, closed
admin-approved membership, opt-in weekly-digest notifications, skippable onboarding.
Admin: ministries/facilities catalog, facility reservations with conflict detection,
one-way `.ics` calendar feed, a consolidated inbox, three fixed roles (Admin / Ministry
Leader / Volunteer), volunteer safety-status tracking, dashboard + CSV export.

**Phase 2 — grows with the congregation:** small groups/circles, volunteer shift
signup, milestone badges (never streaks/leaderboards), guarded direct messaging,
richer directory, read-aloud + extra-contrast toggle. Admin: recurring event engine,
pre-built automation recipes, a fund-based giving ledger with human-approved
disbursement + tax statements, attendance/giving dashboards, pastoral engagement flags
("haven't seen this family in 30 days" — a staff worklist, never an outbound message),
a Brand & Settings editor.

**Future — megachurch & multi-church:** kids' check-in, multi-campus rollup,
sermon/media + podcast + TV apps, a bounded AI FAQ assistant, an explicitly
off-by-default gamification module, a deacon-moderator role appealable to a real
pastor, cross-church discovery, true fork-and-sync tooling, and — only if this becomes
a hosted product rather than a fork-it-yourself template — a shared multi-tenant
Supabase project.

## The Airbnb → church admin mapping

| Airbnb capability | Church equivalent | Phase |
|---|---|---|
| Listings catalog | Ministries & facilities directory | MVP |
| Booking/availability engine | Facility reservations, conflict detection | MVP |
| iCal listing sync | One-way `.ics` calendar feed | MVP |
| Unified inbox | Consolidated requests tab | MVP |
| Verified/trust badge | Volunteer safety status | MVP |
| Co-host permission tiers | Admin / Ministry Leader / Volunteer roles | MVP |
| Instant Book vs. Request-to-Book | Auto-confirm RSVP vs. approval-gated signup | MVP |
| Host dashboard basics | Stat tiles + CSV export | MVP |
| Recurring bookings | Recurring service/event engine | Phase 2 |
| Saved replies + triggers | Pre-built webhook automation recipes | Phase 2 |
| Payouts & statements | Fund-based giving ledger, human-approved | Phase 2 |
| Performance insights | Attendance & giving-trend dashboards | Phase 2 |
| Automated re-engagement messaging | Pastoral engagement **flag**, never an auto-message — the one Airbnb pattern that would be actively harmful copied straight across | Phase 2 |
| Channel-manager sync | Two-way external calendar sync | Future |
| Multi-property tools | Multi-campus rollup | Future |
| Guest-favorite/star badges | **No church equivalent, by design** — pastoral relationships aren't a marketplace | — |

## Onboarding

The research is blunt: for real first-time elderly smartphone users, a polished
in-app tutorial is not the highest-leverage move — a human is. The design: an
in-person buddy session for Shiloh's current ~20 members, paired with a printed
"Getting Started" card; a short, genuinely opt-in in-app intro (equal-weight "Show me
around" / "Skip," never auto-launched full-screen); contextual coach-marks over an
exhaustive tour; a permanent "Replay Tutorial" entry in Help; and a plain-language
copy pass throughout.

## Open questions (still Matthew's to answer)

1. **The on-premises appliance.** Pursue Church OS's physical-box vision in parallel
   now, or treat it as a later phase once the cloud app is proven?
2. **Branding specifics.** Real logo? Firmer color preference? A tagline or verse?
3. **Giving processor.** Direct Stripe, or a giving-specific processor (Tithe.ly,
   Give, Pushpay)?
4. **The real ministries list.** Shiloh's actual ~4–6 groups, to replace the
   placeholders in `data/ministries.json`.
5. **Denomination-specific structure.** Deacon board, trustee board, specific
   auxiliaries that should be named explicitly rather than generically?
6. **Repo and domain.** Confirm the repo name and what domain it should point to.
7. **The McCluster-style weekly agent.** Extend Faith & Results' autonomous
   research/drafting agent pattern to Shiloh's admin now, or hold it for the
   pastoral-care phase?
