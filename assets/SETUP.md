# Tears Tourneys — One-Time Setup Guide

## Overview
This runbook provisions every piece of infrastructure the Tears Tourneys app requires on a fresh Cloudflare account. It is the operator-facing complement to [`INFRASTRUCTURE.md`](./INFRASTRUCTURE.md): the blueprint declares *what* must exist; this guide prescribes *how* to create it. Run it once before the first deploy and again only to rotate a rotated resource (new account, new secret, new sending domain).

All commands target Windows PowerShell because the workspace OS is Windows. bash/zsh equivalents are shown inline where the command differs.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Step 1 — Cloudflare authentication](#step-1--cloudflare-authentication)
3. [Step 2 — Create D1 databases](#step-2--create-d1-databases)
4. [Step 3 — Create Cloudflare Pages project](#step-3--create-cloudflare-pages-project)
5. [Step 4 — Generate and register Workers secrets](#step-4--generate-and-register-workers-secrets)
6. [Step 5 — Add smtp2go sending domain and DNS records](#step-5--add-smtp2go-sending-domain-and-dns-records)
7. [Step 6 — Apply initial migration (preview)](#step-6--apply-initial-migration-preview)
8. [Step 7 — First preview deploy](#step-7--first-preview-deploy)
9. [Step 8 — Production cutover](#step-8--production-cutover)
10. [Commissioner login (first-time)](#commissioner-login-first-time)
11. [Demo tournament](#demo-tournament)
12. [Development Workflow](#development-workflow)
13. [Rollback / Rotation](#rollback--rotation)
14. [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Windows with PowerShell 5.1+ | Primary shell. bash/zsh notes appear in callouts where commands differ. |
| Node.js LTS + npm | Installed by task P0.T3 during scaffolding. Verify with `node --version` and `npm --version`. |
| Cloudflare account | Free tier is sufficient — see [`INFRASTRUCTURE.md`](./INFRASTRUCTURE.md#cloudflare-account--authentication). `sbcctears.com` is already on Cloudflare DNS. |
| smtp2go account | Required for magic-link emails. Cloudflare Workers cannot open raw SMTP sockets, so the app posts to smtp2go's HTTP API. Sign up at [smtp2go.com](https://www.smtp2go.com). Needed in [Step 5](#step-5--add-smtp2go-sending-domain-and-dns-records). |
| Terminal at workspace root | `c:\Users\MichaelCoffey\prj-kiawah`. All `npx wrangler` commands below must be run from `web/` unless stated otherwise. |

> **Note:** Canonical identifiers for this project are `golf` (Pages), `golf-preview` and `golf-prod` (D1), and `golf.sbcctears.com` (custom domain). Swap them consistently if you fork the project.

> **Warning:** Never commit secret values or pass them as CLI arguments (PowerShell history and Windows Event Log capture arguments). Always paste values into the `wrangler secret put` interactive prompt.

---

## Step 1 — Cloudflare authentication

Opens a browser OAuth flow and caches a token for the Wrangler CLI on this workstation. Re-run if you change workstations or clear Wrangler's local config.

```powershell
cd web
npx wrangler login
```

**What to expect:** a browser tab opens on `https://dash.cloudflare.com/oauth2/...`. Click **Allow**. The terminal prints:

```
Successfully logged in.
```

### Verify

```powershell
npx wrangler whoami
```

Expected output shape:

```
 ⛅️ wrangler x.y.z
-------------------
Getting User settings...
👋 You are logged in with an OAuth Token, associated with the email <your-email>.
┌────────────────────┬──────────────────────────────────┐
│ Account Name       │ Account ID                       │
├────────────────────┼──────────────────────────────────┤
│ <your-account>     │ <your-account-id>                │
└────────────────────┴──────────────────────────────────┘
```

Record the `Account ID` — some dashboard URLs require it.

---

## Step 2 — Create D1 databases

Two databases: one for preview deploys, one for production. Environment separation rationale lives in [`INFRASTRUCTURE.md`](./INFRASTRUCTURE.md#cloudflare-d1-database).

### Preview database

```powershell
npx wrangler d1 create golf-preview
```

**What to expect:** Wrangler prints a `database_id` UUID and a JSONC snippet for `wrangler.jsonc`:

```
✅ Successfully created DB 'golf-preview'

{
  "binding": "DB",
  "database_name": "golf-preview",
  "database_id": "<generated-by-wrangler>"
}
```

### Production database

```powershell
npx wrangler d1 create golf-prod
```

Same output shape with a different `database_id`.

### Critical follow-up — register IDs in `wrangler.jsonc`

The repo uses `web/wrangler.jsonc` (JSON-with-comments). The canonical shape already committed is:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "golf",
  "compatibility_date": "2026-04-17",
  "compatibility_flags": ["nodejs_als"],
  "pages_build_output_dir": ".svelte-kit/cloudflare",
  "d1_databases": [
    { "binding": "DB", "database_name": "golf-prod", "database_id": "<prod-uuid>" }
  ],
  "env": {
    "preview": {
      "d1_databases": [
        { "binding": "DB", "database_name": "golf-preview", "database_id": "<preview-uuid>" }
      ]
    },
    "production": {
      "d1_databases": [
        { "binding": "DB", "database_name": "golf-prod", "database_id": "<prod-uuid>" }
      ]
    }
  }
}
```

Replace the two UUIDs with the IDs printed by `wrangler d1 create`. The current committed IDs are recorded in [`INFRASTRUCTURE.md`](./INFRASTRUCTURE.md#cloudflare-d1-database).

> **Note:** Database IDs are not secrets. Committing them to the repo is intentional and required — they are the stable references every environment uses.

### Verify

```powershell
npx wrangler d1 list
```

Expected output:

```
┌────────────────────┬──────────────────────────────────────┬─────────┬───────────┐
│ name               │ uuid                                 │ version │ ...       │
├────────────────────┼──────────────────────────────────────┼─────────┼───────────┤
│ golf-preview       │ <preview-uuid>                       │ ...     │ ...       │
│ golf-prod          │ <prod-uuid>                          │ ...     │ ...       │
└────────────────────┴──────────────────────────────────────┴─────────┴───────────┘
```

---

## Step 3 — Create Cloudflare Pages project

Creates the hosting project that both preview branches and `main` deploy into. Project metadata lives in [`INFRASTRUCTURE.md`](./INFRASTRUCTURE.md#cloudflare-pages-project).

```powershell
npx wrangler pages project create golf --production-branch main
```

**What to expect:**

```
✨ Successfully created the 'golf' project.
To deploy a folder of assets, run 'wrangler pages deploy <directory>'.
```

Visit `https://dash.cloudflare.com/<your-account-id>/workers-and-pages/view/golf` to confirm the project exists in the dashboard.

### Verify

```powershell
npx wrangler pages project list
```

Expected: `golf` appears in the list with `Production branch: main`.

---

## Step 4 — Generate and register Workers secrets

Five secrets × two environments = ten `wrangler pages secret put` invocations. The full table of secrets and their purposes lives in [`INFRASTRUCTURE.md`](./INFRASTRUCTURE.md#workers-secrets).

> **Warning:** Never commit secret values. Never pass them as CLI arguments — they would be logged by PowerShell history and Windows Event Log. Always paste into the interactive prompt.

### Generate a random 32-byte hex value

The HMAC helpers in `web/src/lib/auth/cookies.ts` expect **hex-encoded** keys. Use this PowerShell one-liner to generate one value at a time:

```powershell
[BitConverter]::ToString((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 })).Replace('-','').ToLower()
```

bash / zsh equivalent:

```bash
openssl rand -hex 32
```

Copy the output to your clipboard. Each of `COOKIE_SIGNING_KEY`, `SPECTATOR_COOKIE_KEY`, and `MAGIC_LINK_KEY` must be **independently generated** — do not reuse a value across the three names or across environments.

`EMAIL_API_KEY` is not generated locally; you will copy it from the smtp2go dashboard after completing [Step 5](#step-5--add-smtp2go-sending-domain-and-dns-records).

`FROM_EMAIL` is the display + envelope address used for magic-link emails. The committed production value is `SBCC Tears <michael@sbcctears.com>`.

### Register one secret

Pages Functions secrets are managed via the `pages secret` subcommand (not `secret`):

```powershell
npx wrangler pages secret put COOKIE_SIGNING_KEY --project-name golf
```

**What to expect:** Wrangler prompts to select the environment (Preview or Production), then:

```
Enter a secret value: ***************
```

Paste the clipboard value. Press Enter. Output:

```
✨ Success! Uploaded secret COOKIE_SIGNING_KEY
```

### Repeat for the full matrix

Ten registrations total (run each twice, once per environment prompt):

| Secret | preview | production |
|---|---|---|
| `COOKIE_SIGNING_KEY` | generate new | generate new |
| `SPECTATOR_COOKIE_KEY` | generate new | generate new |
| `MAGIC_LINK_KEY` | generate new | generate new |
| `EMAIL_API_KEY` | smtp2go key (see Step 5) | smtp2go key (see Step 5) |
| `FROM_EMAIL` | `SBCC Tears <michael@sbcctears.com>` | `SBCC Tears <michael@sbcctears.com>` |

For `EMAIL_API_KEY` you can share the same key across preview and production, or create two smtp2go API keys (one per env) for independent rotation.

Registration command pattern (re-run for each secret; pick the env at the prompt):

```powershell
npx wrangler pages secret put <NAME> --project-name golf
```

### Verify

```powershell
npx wrangler pages secret list --project-name golf
```

Expected output includes all five secret names (`COOKIE_SIGNING_KEY`, `SPECTATOR_COOKIE_KEY`, `MAGIC_LINK_KEY`, `EMAIL_API_KEY`, `FROM_EMAIL`) in both preview and production environments before production deploy.

---

## Step 5 — Add smtp2go sending domain and DNS records

Configure the email provider that sends commissioner magic-link emails. The app POSTs to `https://api.smtp2go.com/v3/email/send` from `web/src/lib/auth/emailClient.ts` — Cloudflare Workers cannot open raw SMTP sockets, so an HTTP API is required. Resource specification lives in [`INFRASTRUCTURE.md`](./INFRASTRUCTURE.md#smtp2go-email-provider).

### 5a — Create smtp2go account and add sending domain

1. Sign up at [https://www.smtp2go.com](https://www.smtp2go.com).
2. Dashboard → **Sending** → **Verified Senders** → **Add Domain**.
3. Enter `sbcctears.com` (apex). The committed `FROM_EMAIL` sends from `michael@sbcctears.com`.
4. smtp2go displays a table of DNS records to add: DKIM (one or more CNAMEs), optional tracking CNAME, DMARC (TXT). **Leave this tab open** — you'll copy exact values from it in Step 5b.

### 5b — Add DNS records in Cloudflare

For each record smtp2go shows:

1. Open Cloudflare dashboard → `sbcctears.com` zone → **DNS** → **Records** → **Add record**.
2. Fill the fields as smtp2go specifies. Exact values are account-specific — copy them verbatim from the smtp2go dashboard.

Record shapes (reference only — use the smtp2go-provided values as authoritative):

| smtp2go record | Cloudflare `Type` | Cloudflare `Name` | Cloudflare `Content` | Proxy status | TTL |
|---|---|---|---|---|---|
| DKIM selector(s) | `CNAME` | `s<N>._domainkey` | `<smtp2go-dkim-target>` | DNS only | Auto |
| Tracking (optional) | `CNAME` | `link` | `<smtp2go-tracking-host>` | DNS only | Auto |
| DMARC | `TXT` | `_dmarc` | `v=DMARC1; p=none; rua=mailto:<admin-email>` | DNS only | Auto |

> **Note:** Cloudflare's DNS `Name` field appends the zone automatically — enter only the host portion (`s1._domainkey`, not `s1._domainkey.sbcctears.com`).

> **Warning:** All records must be **DNS only** (grey cloud), not proxied. Proxying breaks DNS-based email authentication.

### 5c — Verify the domain in smtp2go

1. Back in the smtp2go dashboard, open the domain you just added.
2. Click **Verify**. Cloudflare DNS usually propagates within seconds; smtp2go will re-check each record.
3. All records must turn green (**Verified**) before sending will work.

#### Verify — DNS visibility from your workstation

PowerShell:

```powershell
nslookup -type=CNAME s1._domainkey.sbcctears.com
nslookup -type=TXT _dmarc.sbcctears.com
```

bash / zsh:

```bash
dig +short CNAME s1._domainkey.sbcctears.com
dig +short TXT _dmarc.sbcctears.com
```

Expected: non-empty results matching the values smtp2go showed you.

### 5d — Create smtp2go API key and register as Workers secret

1. smtp2go dashboard → **Settings** → **API Keys** → **Add API Key**.
2. Scope it to **Send email**, restricted to the verified sender domain.
3. Copy the key immediately — smtp2go will not display it again.
4. Register it as the `EMAIL_API_KEY` Pages secret using the pattern from [Step 4](#step-4--generate-and-register-workers-secrets):

```powershell
npx wrangler pages secret put EMAIL_API_KEY --project-name golf
```

Paste the key into the prompt. Select the environment when prompted; repeat for the other environment with either the same key or a separately-created per-env key (recommended).

5. Register the sender identity:

```powershell
npx wrangler pages secret put FROM_EMAIL --project-name golf
```

When prompted, paste `SBCC Tears <michael@sbcctears.com>` (or your substitute).

---

## Step 6 — Apply migrations (preview)

Applies the DDL + seed + patch migrations to the remote preview D1 database. D1 migration mechanics live in [`INFRASTRUCTURE.md`](./INFRASTRUCTURE.md#cloudflare-d1-database).

### Apply via the project script

```powershell
cd web
npm run migrations:apply -- --env preview
```

The script wraps `npx wrangler d1 migrations apply DB --remote --env preview` and applies files under `web/migrations/` in filename order.

Direct-wrangler equivalent (skip the wrapper):

```powershell
npx wrangler d1 migrations apply DB --remote --env preview
```

**What to expect:** Wrangler lists pending migrations, prompts for confirmation, then runs each:

```
Migrations to be applied:
┌──────────────────────────────────────────────┐
│ name                                         │
├──────────────────────────────────────────────┤
│ 0001_init.sql                                │
│ 0002_seed_kiawah.sql                         │
│ 0003_add_match_id_to_processed_ops.sql       │
│ 0004_seed_demo_tournament.sql                │
└──────────────────────────────────────────────┘
✔ Ok to apply? … yes
🌀 Executing on remote database golf-preview:
🚣  Executed X queries in Y ms
```

### Verify

```powershell
npx wrangler d1 execute DB --remote --env preview --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

Expected output includes the migration tracking table plus every entity table from the schema (for example: `audit_log`, `commissioners`, `courses`, `holes`, `hole_scores`, `magic_link_tokens`, `match_hole_results`, `match_results`, `match_side_players`, `match_sides`, `matches`, `players`, `processed_ops`, `round_segments`, `rounds`, `teams`, `tees`, `tournaments`).

---

## Step 7 — First preview deploy

Triggers the first Cloudflare Pages build off your feature branch. No CLI deploy is needed — Pages CI builds from Git.

### 7a — Configure a Git remote (if not already set)

`git remote -v` from the workspace root lists configured remotes. If none exist, add one:

```powershell
cd c:\Users\MichaelCoffey\prj-kiawah
git remote add origin <your-git-url>
```

Use GitHub, Cloudflare Pages' own Git-integration, or any git host that Pages supports.

### 7b — Connect the repo in Cloudflare Pages

1. Cloudflare dashboard → **Workers & Pages** → `golf` → **Settings** → **Builds & deployments** → **Git**.
2. Click **Connect to Git** and authorize Cloudflare to read the repo.
3. Build configuration:
   - **Framework preset:** SvelteKit
   - **Build command:** `npm run build`
   - **Build output directory:** `.svelte-kit/cloudflare`
   - **Root directory:** `web`
   - **Production branch:** `main`

### 7c — Push the feature branch

```powershell
git push -u origin feature/golf-rebrand
```

**What to expect:** Pages CI detects the push and starts a preview build. Watch progress at the project's **Deployments** tab.

Build logs stream in the dashboard. On success, the preview URL is:

```
https://feature-golf-rebrand.golf.pages.dev
```

(Branch name is slugified; underscores and slashes become dashes.)

### Verify

PowerShell:

```powershell
Invoke-WebRequest -Method Head https://feature-golf-rebrand.golf.pages.dev
```

bash / zsh:

```bash
curl -I https://feature-golf-rebrand.golf.pages.dev
```

Expected: HTTP `200`, `cf-ray` header present, `content-type: text/html`. The response body serves the SvelteKit welcome page (or whatever the current root route renders).

---

## Step 8 — Production cutover

Repeat preview's migration + secret setup against `--env production`, then bind the custom domain.

### 8a — Apply migrations to production D1

```powershell
cd web
npm run migrations:apply -- --env production
```

Verify:

```powershell
npx wrangler d1 execute DB --remote --env production --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

Same expected table list as [Step 6](#step-6--apply-initial-migration-preview).

### 8b — Confirm production secrets

The production registrations from [Step 4](#step-4--generate-and-register-workers-secrets) should already be in place:

```powershell
npx wrangler pages secret list --project-name golf
```

All five names (`COOKIE_SIGNING_KEY`, `SPECTATOR_COOKIE_KEY`, `MAGIC_LINK_KEY`, `EMAIL_API_KEY`, `FROM_EMAIL`) must be present for the production environment.

### 8c — Bind custom domain

1. Cloudflare dashboard → **Workers & Pages** → `golf` → **Custom domains** → **Set up a custom domain**.
2. Enter `golf.sbcctears.com`.
3. Cloudflare detects the zone and auto-creates the CNAME in `sbcctears.com`. TLS provisions automatically (Google Trust Services).
4. Wait 1–5 minutes for SSL status to flip to **Active**.

### 8d — Merge to `main` to trigger production deploy

```powershell
git checkout main
git merge feature/golf-rebrand --ff-only
git push origin main
```

Pages CI rebuilds and deploys to the custom domain.

### Verify

PowerShell:

```powershell
Invoke-WebRequest -Method Head https://golf.sbcctears.com
```

bash / zsh:

```bash
curl -I https://golf.sbcctears.com
```

Expected:

```
HTTP/2 200
cf-ray: <ray-id>
content-type: text/html
server: cloudflare
```

Certificate: issued by Google Trust Services, valid, not expired.

---

## Commissioner login (first-time)

Authenticates an operator against the production app. The endpoint auto-provisions a commissioner row for any valid email on first use — there is currently no allowlist.

1. Navigate to `https://golf.sbcctears.com/manage/login`.
2. Enter the commissioner email `coffey.mikey@gmail.com`.
3. Submit the form. A magic-link email arrives within seconds, sent from `FROM_EMAIL` via smtp2go.
4. Click the link. You are redirected to `/manage` as an authenticated commissioner.

### Dev-mode fallback

When running `npm run dev` with `EMAIL_API_KEY` or `FROM_EMAIL` unset, `/api/auth/magic-link/request` skips the smtp2go send and prints the link to the server console:

```
[dev] MAGIC LINK for <email>: <url>  (expires <iso>)
```

Copy the URL from the terminal and open it directly in the browser. `MAGIC_LINK_KEY` and `COOKIE_SIGNING_KEY` remain required; missing either returns 500 regardless of environment.

### Troubleshooting

Tail production logs to surface send errors from `emailClient.ts`:

```powershell
npx wrangler pages deployment tail --project-name golf
```

## Demo tournament

Migration `web/migrations/0006_reset_demo_tournament.sql` resets demo data and seeds the current demo tournament. Commissioner row (`coffey.mikey@gmail.com`) is preserved across the reset.

| Field | Value |
|---|---|
| Code | `KIAWAH` |
| Name | `Kiawah Cup 2026` |
| Commissioner | `coffey.mikey@gmail.com` |
| Teams | `USA` (red `#dc2626`), `Europe` (blue `#1d4ed8`) — 2 players each |
| Round | One round on Cougar Point (Kiawah) |
| Matches | Two FOURBALL matches — F9 (holes 1–9) and B9 (holes 10–18) |

Public URLs:

- Tournament view: `https://golf.sbcctears.com/t/KIAWAH`
- Join flow: `https://golf.sbcctears.com/join/KIAWAH`

---

## Development Workflow

### Running locally

```powershell
cd web
npm run dev               # Start SvelteKit dev server at localhost:5173
npm run migrations:apply  # Apply D1 migrations to local D1
```

Local D1 uses a SQLite file under `web/.wrangler/state/`. No Cloudflare credentials required.

### Running tests

```powershell
cd web
npm run test        # Run all Vitest unit tests
npm run test:watch  # Watch mode
npm run e2e         # Playwright E2E tests (requires running dev server)
```

### Building

```powershell
cd web
npm run build    # Build for Cloudflare Pages
npm run preview  # Preview production build locally
```

### Linting and formatting

```powershell
cd web
npm run lint    # ESLint
npm run format  # Prettier
```

### Database migrations

All migrations live in `web/migrations/`. Apply in filename order.

| Target | Command |
|---|---|
| Local | `npm run migrations:apply` (uses `--local` flag) |
| Remote preview | `npx wrangler d1 migrations apply DB --remote --env preview` |
| Remote production | `npx wrangler d1 migrations apply DB --remote --env production` |

Current migrations:

| File | Description |
|---|---|
| `0001_init.sql` | Full schema — all entity tables and indexes |
| `0002_seed_kiawah.sql` | 5 Kiawah courses with tees, holes, SI, CR/Slope |
| `0003_add_match_id_to_processed_ops.sql` | Adds `match_id` column + unique index to `processed_ops` for match-scoped idempotency |
| `0004_seed_demo_tournament.sql` | Seeds public demo tournament (code `DEMO26`) for testing |

---

## Rollback / Rotation

### Rotate a Workers secret

`wrangler pages secret put` overwrites atomically — register the new value with the same name. The next request served by a Pages Function binding picks up the rotated value; no redeploy required.

```powershell
npx wrangler pages secret put COOKIE_SIGNING_KEY --project-name golf
```

> **Warning:** Rotating `COOKIE_SIGNING_KEY`, `SPECTATOR_COOKIE_KEY`, or `MAGIC_LINK_KEY` invalidates every existing cookie / token signed with the old key. All commissioners will be logged out; all in-flight magic links will fail. Do this only with intent.

### Roll back a production deploy

1. Cloudflare dashboard → `golf` → **Deployments**.
2. Find a prior known-good deployment.
3. Click the deployment → **Retry deployment** → **Promote**.

The promoted deployment serves `golf.sbcctears.com` within seconds. The rolled-back state is the Pages bundle only; D1 migrations are **not** reverted by this action.

### Revoke an smtp2go API key

1. smtp2go dashboard → **Settings** → **API Keys**.
2. Find the key → **Disable** (or delete).
3. Immediately register a replacement via [Step 4](#step-4--generate-and-register-workers-secrets)'s pattern and update `EMAIL_API_KEY` in both envs.

### Rotate a D1 database

Beyond the scope of routine rotation; requires a new migration pass and a `wrangler.jsonc` ID swap. Coordinate with the Architect.

---

## Troubleshooting

### `Authentication error` from any `wrangler` command

The cached OAuth token expired or is bound to a different account.

```powershell
npx wrangler logout
npx wrangler login
```

Re-run the failed command.

### D1 migration fails with `no such column` or `table already exists`

Local and remote D1 databases are independent. A migration applied to `--local` is invisible to `--remote`, and vice versa. Confirm which target you meant and re-run with the correct flag.

Inspect remote schema directly:

```powershell
npx wrangler d1 execute DB --remote --env preview --command ".schema"
```

### Preview URL returns 404 or `There is nothing here yet`

The Pages deployment likely failed silently. Check:

1. Dashboard → `golf` → **Deployments** → latest deployment → **View build log**.
2. Common causes: missing Node version pin, missing `web/` root directory in build config, lint/test failure in CI.

### smtp2go says "Domain not verified" despite records being added

Three possibilities:

1. **DNS records are proxied.** Cloudflare's orange-cloud proxy breaks email authentication. Set each record to **DNS only**.
2. **Name field includes the zone suffix.** Cloudflare auto-appends `sbcctears.com`; entering `s1._domainkey.sbcctears.com` produces `s1._domainkey.sbcctears.com.sbcctears.com`. Use only the host portion.
3. **Propagation delay.** Cloudflare DNS is typically near-instant, but confirm with:

   ```powershell
   nslookup -type=CNAME s1._domainkey.sbcctears.com
   ```

   If the record is not visible from your workstation, Cloudflare hasn't published it yet. Wait 60 seconds and retry.

### Magic-link email never arrives

1. Tail logs: `npx wrangler pages deployment tail --project-name golf`. Look for an error thrown from `emailClient.ts` (shape: `smtp2go email send failed with status <code>: <body>`).
2. If status `401` / `403`: `EMAIL_API_KEY` is wrong or lacks send scope. Re-issue from smtp2go and re-register the secret.
3. If status `400` with `sender` complaint: `FROM_EMAIL` uses an address on a domain not yet verified in smtp2go. Complete [Step 5c](#5c--verify-the-domain-in-smtp2go) first.

### `wrangler d1 list` shows no databases after Step 2

You're authenticated to a different Cloudflare account than the one that owns the databases. Run `npx wrangler whoami` and confirm the account.

### Custom domain stuck on "Verifying" in Pages

Pages issues TLS via DNS-01 challenges. If stuck for more than 10 minutes:

1. Dashboard → `sbcctears.com` zone → **DNS** → confirm the `golf` CNAME exists and is proxied (orange cloud).
2. Dashboard → `golf` → **Custom domains** → remove and re-add the domain.
