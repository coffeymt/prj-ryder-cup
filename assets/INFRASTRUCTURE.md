# Golf App — Infrastructure Blueprint

## Overview
This document enumerates every Cloudflare resource, Workers secret, DNS record, and third-party account the Golf web app requires across local, preview, and production environments. It is the canonical reference for provisioning, post-deploy verification, and the user-facing setup runbook (`assets/SETUP.md`). Product context and the rationale behind the Cloudflare + D1 + smtp2go stack live in `plan/golf-rebrand/prd.md` under **Hosting & Infrastructure**.

## Cloudflare Account & Authentication
- **Account tier:** Cloudflare Free is sufficient for the full stack (Pages, Pages Functions, D1, DNS on an existing zone). No paid features required at this scale — see PRD **Constraints** for the dormancy + cost ceiling rationale.
- **Wrangler CLI:** install the latest stable release; do not pin a specific version in this document. The exact version used by CI lives in `web/package.json`.
- **Local auth:** `wrangler login` opens a browser-based OAuth flow that writes a token to the local Wrangler config. Re-run on any workstation that will run `wrangler d1 execute`, `wrangler pages secret put`, or `wrangler pages deploy`.
- **Account API token scopes** (for CI or headless provisioning):
  - `Account — Cloudflare Pages:Edit`
  - `Account — D1:Edit`
  - `Account — Workers Scripts:Edit`
  - `Zone — DNS:Edit` (scoped to the `sbcctears.com` zone)
  - `Zone — Zone:Read` (scoped to the `sbcctears.com` zone)
- **Account ID:** read from the Cloudflare dashboard at provisioning time and passed to Wrangler via `CLOUDFLARE_ACCOUNT_ID` environment variable. Never committed to the repo.

## Cloudflare Pages Project
- **Project name:** `golf` — single source of truth. Configured in `web/wrangler.jsonc` as the `name` field; downstream tooling reads it from there.
- **Framework preset:** SvelteKit (`@sveltejs/adapter-cloudflare`).
- **Build command:** `npm run build` — executed by Cloudflare Pages CI in the project's `web/` root.
- **Build output directory:** `.svelte-kit/cloudflare`.
- **Node version:** pinned via `.nvmrc` or the `NODE_VERSION` Pages env var. Use the latest LTS; exact version lives in repo config, not this document.
- **Production branch:** `main` (auto-deploys to the custom domain).
- **Default Pages URL:** `https://golf.pages.dev` (production). Preview branches deploy to `<branch>.golf.pages.dev`.
- **Preview branch policy:** every non-`main` branch automatically receives a preview URL. Preview deploys bind to the preview D1 database and preview secrets — never production — so preview traffic cannot pollute production data.
- **Environment separation:** preview and production bind **different D1 databases** (see next section) and **different secret values** (see Workers Secrets). This is enforced by the `env.preview` and `env.production` blocks in `web/wrangler.jsonc`.

## Cloudflare D1 Database
- **Provisioned databases** (IDs recorded in `web/wrangler.jsonc`):

  | Env | Database name | Database ID |
  |---|---|---|
  | preview | `golf-preview` | TBD (provisioned in Phase 5 — see `plan/golf-rebrand/tasks.md`) |
  | production | `golf-prod` | TBD (provisioned in Phase 5 — see `plan/golf-rebrand/tasks.md`) |

- **Binding name** used from Workers / Pages Functions: `DB`. All application code references `platform.env.DB` exclusively.
- **Migration workflow:**
  - Local dev: `wrangler d1 migrations apply DB --local`
  - Preview: `wrangler d1 migrations apply DB --remote --env preview`
  - Production: `wrangler d1 migrations apply DB --remote --env production`
  - Migrations live under `web/migrations/*.sql` and are applied in filename order. The `npm run migrations:apply` wrapper script handles ordering (see `web/scripts/apply-migrations.mjs`).
- **Free-tier capacity** at the planned event scale (confirmed sufficient in PRD **Constraints**): 5,000,000 row reads/day, 100,000 row writes/day, 5 GB storage per database.
- **Verify command:**

      wrangler d1 execute DB --remote --env production --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"

  Expected output: the full entity table list from `migrations/0001_init.sql` plus the migrations tracking table Wrangler maintains automatically.

## Custom Domain & DNS
- **Target hostname:** `golf.sbcctears.com` — serves the production deployment. Also reachable at `https://golf.pages.dev`.
- **DNS record (on the `sbcctears.com` zone):**
  - Type: `CNAME`
  - Name: `golf`
  - Target: `golf.pages.dev`
  - Proxy: **Proxied** (orange cloud)
  - TTL: `Auto`
- The custom domain was added via Cloudflare Pages → Custom Domains UI. The UI auto-creates the CNAME, handles activation, and provisions TLS.
- **Do not** modify any existing DNS records on `sbcctears.com`. Adding a new subdomain record is additive and does not interact with the parent site.
- **SSL:** certificate issued by **Google Trust Services** via Cloudflare. Auto-renewed; no manual cert work.
- **Verify command** (PowerShell-friendly, since the workspace OS is Windows):

      nslookup -type=CNAME golf.sbcctears.com

  or cross-platform:

      dig +short CNAME golf.sbcctears.com

  Expected output resolves through Cloudflare's edge to `golf.pages.dev`.
- **End-to-end HTTPS check:**

      curl -I https://golf.sbcctears.com

  Expected: HTTP `200`, valid TLS certificate issued by Google Trust Services, `cf-ray` header present.

## Workers Secrets
Each secret below is registered **independently per environment** (preview and production) via `wrangler pages secret put`. Never share values across environments — rotate one without touching the other.

| Name | Purpose | Generation / source |
|---|---|---|
| `COOKIE_SIGNING_KEY` | HMAC-SHA256 key for commissioner and player session cookies. | 32 random bytes, hex-encoded. PowerShell: `[BitConverter]::ToString((1..32 \| ForEach-Object { Get-Random -Minimum 0 -Maximum 256 })).Replace('-','').ToLower()`. bash: `openssl rand -hex 32`. |
| `SPECTATOR_COOKIE_KEY` | HMAC-SHA256 key for spectator read-only cookies. Kept separate so rotating one cookie class does not invalidate the others. | Independent 32-byte hex value. |
| `MAGIC_LINK_KEY` | HMAC-SHA256 key for signing single-use magic-link tokens issued during commissioner login. | Independent 32-byte hex value. |
| `EMAIL_API_KEY` | API key used by `src/lib/auth/emailClient.ts` to POST magic-link emails to `https://api.smtp2go.com/v3/email/send`. | Obtained from the smtp2go dashboard after verifying the sending domain. |
| `FROM_EMAIL` | Envelope + display `From` address for magic-link emails. Format: `"Display Name <address@domain>"`. Current value: `SBCC Tears <michael@sbcctears.com>`. | User-chosen; must be an address on a domain verified in smtp2go. |

**Registration reference (Pages Functions use `pages secret`, not `secret`):**

    wrangler pages secret put <NAME> --project-name golf
    # Repeat per env by selecting the environment in the interactive prompt.

Values are entered via stdin — never passed as CLI arguments.

**Verify command** (lists secret names, never values):

    wrangler pages secret list --project-name golf

Expected output: all five secret names above present in both preview and production environments.

## smtp2go Email Provider
- **Why smtp2go:** Cloudflare Workers cannot open raw TCP/SMTP sockets, so the app posts magic-link emails to smtp2go's HTTP API (`https://api.smtp2go.com/v3/email/send`). Implementation lives in `web/src/lib/auth/emailClient.ts`.
- **Sending domain:** `sbcctears.com` (apex). The `FROM_EMAIL` value `SBCC Tears <michael@sbcctears.com>` sends from this domain.
- **DNS records on the `sbcctears.com` zone** (exact values are generated per-smtp2go-account — read them from the smtp2go dashboard at provisioning time; shapes below are the spec):

  | Type | Name | Value shape | Purpose |
  |---|---|---|---|
  | `CNAME` | `s<N>._domainkey.sbcctears.com` (one per selector) | smtp2go-provided DKIM target. | DKIM — message signing. |
  | `CNAME` | `link.sbcctears.com` (optional) | smtp2go click/open tracking host. | Tracking (optional). |
  | `TXT` | `_dmarc.sbcctears.com` | `v=DMARC1; p=none; rua=mailto:<admin-email>` | DMARC — alignment policy and reporting address. |

- **Domain verification flow:** add the sending domain in the smtp2go dashboard → copy the generated records into the Cloudflare zone → click **Verify** in the smtp2go dashboard.
- **Verify command — DNS presence** (DKIM selector names come from the smtp2go dashboard):

      dig +short CNAME s1._domainkey.sbcctears.com
      dig +short TXT _dmarc.sbcctears.com

- **Verify command — end-to-end send:**

      curl -X POST https://api.smtp2go.com/v3/email/send \
        -H "Content-Type: application/json" \
        -d '{"api_key":"<key>","sender":"SBCC Tears <michael@sbcctears.com>","to":["<audit-recipient>"],"subject":"smtp2go verify","text_body":"ok"}'

  Expected: HTTP `200` with a JSON body containing `data.email_id`.

## Environment Naming Convention
| Environment | Purpose | D1 database | Domain |
|---|---|---|---|
| `local` | Developer laptop via `wrangler dev` + `--local` D1 (SQLite file under `.wrangler/`). | Local SQLite file (no remote resource). | `http://localhost:5173` (SvelteKit dev server). |
| `preview` | Every non-`main` branch; PR review deploys. | `golf-preview` | `<branch>.golf.pages.dev` |
| `production` | `main` branch auto-deploys. | `golf-prod` | `golf.sbcctears.com` (also `golf.pages.dev`) |

All three environments share the same Cloudflare account and smtp2go account. They never share D1 databases or secret values.

## Applied Migrations
Migrations live in `web/migrations/` and are applied in filename order to each D1 database. Applied set (target: both `golf-preview` and `golf-prod` once provisioned in Phase 5):

| File | Purpose |
|---|---|
| `0001_init.sql` | Full entity schema and indexes. |
| `0002_seed_kiawah.sql` | 5 Kiawah courses with tees, 18 holes each, CR/Slope per tee. |
| `0003_add_match_id_to_processed_ops.sql` | Adds `match_id` column + `UNIQUE(op_id, match_id)` index on `processed_ops` for match-scoped idempotency. |
| `0004_seed_demo_tournament.sql` | Seeds public demo tournament (code `DEMO26`) for testing. |

## Verification Commands Summary
Flat reference for the post-deploy Auditor. One command per resource. These are read-only.

| Resource | Verify command |
|---|---|
| Wrangler auth | `wrangler whoami` |
| Pages project exists | `wrangler pages project list` (expect `golf`) |
| Production deployment live | `wrangler pages deployment list --project-name golf` |
| Preview D1 exists | `wrangler d1 list` (expect `golf-preview`) |
| Production D1 exists | `wrangler d1 list` (expect `golf-prod`) |
| Production D1 schema applied | `wrangler d1 execute DB --remote --env production --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"` |
| Seeded courses present | `wrangler d1 execute DB --remote --env production --command "SELECT COUNT(*) FROM courses WHERE is_seed = 1"` (expect `5`) |
| `processed_ops.match_id` present | `wrangler d1 execute DB --remote --env production --command "PRAGMA table_info(processed_ops)"` (expect `match_id` column) |
| Preview secrets registered | `wrangler pages secret list --project-name golf` (preview env — expect all five names) |
| Production secrets registered | `wrangler pages secret list --project-name golf` (production env — expect all five names) |
| DNS — custom domain CNAME | `nslookup -type=CNAME golf.sbcctears.com` (expect `golf.pages.dev`) |
| TLS — app reachable | `curl -I https://golf.sbcctears.com` (expect `200`, cert issued by Google Trust Services) |
| DNS — smtp2go DKIM | `dig +short CNAME s1._domainkey.sbcctears.com` (selector name per smtp2go dashboard) |
| DNS — DMARC | `dig +short TXT _dmarc.sbcctears.com` |
| smtp2go sending domain verified | smtp2go dashboard → Sending → Verified Senders shows `sbcctears.com` as **Verified** |
| Secrets not committed | `rg -n "COOKIE_SIGNING_KEY\s*=\|MAGIC_LINK_KEY\s*=\|SPECTATOR_COOKIE_KEY\s*=\|EMAIL_API_KEY\s*=" web/` (expect zero literal-assignment matches) |
