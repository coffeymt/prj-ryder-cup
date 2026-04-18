# Tasks — Golf Rebrand, Dark-Mode A11y, Login UX, Demo Seed, E2E

## Status

- D1 UUIDs wired and migrated: `golf-prod` = `c20f6b85-692b-4930-b822-a2f6f22e3d20`, `golf-preview` = `7f1bd175-30d0-4e0c-83e2-5b261d114da6`.
- Pages project target remains `golf`; `wrangler pages project create/list` is currently blocked in this non-interactive shell without `CLOUDFLARE_API_TOKEN`.
- Initial commissioner seed applied to both new D1s: `coffey.mikey@gmail.com` (global scope + `DEMO26` scoped access).

Execution convention: checkboxes track state. Implementation agents flip `- [ ]` → `- [ ]` as they complete tasks. Tasks within a phase that touch **non-overlapping files** are parallelizable; sequential dependencies are noted at phase boundaries. Reference skills: `.github/skills/sql-development.md` (for Task 3.1), `.github/skills/plan-management.md`, `.github/skills/documentation-standards.md` (for Phase 11 doc updates).

---

## Phase 0 — Branch setup (sequential, blocks everything)

- [x] **Task 0.1** — Create and check out new git branch `feature/golf-rebrand` from `main` in the repo root before any other code changes → Coder | Files: *(git only)*
  - Depends on: none
  - Acceptance: `git rev-parse --abbrev-ref HEAD` returns `feature/golf-rebrand`; `git status` is clean.

---

## Phase 1 — Code-only changes (parallelizable; all depend on 0.1)

All tasks in Phase 1 touch disjoint files and may run concurrently.

- [x] **Task 1.1** — Fix dark-mode CSS tokens for WCAG AA: set `--color-text-muted` dark to `#d1d5db`, `--color-text-secondary` dark to `#e5e7eb`, and `--color-accent` dark to `#1d4ed8` (with hover `#1e3a8a`). Apply the same three overrides in the `[data-theme="dark"]` block AND the `@media (prefers-color-scheme: dark)` block. Do not change light-mode tokens. Do not touch component files. → Coder | Files: `web/src/app.css`
  - Depends on: Task 0.1
  - Acceptance: resolved `--color-text-muted` on `--color-surface` ≥4.5:1; resolved `--color-text-secondary` on `--color-surface-raised` ≥4.5:1; resolved `--color-accent-text` `#fff` on `--color-accent` `#1d4ed8` ≥4.5:1. `npm run build` passes.

- [x] **Task 1.2** — Add dev-mode fallback to the magic-link request endpoint: import `{ dev }` from `$app/environment`; when `dev === true` and (`EMAIL_API_KEY` or `FROM_EMAIL`) is missing, skip the `sendMagicLink` call, `console.log` the magic-link URL and expiry, and return success. `MAGIC_LINK_KEY` and `COOKIE_SIGNING_KEY` remain required (500 if missing, regardless of env). → Coder | Files: `web/src/routes/api/auth/magic-link/request/+server.ts`
  - Depends on: Task 0.1
  - Acceptance: running `npm run dev` with unset `EMAIL_API_KEY`/`FROM_EMAIL` and valid `MAGIC_LINK_KEY`+`COOKIE_SIGNING_KEY` yields a console-logged magic link on POST to `/api/auth/magic-link/request` with a valid email; prod build still requires all 4.

- [x] **Task 1.3** — Improve login page error UX: show the server response body verbatim when `import { dev } from '$app/environment'` is true, and a generic "Could not send magic link. Try again shortly." in prod. Do not leak raw server messages in prod. → Coder | Files: `web/src/routes/manage/login/+page.svelte`
  - Depends on: Task 0.1
  - Acceptance: in dev, a 500 response displays the specific `message` field; in prod build, the same 500 displays only the generic string.

- [x] **Task 1.4** — Rename user-facing "Ryder Cup" strings and all identifier references to "Golf" across 16 Svelte files. Replace occurrences of `Ryder Cup` → `Golf` (or context-appropriate neutral phrasing like "Tournament" / "Cup") in visible copy. Leave team names and course names untouched. → Coder | Files: `web/src/routes/+page.svelte`, `web/src/routes/manage/+page.svelte`, `web/src/routes/manage/+layout.svelte`, `web/src/routes/manage/login/+page.svelte`, `web/src/routes/manage/courses/+page.svelte`, `web/src/routes/manage/courses/new/+page.svelte`, `web/src/routes/manage/tournaments/[id]/audit-log/+page.svelte`, `web/src/routes/manage/tournaments/[id]/overrides/+page.svelte`, `web/src/routes/manage/tournaments/[id]/rounds/+page.svelte`, `web/src/routes/manage/tournaments/[id]/rounds/new/+page.svelte`, `web/src/routes/manage/tournaments/[id]/rounds/[roundId]/+page.svelte`, `web/src/routes/manage/tournaments/[id]/players/+page.svelte`, `web/src/routes/manage/tournaments/[id]/teams/+page.svelte`, `web/src/routes/t/[code]/+layout.svelte`, `web/src/routes/join/+page.svelte`, `web/src/routes/join/[code]/+page.svelte`
  - Depends on: Task 0.1
  - Acceptance: `rg -i "ryder[- ]?cup" web/src/routes` returns zero matches; `npm run build` passes.

- [x] **Task 1.5** — Rename Dexie class and DB name: `RyderCupOutboxDB` → `GolfOutboxDB`, constructor arg `'RyderCupOutbox'` → `'GolfOutbox'`. Leave the migration logic for Task 2.1. Update any imports referencing the class across the codebase. → Coder | Files: `web/src/lib/outbox/db.ts` (plus any importers surfaced by grep)
  - Depends on: Task 0.1
  - Acceptance: `rg "RyderCupOutbox"` returns zero matches in `web/src`; `npm run build` passes.

- [x] **Task 1.6** — Update magic-link email subject and body strings: `'Your Ryder Cup sign-in link'` → `'Your Golf sign-in link'`; body phrases `Your Ryder Cup sign-in link` → `Your Golf sign-in link`. Update corresponding assertions in spec. → Coder | Files: `web/src/lib/auth/emailClient.ts`, `web/src/lib/auth/emailClient.spec.ts`
  - Depends on: Task 0.1
  - Acceptance: `npm run test` passes (unit); `rg "Ryder Cup" web/src/lib/auth` returns zero matches.

- [x] **Task 1.7** — Update integration test fixture: rename any `Ryder Cup` strings in `web/src/routes/api/matches/[matchId]/holes/server.spec.ts` to `Golf` (or to neutral test fixture names). → Coder | Files: `web/src/routes/api/matches/[matchId]/holes/server.spec.ts`
  - Depends on: Task 0.1
  - Acceptance: `npm run test` passes.

- [x] **Task 1.8** — Update `web/wrangler.jsonc` for the rename: `name` `"rydercup"` → `"golf"`; top-level D1 `database_name` `"rydercup-prod"` → `"golf-prod"`; under `env.preview.d1_databases` `"rydercup-preview"` → `"golf-preview"`; under `env.production.d1_databases` `"rydercup-prod"` → `"golf-prod"`. Leave `database_id` values as placeholders — they will be replaced in Phase 5 once the new D1s are created. Add a comment marker `// TODO(golf-rebrand): replace database_id after Phase 5` on each id line. → Coder (with Architect blueprint from Task 4.1) | Files: `web/wrangler.jsonc`
  - Depends on: Task 0.1, Task 4.1
  - Acceptance: file parses as JSONC; all four id lines carry the TODO comment; `name` and all three `database_name` values are the new `golf` values.

- [x] **Task 1.9** — Update manifest brand strings: `"name"`, `"short_name"`, `"description"` at `web/static/manifest.webmanifest` to use "Golf" wording. → Coder | Files: `web/static/manifest.webmanifest`
  - Depends on: Task 0.1
  - Acceptance: manifest parses as valid JSON; no "Ryder Cup" strings remain.

- [x] **Task 1.10** — Update top-level `README.md`: replace "Ryder Cup" wording with "Golf"; remove/update any `rydercup.sbcctears.com` references to `golf.sbcctears.com`. Add a new **"Commissioner login (first-time)"** section explaining: (1) commissioner email `coffey.mikey@gmail.com`, (2) local dev flow (console magic link), (3) prod flow (email magic link at `/manage/login`). → Documenter | Files: `README.md`
  - Depends on: Task 0.1
  - Acceptance: `rg "rydercup|Ryder Cup" README.md` returns zero matches; new section exists with all 3 bullets.

- [ ] **Task 1.11** — Run `npm run build` and `npm run test` from `web/` to verify Phase 1 is internally consistent before Phase 2 starts. → Coder | Files: *(verification only)*
  - Depends on: Tasks 1.1 – 1.10
  - Acceptance: both commands exit 0. Fix any TypeScript or lint failures introduced by the rename.

---

## Phase 2 — Dexie one-shot IndexedDB migration (depends on Phase 1)

- [x] **Task 2.1** — Implement one-shot migration from `RyderCupOutbox` IndexedDB → `GolfOutbox`: in `web/src/lib/outbox/db.ts`, after instantiating the new `GolfOutboxDB`, export an idempotent async function `migrateLegacyOutbox()` that (1) checks `localStorage.getItem('golf_outbox_migrated') === '1'` and returns early if set; (2) uses `indexedDB.databases()` to detect `RyderCupOutbox`; (3) if present, opens it, reads all rows from the `outbox` store, writes them into the new `GolfOutboxDB.outbox` via `bulkAdd` inside one transaction; (4) calls `Dexie.delete('RyderCupOutbox')`; (5) sets `localStorage.setItem('golf_outbox_migrated', '1')`. Wrap the entire function in try/catch — any failure logs and leaves the legacy DB intact (no data loss). Invoke `migrateLegacyOutbox()` from the outbox initializer call site (find via grep of `db` import from `lib/outbox/db`). → Coder | Files: `web/src/lib/outbox/db.ts` (plus outbox initializer call site if different)
  - Depends on: Task 1.5, Task 1.11
  - Acceptance: Manual browser test — seed fake rows into `RyderCupOutbox`, reload app, verify rows appear in `GolfOutbox` and `RyderCupOutbox` is deleted. Second reload: no duplicate copy, no errors. Unit test or explicit acceptance note is fine for MVP.

---

## Phase 3 — Demo tournament seed migration (parallelizable with Phase 2)

- [x] **Task 3.1** — Write `web/migrations/0004_seed_demo_tournament.sql` following `.github/skills/sql-development.md`. Content requirements: (a) `PRAGMA foreign_keys = ON;`, (b) 1 tournament row `INSERT OR IGNORE` with deterministic UUID, code `'DEMO26'`, name `'Demo Cup 2026'`, commissioner email `'coffey.mikey@gmail.com'`, status `'active'`, (c) 2 teams "USA" and "Europe" with deterministic UUIDs and preset palettes `blue` and `red`, (d) 8 players (4/team) with deterministic UUIDs and placeholder names from the PRD, (e) 1 round referencing the first Kiawah course UUID seeded by `0002_seed_kiawah.sql` (look up the exact id in that file and hardcode in a `-- source:` comment), (f) 4 matches exercising singles match play, four-ball, foursomes, and scramble formats. Every INSERT uses `INSERT OR IGNORE`. File must be re-runnable as a no-op. → Coder | Files: `web/migrations/0004_seed_demo_tournament.sql`
  - Depends on: Task 0.1
  - Acceptance: `wrangler d1 execute <local> --file=web/migrations/0004_seed_demo_tournament.sql` applied twice produces identical row counts. `SELECT * FROM tournament WHERE code = 'DEMO26'` returns exactly 1 row with 2 teams, 8 players, 1 round, 4 matches joined via FK.

---

## Phase 4 — Architecture blueprint (runs in parallel with Phase 1)

- [ ] **Task 4.1** — Produce infrastructure blueprint for the new stack. Document in chat reply to orchestrator (not a file; orchestrator captures): (1) Cloudflare Pages project name `golf` with production env + preview env; (2) D1 databases `golf-prod` + `golf-preview` (region matches old DBs); (3) secrets list (5 × 2 = 10): `COOKIE_SIGNING_KEY`, `SPECTATOR_COOKIE_KEY`, `MAGIC_LINK_KEY`, `EMAIL_API_KEY`, `FROM_EMAIL`, registered via `wrangler secret put --env preview|production`; (4) custom domain `golf.sbcctears.com` bound to production env; (5) DNS cutover plan (add new binding first, verify, then remove old CNAME + binding); (6) `database_id` values will be captured from `wrangler d1 create` output and plumbed into `web/wrangler.jsonc` as part of Task 5.2. → Architect | Files: *(advisory; Coder updates `web/wrangler.jsonc` in Task 5.2)*
  - Depends on: none
  - Acceptance: Blueprint in chat names every resource, every secret, every binding, and verification commands (`wrangler d1 list`, `wrangler pages project list`, `wrangler secret list --env …`).

---

## Phase 5 — Infra provisioning (depends on Phase 4 + Task 1.11)

All Phase 5 tasks are **sequential** because each one's output feeds the next.

- [ ] **Task 5.1** — Create Cloudflare Pages project `golf` with production and preview environments. Connect to the same Git repo/branch setup as `rydercup` project (use Pages project settings; do not trigger a deploy yet). → Coder (executing Architect blueprint) | Files: *(Cloudflare API)*
  - Depends on: Task 4.1
  - Acceptance: `wrangler pages project list` shows `golf`.

- [x] **Task 5.2** — Create D1 databases `golf-prod` and `golf-preview` via `wrangler d1 create golf-prod` and `wrangler d1 create golf-preview`. Capture the two new `database_id` UUIDs and update `web/wrangler.jsonc` (replace the three `database_id` TODO placeholders from Task 1.8). Commit the wrangler.jsonc update to `feature/golf-rebrand`. → Coder (executing Architect blueprint) | Files: `web/wrangler.jsonc`
  - Depends on: Task 5.1, Task 1.8
  - Acceptance: `wrangler d1 list` shows both new DBs; `web/wrangler.jsonc` has real UUIDs on all three `database_id` lines; no TODO comments remain.

- [x] **Task 5.3** — Apply schema migrations to both new D1s (in order): `0001_init.sql`, `0002_seed_kiawah.sql`, `0003_add_match_id_to_processed_ops.sql`. Use `wrangler d1 execute golf-prod --remote --file=…` and `wrangler d1 execute golf-preview --remote --file=…`. Do NOT apply `0004` yet. → Coder | Files: *(D1 runtime)*
  - Depends on: Task 5.2
  - Acceptance: `SELECT name FROM sqlite_master WHERE type='table'` against both DBs returns the expected tables from 0001; Kiawah courses present from 0002.

- [ ] **Task 5.4** — Register all 10 secrets on the new Pages project using `wrangler secret put <NAME> --env preview` and `--env production`. Values come from the owner's vault. Secrets: `COOKIE_SIGNING_KEY`, `SPECTATOR_COOKIE_KEY`, `MAGIC_LINK_KEY`, `EMAIL_API_KEY`, `FROM_EMAIL`. → Coder | Files: *(Cloudflare secrets — values never committed)*
  - Depends on: Task 5.1
  - Acceptance: `wrangler secret list --env preview` and `--env production` each list all 5 names.

- [ ] **Task 5.5** — Deploy `feature/golf-rebrand` to the preview env of the new `golf` Pages project as a smoke test. Verify the preview URL returns HTTP 200 and renders the landing page. → Coder | Files: *(deploy artifact only)*
  - Depends on: Tasks 5.2, 5.3, 5.4
  - Acceptance: Preview URL (e.g. `<hash>.golf.pages.dev`) loads landing page without 5xx; no console errors from missing bindings.

---

## Phase 6 — Data migration (depends on Phase 5)

- [ ] **Task 6.1** — Export data from `rydercup-prod` and `rydercup-preview` via `wrangler d1 export rydercup-prod --remote --output=./tmp/rydercup-prod.sql` (and same for preview). Import into the new DBs via `wrangler d1 execute golf-prod --remote --file=./tmp/rydercup-prod.sql` (and preview). Both import SQL dumps are data-only (schema is already present from Task 5.3). If `wrangler d1 export` emits schema too, strip/override with `--no-schema` flag or pre-edit the dump. Validate row counts match between source and destination for every table. → Coder | Files: *(local `./tmp/` dumps; D1 runtime)*
  - Depends on: Task 5.3
  - Acceptance: For every table in both DB pairs, `SELECT COUNT(*) FROM <table>` returns identical values old vs. new. Dump files are in `.gitignore` or `./tmp/` (never committed).

---

## Phase 7 — Apply demo seed to new stack (depends on Phase 6 + Task 3.1)

- [ ] **Task 7.1** — Apply `web/migrations/0004_seed_demo_tournament.sql` to both `golf-prod` and `golf-preview` via `wrangler d1 execute --remote --file=…`. → Coder | Files: *(D1 runtime)*
  - Depends on: Task 6.1, Task 3.1
  - Acceptance: Both DBs return 1 tournament with code `DEMO26`, 2 teams, 8 players, 1 round, 4 matches.

---

## Phase 8 — DNS cutover (depends on Phase 5)

- [ ] **Task 8.1** — Bind custom domain `golf.sbcctears.com` to the production env of the new `golf` Pages project via Cloudflare Pages (API or dashboard). Wait for TLS cert issuance. → Coder (executing Architect blueprint) | Files: *(Cloudflare Pages / DNS)*
  - Depends on: Task 5.5
  - Acceptance: `curl -I https://golf.sbcctears.com` returns `HTTP/2 200` with valid TLS; `curl -s https://golf.sbcctears.com | grep -i golf` finds the brand string.

- [ ] **Task 8.2** — Remove the custom-domain binding `rydercup.sbcctears.com` from the old `rydercup` Pages project; delete the `rydercup` CNAME record in Cloudflare DNS. → Coder | Files: *(Cloudflare DNS)*
  - Depends on: Task 8.1 (old domain unbound only after new domain proven working)
  - Acceptance: `dig rydercup.sbcctears.com` returns `NXDOMAIN` or no A/CNAME records; `curl https://rydercup.sbcctears.com` fails (cert error or DNS error is both acceptable).

---

## Phase 9 — Production deploy + E2E coverage (depends on Phases 7 + 8)

- [ ] **Task 9.1** — Merge `feature/golf-rebrand` → `main` (after Reviewer sign-off in Phase 11) and deploy to `golf` Pages production. → Coder | Files: *(git + deploy)*
  - Depends on: Task 8.1, Task 7.1, Task 11.1 (code review)
  - Acceptance: `https://golf.sbcctears.com` serves the newly deployed `main` build; `SELECT * FROM tournament WHERE code='DEMO26'` resolves via the public view at `/t/DEMO26`.

- [ ] **Task 9.2** — Create Playwright E2E test files covering: landing page renders & key strings present in both `prefers-color-scheme: light` and `dark` (use `page.emulateMedia({ colorScheme: ... })`); `/t/DEMO26` public view loads, shows team names and match cards; `/join/DEMO26` renders join UI; live ticker element present on tournament page. Tests target `process.env.E2E_TARGET ?? 'http://localhost:4173'` so same suite runs locally and against prod. → Coder | Files: `web/tests/e2e/landing.e2e.ts`, `web/tests/e2e/public-tournament.e2e.ts`, `web/tests/e2e/spectator.e2e.ts`
  - Depends on: Task 0.1 (authoring), Task 7.1 (for meaningful assertions)
  - Acceptance: `npm run test:e2e` passes locally against a seeded preview build; `E2E_TARGET=https://golf.sbcctears.com npm run test:e2e` passes against prod.

- [ ] **Task 9.3** — Create Playwright E2E test covering commissioner login in dev: POST a valid email to `/api/auth/magic-link/request`, read the dev-console fallback from the server stdout via Playwright's `webServer.stdout` capture pattern, extract the magic-link URL, GET it, assert redirect to `/manage`, and assert the `rc_commissioner` cookie is set. Skip this suite when `E2E_TARGET` is set (i.e., do not run against prod). → Coder | Files: `web/tests/e2e/login.e2e.ts`
  - Depends on: Task 1.2 (dev fallback), Task 9.2 (for shared harness)
  - Acceptance: `npm run test:e2e -- login.e2e.ts` passes locally; suite is auto-skipped when `E2E_TARGET` is set.

- [ ] **Task 9.4** — Author pasteable manual test checklist at `assets/MANUAL_TEST_CHECKLIST.md` following `.github/skills/documentation-standards.md`. One checklist section per public page (`/`, `/join`, `/join/DEMO26`, `/t/DEMO26`, live ticker), one per commissioner flow (`/manage/login`, `/manage`, create tournament, teams, players, rounds, matches, scoring, audit-log, overrides), and one per theme (light & dark). Each row: action + expected result + pass/fail checkbox. → Documenter | Files: `assets/MANUAL_TEST_CHECKLIST.md`
  - Depends on: Task 7.1
  - Acceptance: file exists, all routes covered, both themes covered; owner can walk through it without asking questions.

---

## Phase 10 — Cleanup (gated on owner sign-off after Phase 9)

- [ ] **Task 10.1** — Delete the old `rydercup` Cloudflare Pages project. → Coder | Files: *(Cloudflare Pages)*
  - Depends on: Task 9.1, Task 9.4, explicit owner "go" after running the manual checklist
  - Acceptance: `wrangler pages project list` does not include `rydercup`.

- [ ] **Task 10.2** — Delete the old `rydercup-prod` and `rydercup-preview` D1 databases via `wrangler d1 delete`. → Coder | Files: *(Cloudflare D1)*
  - Depends on: Task 10.1
  - Acceptance: `wrangler d1 list` does not include either name.

---

## Phase 11 — Review, documentation, audit (runs alongside/after Phase 9)

- [ ] **Task 11.1** — Code review of all changes on `feature/golf-rebrand`: token edits, login dev fallback, login page error UX, string renames, Dexie migration, demo seed migration, wrangler.jsonc edits, manifest changes, E2E tests. Flag: hardcoded project IDs, leaked secrets, contract violations, WCAG failures, Dexie migration edge cases. → Reviewer | Files: *(read-only: all files modified in Phases 1–3 and 9)*
  - Depends on: Tasks 1.1–1.11, 2.1, 3.1, 9.2, 9.3
  - Acceptance: Reviewer returns no CRITICAL issues. WARNINGS/SUGGESTIONS reported to orchestrator.

- [ ] **Task 11.2** — Update `assets/INFRASTRUCTURE.md` to reflect new Pages project name `golf`, D1 names `golf-prod`/`golf-preview`, new `database_id` values, and new custom domain `golf.sbcctears.com`. Update `assets/ARCHITECTURE.md` brand wording. Update `assets/SETUP.md` with: (a) new commissioner-login section matching the README (email `coffey.mikey@gmail.com`, local dev console flow, prod email flow), (b) demo tournament code `DEMO26`, (c) dev-mode fallback behavior of the magic-link endpoint. Reference `.github/skills/documentation-standards.md`. → Documenter | Files: `assets/INFRASTRUCTURE.md`, `assets/ARCHITECTURE.md`, `assets/SETUP.md`, `assets/DESIGN_SYSTEM.md`
  - Depends on: Task 11.1 (review pass)
  - Acceptance: `rg "rydercup|Ryder Cup" assets/` returns zero matches; new sections exist in SETUP; INFRASTRUCTURE reflects real IDs.
  - **Status:** Brand/identifier rename and new `assets/SETUP.md` sections landed (Commissioner login, Demo tournament). D1 `database_id` values in `assets/INFRASTRUCTURE.md` are placeheld as `TBD (provisioned in Phase 5)`; final UUID backfill deferred until Phase 5 (Tasks 5.1 / 5.2) provisions the real `golf-prod` and `golf-preview` databases. Re-open this task to flip to `[x]` after Phase 5 lands the real IDs.

- [ ] **Task 11.3** — Infrastructure audit: verify new Pages project exists and is healthy; both D1 databases exist with correct schemas (tables from 0001 present, Kiawah rows from 0002 present, `DEMO26` from 0004 present); all 10 secrets registered in both envs; custom domain `golf.sbcctears.com` bound with valid TLS; old `rydercup` Pages project and D1s are **gone** (post-Phase 10). Read-only commands only: `wrangler pages project list`, `wrangler d1 list`, `wrangler secret list --env …`, `curl -I` for TLS. → Auditor | Files: *(read-only infra verification)*
  - Depends on: Task 10.2 (full cleanup) or Task 9.1 (partial audit acceptable before cleanup)
  - Acceptance: Audit report in chat lists each resource with status PASS/WARN/FAIL; no FAILs remain.

---

## Cross-phase dependency summary

```
0.1
 └─▶ 1.1–1.10 ▶ 1.11 ▶ 2.1
                      ▶ 3.1
 └─▶ 4.1
     └─▶ 5.1 ▶ 5.2 ▶ 5.3 ▶ 6.1 ▶ 7.1
             ▶ 5.4       ▶ 5.5 ▶ 8.1 ▶ 9.1 ▶ 10.1 ▶ 10.2
                                    ▶ 8.2
 └─▶ 9.2, 9.3 (authored any time after 1.2/1.11; run against prod after 9.1)
 └─▶ 9.4 (after 7.1)
 └─▶ 11.1 (after all code) ▶ 11.2 ▶ 11.3
```

Parallelization wins:
- Phase 1 tasks 1.1–1.10 all run in parallel (disjoint files).
- Phase 4 (Architect blueprint) runs in parallel with all of Phase 1.
- Phase 3 (demo seed migration) runs in parallel with Phase 2 (Dexie migration).
- Phases 5.1 and 5.4 can run concurrently; 5.2 → 5.3 → 5.5 is serial.
- Phase 9 test authoring can start as early as 1.2/1.11 land.
