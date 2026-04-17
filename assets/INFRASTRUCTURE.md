# Ryder Cup App — Infrastructure Blueprint

## Overview
This document enumerates every Cloudflare resource, Workers secret, DNS record, and third-party account the Ryder Cup web app requires across local, preview, and production environments. It is the canonical reference for provisioning (Phase 11), post-deploy verification (Phase 12), and the user-facing setup runbook (`assets/SETUP.md`). Product context and the rationale behind the Cloudflare + D1 + Resend stack live in `plan/ryder-cup-app/prd.md` under **Hosting & Infrastructure**.

## Cloudflare Account & Authentication
- **Account tier:** Cloudflare Free is sufficient for the full stack (Pages, Pages Functions, D1, DNS on an existing zone). No paid features required at this scale — see PRD **Constraints** for the dormancy + cost ceiling rationale.
- **Wrangler CLI:** install the latest stable release; do not pin a specific version in this document. The exact version used by CI lives in `web/package.json`.
- **Local auth:** `wrangler login` opens a browser-based OAuth flow that writes a token to the local Wrangler config. Re-run on any workstation that will run `wrangler d1 execute`, `wrangler secret put`, or `wrangler pages deploy`.
- **Account API token scopes** (for CI or headless provisioning):
  - `Account — Cloudflare Pages:Edit`
  - `Account — D1:Edit`
  - `Account — Workers Scripts:Edit`
  - `Zone — DNS:Edit` (scoped to the `sbcctears.com` zone)
  - `Zone — Zone:Read` (scoped to the `sbcctears.com` zone)
- **Account ID:** read from the Cloudflare dashboard at provisioning time and passed to Wrangler via `CLOUDFLARE_ACCOUNT_ID` environment variable or `wrangler.toml` `account_id` field. Never committed to the repo.

## Cloudflare Pages Project
- **Project name:** `ryder-cup-app` — single source of truth. Do not hardcode this string anywhere except `wrangler.toml`; downstream tooling reads it from there.
- **Framework preset:** SvelteKit (`@sveltejs/adapter-cloudflare`).
- **Build command:** `pnpm build` (or `npm run build`) — executed by Cloudflare Pages CI in the project's `web/` root.
- **Build output directory:** `.svelte-kit/cloudflare`.
- **Node version:** pinned via `.nvmrc` or the `NODE_VERSION` Pages env var. Use the latest LTS; exact version lives in repo config, not this document.
- **Production branch:** `main` (auto-deploys to the custom domain).
- **Preview branch policy:** every non-`main` branch automatically receives a preview URL at `<branch>.ryder-cup-app.pages.dev`. Preview deploys bind to the preview D1 database and preview secrets — never production — so preview traffic cannot pollute production data.
- **Environment separation:** preview and production bind **different D1 databases** (see next section) and **different secret values** (see Workers Secrets). This is enforced by the `[env.preview]` and `[env.production]` blocks in `wrangler.toml`.

## Cloudflare D1 Database
- **Database names** (configurable — values live in `wrangler.toml`, not hardcoded in source):
  - Preview: `ryder-cup-preview`
  - Production: `ryder-cup-prod`
- **Binding name** used from Workers / Pages Functions: `DB`. All application code references `platform.env.DB` exclusively.
- **Migration workflow:**
  - Local dev: `wrangler d1 migrations apply DB --local`
  - Preview: `wrangler d1 migrations apply DB --remote --env preview`
  - Production: `wrangler d1 migrations apply DB --remote --env production`
  - Migrations live under `web/migrations/*.sql` and are applied in filename order. The `pnpm migrations:apply` wrapper script handles ordering (see `web/scripts/apply-migrations.mjs`, Task P1.T3).
- **Free-tier capacity** at the planned event scale (confirmed sufficient in PRD **Constraints**): 5,000,000 row reads/day, 100,000 row writes/day, 5 GB storage per database.
- **Verify command:**

      wrangler d1 execute DB --remote --env production --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"

  Expected output: the full entity table list from `migrations/0001_init.sql` plus the migrations tracking table Wrangler maintains automatically.

## Custom Domain & DNS
- **Target hostname:** `rydercup.sbcctears.com` — **configurable**. The Pages project can be bound to any subdomain of a zone the user already controls; `sbcctears.com` is the user's existing Cloudflare-managed zone and was chosen in the PRD to avoid registering a new domain. Changing the subdomain is a one-line change in the Pages custom-domain configuration plus a DNS record swap.
- **DNS record to add on the `sbcctears.com` zone:**
  - Type: `CNAME`
  - Name: `rydercup`
  - Target: `ryder-cup-app.pages.dev`
  - Proxy: **Proxied** (orange cloud)
  - TTL: `Auto`
- **Recommended path:** add the custom domain through Cloudflare Pages → Custom Domains UI. The UI auto-creates the CNAME in the zone, handles activation polling, and provisions Universal SSL.
- **Do not** modify any existing DNS records on `sbcctears.com`. Adding a new subdomain record is additive and does not interact with the parent site.
- **SSL:** Universal SSL auto-covers the subdomain. Cloudflare manages certificate issuance and renewal; no manual cert work.
- **Verify command** (PowerShell-friendly, since the workspace OS is Windows):

      nslookup -type=CNAME rydercup.sbcctears.com

  or cross-platform:

      dig +short CNAME rydercup.sbcctears.com

  Expected output resolves to a Cloudflare-managed hostname (for example `ryder-cup-app.pages.dev` before orange-cloud rewriting, or a Cloudflare edge hostname after).
- **End-to-end HTTPS check:**

      curl -I https://rydercup.sbcctears.com

  Expected: HTTP `200`, valid TLS certificate issued by Cloudflare / Google Trust Services, `cf-ray` header present.

## Workers Secrets
Each secret below is registered **independently per environment** (preview and production). Never share values across environments — rotate one without touching the other.

| Name | Purpose | Generation |
|---|---|---|
| `COOKIE_SIGNING_KEY` | HMAC-SHA256 key for commissioner and player session cookies. | `openssl rand -base64 32` (Linux/macOS) or `[Convert]::ToBase64String((1..32 \| ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))` (PowerShell). |
| `SPECTATOR_COOKIE_KEY` | HMAC-SHA256 key for spectator read-only cookies. Kept separate so rotating one cookie class does not invalidate the others. | Same as above — generate an independent value. |
| `MAGIC_LINK_KEY` | HMAC-SHA256 key for signing single-use magic-link tokens issued during commissioner login. | Same as above — generate an independent value. |
| `RESEND_API_KEY` | API key for sending magic-link emails via Resend. | Obtained from the Resend dashboard after creating an account and verifying the sending domain. |

**Registration reference (not run by this document):** `wrangler secret put <NAME> --env preview` and `wrangler secret put <NAME> --env production`. Each invocation prompts for the value on stdin — values are never passed as CLI arguments.

**Verify command** (lists secret names, never values):

    wrangler secret list --env production

Expected output: all four secret names above. Run with `--env preview` to confirm the preview env independently.

## Resend Email Provider
- **Account tier:** Free (3,000 emails/month, 100/day). Dwarfs the expected volume of magic-link emails for the user's event cadence — see PRD **Resolved Decisions #15**.
- **Sending domain:** `mail.rydercup.sbcctears.com` — **configurable**. A dedicated subdomain (as opposed to the apex `sbcctears.com`) scopes DKIM to app-only mail and keeps deliverability isolated from any future mail on the parent zone. The apex or any other subdomain of `sbcctears.com` would also work; the dedicated subdomain is the recommendation, not a constraint.
- **DNS records Resend requires on the `sbcctears.com` zone** (exact values are generated per-Resend-account — read them from the Resend dashboard at provisioning time; the *shapes* below are the spec, not live values):

  | Type | Name | Value shape | Purpose |
  |---|---|---|---|
  | `TXT` | `mail.rydercup.sbcctears.com` | SPF string provided by Resend (format: `v=spf1 include:<resend-host> ~all`). | SPF — authorizes Resend's mail servers to send as this subdomain. |
  | `CNAME` | `resend._domainkey.mail.rydercup.sbcctears.com` | Resend-provided DKIM target (typically `resend._domainkey.<resend-host>`). | DKIM — message signing key #1. |
  | `CNAME` | Additional DKIM selector(s) as provided by Resend (account may issue 2 or 3). | Resend-provided DKIM targets. | DKIM — additional signing keys. |
  | `TXT` | `_dmarc.mail.rydercup.sbcctears.com` | `v=DMARC1; p=none; rua=mailto:<admin-email>` | DMARC — alignment policy and reporting address. |

- **Domain verification flow:** create the sending domain in the Resend dashboard → copy the generated records into the Cloudflare zone → wait for DNS propagation (usually seconds on Cloudflare) → click **Verify** in the Resend dashboard. Status flips to **Verified** once SPF and both DKIM records are observable.
- **Verify command — DNS presence:**

      dig +short TXT mail.rydercup.sbcctears.com
      dig +short CNAME resend._domainkey.mail.rydercup.sbcctears.com
      dig +short TXT _dmarc.mail.rydercup.sbcctears.com

  Expected: non-empty results matching the Resend-dashboard values.

- **Verify command — end-to-end send** (run once per environment during Phase 12 audit; requires a temporary test recipient):

      curl -X POST https://api.resend.com/emails \
        -H "Authorization: Bearer $RESEND_API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"from":"noreply@mail.rydercup.sbcctears.com","to":"<audit-recipient>","subject":"Resend verify","text":"ok"}'

  Expected: HTTP `200` with an `id` field. Equivalent: a `wrangler dev` route that calls `src/lib/auth/emailClient.ts` and is invoked from the browser.

## Environment Naming Convention
| Environment | Purpose | D1 database | Domain |
|---|---|---|---|
| `local` | Developer laptop via `wrangler dev` + `--local` D1 (SQLite file under `.wrangler/`). | Local SQLite file (no remote resource). | `http://localhost:5173` (SvelteKit dev server). |
| `preview` | Every non-`main` branch; PR review deploys. | `ryder-cup-preview` | `<branch>.ryder-cup-app.pages.dev` |
| `production` | `main` branch auto-deploys. | `ryder-cup-prod` | `rydercup.sbcctears.com` |

All three environments share the same Cloudflare account and Resend account. They never share D1 databases or secret values.

## Provisioning Order
Strict order — later steps depend on earlier ones. Each step references the Wrangler or dashboard action a human operator runs; this document does not execute commands.

1. Create or confirm Cloudflare account; run `wrangler login` on the operator workstation.
2. Create D1 databases: `ryder-cup-preview`, then `ryder-cup-prod`. Record the generated database IDs in `wrangler.toml` (these IDs are not secrets but are environment-specific; the repo stores them in the committed Wrangler config).
3. Create the Pages project: `wrangler pages project create ryder-cup-app --production-branch main`.
4. Apply initial migration to the preview D1: `wrangler d1 migrations apply DB --remote --env preview`.
5. Register preview secrets (all four from the Workers Secrets table) via `wrangler secret put <NAME> --env preview`.
6. Push a branch and confirm the first preview deploy succeeds end-to-end (build green, D1 binding resolves, cookie-issuing route works).
7. Apply initial migration to production D1: `wrangler d1 migrations apply DB --remote --env production`.
8. Register production secrets via `wrangler secret put <NAME> --env production`.
9. Bind the custom domain `rydercup.sbcctears.com` in the Pages UI (Custom Domains → Add). Cloudflare creates the CNAME and provisions Universal SSL.
10. Create the Resend account, add the `mail.rydercup.sbcctears.com` sending domain, copy the DNS records into the `sbcctears.com` Cloudflare zone, verify.
11. Merge to `main` to trigger the first production deploy; verify `https://rydercup.sbcctears.com` serves the app with a valid cert.

## Verification Commands Summary
Flat reference for the Phase 12 Auditor. One command per resource. These are read-only.

| Resource | Verify command |
|---|---|
| Wrangler auth | `wrangler whoami` |
| Pages project exists | `wrangler pages project list` (expect `ryder-cup-app`) |
| Production deployment live | `wrangler pages deployment list --project-name ryder-cup-app` |
| Preview D1 exists | `wrangler d1 list` (expect `ryder-cup-preview`) |
| Production D1 exists | `wrangler d1 list` (expect `ryder-cup-prod`) |
| Production D1 schema applied | `wrangler d1 execute DB --remote --env production --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"` |
| Seeded courses present | `wrangler d1 execute DB --remote --env production --command "SELECT COUNT(*) FROM courses WHERE is_seed = 1"` (expect `5`) |
| Preview secrets registered | `wrangler secret list --env preview` (expect all four names) |
| Production secrets registered | `wrangler secret list --env production` (expect all four names) |
| DNS — custom domain CNAME | `nslookup -type=CNAME rydercup.sbcctears.com` |
| TLS — app reachable | `curl -I https://rydercup.sbcctears.com` (expect `200` + valid cert) |
| DNS — Resend SPF | `dig +short TXT mail.rydercup.sbcctears.com` |
| DNS — Resend DKIM | `dig +short CNAME resend._domainkey.mail.rydercup.sbcctears.com` |
| DNS — DMARC | `dig +short TXT _dmarc.mail.rydercup.sbcctears.com` |
| Resend sending domain verified | Resend dashboard → Domains → `mail.rydercup.sbcctears.com` shows **Verified** |
| Secrets not committed | `rg -n "COOKIE_SIGNING_KEY\s*=\|MAGIC_LINK_KEY\s*=\|SPECTATOR_COOKIE_KEY\s*=\|RESEND_API_KEY\s*=" web/` (expect zero literal-assignment matches) |
