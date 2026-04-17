# Ryder Cup App — One-Time Setup Guide

## Overview
This runbook provisions every piece of infrastructure the Ryder Cup app requires on a fresh Cloudflare account. It is the operator-facing complement to [`INFRASTRUCTURE.md`](./INFRASTRUCTURE.md): the blueprint declares *what* must exist; this guide prescribes *how* to create it. Run it once before the first deploy and again only to rotate a rotated resource (new account, new secret, new sending domain).

All commands target Windows PowerShell because the workspace OS is Windows. bash/zsh equivalents are shown inline where the command differs.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Step 1 — Cloudflare authentication](#step-1--cloudflare-authentication)
3. [Step 2 — Create D1 databases](#step-2--create-d1-databases)
4. [Step 3 — Create Cloudflare Pages project](#step-3--create-cloudflare-pages-project)
5. [Step 4 — Generate and register Workers secrets](#step-4--generate-and-register-workers-secrets)
6. [Step 5 — Add Resend sending domain and DNS records](#step-5--add-resend-sending-domain-and-dns-records)
7. [Step 6 — Apply initial migration (preview)](#step-6--apply-initial-migration-preview)
8. [Step 7 — First preview deploy](#step-7--first-preview-deploy)
9. [Step 8 — Production cutover](#step-8--production-cutover)
10. [Rollback / Rotation](#rollback--rotation)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Windows with PowerShell 5.1+ | Primary shell. bash/zsh notes appear in callouts where commands differ. |
| Node.js LTS + npm | Installed by task P0.T3 during scaffolding. Verify with `node --version` and `npm --version`. |
| Cloudflare account | Free tier is sufficient — see [`INFRASTRUCTURE.md`](./INFRASTRUCTURE.md#cloudflare-account--authentication). `sbcctears.com` is already on Cloudflare DNS. |
| Resend account (free tier) | Sign up at [resend.com](https://resend.com). Free tier: 3,000 emails/month, 100/day. Needed in [Step 5](#step-5--add-resend-sending-domain-and-dns-records). |
| Terminal at workspace root | `c:\Users\MichaelCoffey\prj-kiawah`. All `npx wrangler` commands below must be run from `web/` unless stated otherwise. |

> **Note:** No resource names, domains, or secret values are hardcoded in this document beyond the shared identifiers agreed in [`INFRASTRUCTURE.md`](./INFRASTRUCTURE.md) (`ryder-cup-app`, `ryder-cup-preview`, `ryder-cup-prod`, `mail.rydercup.sbcctears.com`). Swap them consistently if you fork the project.

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
npx wrangler d1 create ryder-cup-preview
```

**What to expect:** Wrangler prints a `database_id` UUID and a `wrangler.toml` snippet:

```
✅ Successfully created DB 'ryder-cup-preview'

[[d1_databases]]
binding = "DB"
database_name = "ryder-cup-preview"
database_id = "<generated-by-wrangler>"
```

### Production database

```powershell
npx wrangler d1 create ryder-cup-prod
```

Same output shape with a different `database_id`.

### Critical follow-up — register IDs in `wrangler.jsonc`

The repo uses `web/wrangler.jsonc` (JSON-with-comments). Open it and add `[env.preview]` and `[env.production]` blocks bound to the `DB` binding, replacing the zero-UUID placeholders left by task P0.T4. The shape should be:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "ryder-cup-app",
  "compatibility_date": "2026-04-17",
  "compatibility_flags": ["nodejs_als"],
  "pages_build_output_dir": ".svelte-kit/cloudflare",
  "env": {
    "preview": {
      "d1_databases": [
        {
          "binding": "DB",
          "database_name": "ryder-cup-preview",
          "database_id": "<preview-uuid-from-wrangler>"
        }
      ]
    },
    "production": {
      "d1_databases": [
        {
          "binding": "DB",
          "database_name": "ryder-cup-prod",
          "database_id": "<prod-uuid-from-wrangler>"
        }
      ]
    }
  }
}
```

> **Note:** Database IDs are not secrets. Committing them to the repo is intentional and required — they are the stable references every environment uses.

> **Warning:** At the time of writing, task P0.T4 authors the `env.preview` / `env.production` blocks and placeholder IDs. If those blocks are not yet present in `wrangler.jsonc`, stop here and complete P0.T4 before continuing.

### Verify

```powershell
npx wrangler d1 list
```

Expected output:

```
┌────────────────────┬──────────────────────────────────────┬─────────┬───────────┐
│ name               │ uuid                                 │ version │ ...       │
├────────────────────┼──────────────────────────────────────┼─────────┼───────────┤
│ ryder-cup-preview  │ <preview-uuid>                       │ ...     │ ...       │
│ ryder-cup-prod     │ <prod-uuid>                          │ ...     │ ...       │
└────────────────────┴──────────────────────────────────────┴─────────┴───────────┘
```

---

## Step 3 — Create Cloudflare Pages project

Creates the hosting project that both preview branches and `main` deploy into. Project metadata lives in [`INFRASTRUCTURE.md`](./INFRASTRUCTURE.md#cloudflare-pages-project).

```powershell
npx wrangler pages project create ryder-cup-app --production-branch main
```

**What to expect:**

```
✨ Successfully created the 'ryder-cup-app' project.
To deploy a folder of assets, run 'wrangler pages deploy <directory>'.
```

Visit `https://dash.cloudflare.com/<your-account-id>/workers-and-pages/view/ryder-cup-app` to confirm the project exists in the dashboard.

### Verify

```powershell
npx wrangler pages project list
```

Expected: `ryder-cup-app` appears in the list with `Production branch: main`.

---

## Step 4 — Generate and register Workers secrets

Four secrets × two environments = eight `wrangler secret put` invocations. The full table of secrets and their purposes lives in [`INFRASTRUCTURE.md`](./INFRASTRUCTURE.md#workers-secrets).

> **Warning:** Never commit secret values. Never pass them as CLI arguments — they would be logged by PowerShell history and Windows Event Log. Always paste into the interactive prompt.

### Generate a random 32-byte base64 value

Use this PowerShell one-liner to generate one secret value at a time:

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

bash / zsh equivalent:

```bash
openssl rand -base64 32
```

Copy the output to your clipboard. Each of `COOKIE_SIGNING_KEY`, `SPECTATOR_COOKIE_KEY`, and `MAGIC_LINK_KEY` must be **independently generated** — do not reuse a value across the three names or across environments.

`RESEND_API_KEY` is not generated locally; you will copy it from the Resend dashboard after completing [Step 5](#step-5--add-resend-sending-domain-and-dns-records).

### Register one secret

```powershell
npx wrangler secret put COOKIE_SIGNING_KEY --env preview
```

**What to expect:** Wrangler prompts:

```
Enter a secret value: ***************
```

Paste the clipboard value. Press Enter. Output:

```
🌀 Creating the secret for Worker "ryder-cup-app" (preview)
✨ Success! Uploaded secret COOKIE_SIGNING_KEY
```

### Repeat for the full matrix

Eight registrations total:

| Secret | preview | production |
|---|---|---|
| `COOKIE_SIGNING_KEY` | generate new | generate new |
| `SPECTATOR_COOKIE_KEY` | generate new | generate new |
| `MAGIC_LINK_KEY` | generate new | generate new |
| `RESEND_API_KEY` | same key from Resend (see Step 5) | same key from Resend (see Step 5) |

For `RESEND_API_KEY` you can share the same key across preview and production, or create two Resend API keys (one per env) if you want independent rotation. The [`INFRASTRUCTURE.md`](./INFRASTRUCTURE.md#workers-secrets) default is **per-environment independent keys**.

Registration command pattern (run for each row × each env):

```powershell
npx wrangler secret put <NAME> --env preview
npx wrangler secret put <NAME> --env production
```

### Verify

```powershell
npx wrangler secret list --env preview
npx wrangler secret list --env production
```

Expected output for each env:

```
[
  { "name": "COOKIE_SIGNING_KEY", "type": "secret_text" },
  { "name": "MAGIC_LINK_KEY", "type": "secret_text" },
  { "name": "RESEND_API_KEY", "type": "secret_text" },
  { "name": "SPECTATOR_COOKIE_KEY", "type": "secret_text" }
]
```

All four names must be present in both environments before production deploy.

---

## Step 5 — Add Resend sending domain and DNS records

Configure the email provider that sends commissioner magic-link emails. Resource specification lives in [`INFRASTRUCTURE.md`](./INFRASTRUCTURE.md#resend-email-provider).

### 5a — Create Resend account and add sending domain

1. Sign up at [https://resend.com](https://resend.com) (free tier).
2. Dashboard → **Domains** → **Add Domain**.
3. Enter `mail.rydercup.sbcctears.com` (the project's dedicated sending subdomain). You may choose a different subdomain of `sbcctears.com`; update references everywhere if you do.
4. Select region (closest to your commissioners).
5. Resend displays a table of DNS records to add: SPF (TXT), DKIM (one or more CNAMEs), DMARC (TXT). **Leave this tab open** — you'll copy exact values from it in Step 5b.

### 5b — Add DNS records in Cloudflare

For each record Resend shows:

1. Open Cloudflare dashboard → `sbcctears.com` zone → **DNS** → **Records** → **Add record**.
2. Fill the fields as Resend specifies. Exact values are account-specific — copy them verbatim from the Resend dashboard.

Record shapes (reference only — use the Resend-provided values as authoritative):

| Resend record | Cloudflare `Type` | Cloudflare `Name` | Cloudflare `Content` | Proxy status | TTL |
|---|---|---|---|---|---|
| SPF | `TXT` | `mail.rydercup` | `v=spf1 include:<resend-host> ~all` | DNS only | Auto |
| DKIM #1 | `CNAME` | `resend._domainkey.mail.rydercup` | `<resend-dkim-target>` | DNS only | Auto |
| DKIM #2 (if issued) | `CNAME` | `<selector>.mail.rydercup` | `<resend-dkim-target>` | DNS only | Auto |
| DMARC | `TXT` | `_dmarc.mail.rydercup` | `v=DMARC1; p=none; rua=mailto:<admin-email>` | DNS only | Auto |

> **Note:** Cloudflare's DNS `Name` field appends the zone automatically — enter only the host portion (`mail.rydercup`, not `mail.rydercup.sbcctears.com`).

> **Warning:** All four records must be **DNS only** (grey cloud), not proxied. Proxying breaks DNS-based email authentication.

### 5c — Verify the domain in Resend

1. Back in the Resend dashboard, open the domain you just added.
2. Click **Verify DNS Records**. Cloudflare DNS usually propagates within seconds; Resend will re-check each record.
3. All records must turn green (**Verified**) before sending will work.

#### Verify — DNS visibility from your workstation

PowerShell:

```powershell
nslookup -type=TXT mail.rydercup.sbcctears.com
nslookup -type=CNAME resend._domainkey.mail.rydercup.sbcctears.com
nslookup -type=TXT _dmarc.mail.rydercup.sbcctears.com
```

bash / zsh:

```bash
dig +short TXT mail.rydercup.sbcctears.com
dig +short CNAME resend._domainkey.mail.rydercup.sbcctears.com
dig +short TXT _dmarc.mail.rydercup.sbcctears.com
```

Expected: non-empty results matching the values Resend showed you.

### 5d — Create Resend API key and register as Workers secret

1. Resend dashboard → **API Keys** → **Create API Key**.
2. Name it `ryder-cup-preview` (or `ryder-cup-prod`). Scope: **Sending access** on the verified domain.
3. Copy the key immediately — Resend will not display it again.
4. Register it as the `RESEND_API_KEY` Workers secret using the pattern from [Step 4](#step-4--generate-and-register-workers-secrets):

```powershell
npx wrangler secret put RESEND_API_KEY --env preview
```

Paste the key into the prompt. Repeat with `--env production` using either the same key or a separately-created prod key (recommended).

---

## Step 6 — Apply initial migration (preview)

Applies the DDL schema to the remote preview D1 database. D1 migration mechanics live in [`INFRASTRUCTURE.md`](./INFRASTRUCTURE.md#cloudflare-d1-database).

> **Warning:** This step requires `web/migrations/0001_init.sql` and the `migrations:apply` script, both authored in **Phase 1** (tasks P1.T1 and P1.T3). If `web/migrations/` is empty or the script is missing, stop here and complete Phase 1 before returning. Running this step with no migration files is a harmless no-op but provides no schema.

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
┌────────────────────────┐
│ name                   │
├────────────────────────┤
│ 0001_init.sql          │
│ 0002_seed_kiawah.sql   │
└────────────────────────┘
✔ Ok to apply? … yes
🌀 Executing on remote database ryder-cup-preview:
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

1. Cloudflare dashboard → **Workers & Pages** → `ryder-cup-app` → **Settings** → **Builds & deployments** → **Git**.
2. Click **Connect to Git** and authorize Cloudflare to read the repo.
3. Build configuration:
   - **Framework preset:** SvelteKit
   - **Build command:** `npm run build`
   - **Build output directory:** `.svelte-kit/cloudflare`
   - **Root directory:** `web`
   - **Production branch:** `main`

### 7c — Push the feature branch

```powershell
git push -u origin feature/ryder-cup-app
```

**What to expect:** Pages CI detects the push and starts a preview build. Watch progress at the project's **Deployments** tab.

Build logs stream in the dashboard. On success, the preview URL is:

```
https://feature-ryder-cup-app.ryder-cup-app.pages.dev
```

(Branch name is slugified; underscores and slashes become dashes.)

### Verify

PowerShell:

```powershell
Invoke-WebRequest -Method Head https://feature-ryder-cup-app.ryder-cup-app.pages.dev
```

bash / zsh:

```bash
curl -I https://feature-ryder-cup-app.ryder-cup-app.pages.dev
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

The `--env production` registrations from [Step 4](#step-4--generate-and-register-workers-secrets) should already be in place:

```powershell
npx wrangler secret list --env production
```

All four names must be present.

### 8c — Bind custom domain

1. Cloudflare dashboard → **Workers & Pages** → `ryder-cup-app` → **Custom domains** → **Set up a custom domain**.
2. Enter `rydercup.sbcctears.com`.
3. Cloudflare detects the zone and auto-creates the CNAME in `sbcctears.com`. Universal SSL provisions automatically.
4. Wait 1–5 minutes for SSL status to flip to **Active**.

### 8d — Merge to `main` to trigger production deploy

```powershell
git checkout main
git merge feature/ryder-cup-app --ff-only
git push origin main
```

Pages CI rebuilds and deploys to the custom domain.

### Verify

PowerShell:

```powershell
Invoke-WebRequest -Method Head https://rydercup.sbcctears.com
```

bash / zsh:

```bash
curl -I https://rydercup.sbcctears.com
```

Expected:

```
HTTP/2 200
cf-ray: <ray-id>
content-type: text/html
server: cloudflare
```

Certificate: issued by Cloudflare / Google Trust Services, valid, not expired.

---

## Rollback / Rotation

### Rotate a Workers secret

`wrangler secret put` overwrites atomically — register the new value with the same name. The next request served by a Pages Function binding picks up the rotated value; no redeploy required.

```powershell
npx wrangler secret put COOKIE_SIGNING_KEY --env production
```

> **Warning:** Rotating `COOKIE_SIGNING_KEY`, `SPECTATOR_COOKIE_KEY`, or `MAGIC_LINK_KEY` invalidates every existing cookie / token signed with the old key. All commissioners will be logged out; all in-flight magic links will fail. Do this only with intent.

### Roll back a production deploy

1. Cloudflare dashboard → `ryder-cup-app` → **Deployments**.
2. Find a prior known-good deployment.
3. Click the deployment → **Retry deployment** → **Promote**.

The promoted deployment serves `rydercup.sbcctears.com` within seconds. The rolled-back state is the Pages bundle only; D1 migrations are **not** reverted by this action.

### Revoke a Resend API key

1. Resend dashboard → **API Keys**.
2. Find the key → **Revoke**.
3. Immediately register a replacement via [Step 4](#step-4--generate-and-register-workers-secrets)'s pattern and update `RESEND_API_KEY` in both envs.

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

1. Dashboard → `ryder-cup-app` → **Deployments** → latest deployment → **View build log**.
2. Common causes: missing Node version pin, missing `web/` root directory in build config, lint/test failure in CI.

### Resend says "Domain not verified" despite records being added

Three possibilities:

1. **DNS records are proxied.** Cloudflare's orange-cloud proxy breaks email authentication. Set each record to **DNS only**.
2. **Name field includes the zone suffix.** Cloudflare auto-appends `sbcctears.com`; entering `mail.rydercup.sbcctears.com` produces `mail.rydercup.sbcctears.com.sbcctears.com`. Use only the host portion.
3. **Propagation delay.** Cloudflare DNS is typically near-instant, but confirm with:

   ```powershell
   nslookup -type=TXT mail.rydercup.sbcctears.com
   ```

   If the TXT record is not visible from your workstation, Cloudflare hasn't published it yet. Wait 60 seconds and retry.

### `wrangler d1 list` shows no databases after Step 2

You're authenticated to a different Cloudflare account than the one that owns the databases. Run `npx wrangler whoami` and confirm the account.

### Custom domain stuck on "Verifying" in Pages

Pages issues Universal SSL via DNS-01 challenges. If stuck for more than 10 minutes:

1. Dashboard → `sbcctears.com` zone → **DNS** → confirm the `rydercup` CNAME exists and is proxied (orange cloud).
2. Dashboard → `ryder-cup-app` → **Custom domains** → remove and re-add the domain.
