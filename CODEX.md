# Codex — McCluster

Read `AGENTS.md` first. Completely.

You are in the McCluster ecosystem. The GitHub repository `mcclusterishere/mccluster` and the Cloudflare project `mccluster` are the backend AND the control plane. Supabase project `zmnhbrjyhxzhkxmhkexs` is the shared data plane.

Satellites do not grow a second auth, database, social scheduler, billing, or admin. Public edge is `matthew.mccluster.org` (apex `mccluster.org` aliases it). Worker API is `mccluster-core` on `api.mccluster.org`.

Client social is a McCluster service. If you were about to create a new backend: stop.