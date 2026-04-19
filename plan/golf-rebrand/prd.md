# PRD — Golf Rebrand, Dark-Mode A11y, Login UX, Demo Seed, E2E Coverage

## 1. Problem Statement

The Kiawah "Ryder Cup" SvelteKit app at `web/` has five intertwined issues blocking a clean public launch under the new identity:

1. **Brand ambiguity** — Rights/neutrality concerns around the "Ryder Cup" name mean every source, config, wrangler binding, Pages project, D1 database, manifest, email subject, documentation reference, and IndexedDB name must move to a generic `golf` identity served at `golf.sbcctears.com`.
2. **Dark-mode accessibility regressions** — Dark-mode CSS tokens fail WCAG AA:
   - `--color-text-muted` (`#6b7280`) on `--color-surface` (`#1f2937`) → **3.0:1 FAIL** (AA body requires 4.5:1).
   - `--color-text-secondary` (`#9ca3af`) on `--color-surface-raised` (`#374151`) → **4.0:1 FAIL**.
   - `--color-accent-text` (`#fff`) on `--color-accent` (`#3b82f6`) → **3.7:1** borderline for non-large text.
   Tokens propagate to 32+ components via `var(--color-*)`, so fixing at the token layer is the correct mechanism. No explicit theme toggle exists; dark mode auto-engages via `prefers-color-scheme` (`web/src/app.css:90-108`).
3. **Commissioner login friction** — `/manage/login` works in code, but: (a) there is no dev fallback when `EMAIL_API_KEY`/`FROM_EMAIL`/`MAGIC_LINK_KEY` are missing (the endpoint 500s with a generic "Could not send magic link"), (b) the login page surfaces only a generic error in both envs, and (c) there is no documented "first-time login as commissioner" path for `coffey.mikey@gmail.com` — making a live verification of the rebrand hard to confirm without code spelunking. The magic-link flow itself auto-creates any OWNER row (`magic-link/request/+server.ts:83-92`).
4. **No testable demo data** — Fresh D1 has no tournament, so a reviewer who logs in has nothing to render at `/t/<code>`, `/manage`, or the live ticker.
5. **No E2E coverage against the deployed site** — `web/playwright.config.ts` exists but `web/tests/e2e/` is empty. There is no automated verification that a rename didn't break the login → create → score path.

## 2. Goals

1. Rename the code, infrastructure, IndexedDB, and documentation from `rydercup` → `golf` with **zero data loss** (service DB and offline outbox) and **zero downtime** perception for the owner during cutover.
2. Raise dark-mode WCAG AA compliance at the token level so every consumer of `--color-text-*` / `--color-accent-text` inherits passing contrast without per-component edits.
3. Make commissioner login usable end-to-end on first try:
   - Dev: no smtp2go required; magic-link URL printed to server console.
   - Prod: works after rename; README + `assets/SETUP.md` document the owner login flow.
   - Login page surfaces specific failure reasons in dev, generic in prod.
4. Seed a stable, idempotent demo tournament (`DEMO26`, commissioner `coffey.mikey@gmail.com`) that survives the `rydercup → golf` D1 cutover.
5. Produce a Playwright E2E suite runnable against `https://golf.sbcctears.com` and a manual test checklist the owner can paste and walk.

## 3. Capability Tree

### C1. Accessibility — Dark-Mode Contrast
- **F1.1** Raise `--color-text-muted` dark value until ≥4.5:1 on `#1f2937` (`--color-surface`) and `#374151` (`--color-surface-raised`). Target `#d1d5db` (candidate).
- **F1.2** Raise `--color-text-secondary` dark value until ≥4.5:1 on both dark surfaces. Target `#e5e7eb` (candidate).
- **F1.3** Fix accent contrast. Option A: darken `--color-accent` dark to `#1d4ed8` (blue-700) → ≥4.5:1 with `#fff`. Option B: keep `#3b82f6` and switch `--color-accent-text` to `#0b1221`. **Decision: Option A** — preserves white-on-blue button mental model across themes.
- **F1.4** No theme toggle in scope. Document as future work.
- Inputs: `web/src/app.css` tokens. Outputs: updated dark-mode CSS variables; no component-level changes.

### C2. Commissioner Login Experience
- **F2.1** Dev fallback: in `magic-link/request/+server.ts`, when `import { dev } from '$app/environment'` is true AND any of `EMAIL_API_KEY`/`FROM_EMAIL` is missing, `console.log` the magic-link URL instead of calling smtp2go; still return `{ message: 'Magic link sent' }`. `MAGIC_LINK_KEY` and `COOKIE_SIGNING_KEY` remain mandatory (the link must still be signed).
- **F2.2** Login page (`web/src/routes/manage/login/+page.svelte`) surfaces the server-returned error body verbatim in dev, generic "Could not send magic link. Try again shortly." in prod. Gate via `$app/environment` on the client side for message selection (the message itself is always the server response — client only chooses between specific and generic rendering).
- **F2.3** Documentation: new "Commissioner login" section in `README.md` and `assets/SETUP.md` covering:
   - Seeded commissioner email: `coffey.mikey@gmail.com`.
   - Local: `npm run dev`, POST email at `/manage/login`, copy URL from server console.
   - Prod: visit `/manage/login` at `golf.sbcctears.com`, enter the address, open email.
- Inputs: existing magic-link flow. Outputs: dev-friendly behavior, documented path, better error UX.

### C3. Demo Tournament Seed
- **F3.1** New migration `web/migrations/0004_seed_demo_tournament.sql` creating:
   - 1 tournament: code `DEMO26`, name "Demo Cup 2026", commissioner email `coffey.mikey@gmail.com`, status `active`.
   - 2 teams: "USA" (preset blue) and "Europe" (preset red).
   - 8 players (4/team) with placeholder first/last names (`Alice Alpha`, `Bob Beta`, `Carol Gamma`, `Dan Delta` for USA; `Emma Echo`, `Frank Foxtrot`, `Greta Golf`, `Henry Hotel` for Europe).
   - 1 round on a Kiawah course (reuse course from `0002_seed_kiawah.sql` — pick the first Kiawah course id available).
   - 4 matches across formats (singles match play, four-ball, foursomes, scramble) to exercise the scoring engine.
- **F3.2** Idempotency: every `INSERT` uses `INSERT OR IGNORE` keyed on deterministic UUIDs (or the natural keys that already have UNIQUE constraints). Re-applying the migration is a no-op.
- **F3.3** Must be applied to both `golf-preview` and `golf-prod` **after** data import from old DBs (so demo tournament is present on fresh stack even if old stack had none).
- Inputs: existing `0001_init.sql` schema, `0002_seed_kiawah.sql` course IDs. Outputs: testable tournament at `/t/DEMO26`.

### C4. Rename `rydercup` → `golf`
- **F4.1 Code & strings** — Rename user-facing strings, class/DB names, config, manifest, email subject/body, test fixtures, docs.
- **F4.2 Dexie migration** — One-shot IndexedDB migration in `web/src/lib/outbox/db.ts`: on first load after rename, if `RyderCupOutbox` exists and `GolfOutbox` does not, copy all `outbox` rows into new DB, then `Dexie.delete('RyderCupOutbox')`. Must be idempotent across tabs (use Dexie's built-in transaction isolation + a write-once guard flag in `localStorage`).
- **F4.3 Infra provisioning** — New Cloudflare Pages project `golf`, new D1 databases `golf-prod` + `golf-preview`, secrets re-registered (5 secrets × 2 envs = 10 `wrangler secret put` calls), custom domain `golf.sbcctears.com` bound to new project.
- **F4.4 Data migration** — Export from `rydercup-prod`/`rydercup-preview` via `wrangler d1 export`, import into `golf-prod`/`golf-preview` via `wrangler d1 execute --file=…`. Performed **before** applying `0004_seed_demo_tournament.sql` to the new databases.
- **F4.5 DNS cutover** — CNAME `golf.sbcctears.com` already added by owner; bind in Cloudflare Pages UI/API; verify TLS + 200 response; then delete old `rydercup.sbcctears.com` CNAME and unbind from old Pages project.
- **F4.6 Cleanup** — Only after owner signs off on new stack: delete old `rydercup` Pages project; delete old `rydercup-prod` + `rydercup-preview` D1 databases.

### C5. End-to-End Testing
- **F5.1** Playwright suite `web/tests/e2e/*.e2e.ts` exercising:
   - Landing page renders in both `prefers-color-scheme: light` and `dark` with contrast assertions (reuse Playwright's `toHaveCSS` against the resolved token values).
   - `/manage/login` request → intercept magic-link email via dev-mode console log (when run locally) OR skip if run against prod (gate via `process.env.E2E_TARGET`).
   - `/t/DEMO26` public view renders, team names present, scores render.
   - Spectator join at `/join/DEMO26`.
   - Live ticker presence on the tournament page.
- **F5.2** Manual pasteable test checklist at `assets/MANUAL_TEST_CHECKLIST.md` — rows for every public page × theme mode, every commissioner flow, every error state.
- Inputs: seeded `DEMO26`, `/manage/login` dev fallback, new domain. Outputs: automated regression coverage + a checklist the owner can run.

## 4. Repository Structure

New/modified files map to capabilities:

| Path | Capability | Agent |
| --- | --- | --- |
| `web/src/app.css` | C1 (F1.1–F1.3) | Coder |
| `web/src/routes/api/auth/magic-link/request/+server.ts` | C2 (F2.1) | Coder |
| `web/src/routes/manage/login/+page.svelte` | C2 (F2.2) | Coder |
| `README.md`, `assets/SETUP.md` | C2 (F2.3), C4 (F4.1) | Documenter |
| `web/migrations/0004_seed_demo_tournament.sql` | C3 | Coder |
| `web/src/lib/outbox/db.ts` | C4 (F4.1, F4.2) | Coder |
| `web/src/lib/auth/emailClient.ts` + `emailClient.spec.ts` | C4 (F4.1) | Coder |
| `web/src/routes/api/matches/[matchId]/holes/server.spec.ts` | C4 (F4.1) | Coder |
| `web/wrangler.jsonc` | C4 (F4.1, F4.3) | Coder (with Architect blueprint) |
| `web/static/manifest.webmanifest` | C4 (F4.1) | Coder |
| All 16 `.svelte` files with "Ryder Cup" strings | C4 (F4.1) | Coder |
| `assets/INFRASTRUCTURE.md`, `assets/ARCHITECTURE.md`, `assets/SETUP.md`, `assets/*` | C4 (F4.1) | Documenter |
| Cloudflare Pages project `golf`, D1 `golf-prod`/`golf-preview`, secrets, DNS binding | C4 (F4.3, F4.5, F4.6) | Architect → Coder (provisioning) |
| `web/tests/e2e/landing.e2e.ts`, `login.e2e.ts`, `public-tournament.e2e.ts`, `spectator.e2e.ts` | C5 (F5.1) | Coder |
| `assets/MANUAL_TEST_CHECKLIST.md` | C5 (F5.2) | Documenter |

Existing `plan/ryder-cup-app/` is **not** renamed in this plan (it is a historical artifact; `plan-management` skill says plan dirs are per-feature and not retroactively edited).

## 5. Dependency Chain

Topological order (foundation → dependent):

```
P0. Branch setup
   └─▶ (all subsequent code tasks on this branch)

P1. Code-only rename + UX + a11y (low risk, reversible, parallelizable within)
   ├── A1: dark-mode tokens (web/src/app.css)
   ├── A2: login dev fallback + error UX
   ├── A3: source string rename (svelte files, emailClient, outbox Dexie class name)
   ├── A4: wrangler.jsonc name+D1 references
   ├── A5: manifest.webmanifest
   └── A6: test-fixture string updates
   All in P1 touch distinct files — run in parallel.

P2. Dexie one-shot migration (depends on A3 for new class name)
   └── B1: outbox DB migration code + guard flag

P3. Demo seed migration (independent of rename code; depends on 0001/0002 schema being stable, which they are)
   └── C1: 0004_seed_demo_tournament.sql

P4. Architect blueprint (depends on nothing code — can start at P0)
   └── D1: infra blueprint doc (Pages project name, D1 names, secrets list, DNS plan)

P5. Infra provisioning (depends on P1 for final wrangler.jsonc + P4 blueprint)
   ├── E1: create Pages project `golf`
   ├── E2: create D1 `golf-prod` + `golf-preview`; apply 0001 + 0002 + 0003
   ├── E3: register 10 secrets
   └── E4: first deploy to preview env (smoke)

P6. Data migration (depends on E2)
   └── F1: export rydercup-prod/preview; import into golf-prod/preview

P7. Apply demo seed to new stack (depends on F1 + C1)
   └── G1: wrangler d1 execute 0004 on both golf DBs

P8. DNS cutover (depends on E4)
   └── H1: bind golf.sbcctears.com to golf Pages; verify 200/TLS; remove rydercup.sbcctears.com CNAME & binding

P9. Production deploy + E2E (depends on H1, G1)
   ├── I1: production deploy
   ├── I2: Playwright E2E against https://golf.sbcctears.com
   └── I3: owner runs manual checklist

P10. Cleanup (gated by owner sign-off on I3)
   ├── J1: delete old rydercup Pages project
   └── J2: delete old rydercup-prod + rydercup-preview D1 DBs

P11. Review + docs + audit
   ├── Reviewer: code review across P1–P3
   ├── Documenter: update assets/ + README + manual checklist
   └── Auditor: verify new Pages project, both D1s, all 10 secrets, DNS, TLS
```

## 6. Development Phases

See `tasks.md` for the checkboxed task graph. Phase entry/exit criteria are captured inline there.

## 7. Out of Scope

- Explicit light/dark **theme toggle UI** (auto-OS-driven only; noted as future work).
- Migrating historical `plan/ryder-cup-app/` artifacts (kept as-is).
- Changing the schema of `0001_init.sql` — `0004` only seeds rows.
- Performance/load testing of the new stack.
- Changing email provider (smtp2go remains; dev fallback just bypasses it).
- Multi-region D1 replication changes.

## 8. Constraints

1. **Zero data loss** — Service D1 data (any real tournaments, commissioners, matches) must survive the cutover. Dexie outbox data must survive on clients that had queued offline scores.
2. **Dexie migration idempotency** — Must work if users open the app after rename on multiple tabs simultaneously; must not re-run once the old DB is deleted.
3. **DNS transition** — `golf.sbcctears.com` must reach new stack **before** `rydercup.sbcctears.com` is removed; overlap of both working briefly is acceptable and preferred.
4. **Cost ceiling** — Cloudflare Pages + D1 free tier is sufficient; no new paid bindings. Custom domains are free.
5. **Secrets** — Never committed. Re-registered via `wrangler secret put` against new env names; values reused from owner's vault.
6. **Backward compatibility of the seed** — `0004` must be safe against an already-seeded DB (re-apply = no-op) so reruns during debugging don't error.
7. **WCAG AA** — All dark-mode text tokens must clear 4.5:1 on both `--color-surface` and `--color-surface-raised`; accent button must clear 4.5:1 with white text.
8. **Branch discipline** — All P1–P3 code changes on a single feature branch `feature/golf-rebrand` before infra/DNS work begins.

## 9. Open Questions

None. All open items were resolved in the orchestrator briefing:
- Full rename (not domain swap): **confirmed**.
- Remove old `rydercup.sbcctears.com`: **confirmed**.
- New domain `golf.sbcctears.com`: **confirmed** (CNAME already added).
- Demo seed via D1 migration: **confirmed**.
- Seed commissioner email `coffey.mikey@gmail.com`: **confirmed**.
- Testing = Playwright E2E + manual checklist: **confirmed**.
