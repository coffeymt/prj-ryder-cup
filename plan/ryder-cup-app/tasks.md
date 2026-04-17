# Ryder Cup App — Task Graph

## Overview

Implementation plan for the Ryder Cup golf tournament web app. See `prd.md` for product requirements and resolved decisions.

**Framework choice:** **SvelteKit** with `@sveltejs/adapter-cloudflare`. Rationale: smallest client bundle, first-class Cloudflare Pages support, file-based routing that maps cleanly to the PRD's URL structure (`/t/:code`, `/manage/...`), native form actions that simplify commissioner CRUD without a separate API-client layer. React+Vite remains an acceptable substitute; the structure below changes minimally.

**Feature branch:** `feature/ryder-cup-app` (created in Phase 0, since the workspace is not currently a git repo, `git init` is prerequisite).

**Configuration policy:** no project IDs, domains, secrets, or environment-specific values are hardcoded in any task. All environment-specific values are parameterized via `wrangler.toml`, Workers secrets, or `.env` files referenced through the SvelteKit `env` module.

**Parallelization hints:** tasks within a phase have non-overlapping file lists unless called out. The orchestrator can run all tasks in a phase concurrently.

**Agent legend:** `Coder` writes code; `Designer` produces UX/visual design; `Architect` defines infrastructure; `Documenter` updates `assets/`; `Auditor` verifies live resources.

---

## Phase 0 — Foundation

**Entry criteria:** PRD approved.
**Exit criteria:** Git repo on `feature/ryder-cup-app`, SvelteKit app scaffolded, `wrangler dev` runs locally, infrastructure blueprint documented, DNS + D1 + Resend provisioned (via Architect blueprint + user manual steps).

- [x] **Task P0.T1** — Initialize git repo at workspace root and create `feature/ryder-cup-app` branch from `main` before any other changes. Add a baseline `.gitignore` appropriate for a Node + SvelteKit + Cloudflare project. → Coder | Files: `.gitignore`, `.git/` (init), `README.md` (stub)
  - Depends on: none
  - Acceptance: `git status` shows clean working tree on branch `feature/ryder-cup-app`; `main` exists as the default branch.

- [x] **Task P0.T2** — Author infrastructure blueprint documenting all Cloudflare resources, secrets, and DNS records the project needs. Deliverable is a concise markdown doc covering: Pages project (preview + prod), D1 database name + binding, custom domain `rydercup.sbcctears.com`, Workers secrets (`COOKIE_SIGNING_KEY`, `MAGIC_LINK_KEY`, `SPECTATOR_COOKIE_KEY`, `RESEND_API_KEY`), Resend sending-domain setup (SPF/DKIM/DMARC records to add to the Cloudflare zone), preview URL pattern, environment naming convention. Reference `.github/skills/api-contract-validation.md` and `.github/skills/pipeline-orchestration.md` for patterns. → Architect | Files: `assets/INFRASTRUCTURE.md`
  - Depends on: P0.T1
  - Acceptance: Document enumerates every resource with a `verify` command and a `provision` step. No secret values are inline — only variable names.

- [x] **Task P0.T3** — Scaffold SvelteKit app under `web/` with TypeScript, Vitest, Playwright, ESLint, Prettier, Tailwind CSS, and `@sveltejs/adapter-cloudflare`. Configure `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.cjs`, `.prettierrc`, `.eslintrc.cjs`. Add `package.json` scripts: `dev`, `build`, `preview`, `test`, `test:watch`, `e2e`, `lint`, `format`, `migrations:apply`. Do NOT pin package versions to specific values in this PRD — the Coder resolves the latest stable at install time via the package manager. → Coder | Files: `web/package.json`, `web/svelte.config.js`, `web/vite.config.ts`, `web/tsconfig.json`, `web/tailwind.config.ts`, `web/postcss.config.cjs`, `web/.prettierrc`, `web/.eslintrc.cjs`, `web/src/app.html`, `web/src/app.css`, `web/src/app.d.ts`
  - Depends on: P0.T1
  - Acceptance: `pnpm install` (or `npm install`) completes; `pnpm dev` serves the default SvelteKit page at `localhost:5173`; `pnpm lint` and `pnpm test` run (even with zero tests).

- [x] **Task P0.T4** — Author Wrangler config with bindings for D1 (`DB`) and placeholder references to Workers secrets. Configure separate preview and production env blocks. Do not include secret values. → Coder | Files: `web/wrangler.jsonc` (using Wrangler's JSONC format instead of TOML)
  - Depends on: P0.T3
  - Acceptance: `wrangler d1 list` works when run by the user with valid Cloudflare credentials; `wrangler pages dev web/.svelte-kit/cloudflare` runs locally.

- [x] **Task P0.T5** — Document user-facing one-time setup steps in `assets/SETUP.md`: Cloudflare account / API token prerequisites, `wrangler login`, creating the D1 database, adding the `rydercup.sbcctears.com` CNAME in the existing Cloudflare zone, creating a Resend account and verifying the sending domain, registering secrets via `wrangler secret put`. Reference `.github/skills/documentation-standards.md`. → Documenter | Files: `assets/SETUP.md`
  - Depends on: P0.T2
  - Acceptance: A reader with zero prior context can execute every step in order; no step says "TBD" or "see later"; every CLI command shows the expected success output.

- [x] **Task P0.T6** — Add GitHub Actions CI workflow: install, lint, test, build on every push/PR. No deploy step in this task. → Coder | Files: `.github/workflows/ci.yml`
  - Depends on: P0.T3
  - Acceptance: Workflow passes on a clean `feature/ryder-cup-app` branch.

---

## Phase 1 — Data model & migrations

**Entry criteria:** Phase 0 complete.
**Exit criteria:** D1 schema applied locally (via `wrangler d1 execute --local`), all entity tables and indexes exist, 5 Kiawah courses seeded with full per-tee CR/Slope and per-hole par + SI.

All tasks in this phase write to **non-overlapping** migration files and can run in parallel.

- [ ] **Task P1.T1** — Author `0001_init.sql`: DDL for `tournaments`, `teams`, `players`, `courses`, `tees`, `holes`, `rounds`, `round_segments`, `matches`, `match_sides`, `match_side_players`, `hole_scores`, `match_hole_results`, `match_results`, `audit_log`, `magic_link_tokens`, `processed_ops`, `commissioners`. Include appropriate indexes for `(tournament_id, ...)` access patterns, unique constraints on `tournaments.code` and `magic_link_tokens.token_hash`. Reference `.github/skills/sql-development.md` and `.github/skills/database-optimization.md`. → Coder | Files: `web/migrations/0001_init.sql`
  - Depends on: P0.T4
  - Acceptance: `wrangler d1 execute DB --local --file web/migrations/0001_init.sql` succeeds against an empty local D1; every entity from the Domain Model in `prd.md` is represented; no hardcoded tournament data present.

- [ ] **Task P1.T2** — Author `0002_seed_kiawah.sql`: INSERT statements seeding the five Kiawah courses (Cougar Point, Osprey Point, Oak Point, Ocean Course, Turtle Point) with their tees and per-hole par + stroke index for the primary tournament tees, plus 18-hole and 9-hole CR/Slope/par. Cross-check values against BlueGolf course profiles and the Ocean Course scorecard (sources listed in `prd.md` Appendix B). Mark `isSeed = true`. Reference `.github/skills/sql-development.md`. → Coder | Files: `web/migrations/0002_seed_kiawah.sql`
  - Depends on: P1.T1
  - Acceptance: Migration applies cleanly after `0001_init.sql`; each course has 18 holes with non-null par and SI 1–18 (no duplicates); each tee has non-null `cr18`, `slope18`, `par18`, and non-null `cr9F`/`slope9F`/`par9F`/`cr9B`/`slope9B`/`par9B` where available. Values cite their source in a SQL comment block at the top of the file.

- [ ] **Task P1.T3** — Add an `npm` script `migrations:apply` that runs every file in `migrations/*.sql` in order against the configured D1 binding (local by default; `--remote` flag for production). → Coder | Files: `web/package.json` (script only), `web/scripts/apply-migrations.mjs`
  - Depends on: P1.T1
  - Acceptance: `pnpm migrations:apply` idempotently applies all migrations locally; re-running is a no-op.

---

## Phase 2 — Scoring engine (pure, testable)

**Entry criteria:** Phase 1 complete (schema informs types).
**Exit criteria:** All five format engines produce correct results against USGA Appendix C/E worked examples; 100% branch coverage on engine code; no I/O in any engine file.

**CRITICAL — requires explicit approval before any changes after initial implementation:** the handicap math and match-state logic are the product's core trust signal. Any modification after Phase 2 exit must be reviewed against the PRD formulas and worked examples.

All tasks in this phase write to **non-overlapping** files under `web/src/lib/engine/` and can run in parallel once `P2.T1` (type definitions) completes.

- [ ] **Task P2.T1** — Define engine type contracts in `types.ts`: `HandicapIndex`, `Slope`, `CourseRating`, `Par`, `StrokeIndex`, `CourseHandicap`, `PlayingHandicap`, `Allowance`, `Segment` (`F9`|`B9`|`18`), `Format`, `HoleScore`, `MatchSideState`, `MatchState`, `CloseNotation`. Pure types only — no runtime exports. Reference `.github/skills/api-contract-validation.md`. → Coder | Files: `web/src/lib/engine/types.ts`
  - Depends on: P1.T1
  - Acceptance: Types compile under `tsconfig` strict mode; downstream engine modules import from this file only.

- [ ] **Task P2.T2** — Implement Course Handicap (CH) calculation per WHS Rule 6.1a and 9-hole CH per Rule 6.1b. Pure function, no I/O. Include inline unit tests in a sibling spec. → Coder | Files: `web/src/lib/engine/courseHandicap.ts`, `web/src/lib/engine/courseHandicap.spec.ts`
  - Depends on: P2.T1
  - Acceptance: CH18 and CH9 test cases drawn from USGA published examples all pass; negative indexes and wrap-around cases covered.

- [ ] **Task P2.T3** — Implement per-format allowance logic and match-play normalization (subtract lowest PH → 0). Handle Scramble (35/15 blended), Pinehurst (60/40 blended), Shamble (default 85% per player, configurable), Four-Ball (default 100% per player, configurable, USGA one-click = 90%), Singles (100%). All percentages accepted as configuration inputs, not literals. → Coder | Files: `web/src/lib/engine/allowances.ts`, `web/src/lib/engine/allowances.spec.ts`
  - Depends on: P2.T1, P2.T2
  - Acceptance: Default-config cases and explicit-override cases both pass; Scramble and Pinehurst tests match USGA Appendix C examples; match-play normalization reduces all participants so lowest plays off 0.

- [ ] **Task P2.T4** — Implement stroke allocation per WHS Appendix E: ascending SI order with wrap when `PH > 18`, descending from SI 18 for negative PH, 9-hole sub-match allocation using SI ranks filtered to the played nine. → Coder | Files: `web/src/lib/engine/strokeAllocation.ts`, `web/src/lib/engine/strokeAllocation.spec.ts`
  - Depends on: P2.T1
  - Acceptance: Allocations for `PH = 10`, `PH = 22`, `PH = -3`, `PH = 36` all verified against Appendix E tables; 9-hole allocations filtered to F9 and B9 separately verified.

- [ ] **Task P2.T5** — Implement Scramble format: single team ball, team gross input, team-PH strokes subtracted by SI allocation, per-hole team net. → Coder | Files: `web/src/lib/engine/formats/scramble.ts`, `web/src/lib/engine/formats/scramble.spec.ts`
  - Depends on: P2.T3, P2.T4
  - Acceptance: Kiawah Cougar Point F9 scramble example from `prd.md` produces correct per-hole team nets; halved holes detected.

- [ ] **Task P2.T6** — Implement Pinehurst / Modified Alt Shot format: same mechanics as Scramble but with 60/40 blended team PH. → Coder | Files: `web/src/lib/engine/formats/pinehurst.ts`, `web/src/lib/engine/formats/pinehurst.spec.ts`
  - Depends on: P2.T3, P2.T4 (parallel with P2.T5)
  - Acceptance: Osprey Point F9 Pinehurst worked example from `prd.md` passes; verifies blended PH differs from Scramble.

- [ ] **Task P2.T7** — Implement Shamble format: per-player nets, team net = `min(playerA_net, playerB_net)`, picked-up carries partner. → Coder | Files: `web/src/lib/engine/formats/shamble.ts`, `web/src/lib/engine/formats/shamble.spec.ts`
  - Depends on: P2.T3, P2.T4 (parallel with P2.T5, P2.T6)
  - Acceptance: Picked-up + partner-carries case verified; both-pick-up forfeits hole; default 85% and USGA 75% configs both produce correct allocations.

- [ ] **Task P2.T8** — Implement Four-Ball format: per-player nets, team net = `min(...)`, match-play normalization applied. → Coder | Files: `web/src/lib/engine/formats/fourBall.ts`, `web/src/lib/engine/formats/fourBall.spec.ts`
  - Depends on: P2.T3, P2.T4 (parallel with P2.T5–T7)
  - Acceptance: Default 100% config and USGA 90% config both tested; picked-up cases correct.

- [ ] **Task P2.T9** — Implement Singles format: 100% CH per player, match-play normalization. → Coder | Files: `web/src/lib/engine/formats/singles.ts`, `web/src/lib/engine/formats/singles.spec.ts`
  - Depends on: P2.T3, P2.T4 (parallel with P2.T5–T8)
  - Acceptance: 1v1 cases verified; halved match = T = 0.5/0.5 honored.

- [ ] **Task P2.T10** — Implement match-state state machine: after each hole compute `holesUp`, `holesRemaining`, state (`AS`|`X UP`|`X DN`|`DORMIE`|`CLOSED`|`T`), and close notation (`W&R` like `4&3`). Pure function driven by a sequence of hole-result inputs. → Coder | Files: `web/src/lib/engine/matchState.ts`, `web/src/lib/engine/matchState.spec.ts`
  - Depends on: P2.T1
  - Acceptance: Dormie detection correct for both 18-hole and 9-hole segments; closed-out detection fires at correct hole; halved-match handling correct.

- [ ] **Task P2.T11** — Implement point-tally engine: takes a set of closed match results and sums to team totals, honoring 0.5/0.5 halves and commissioner overrides. → Coder | Files: `web/src/lib/engine/pointTally.ts`, `web/src/lib/engine/pointTally.spec.ts`
  - Depends on: P2.T10
  - Acceptance: 30-point Kiawah scenario (all halved) = 15-15; all-won-by-Team-A = 30-0; mixed scenario with overrides verified.

- [ ] **Task P2.T12** — Implement split-format orchestrator: routes F9 holes through one format, B9 through another, Overall through a third where applicable. Selects Convention 1 (independent 9-hole CH) by default and Convention 2 (halved CH18) when course lacks 9-hole ratings. → Coder | Files: `web/src/lib/engine/splitFormat.ts`, `web/src/lib/engine/splitFormat.spec.ts`
  - Depends on: P2.T5, P2.T6, P2.T7, P2.T8, P2.T9, P2.T10
  - Acceptance: Cougar Point (F9 Scramble + B9 Four-Ball) and Ocean Course (F9 + B9 + Overall) both produce correct sub-match points.

---

## Phase 3 — Auth & session

**Entry criteria:** Phase 1 complete.
**Exit criteria:** Magic-link + roster-pick + spectator cookie flows all functional locally; tokens signed and verified; route middleware discriminates commissioner / player / spectator correctly.

Runs in parallel with Phase 2 (different files) once Phase 1 is done.

- [ ] **Task P3.T1** — Implement HMAC cookie sign/verify helpers. Reads `COOKIE_SIGNING_KEY`, `SPECTATOR_COOKIE_KEY` from SvelteKit `$env/dynamic/private`. No hardcoded keys. → Coder | Files: `web/src/lib/auth/cookies.ts`, `web/src/lib/auth/cookies.spec.ts`
  - Depends on: P2.T1 (types)
  - Acceptance: Round-trip sign → verify passes; tampered cookies fail verification; replay protection via exp claim.

- [ ] **Task P3.T2** — Implement tournament-code generator: 6-char alphanumeric, excludes `0/O/1/I/L`, retries on collision against `tournaments.code`. → Coder | Files: `web/src/lib/auth/tournamentCode.ts`, `web/src/lib/auth/tournamentCode.spec.ts`
  - Depends on: P3.T1
  - Acceptance: 10,000 generations produce no ambiguous chars; collision retry path exercised with mocked DB.

- [ ] **Task P3.T3** — Implement magic-link token lifecycle: generate single-use signed tokens, persist hash in `magic_link_tokens`, consume idempotently, 15-minute expiry. → Coder | Files: `web/src/lib/auth/magicLink.ts`, `web/src/lib/auth/magicLink.spec.ts`
  - Depends on: P3.T1
  - Acceptance: Consumed tokens cannot be reused; expired tokens rejected; second-use returns same result for idempotency window.

- [ ] **Task P3.T4** — Implement Resend email client wrapper: `sendMagicLink({ email, url })`. Reads `RESEND_API_KEY` from secrets. Renders a minimal HTML + plaintext magic-link email. No hardcoded sender address — reads from env. → Coder | Files: `web/src/lib/auth/emailClient.ts`, `web/src/lib/auth/emailClient.spec.ts`
  - Depends on: P3.T3
  - Acceptance: Unit test mocks `fetch` and asserts Resend request shape; includes failure-mode test (non-200 from Resend → thrown error).

- [ ] **Task P3.T5** — Implement route-middleware for role discrimination. `hooks.server.ts` reads cookies on every request, resolves role (`commissioner`|`player`|`spectator`|`anonymous`), attaches to `event.locals`. Define helper `requireRole()`. → Coder | Files: `web/src/hooks.server.ts`, `web/src/lib/auth/guards.ts`, `web/src/lib/auth/guards.spec.ts`
  - Depends on: P3.T1
  - Acceptance: Requests with commissioner cookie resolve role `commissioner`; player cookie → `player`; spectator cookie → `spectator`; no cookie → `anonymous`; `requireRole('commissioner')` throws 403 for other roles.

---

## Phase 4 — Backend API (Pages Functions)

**Entry criteria:** Phase 2 and Phase 3 complete.
**Exit criteria:** Full CRUD + score-entry + spectator-read endpoints exercised via curl against local D1; idempotency verified; audit log writes for every override.

All tasks below touch non-overlapping route files and can be parallelized.

- [ ] **Task P4.T1** — Implement D1 repository layer: one file per entity, prepared statements only, no ORM. Export typed functions matching engine types. → Coder | Files: `web/src/lib/db/tournaments.ts`, `web/src/lib/db/teams.ts`, `web/src/lib/db/players.ts`, `web/src/lib/db/courses.ts`, `web/src/lib/db/rounds.ts`, `web/src/lib/db/matches.ts`, `web/src/lib/db/holeScores.ts`, `web/src/lib/db/auditLog.ts`, `web/src/lib/db/processedOps.ts`, `web/src/lib/db/commissioners.ts`, `web/src/lib/db/magicLinks.ts`, `web/src/lib/db/types.ts`
  - Depends on: P1.T1, P2.T1
  - Acceptance: Each repository has integration tests against a migrated local D1; all queries are parameterized (no string concat).

- [ ] **Task P4.T2** — Implement commissioner auth endpoints: `POST /api/auth/magic-link/request`, `GET /api/auth/magic-link/consume`, `POST /api/auth/logout`. → Coder | Files: `web/src/routes/api/auth/magic-link/request/+server.ts`, `web/src/routes/api/auth/magic-link/consume/+server.ts`, `web/src/routes/api/auth/logout/+server.ts`
  - Depends on: P3.T3, P3.T4, P4.T1
  - Acceptance: End-to-end flow via curl issues a cookie; logout clears it.

- [ ] **Task P4.T3** — Implement tournament CRUD: `POST/GET/PATCH /api/tournaments`, `POST /api/tournaments/:id/regenerate-code`, `PATCH /api/tournaments/:id/ticker-visibility`. Role-gated to commissioner of that tournament. → Coder | Files: `web/src/routes/api/tournaments/+server.ts`, `web/src/routes/api/tournaments/[id]/+server.ts`, `web/src/routes/api/tournaments/[id]/regenerate-code/+server.ts`, `web/src/routes/api/tournaments/[id]/ticker-visibility/+server.ts`
  - Depends on: P4.T1, P3.T5
  - Acceptance: Non-commissioner requests return 403; regenerate-code enforces uniqueness; ticker-visibility persists.

- [ ] **Task P4.T4** — Implement team & player CRUD endpoints. Bulk player CSV parse accepted as JSON `{rows: [...]}`. → Coder | Files: `web/src/routes/api/tournaments/[id]/teams/+server.ts`, `web/src/routes/api/tournaments/[id]/teams/[teamId]/+server.ts`, `web/src/routes/api/tournaments/[id]/players/+server.ts`, `web/src/routes/api/tournaments/[id]/players/[playerId]/+server.ts`, `web/src/routes/api/tournaments/[id]/players/bulk/+server.ts`
  - Depends on: P4.T1, P3.T5
  - Acceptance: Roster of 10 players can be bulk-created in one request; invalid rows are rejected without partial writes.

- [ ] **Task P4.T5** — Implement course CRUD endpoints with full tee + hole support. → Coder | Files: `web/src/routes/api/courses/+server.ts`, `web/src/routes/api/courses/[id]/+server.ts`, `web/src/routes/api/courses/[id]/tees/+server.ts`, `web/src/routes/api/courses/[id]/tees/[teeId]/+server.ts`, `web/src/routes/api/courses/[id]/holes/+server.ts`
  - Depends on: P4.T1, P3.T5
  - Acceptance: Create course with 18 holes + 2 tees in one transaction; validation rejects SI outside 1–18 or duplicate SIs.

- [ ] **Task P4.T6** — Implement round & matchup builder endpoints. → Coder | Files: `web/src/routes/api/tournaments/[id]/rounds/+server.ts`, `web/src/routes/api/tournaments/[id]/rounds/[roundId]/+server.ts`, `web/src/routes/api/tournaments/[id]/rounds/[roundId]/matches/+server.ts`, `web/src/routes/api/tournaments/[id]/rounds/[roundId]/matches/[matchId]/+server.ts`
  - Depends on: P4.T1, P3.T5
  - Acceptance: Ocean Course three-segment round (F9 + B9 + Overall) with 3 matchups creates 9 match rows; validation catches duplicate player assignments across sides.

- [ ] **Task P4.T7** — Implement idempotent hole-score endpoint: `POST /api/matches/:matchId/holes` with `Idempotency-Key` header. Writes `hole_scores`, updates `match_hole_results`, recomputes match state via engine, writes to `processed_ops`. → Coder | Files: `web/src/routes/api/matches/[matchId]/holes/+server.ts`, `web/src/routes/api/matches/[matchId]/holes/+server.spec.ts`
  - Depends on: P4.T1, P2.T5–T12, P3.T5
  - Acceptance: Duplicate `Idempotency-Key` returns identical response without double-writing; concurrent edits resolve via last-write-wins keyed on server `enteredAt`; match state returned in response body for client optimistic update.

- [ ] **Task P4.T8** — Implement concede-hole endpoint: `POST /api/matches/:matchId/holes/:hole/concede` with side parameter. Any authenticated player in the match (either side) can concede. Writes audit_log entry. → Coder | Files: `web/src/routes/api/matches/[matchId]/holes/[hole]/concede/+server.ts`
  - Depends on: P4.T7
  - Acceptance: Player A can concede their own hole; player B can also concede their own hole; audit log captures actor.

- [ ] **Task P4.T9** — Implement commissioner override endpoints: edit any score, force-close match, manual point adjustment. Every call writes to `audit_log` with `reason`. → Coder | Files: `web/src/routes/api/matches/[matchId]/override/+server.ts`, `web/src/routes/api/tournaments/[id]/points-adjust/+server.ts`
  - Depends on: P4.T7, P3.T5
  - Acceptance: Only commissioner role succeeds; non-commissioner returns 403; audit log row exists with actor, before/after values, reason.

- [ ] **Task P4.T10** — Implement spectator / live-read endpoints: `GET /api/live/:code` returns aggregated team totals + match statuses + last-updated timestamp. Respects `publicTickerEnabled` setting. → Coder | Files: `web/src/routes/api/live/[code]/+server.ts`, `web/src/routes/api/live/[code]/sse/+server.ts`
  - Depends on: P4.T1, P2.T11, P3.T5
  - Acceptance: Without `publicTickerEnabled` → spectator cookie required; with → anonymous allowed; SSE stream emits an event within 5s of a hole entry.

- [ ] **Task P4.T11** — Implement join flow endpoints: `POST /api/join/:code/roster` returns roster; `POST /api/join/:code/select-player` issues player cookie. → Coder | Files: `web/src/routes/api/join/[code]/roster/+server.ts`, `web/src/routes/api/join/[code]/select-player/+server.ts`
  - Depends on: P4.T1, P3.T1, P3.T5
  - Acceptance: Valid code returns roster; invalid code returns 404; selecting a player issues player cookie.

---

## Phase 5 — Frontend (commissioner portal)

**Entry criteria:** Phase 4 complete.
**Exit criteria:** Commissioner can build the Kiawah reference event end-to-end (10 players, 2 teams, 5 rounds, all matchups) through the manager portal with no curl fallbacks.

Runs in parallel with Phase 6 (different routes).

- [ ] **Task P5.T1** — Build manager login page (email input → magic link) and magic-link landing handler. → Coder | Files: `web/src/routes/manage/login/+page.svelte`, `web/src/routes/manage/login/+page.server.ts`, `web/src/routes/manage/magic-link-sent/+page.svelte`
  - Depends on: P4.T2
  - Acceptance: Submitting email triggers Resend send; clicking link from email lands on `/manage` authenticated.

- [ ] **Task P5.T2** — Build manager portal shell with Switch-Tournament selector, top nav, and empty-state landing page when no tournaments exist. → Coder | Files: `web/src/routes/manage/+layout.svelte`, `web/src/routes/manage/+layout.server.ts`, `web/src/routes/manage/+page.svelte`, `web/src/lib/ui/TournamentSwitcher.svelte`
  - Depends on: P5.T1, P4.T3
  - Acceptance: Switcher lists every tournament owned by the signed-in commissioner; selecting one routes to `/manage/tournaments/:id`; "+ New Tournament" always visible.

- [ ] **Task P5.T3** — Build tournament creation + settings screens (name, dates, points-to-win, team colors, ticker visibility, per-format allowance defaults with USGA one-click). → Coder | Files: `web/src/routes/manage/tournaments/new/+page.svelte`, `web/src/routes/manage/tournaments/new/+page.server.ts`, `web/src/routes/manage/tournaments/[id]/settings/+page.svelte`, `web/src/routes/manage/tournaments/[id]/settings/+page.server.ts`, `web/src/lib/ui/AllowanceField.svelte`
  - Depends on: P5.T2
  - Acceptance: Creating a new tournament generates a 6-char code; allowance fields show defaults and "Use USGA standard" buttons pre-fill correctly.

- [ ] **Task P5.T4** — Build team & player management screens with CSV-paste bulk import and color picker per team. → Coder | Files: `web/src/routes/manage/tournaments/[id]/teams/+page.svelte`, `web/src/routes/manage/tournaments/[id]/teams/+page.server.ts`, `web/src/routes/manage/tournaments/[id]/players/+page.svelte`, `web/src/routes/manage/tournaments/[id]/players/+page.server.ts`, `web/src/lib/ui/ColorPicker.svelte`
  - Depends on: P5.T2, P4.T4
  - Acceptance: Pasting 10-row CSV creates 10 players; drag-drop or dropdown assigns players to teams; captain toggle works.

- [ ] **Task P5.T5** — Build course library screens: browse seeded courses, admin add/edit course form with per-tee CR/Slope/par (18 + 9F + 9B) and per-hole par + SI grid. → Coder | Files: `web/src/routes/manage/courses/+page.svelte`, `web/src/routes/manage/courses/+page.server.ts`, `web/src/routes/manage/courses/new/+page.svelte`, `web/src/routes/manage/courses/[id]/+page.svelte`, `web/src/routes/manage/courses/[id]/+page.server.ts`
  - Depends on: P5.T2, P4.T5
  - Acceptance: 5 Kiawah courses render in the library; editing the Ocean Course par-72 to par-71 persists; validation prevents duplicate SIs.

- [ ] **Task P5.T6** — Build round & matchup builder: course/tee/date picker, segment configurator (single 18 / split F9+B9 / F9+B9+Overall), per-segment format + point allocation + allowance override, matchup editor (pairings as rows with player dropdowns per side). Live running-total banner shows cumulative tournament points. → Coder | Files: `web/src/routes/manage/tournaments/[id]/rounds/+page.svelte`, `web/src/routes/manage/tournaments/[id]/rounds/+page.server.ts`, `web/src/routes/manage/tournaments/[id]/rounds/new/+page.svelte`, `web/src/routes/manage/tournaments/[id]/rounds/[roundId]/+page.svelte`, `web/src/routes/manage/tournaments/[id]/rounds/[roundId]/+page.server.ts`, `web/src/lib/ui/MatchupBuilder.svelte`, `web/src/lib/ui/SegmentConfig.svelte`
  - Depends on: P5.T2, P4.T6, P5.T5
  - Acceptance: Full Kiawah event (5 rounds, 30 points) built from scratch in under 30 minutes; Oak Point round can be created with 2 matchups using only 8 of 10 players; split-format warning appears when course lacks 9-hole ratings.

- [ ] **Task P5.T7** — Build commissioner-overrides screen: edit any hole score, force-close match, manual point adjustment, audit log viewer. → Coder | Files: `web/src/routes/manage/tournaments/[id]/overrides/+page.svelte`, `web/src/routes/manage/tournaments/[id]/overrides/+page.server.ts`, `web/src/routes/manage/tournaments/[id]/audit-log/+page.svelte`
  - Depends on: P5.T2, P4.T9
  - Acceptance: Editing a score requires a reason; audit log shows all overrides with actor and timestamp.

---

## Phase 6 — Frontend (player / scorer)

**Entry criteria:** Phase 4 complete.
**Exit criteria:** Player can join via code, enter a full round of hole-by-hole scores, see live match status, traverse a format-change interstitial, and concede a hole.

Runs in parallel with Phase 5 (different routes).

- [ ] **Task P6.T1** — Build public landing page + code-entry flow (`/` and `/join`). → Coder | Files: `web/src/routes/+page.svelte`, `web/src/routes/+page.server.ts`, `web/src/routes/join/+page.svelte`, `web/src/routes/join/+page.server.ts`, `web/src/routes/join/[code]/+page.svelte`, `web/src/routes/join/[code]/+page.server.ts`
  - Depends on: P4.T11
  - Acceptance: Entering a valid code shows the roster; tapping a name issues the player cookie and routes to `/t/:code`.

- [ ] **Task P6.T2** — Build player-facing tournament layout + dashboard (today's round, my matches, team totals). → Coder | Files: `web/src/routes/t/[code]/+layout.svelte`, `web/src/routes/t/[code]/+layout.server.ts`, `web/src/routes/t/[code]/+page.svelte`, `web/src/routes/t/[code]/+page.server.ts`
  - Depends on: P6.T1
  - Acceptance: Dashboard shows the player's name, team color accent, today's matches, and team totals to date.

- [ ] **Task P6.T3** — Build one-hole-per-screen score-entry UI with large +/- steppers, stroke dots per player, conceded-hole button, picked-up button, format-change interstitial between F9 and B9, back/next navigation. → Coder | Files: `web/src/routes/t/[code]/matches/[matchId]/+page.svelte`, `web/src/routes/t/[code]/matches/[matchId]/+page.server.ts`, `web/src/routes/t/[code]/matches/[matchId]/hole/[n]/+page.svelte`, `web/src/lib/ui/HoleStepper.svelte`, `web/src/lib/ui/MatchStatusHeader.svelte`, `web/src/lib/ui/StrokeDots.svelte`, `web/src/lib/ui/FormatInterstitial.svelte`
  - Depends on: P6.T2, P4.T7, P4.T8, P2.T5–T12
  - Acceptance: Full Four-Ball 18 holes enters correctly on a 360px-wide viewport; stroke dots reflect current allowance/PH/SI; match-status header updates after each submit; format interstitial appears between hole 9 and 10 on split-format rounds; concede button always enabled for both sides.

- [ ] **Task P6.T4** — Build online/offline pill + pending-syncs badge in the player layout header. (Pure UI; actual outbox logic ships in Phase 8.) → Coder | Files: `web/src/lib/ui/OnlineOfflinePill.svelte`, `web/src/lib/ui/PendingSyncBadge.svelte`
  - Depends on: P6.T2 (parallel with P6.T3)
  - Acceptance: Pill toggles via `navigator.onLine` events; badge renders a count passed in as a prop.

---

## Phase 7 — Frontend (spectator ticker)

**Entry criteria:** Phase 4 complete.
**Exit criteria:** Anyone with the event code (or, if public-ticker toggle is on, anyone with the URL) sees a live-updating Ryder-Cup-style ticker showing team totals + all match cards with auto-refresh ≤5s.

- [ ] **Task P7.T1** — Build public ticker route with SSE/polling data hook, team totals header with progress-to-win bar, collapsed finished-match cards, expanded in-progress cards, dark-mode default. Honors `publicTickerEnabled` toggle: requires spectator cookie when false. → Coder | Files: `web/src/routes/t/[code]/live/+page.svelte`, `web/src/routes/t/[code]/live/+page.server.ts`, `web/src/lib/ui/TickerHeader.svelte`, `web/src/lib/ui/MatchCard.svelte`, `web/src/lib/hooks/useLiveFeed.ts`
  - Depends on: P4.T10, P6.T2 (shared layout patterns)
  - Acceptance: Simulated full-event data renders correctly; status updates within 5s of a score write; honors spectator gating.

---

## Phase 8 — PWA & offline

**Entry criteria:** Phases 6 and 7 complete (UI surfaces for the outbox badge exist).
**Exit criteria:** App is installable; Lighthouse PWA score ≥90; score entry works in airplane mode and syncs on reconnect.

- [ ] **Task P8.T1** — Author PWA manifest and iconography (launcher icons, maskable icons, Apple touch icons). Placeholder visuals acceptable until Phase 9 polish pass. → Coder | Files: `web/static/manifest.webmanifest`, `web/static/icons/icon-192.png`, `web/static/icons/icon-512.png`, `web/static/icons/apple-touch-icon.png`, `web/static/icons/maskable-512.png`, `web/src/app.html` (link tags)
  - Depends on: P7.T1
  - Acceptance: Manifest validates; install prompt appears in Chrome Android on the staging URL.

- [ ] **Task P8.T2** — Implement service worker with Workbox: app-shell precache, stale-while-revalidate for course/round/match metadata reads, skip-waiting on activate. Register via SvelteKit-compatible pattern. → Coder | Files: `web/src/service-worker.ts`, `web/src/lib/pwa/register.ts`, `web/src/routes/+layout.svelte` (register hook)
  - Depends on: P8.T1
  - Acceptance: Second load of any route serves from cache offline; cache busted correctly on new deploy.

- [ ] **Task P8.T3** — Implement Dexie-backed outbox: enqueue on score mutation, attempt POST with `Idempotency-Key`, retry with exponential backoff on online events. Wires into `OnlineOfflinePill` and `PendingSyncBadge` from Phase 6. → Coder | Files: `web/src/lib/outbox/db.ts`, `web/src/lib/outbox/queue.ts`, `web/src/lib/outbox/sync.ts`, `web/src/lib/outbox/queue.spec.ts`, `web/src/lib/outbox/sync.spec.ts`
  - Depends on: P6.T3, P6.T4, P4.T7
  - Acceptance: With DevTools offline throttling, 9 holes of scores enqueue; reconnect drains queue in order; duplicate replays are no-ops (verified via `processed_ops`).

- [ ] **Task P8.T4** — Wire outbox into score-entry form: optimistic UI update, hole confirmed locally before server ACK, reconciliation on sync. → Coder | Files: `web/src/routes/t/[code]/matches/[matchId]/hole/[n]/+page.svelte` (integration), `web/src/lib/outbox/useOutbox.ts`
  - Depends on: P8.T3
  - Acceptance: Entering hole 5 offline immediately advances to hole 6 with badge "1 pending"; reconnection clears badge and updates server-authoritative state.

---

## Phase 9 — Design pass

**Entry criteria:** Phases 5, 6, and 7 functionally complete.
**Exit criteria:** Consistent visual theme applied across commissioner, player, and spectator screens; team colors flow through as accents; passes accessibility checks.

- [ ] **Task P9.T1** — Design default theme: color tokens (light + dark, team-color accent slots), typography scale, spacing scale, component patterns for buttons, steppers, cards, badges, progress bars, pills, tables. Deliver as Tailwind config + component-pattern documentation. → Designer | Files: `web/tailwind.config.ts` (theme tokens), `web/src/app.css` (CSS variables), `assets/DESIGN_SYSTEM.md`
  - Depends on: P5.T1, P6.T1, P7.T1
  - Acceptance: Every token named semantically (`--color-accent-team-a`, not `--color-red-500`); dark mode token parity; all patterns documented in `DESIGN_SYSTEM.md`.

- [ ] **Task P9.T2** — Apply design system across commissioner screens. → Designer | Files: all `.svelte` files under `web/src/routes/manage/**`, `web/src/lib/ui/ColorPicker.svelte`, `web/src/lib/ui/TournamentSwitcher.svelte`, `web/src/lib/ui/AllowanceField.svelte`, `web/src/lib/ui/MatchupBuilder.svelte`, `web/src/lib/ui/SegmentConfig.svelte`
  - Depends on: P9.T1
  - Acceptance: Every manager screen uses the theme tokens; no inline color hexes remain.

- [ ] **Task P9.T3** — Apply design system across player screens; implement team-color accents driven by data. → Designer | Files: all `.svelte` files under `web/src/routes/t/[code]/**` (excluding `live/`), `web/src/lib/ui/HoleStepper.svelte`, `web/src/lib/ui/MatchStatusHeader.svelte`, `web/src/lib/ui/StrokeDots.svelte`, `web/src/lib/ui/FormatInterstitial.svelte`, `web/src/lib/ui/OnlineOfflinePill.svelte`, `web/src/lib/ui/PendingSyncBadge.svelte`
  - Depends on: P9.T1 (parallel with P9.T2)
  - Acceptance: Team color accents derive from `team.color`; color-independent state cues present (pill + icon for every state).

- [ ] **Task P9.T4** — Apply design system to spectator ticker with dark-mode default, tuned for phone and large-format (TV / iPad propped on kitchen counter). → Designer | Files: `web/src/routes/t/[code]/live/+page.svelte`, `web/src/lib/ui/TickerHeader.svelte`, `web/src/lib/ui/MatchCard.svelte`
  - Depends on: P9.T1 (parallel with P9.T2, P9.T3)
  - Acceptance: Ticker renders legibly at 1920px-wide TV resolution and at 360px phone width.

---

## Phase 10 — QA & seed verification

**Entry criteria:** Phases 8 and 9 complete.
**Exit criteria:** Full Kiawah reference event runs end-to-end against local D1 + preview deploy; Lighthouse PWA ≥90; engine coverage report shows 100% branch coverage.

- [ ] **Task P10.T1** — Write Playwright E2E test that replays the full Kiawah event: commissioner creates tournament + teams + players + 5 rounds + matchups, players enter scores across all rounds, final totals match 30-point structure. → Coder | Files: `web/tests/e2e/kiawah-full-event.spec.ts`, `web/tests/e2e/fixtures/kiawah.ts`
  - Depends on: P8, P9
  - Acceptance: Test passes against a freshly migrated local D1; total points awarded = 30; Team-color accents render correctly.

- [ ] **Task P10.T2** — Verify Kiawah seed data against primary sources (BlueGolf + Ocean Course PDF). Produce a cross-check report showing each value in `0002_seed_kiawah.sql` with its source citation. Fix any discrepancies. → Coder | Files: `assets/KIAWAH_SEED_VERIFICATION.md`, `web/migrations/0002_seed_kiawah.sql` (corrections if needed)
  - Depends on: P1.T2
  - Acceptance: Report covers every tee and every hole for all 5 courses; zero unresolved discrepancies.

- [ ] **Task P10.T3** — Run Lighthouse audit on preview deploy for three routes: landing, player score-entry, public ticker. Capture JSON reports and fix any PWA/Performance/Accessibility regressions below target thresholds. → Coder | Files: `assets/LIGHTHOUSE_REPORT.md`, related fixes in whatever files Lighthouse flags
  - Depends on: P8, P9, P10.T1
  - Acceptance: PWA ≥90, Performance ≥90, Accessibility ≥95 on all three routes.

---

## Phase 11 — Deploy

**Entry criteria:** Phase 10 complete, review passed.
**Exit criteria:** Production deployment live at `rydercup.sbcctears.com`, migrations applied to production D1, Resend sending domain verified, smoke-test event created and deleted.

- [ ] **Task P11.T1** — Configure Cloudflare Pages project for production branch; add `[env.production]` bindings in `wrangler.toml`; set all production secrets via `wrangler secret put`. Produce user-facing runbook of exact commands the user runs (agent cannot access user's Cloudflare account). → Architect | Files: `assets/DEPLOY_RUNBOOK.md`, `web/wrangler.toml` (production env block only)
  - Depends on: P0.T2, P10
  - Acceptance: Runbook covers every command with expected output; no secret values embedded.

- [ ] **Task P11.T2** — Apply migrations to production D1 via `wrangler d1 execute DB --remote --file migrations/*.sql`. Capture pre/post row counts. → Coder | Files: `assets/DEPLOY_RUNBOOK.md` (migration-log section)
  - Depends on: P11.T1
  - Acceptance: Both migrations applied cleanly; seed courses present.

- [ ] **Task P11.T3** — Trigger first production Pages build; verify custom domain `rydercup.sbcctears.com` resolves and serves the app with valid TLS. → Coder | Files: `assets/DEPLOY_RUNBOOK.md` (verification-log section)
  - Depends on: P11.T2
  - Acceptance: `curl -I https://rydercup.sbcctears.com` returns 200; HTML contains app shell; cert is valid.

---

## Phase 12 — Post-deploy audit

**Entry criteria:** Phase 11 complete.
**Exit criteria:** Auditor confirms every infrastructure resource from `assets/INFRASTRUCTURE.md` exists and is correctly configured against live Cloudflare + Resend state.

- [ ] **Task P12.T1** — Audit D1: schema matches migrations, both migrations recorded, seed courses present, no unexpected tables. → Auditor | Files: `assets/AUDIT_REPORT.md`
  - Depends on: P11.T2
  - Acceptance: Read-only `wrangler d1` commands verify; any drift reported.

- [ ] **Task P12.T2** — Audit DNS + Pages: `rydercup.sbcctears.com` resolves to Cloudflare Pages, cert is valid, preview deploys work, production deploy is the expected commit. → Auditor | Files: `assets/AUDIT_REPORT.md`
  - Depends on: P11.T3
  - Acceptance: `dig`, `curl -I`, and `wrangler pages deployment list` agree.

- [ ] **Task P12.T3** — Audit Resend: sending domain verified, SPF + DKIM + DMARC records present in Cloudflare DNS, API key works end-to-end (test magic link sent to commissioner email). → Auditor | Files: `assets/AUDIT_REPORT.md`
  - Depends on: P11.T1
  - Acceptance: Resend dashboard shows domain as "Verified"; end-to-end magic-link test email delivered.

- [ ] **Task P12.T4** — Audit Workers secrets: `COOKIE_SIGNING_KEY`, `MAGIC_LINK_KEY`, `SPECTATOR_COOKIE_KEY`, `RESEND_API_KEY` all present in production env. Verify no values are committed to the repo. → Auditor | Files: `assets/AUDIT_REPORT.md`
  - Depends on: P11.T1
  - Acceptance: `wrangler secret list` shows all four; `rg -n 'COOKIE_SIGNING_KEY|MAGIC_LINK_KEY|RESEND_API_KEY|SPECTATOR_COOKIE_KEY' web/` returns only variable references, never literal values.

---

## Parallelization Summary

| Phase | Parallelizable? | Notes |
|---|---|---|
| P0 | Partially | P0.T1 must run first; P0.T2–T6 parallelize after |
| P1 | Yes (within phase) | T2 depends on T1; T3 depends on T1 |
| P2 | Yes heavily | Format tasks T5–T9 all parallel after T3+T4 |
| P3 | Yes (within phase) | All 5 tasks touch different files |
| P4 | Yes heavily | 11 tasks, non-overlapping routes |
| P5 vs P6 vs P7 | P5/P6/P7 parallel across agents | Different route subtrees |
| P8 | Sequential within phase | T1→T2→T3→T4 depends chain |
| P9 | T2/T3/T4 parallel after T1 | Designer can fan out |
| P10 | Sequential | QA gates on full implementation |
| P11 | Sequential | Deploy chain |
| P12 | Yes (within phase) | Auditor checks independent resources |

## Task Lifecycle

Implementation agents mark completed tasks by changing `- [ ]` to `- [x]` in this file. Orchestrator reads unchecked items to schedule subsequent phases.
