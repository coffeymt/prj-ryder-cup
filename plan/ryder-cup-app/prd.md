# Ryder Cup Golf Tournament Web App — PRD

## Executive Summary
A lightweight, mobile-first web app for running Ryder-Cup-style team golf events on a buddies' trip. Commissioners create a tournament, configure courses/rounds/formats/pairings, and share a short alphanumeric event code. Players join with the code, self-select their name from the roster, and enter hole-by-hole scores on their phone — even with no signal. The app applies USGA-compliant net handicap math per format, tracks live match status (X UP / AS / Dormie / closed-out), and rolls every sub-match up to live team points on a public ticker that spouses, kids, and the dinner crowd can watch without logging in.

**Target cost: $0/month** at the event scale we care about (10–50 users, a handful of events per year), hosted on Cloudflare Pages + Pages Functions + D1 under a new subdomain `rydercup.sbcctears.com`. The MVP is event-agnostic: any number of players, any team configuration, any course, any format mix, any point structure — the user's Kiawah Ryder Cup is one example event, not a hardcoded template.

## Problem Statement
Friend-group golf trips that run a Ryder-Cup-style team event currently rely on a mash-up of paper scorecards, shared spreadsheets, group-chat math, and "the captain's notes app." Tools that do this well — Golf Genius, USGA TM, BlueGolf — are priced and pitched at clubs and tour ops, require accounts and tee-sheet imports, and make multi-format / mixed-format / split-nine days painful to configure for a 10-person trip. The result on every trip:

- Net-stroke disputes mid-round because nobody agrees on which player gets a stroke on which hole under which format allowance.
- Cumulative team points get miscounted when sub-matches are halved or when split-format rounds award front/back/overall points.
- Spectators (spouses at the pool, the player who sat out the morning round, the captain back at the house) have no way to follow live without texting the group constantly.
- Post-event arguments about handicap allowances, conceded holes, and the final cup margin.

**Who feels this:** the captain/commissioner who runs the trip, the 8–12 players in the rotation, and the rotating cast of spectators back at the house.

## Goals

### Primary goals (MVP success criteria)
- A 10-player, 4-day, 5-round, 30-point Ryder-Cup-style event runs end to end with **zero paper scorecards**.
- **Zero post-round scoring disputes** caused by handicap math, stroke allocation, or point tallying — every result traces back to an auditable sequence of hole entries.
- Any player can enter scores on their phone in dead-zone areas of the course; **all queued entries sync without loss** when signal returns.
- Commissioner can build the entire Kiawah Ryder Cup event (5 rounds, mixed formats, Oak Point 8-player carve-out, 30 points distributed across 6+6+4+9+5) in **under 30 minutes** with no developer intervention.
- A spectator with the public ticker URL sees team totals and per-match status updated within **5 seconds** of the scorer entering a hole.

### Secondary goals
- Stay on the **Cloudflare free tier** indefinitely at this scale.
- Lighthouse PWA audit passes; app is installable to the home screen.
- Course library generalizes — adding a new venue is a single admin form, not a code change.

## Personas & Roles

| Role | Auth | Powers |
|---|---|---|
| **Commissioner** | Magic-link or password to a manager portal | Create/edit tournament, teams, players, courses, rounds, matchups, point allocations. Override any score. Force-close any match. Reset/regenerate the event code. |
| **Player** | Event code + self-select name from roster | Enter hole-by-hole scores for any match they are in or the foursome they are walking with. See live match status and team totals for their tournament. |
| **Spectator** | None (public URL with embedded read token) | Read-only ticker view of team totals and all match statuses. No score entry. |

**Scorer convention:** one scorer per foursome by social agreement, not enforced by the app. Any player in a group can enter a hole; the most recent submission wins, and edits are visible to the whole group. Commissioner override is always available.

## Auth Model

Patterned on Golf Genius's GGID flow — chosen because the user explicitly requested it and because it eliminates the friction of account creation for one-off trip events.

- **Tournament code:** 6-character alphanumeric (excluding ambiguous chars `0/O/1/I/L`), generated at tournament creation, regeneratable by the commissioner. Example: `K7M4XQ`.
- **Player join flow:**
  1. Player visits the app, enters the tournament code.
  2. App shows the roster pre-seeded by the commissioner; player taps their name.
  3. Server issues an **HMAC-signed httpOnly cookie** carrying `{tournamentId, playerId, role: "player"}` with a 30-day expiry. No password.
  4. Subsequent requests are authorized by the cookie; no re-entry of the code.
- **Commissioner flow:**
  1. Separate `/manage` portal with email magic-link sign-in (single-use signed link, 15-minute expiry).
  2. Successful link consumption issues an HMAC-signed cookie `{tournamentId, userId, role: "commissioner"}`.
  3. Commissioner can hold the role on multiple tournaments via the same email.
- **Spectator flow:**
  - **Default (event-code-gated read view):** visitors must enter the tournament code to reach the read-only ticker at `rydercup.sbcctears.com/t/K7M4XQ/live`. Entering the code sets a read-only HMAC-signed cookie `{tournamentId, role: "spectator"}` — no roster pick required. This matches Golf Genius's GGID behavior and avoids accidental public exposure of rosters.
  - **Optional public ticker toggle (per tournament):** commissioner can flip `publicTickerEnabled = true` to allow the ticker URL to load without entering the code — useful for group-text sharing.
  - Spectator role has **no write permissions** anywhere. No PII exposed beyond first-name + last-initial display.
- **Why not full auth (OAuth, Clerk, Auth0):** overkill for ephemeral 10-person events; account friction kills join rates; cost; the GGID model is proven in this exact use case.

## Domain Model

```
Tournament
  id, code (unique), name, startDate, endDate, status (draft|active|complete|archived)
  pointsToWin (e.g. 15.5), totalPointsAvailable (derived; e.g. 30)
  publicTickerEnabled (bool)
  publicTickerRequiresCode (bool)
  commissionerUserId
  createdAt, updatedAt

Team
  id, tournamentId, name, color (hex), captainPlayerId
  -> Players (1..n)

Player
  id, tournamentId, teamId (nullable until drafted), displayName
  email (nullable; only if commissioner; not required for players)
  handicapIndex (decimal, 1 dp)
  isCaptain (bool)

Course
  id, name, location, isSeed (bool, true for the 5 Kiawah courses)
  Tees[] -> { id, name (e.g. "Blue", "White"), gender,
              cr18, slope18, par18,
              cr9F, slope9F, par9F,   -- nullable; required for split-format
              cr9B, slope9B, par9B }
  Holes[] -> { holeNumber (1..18), par, yardageByTeeId{}, strokeIndex (1..18) }

Round
  id, tournamentId, courseId, teeId, dateTime, name (e.g. "Cougar Point")
  segments[] -> { segment (F9|B9|18|9-only), format (Scramble|Pinehurst|Shamble|FourBall|Singles),
                  allowanceConfig (% values), pointsAtStake }
  status (draft|inProgress|complete)

Match
  id, roundId, segment (F9|B9|18 -- multiple Match rows for a multi-segment round)
  format (denormalized from Round.segment)
  sideA: { teamId, players[] }
  sideB: { teamId, players[] }
  pointsAtStake
  status (notStarted|inProgress|closed|halved|won)
  result: { sideAPoints, sideBPoints, closeNotation (e.g. "4&3" | "AS" | "T") }

HoleScore
  id, matchId, playerId, holeNumber, grossStrokes (nullable for picked-up)
  conceded (bool), pickedUp (bool)
  enteredByPlayerId, enteredAt, opId (idempotency)

MatchHoleResult (derived but cached for speed)
  matchId, holeNumber, sideANet, sideBNet, holeWinner (A|B|T|null),
  matchStateAfter (e.g. "A 2 UP")
```

**Cardinality notes:** A single Round row can spawn 1..N Match rows: a 6-pt mixed-format day at Cougar Point with 3 pairings produces 6 Match rows (3 matchups × {F9, B9}); a 9-pt Ocean Course day produces 9 (3 matchups × {F9, B9, 18-overall}); a Singles day produces 5 (5 matchups × {18-overall}).

## Auth Model and Secrets
- HMAC-signed cookies use a per-environment `COOKIE_SIGNING_KEY` stored in Cloudflare Workers secrets.
- Magic-link tokens use a `MAGIC_LINK_KEY` separate from the cookie key.
- No third-party identity provider.

## Capability Tree

### C1. Tournament Lifecycle
- C1.1 Create tournament (commissioner sign-up + new event)
- C1.2 Edit tournament metadata (name, dates, points-to-win)
- C1.3 Regenerate event code
- C1.4 Archive / unarchive tournament
- C1.5 Toggle public ticker visibility (event-code-gated ↔ fully public)
- C1.6 Switch between tournaments owned by the same commissioner

### C2. Team & Player Management
- C2.1 Add / edit / remove player (name, handicap index, captain flag, optional email)
- C2.2 Create / rename / recolor team (color picker drives theme accents)
- C2.3 Assign player to team (manual drag-drop or dropdown)
- C2.4 Designate captain
- C2.5 Bulk import players via CSV paste

### C3. Course Library
- C3.1 Browse seeded courses (5 Kiawah: Cougar Point, Osprey Point, Oak Point, Ocean Course, Turtle Point)
- C3.2 Add new course (name, tees, holes with par + SI + 9/18 CR/Slope)
- C3.3 Edit course / tee / hole
- C3.4 Validate course completeness (required fields per tee for net calc)

### C4. Round & Matchup Builder
- C4.1 Create round (date, course, tee, segments, point allocation)
- C4.2 Configure per-segment format and allowance overrides
- C4.3 Build matchups (drag-drop or dropdown; supports 1v1, 2v2, partial-roster carve-outs like Oak Point 8-player)
- C4.4 Validate matchup completeness vs. team rosters

### C5. Format & Handicap Engine (see §"Handicap & Scoring Engine")
- C5.1 Compute Course Handicap (CH) per player per tee per segment
- C5.2 Compute Playing Handicap (PH) per player per format
- C5.3 Allocate strokes by SI ascending with wrap
- C5.4 Compute net hole result per format
- C5.5 Compute match state after each hole
- C5.6 Detect closed-out matches (e.g., "4&3"), Dormie, halved
- C5.7 Aggregate sub-match results into team points

### C6. Score Entry
- C6.1 One-hole-per-screen UI with large +/- steppers
- C6.2 Stroke-dot indicators per player on stroked holes
- C6.3 Persistent match-status header (e.g., "Team Ted 2 UP thru 5")
- C6.4 Format-change interstitial between F9 and B9 when formats differ
- C6.5 Conceded-hole shortcut
- C6.6 Picked-up-ball handling
- C6.7 Per-hole comments (post-MVP)
- C6.8 Offline-capable with outbox queue

### C7. Live Status & Ticker
- C7.1 In-app live match list per tournament
- C7.2 Public read-only ticker URL (no auth)
- C7.3 Per-match detail view (hole-by-hole, current state)
- C7.4 Team totals panel with progress to win-threshold
- C7.5 Auto-refresh (3–5s polling or SSE)

### C8. Commissioner Overrides
- C8.1 Edit any score
- C8.2 Force-close a match with arbitrary result
- C8.3 Manual point adjustment
- C8.4 Audit log of overrides

### C9. PWA & Offline
- C9.1 Installable web app (manifest + icons)
- C9.2 Service worker with app-shell caching
- C9.3 IndexedDB outbox for unsynced score writes
- C9.4 Online/offline indicator + pending-sync badge
- C9.5 Idempotency-key-based replay on reconnect

## Repository Structure

Recommended layout for SvelteKit + Cloudflare Pages (React+Vite is an acceptable substitute; structure changes minimally):

```
/                               -- repo root
├─ plan/                        -- planning artifacts (this PRD lives here)
├─ assets/                      -- project documentation
├─ web/                         -- SvelteKit app
│  ├─ src/
│  │  ├─ routes/                -- pages
│  │  │  ├─ +layout.svelte
│  │  │  ├─ +page.svelte        -- landing / "enter event code"
│  │  │  ├─ join/+page.svelte   -- code → roster select
│  │  │  ├─ t/[code]/           -- player-facing tournament views
│  │  │  │  ├─ +layout.svelte
│  │  │  │  ├─ +page.svelte     -- my dashboard
│  │  │  │  ├─ matches/[matchId]/+page.svelte    -- score entry
│  │  │  │  └─ live/+page.svelte                 -- public ticker (also unauth)
│  │  │  ├─ manage/             -- commissioner portal
│  │  │  │  ├─ +layout.svelte
│  │  │  │  ├─ login/+page.svelte
│  │  │  │  ├─ tournaments/[id]/
│  │  │  │  │  ├─ teams/+page.svelte
│  │  │  │  │  ├─ courses/+page.svelte
│  │  │  │  │  ├─ rounds/+page.svelte
│  │  │  │  │  └─ overrides/+page.svelte
│  │  │  └─ api/                -- Pages Functions (server endpoints)
│  │  │     ├─ tournaments/+server.ts
│  │  │     ├─ tournaments/[id]/teams/+server.ts
│  │  │     ├─ matches/[id]/holes/+server.ts     -- idempotent score POST
│  │  │     ├─ live/[code]/+server.ts            -- ticker SSE/poll
│  │  │     └─ auth/...
│  │  ├─ lib/
│  │  │  ├─ engine/             -- pure handicap+match engine (no I/O)
│  │  │  │  ├─ courseHandicap.ts
│  │  │  │  ├─ allowances.ts
│  │  │  │  ├─ strokeAllocation.ts
│  │  │  │  ├─ formats/
│  │  │  │  │  ├─ scramble.ts
│  │  │  │  │  ├─ pinehurst.ts
│  │  │  │  │  ├─ shamble.ts
│  │  │  │  │  ├─ fourBall.ts
│  │  │  │  │  └─ singles.ts
│  │  │  │  ├─ matchState.ts    -- X UP / AS / Dormie / closed-out
│  │  │  │  └─ pointTally.ts    -- sub-match → team points
│  │  │  ├─ db/                 -- D1 query layer
│  │  │  ├─ auth/               -- HMAC cookie + magic link
│  │  │  ├─ outbox/             -- Dexie outbox + sync
│  │  │  ├─ pwa/                -- service worker registration
│  │  │  └─ ui/                 -- shared components
│  │  └─ app.html, app.css
│  ├─ static/
│  │  ├─ icons/                 -- PWA icons
│  │  └─ manifest.webmanifest
│  ├─ workers-site/             -- if using separate Worker
│  ├─ migrations/               -- D1 SQL migrations
│  │  ├─ 0001_init.sql
│  │  └─ 0002_seed_kiawah.sql
│  ├─ tests/
│  │  ├─ engine/                -- handicap/format unit tests (vitest)
│  │  └─ e2e/                   -- Playwright happy-path
│  ├─ wrangler.toml
│  ├─ svelte.config.js
│  ├─ vite.config.ts
│  ├─ package.json
│  └─ tsconfig.json
└─ README.md
```

**Engine isolation rule:** every file in `src/lib/engine/` must be pure (no DB, no network, no `Date.now()` without DI). All edge cases get unit-tested with table-driven tests pulled from USGA examples.

## Dependency Chain

Topologically ordered. Each layer depends only on layers above it.

```
Layer 0 — Repo + tooling
  pnpm/npm + tsconfig + svelte.config + wrangler.toml + vitest + playwright + eslint/prettier

Layer 1 — Cloudflare infra
  CF Pages project, D1 database (one DB, one binding), Workers secrets
  Custom domain CNAME -> rydercup.sbcctears.com

Layer 2 — Database schema
  migrations/0001_init.sql (tournaments, teams, players, courses, tees, holes,
    rounds, segments, matches, hole_scores, audit_log)
  migrations/0002_seed_kiawah.sql (5 courses + tees + holes + SI + CR/Slope)

Layer 3 — Pure engine (no I/O)
  courseHandicap, allowances, strokeAllocation,
  formats/{scramble,pinehurst,shamble,fourBall,singles},
  matchState, pointTally
  Unit tests against USGA Appendix C/E examples

Layer 4 — DB query layer
  Repositories per entity using Cloudflare D1 prepared statements

Layer 5 — Auth
  HMAC cookie sign/verify, magic-link issue/consume,
  middleware for player vs commissioner vs spectator

Layer 6 — API endpoints (Pages Functions)
  CRUD for tournaments, teams, players, courses, rounds, matchups
  Idempotent POST /matches/:id/holes (uses opId / Idempotency-Key)
  GET /live/:code (poll or SSE feed of derived state)

Layer 7 — Web UI: shared shell + auth flows
  Landing, code entry, roster select, manager login, layout

Layer 8a — Manager portal screens (parallel with 8b)
  Tournament settings, teams/players, courses, rounds builder, overrides

Layer 8b — Player score-entry UX (parallel with 8a)
  Round dashboard, hole-by-hole stepper, format interstitial, stroke dots,
  match state header

Layer 9 — Live views
  In-app live list, per-match detail, public ticker page

Layer 10 — PWA + offline
  Manifest, icons, service worker, Dexie outbox, sync orchestrator,
  online/offline UI

Layer 11 — Polish
  Empty states, error boundaries, accessibility audit, Lighthouse pass

Layer 12 — Seed + smoke
  Replay the Kiawah CSV as a seeded sample tournament for QA
```

Foundation modules (Layers 0–3) have no inter-dependencies internal to themselves and can be parallelized within each layer.

## Development Phases

| Phase | Entry criteria | Parallelizable work | Exit criteria |
|---|---|---|---|
| **P0 — Foundations** | Repo created | CF infra setup; SvelteKit scaffold; D1 schema; engine unit tests | `wrangler dev` runs; `pnpm test` passes engine tests |
| **P1 — Engine + API** | P0 done | All format files in `engine/`; DB repositories; API CRUD; auth | Engine 100% covered for the 5 MVP formats; API exercised via curl |
| **P2 — Manager portal** | P1 done | Tournament/teams/players/courses/rounds CRUD UI; matchup builder | Commissioner can build the entire Kiawah event from a clean DB |
| **P3 — Player score UX** | P1 done (parallel with P2) | Score entry flow, stroke dots, match state header, format interstitial | Player can enter all 18 holes of a Four-Ball match and see correct net result |
| **P4 — Live + ticker** | P2 + P3 | In-app live list, per-match detail, public ticker page, polling/SSE | Spectator sees state update within 5s of player entry |
| **P5 — PWA + offline** | P4 | Manifest, SW, Dexie outbox, idempotent replay, offline UI | Score entry works in airplane mode; replays on reconnect |
| **P6 — Seed + QA** | P5 | Kiawah seed migration; full event dry run; Lighthouse pass | All 5 rounds of Kiawah CSV can be replayed end-to-end |

## Core Features (MVP) — Detailed

### F1. Tournament Creation & Configuration
- Commissioner signs in via magic link → "+ New Tournament" → name, start/end dates, points-to-win (default 15.5, configurable), points-available (computed from rounds, displayed live), team color accents (Team A / Team B / …), spectator-access toggle (event-code-gated ↔ fully public ticker).
- App generates the 6-char event code; commissioner can regenerate.
- **Switch-Tournament selector:** persistent dropdown in the manager portal header that lists every tournament the signed-in commissioner owns. Clicking a tournament switches the entire portal context (teams, players, courses, rounds, overrides). Players carry a single-tournament cookie scope; they do not see the switcher. Default landing page after login is the most-recently-edited tournament; "+ New Tournament" is always adjacent to the switcher.

### F2. Team & Player Management
- Add players one-by-one or via CSV paste (`Name, Index, Email?`).
- Create teams (any count ≥2; MVP focuses on 2-team Ryder format but does not hardcode it).
- Assign players → teams (drag-drop or dropdown). Captain flag per team.
- Per-team color picker (drives ticker accents and score-entry header badges).
- **Matchup assignment is fully manual in MVP** — automated snake-draft / tier assignment is out of scope. Commissioners record any sit-out or tier rule as plain text in the tournament description field.

### F3. Course Library
- 5 Kiawah courses pre-seeded via `0002_seed_kiawah.sql` with all per-tee CR/Slope/par for both 18 and 9-hole splits, plus per-hole par and SI.
- "Add Course" admin form. Required fields per tee for the net engine to function: `cr18, slope18, par18, holes[1..18].par, holes[1..18].strokeIndex`. Recommended fields: `cr9F, slope9F, par9F, cr9B, slope9B, par9B` (required to support split-format rounds).
- Validation banner: "This course cannot be used for split-format rounds because 9-hole ratings are missing."

### F4. Round Builder
- Pick course + tee + date/time.
- Choose segment shape:
  - **Single-format 18:** one format the whole round (e.g., Singles at Turtle Point).
  - **Split F9 / B9:** different formats each nine (e.g., Scramble F9 + Four-Ball B9 at Cougar Point).
  - **Three-segment:** F9 + B9 + Overall (e.g., Ocean Course 9-pt day awards 1pt F9 + 1pt B9 + 1pt overall per match).
- Per-segment point allocation. App displays running total of points across the tournament so commissioner sees they're hitting their target (30 in the user's case).
- Matchup builder: list pairings as rows; each row picks side-A players from Team 1 roster and side-B players from Team 2 roster; supports 1v1, 2v2; rosters collapse to those still present (Oak Point 8-player carve-out drops Ted and Tim).

### F5. Format Engine
The five MVP formats with configurable allowances. Every percentage below is editable in **tournament settings** (applies to all rounds of that tournament) with an optional **per-round override**. The UI surfaces the **default** and the **"Use USGA standard"** one-click shortcut side by side.

| Format | Default allowance | USGA-recommended standard (one-click) | Team net per hole |
|---|---|---|---|
| **2-Man Scramble** | `35% × low_PH + 15% × high_PH` | Same (USGA Appendix C) | Team gross − team PH strokes on hole |
| **Pinehurst / Mod Alt Shot** | `60% × low_PH + 40% × high_PH` | Same (USGA Appendix C) | Team gross − team PH strokes on hole |
| **Shamble** | **85% per player** (community-practice recommendation) | 75% per player (USGA Committee Procedures §LG_R7h7, 2-person) | `min(playerA_net, playerB_net)` |
| **Four-Ball** | **100% per player** (user default when allowance left blank) | 90% per player match play (USGA Appendix C), 85% stroke play | `min(playerA_net, playerB_net)` |
| **Singles** | `100% × CH` per player | Same (USGA Appendix C) | Per player |

**Rules:**
- All five allowance values are editable per tournament (numeric input) and per round (override).
- The "Use USGA standard" button next to each format pre-fills the USGA value without saving; commissioner must confirm.
- Match-play normalization (lowest PH → 0) is applied **after** allowance, and is **not configurable** — it is the defining property of match play.
- If the commissioner leaves an allowance field blank, the default above is used.

### F6. Live Hole-by-Hole Score Entry
- One hole per screen. Top of screen: persistent match-state header `"Team Ted 2 UP thru 5"` and the current segment label (`F9 — Scramble`).
- Per player row: large +/- stepper for gross strokes, defaulting to par. Stroke-dot indicator (`•` or `••`) on holes where the player gets a stroke under the current format/PH.
- "Conceded hole" button (single tap) writes a `conceded=true` record without requiring a gross.
- "Picked up" button writes `pickedUp=true`; format engine treats player as out of the hole and uses partner's net (Four-Ball/Shamble) or assigns max for the team (Scramble/Pinehurst not applicable since single ball).
- Swipe / next button advances; back button edits prior hole.
- Format-change interstitial appears between hole 9 and hole 10 when the round has split formats: "B9 starts now — Four-Ball. Stroke allowances change. Continue."

### F7. Match Status & Match-Play Notation
- After every hole entry, recompute and display:
  - `2 UP`, `1 DN`, `AS` (all square), `DORMIE` (lead = holes remaining)
  - On match close: `W&R` notation, e.g. `4&3` (won by 4 with 3 holes to play); `5&4`, etc.
  - Halved holes show `T` pill on hole result; halved match shows `T` and awards 0.5 to each side.
- Sub-match results (F9, B9, Overall) compute independently when configured; Overall is a separate sub-match driven by full 18 holes, not a sum of F9 and B9.

### F8. Team Points Ticker
- In-app live list at `/t/:code` shows: cumulative team totals at the top, progress bar to `pointsToWin`, then per-round cards each containing per-match status.
- Public ticker at `/t/:code/live` (or alternate signed URL) renders the same data without auth, auto-refreshes every 3–5 seconds, mobile-friendly, dark-mode default for evening viewing.
- Ticker honors halved sub-matches as 0.5 + 0.5.

### F9. Commissioner Overrides
- Edit any hole score (with reason field, captured to `audit_log`).
- Force-close a match with arbitrary final score.
- Manual `+/-` to team points (escape hatch for weather adjustments, voided rounds, etc.).
- Audit log visible to all commissioners; not visible to players.

## Key User Flows

### UF1. Commissioner sets up the event
1. Visit `/manage/login`, enter email, click magic link.
2. "+ New Tournament" → fill name, dates, `pointsToWin = 15.5`.
3. Add 10 players via CSV paste.
4. Create Team Ted (red) and Team Corey (blue); assign captains; assign players manually (drag-drop from unassigned roster).
5. Course library: confirm 5 Kiawah courses present.
6. Add 5 rounds:
   - Tue Cougar Point: F9 Scramble (3 pts) + B9 Four-Ball (3 pts), 3 matchups (2v2, 2v2, 1v1).
   - Wed Osprey Point: F9 Pinehurst (3 pts) + B9 Four-Ball (3 pts), same shape.
   - Thu AM Oak Point: F9 Shamble (2 pts) + B9 Four-Ball (2 pts), 2 matchups (8 players; Ted + Tim sit out).
   - Thu PM Ocean Course: 18-hole F9 (3 pts) + B9 (3 pts) + Overall (3 pts), 3 matchups.
   - Fri Turtle Point: 18-hole Singles, 5 matchups, 1 pt each.
7. Confirm total points = 30, points-to-win = 15.5.
8. Share event code in the group chat.

### UF2. Player joins
1. Tap link in group chat → app prompts for code → enter `K7M4XQ`.
2. Tap "Mike C" from the roster.
3. Lands on personal dashboard: shows tournament, today's round, the matches I'm in.
4. App offers "Install to home screen" if first visit.

### UF3. Scorer enters a round (with offline interlude)
1. At Cougar Point tee, scorer Mike C opens the Cougar Point F9 Scramble match.
2. App shows hole 1: par 4, SI 9. Stroke dots reflect that Bob (high) gets a stroke here under blended scramble PH.
3. Scorer enters team gross 5; app computes team net using blended PH and SI allocation; renders new state `Team Ted 1 DN thru 1`.
4. Walking to hole 5, signal drops. App shows offline indicator. Scorer enters holes 5–9 anyway; outbox queues them with `opId`.
5. Format interstitial appears at hole 10: B9 Four-Ball starts; stroke allowances refresh.
6. Signal returns at hole 12. Outbox replays in order; server idempotency keys prevent duplicates; ticker updates.
7. Match closes 3&2 on hole 16. App locks subsequent holes; result writes to `match.result`.

### UF4. Commissioner finalizes a round
1. End of day, commissioner opens round detail.
2. Reviews any flagged matches (e.g., one with no final entry).
3. Closes any open matches manually if needed; confirms team points add up.

### UF5. Spectator watches public ticker
1. Spouses get a link `rydercup.sbcctears.com/t/K7M4XQ/live`.
2. Page auto-refreshes; shows `Team Ted 8.5 — Team Corey 6.5` at the top, current matches in progress, finished matches collapsed.
3. No login. No edit affordances.

## Handicap & Scoring Engine

The canonical rules the app implements. All formulas reference USGA WHS Rules of Handicapping, 2024 revision.

### Course Handicap (CH) — WHS Rule 6.1a
```
CH = HandicapIndex × (Slope / 113) + (CourseRating − Par)
```
- Compute unrounded.
- Round to integer Playing Handicap **after** the format allowance is applied.

### 9-hole Course Handicap (CH9) — WHS Rule 6.1b
```
HalfIndex = round(HandicapIndex / 2, 1)            -- to one decimal
CH9       = HalfIndex × (Slope9 / 113) + (CR9 − Par9)
```
- Required for split-format rounds; required when a sub-match is 9 holes only.

### Format allowances (default; editable per tournament, overridable per round)

| Format | Default allowance | Standards reference (one-click in UI) | Source |
|---|---|---|---|
| 2-Man Scramble | 35% low + 15% high blended team PH | 35/15 (unchanged) | USGA Appendix C |
| Pinehurst / Mod Alt Shot | 60% low + 40% high blended team PH | 60/40 (unchanged) | USGA Appendix C |
| Shamble (per-player) | **85%** (community-practice) | 75% per player | USGA Committee Procedures §LG_R7h7 |
| Four-Ball (per-player) | **100%** (default when left blank) | 90% match play / 85% stroke play | USGA Appendix C |
| Singles | 100% | 100% (unchanged) | USGA Appendix C |

**Standards Reference policy:** every allowance field in the UI displays both the current value and a "Use USGA standard" affordance that pre-fills the USGA-recommended number without saving. Commissioners explicitly confirm to apply. Custom values outside the 0–150% range are rejected with a validation error.

### Match-play normalization
For per-player formats (Shamble, Four-Ball, Singles), after applying the per-player allowance:
1. Find the lowest PH among all players in the match.
2. Subtract that lowest PH from each player's PH so the lowest plays off 0.
3. Allocate strokes from the resulting deltas.

For team-PH formats (Scramble, Pinehurst), the team has a single PH. Compute both teams' PH; subtract the lower from both so one team plays off 0.

### Stroke allocation — Appendix E
- Allocate strokes in **ascending Stroke Index order** (SI 1 first, SI 2 second, …).
- If allocated strokes > 18, wrap around: SI 1 receives a 2nd stroke as stroke #19, SI 2 receives the 20th, etc.
- Negative PH (plus handicap): give back strokes starting at SI 18 descending.
- For 9-hole sub-matches, allocate only on the 9 holes in scope; SI ranks are taken from the full 18 (the lower 9 SIs that fall within the played 9 receive strokes first).

### Net per hole
- **Per-player net** = `gross − strokesReceivedOnHole` (typically 0 or 1, can be 2 on wrap).
- **Team net (Scramble/Pinehurst)** = `team_gross − team_strokes_on_hole` derived from team PH.
- **Team net (Shamble/Four-Ball)** = `min(playerA_net, playerB_net)` (use partner's net if other picked up).

### Hole result
- Lower team net wins the hole; equal nets = halved (`T`).
- Conceded holes write the conceded side as the hole loser without requiring a gross.

### Match state
- After each hole, recompute `holesUp = sideA_holesWon − sideB_holesWon` and `holesRemaining = 18 − holesPlayed` (or 9 for 9-hole sub-matches; or however many remain in the relevant segment).
- States: `AS` (holesUp = 0), `X UP` (holesUp > 0), `X DN` (holesUp < 0), `DORMIE` (|holesUp| = holesRemaining), closed-out (`|holesUp| > holesRemaining` → record `W&R` notation, e.g. `4&3`).
- Halved match (full segment played, holesUp = 0) → `T`, awards 0.5 to each side of the segment's points.

### Sub-match → team points (point tally)
- Each `Match` row carries `pointsAtStake`. On close:
  - Win → all `pointsAtStake` to winner.
  - Halved → split equally.
- Team totals = sum across all closed matches in the tournament.

### Split-format stroke allocation — recommended default
- **Convention 1 (recommended):** independent 9-hole CH per nine; each nine's format allowance applied separately. Requires 9-hole CR/Slope/par for the course.
- **Convention 2 (fallback):** halved 18-hole CH (each nine gets `round(CH18 / 2)`); used only when 9-hole ratings are unavailable for the course.
- Surfaced as a tournament setting; default is Convention 1, fallback to Convention 2 with a UI warning when course lacks 9-hole ratings.

### Worked example (illustrative, drawn from Kiawah CSV)
- Tue Cougar Point F9 Scramble, pairing `Ted (2.4) & Bob (18.6)` vs `Corey (5.8) & Joe (25.0)`.
- Compute each player's CH9 using Cougar Point Blue tee 9F CR/Slope/par.
- Team Ted PH = `0.35 × min(CH9_Ted, CH9_Bob) + 0.15 × max(...)` (rounded to integer at the end).
- Team Corey PH similarly.
- Subtract the lower team PH from both → that team plays scratch on F9; the other gets the difference distributed by SI ascending.
- Team enters one team gross per hole; engine subtracts allocated strokes; lower team net wins the hole; segment state updates after each entry.

### Picked-up ball and conceded-hole rules
- **Picked up (per-player formats: Shamble, Four-Ball):** player's ball out of the hole; partner's net carries the team for that hole. If **all** players on a side have picked up, the side forfeits the hole.
- **Picked up (single-ball formats: Scramble, Pinehurst):** not applicable — the team plays one ball; concede the hole instead.
- **Concede-hole authority:** any authenticated player in the match (either side) can concede a hole for their own side. The action is attributed to `enteredByPlayerId` and written to the audit log. No role-based restriction.
- **Halved match (including Singles going `AS` after 18):** recorded as `T` and awards 0.5 points to each side. **No sudden-death playoff in MVP.**

## Offline & PWA Requirements

### Service worker
- App-shell precache: HTML/JS/CSS hashes via Vite build manifest; revalidate on activate.
- Runtime caching: course/round/match metadata cached `stale-while-revalidate`.
- Background sync registration for outbox flushes.

### Outbox (Dexie / IndexedDB)
- Every score-mutation request:
  1. Generates `opId` (UUIDv7 or ULID — sortable).
  2. Writes optimistic local update.
  3. Enqueues `{opId, endpoint, body}` in IndexedDB `outbox` table.
  4. Attempts POST with `Idempotency-Key: opId`.
  5. On 2xx, removes from outbox.
  6. On network failure, retries with exponential backoff on next online event.
- Server endpoints check `Idempotency-Key` against a `processed_ops` table; duplicate keys return the prior response.

### UI
- Persistent online/offline pill in the header.
- "N pending" badge when outbox is non-empty.
- Last-synced timestamp on each match.
- Hard error toast only after sustained sync failure (not on transient).

### Conflict resolution
- Last-write-wins per `(matchId, playerId, holeNumber)` keyed on server `enteredAt`.
- Commissioner overrides always win regardless of timestamp (separate field).
- Concurrent edits surface a "score updated by [player]" toast to other open clients.

### PWA manifest
- Installable; standalone display mode.
- Theme color matches tournament's primary team color when on a tournament route.
- Apple touch icons + maskable icons for Android.
- Audited via Lighthouse PWA category — must score ≥90.

## Hosting & Infrastructure Recommendation

### Primary recommendation: Cloudflare Pages + Pages Functions + D1 on `rydercup.sbcctears.com`

**Why:** the user already owns `sbcctears.com` in Cloudflare; adding a subdomain is one CNAME and zero risk to the parent site. D1 is SQLite-on-edge — perfect fit for an event-scoped, mostly-read workload with bursty writes during rounds. Pages Functions handle our API at zero cost. PWA static assets ride the Cloudflare CDN. All traffic stays in one provider so the network path is a single hop.

### Subdomain vs. subpath tradeoff

| Concern | Subdomain `rydercup.sbcctears.com` | Subpath `sbcctears.com/rydercup` |
|---|---|---|
| **Risk to existing site** | Zero — separate CNAME, separate Pages project | High — subpath routing must coexist with whatever serves the parent site; misconfigured Page Rules can break either side |
| **Cookie isolation** | httpOnly cookies scoped to subdomain; can't leak to parent | Cookies risk leaking between contexts unless carefully scoped |
| **PWA scope** | Clean root scope; service worker doesn't fight parent SW | Service worker scope must be `/rydercup/`; install heuristics worse |
| **Deploy independence** | Fully independent; deploys don't touch the parent | Couples deploys |
| **SEO / branding** | Distinct subdomain shows up nicely in messages | Buried under parent |
| **Setup effort** | Add CNAME → Pages project → custom domain (5 minutes) | Requires routing rules on the parent or a Cloudflare Worker doing path rewrites |
| **Recommendation** | ✅ Use this | ❌ Avoid |

### Dormancy constraint (hard requirement)

The app is **expected to be dormant for long stretches** between events (potentially months). Whatever runs in production must still respond in full after extended idle time with **no manual "wake up" ritual** and **no data loss**. This constraint eliminates:

- **Supabase free tier** — projects pause after 7 days of inactivity; requires manual unpause and risks blocking the commissioner the morning of an event. Ruled out.
- **Render / Fly / Railway free tiers** — containers spin down after idle; first request after dormancy suffers cold-start delays of 10–30s. Ruled out for production.
- **Vercel Postgres free** — limited data-transfer quotas and historical policy changes create renewal risk for long-dormant projects. Ruled out.

Cloudflare Pages (static) + Pages Functions (Workers) + D1 all remain **always-available** regardless of traffic; D1 databases persist at rest indefinitely; Workers have no cold-start in the traditional sense. This is the only free-tier combination evaluated that satisfies the dormancy constraint.

### Hosting options compared

| Option | Monthly cost (this scale) | Survives dormancy? | Pros | Cons | Verdict |
|---|---|---|---|---|---|
| **CF Pages + CF Pages Functions + D1** | $0 | ✅ Yes | Single provider; free tier roomy; no cold start; existing Cloudflare zone | D1 is newer; SQL only (no JSONB); no managed admin GUI | **Recommended** |
| CF Pages + Supabase | $0 (Supabase free) | ❌ No (7-day pause) | Postgres; auth + storage + realtime built in | Free tier pauses after idle — **violates dormancy constraint** | Ruled out |
| CF Pages + Neon (Postgres) | $0 small tier | ⚠️ Partial (cold starts) | Real Postgres; great DX | ~1s cold start after idle; cross-cloud hop | Acceptable backup only |
| Vercel + Vercel Postgres / KV | Free tier limited | ❌ No | Best Next.js DX | Bandwidth + function invocation caps; commercial-use restrictions | Ruled out |
| Render / Fly / Railway | $5–10 | ❌ Free tier spins down | Familiar Postgres model | Paid to stay warm; **violates dormancy constraint** on free tier | Ruled out |

### Domain cost
- Subdomain on existing zone: **$0**.
- New domain (e.g., `kiawahrydercup.com`): $10–15/year — **not recommended** because it adds renewal overhead for a tool the user wants to use indefinitely; subdomain has no such drawback.

### Email delivery — Resend

Cloudflare does not ship an outbound email service, so magic-link emails require a third-party provider. **Resend** is the chosen default because:

- Free tier: 3,000 emails/month, 100/day — dwarfs expected usage (a few magic links per tournament).
- Clean SDK; works from Cloudflare Workers with `fetch` (no Node SDK required).
- Requires a verified sending domain (`sbcctears.com` or a dedicated subdomain like `mail.rydercup.sbcctears.com`) with SPF + DKIM DNS records added to the existing Cloudflare zone.
- Integrates with a single Workers secret `RESEND_API_KEY`.

Alternatives (MailChannels via CF, AWS SES) remain documented as fallbacks but are not the default.

### Production setup checklist (for the Architect to execute later)
- New Cloudflare Pages project bound to the repo.
- Custom domain `rydercup.sbcctears.com` (CNAME inside existing zone).
- D1 database `rydercup-prod`; binding name `DB`.
- Workers secrets: `COOKIE_SIGNING_KEY`, `MAGIC_LINK_KEY`, `RESEND_API_KEY`, `SPECTATOR_COOKIE_KEY`.
- Resend account + verified sending domain (SPF, DKIM, DMARC records in Cloudflare DNS).
- Preview environment on `*.pages.dev` for branch deploys.
- Wrangler-managed migrations.

## Branding & Theme

- **Default theme:** clean, modern, mobile-first. Neutral light + dark modes; auto-switch with `prefers-color-scheme`. Dark mode is default on the public ticker for evening viewing.
- **Typography:** system font stack for speed and platform-native feel; display weight for match-state header.
- **Per-tournament accents:** each team has a configurable color (picker in team settings). Team colors drive ticker badges, score-entry headers, and progress-to-win bars. Commissioner picks at tournament creation; can edit anytime.
- **Color independence:** state cues (UP / DN / AS / T) never rely on team color alone — always paired with a text pill and/or an iconographic indicator.
- **Designer deliverable:** the Designer produces the default theme (color tokens, typography scale, component patterns for steppers, cards, badges, progress bars) during the implementation phase and applies it across commissioner, player, and spectator screens.

## Non-Functional Requirements

- **Mobile-first responsive** down to 360px width; tested on iOS Safari and Chrome Android.
- **Touch targets ≥44pt** per Apple HIG; score-entry steppers ≥56pt.
- **Performance:** First Contentful Paint <1.5s on a throttled 4G profile; Time to Interactive <2s.
- **Offline:** all read paths function from cache; score writes function offline; sync on reconnect.
- **Lighthouse:** PWA ≥90, Performance ≥90, Accessibility ≥95.
- **Accessibility:** semantic HTML, ARIA where needed, keyboard-navigable manager portal, color-independent state cues (don't rely on red/blue alone for team identity).
- **Browser support:** evergreen Chrome, Safari, Firefox, Edge. No IE.
- **Data retention:** tournaments archived forever; player records retain `displayName + handicapIndex + email?` only. No phone, no DOB, no payment data.
- **Privacy:** GDPR-light privacy notice in the manager portal; per-tournament purge endpoint (commissioner action: deletes all rows referencing the tournament).

## Nice-to-Haves / Post-MVP Backlog

- **Skins game** layered on top of any round.
- **Closest-to-pin / Longest drive** flags per hole with per-hole point bonuses.
- **Per-hole photos & comments** (S3-compatible R2 storage).
- **Tournament history archive** with cup-record book (lifetime W-L between teams or captains).
- **Side-bet ledger** (auto-pivot of dinner-payout responsibility).
- **Push notifications** for match-over events.
- **SMS notifications** via Twilio (paid).
- **Apple Watch companion** for hole entry.
- **GHIN sync** for handicap index pulls.
- **Stroke-play tournaments** (and Stableford, Modified Stableford, Chapman, Greensomes).
- **Multi-language UI**.
- **CSV import/export** for rosters and final scorecards.
- **Course-data scrape tool** to seed a new course from BlueGolf URLs.
- **In-app chat / per-match comments** for spectator banter.

## Out of Scope (MVP)

- GHIN integration / live handicap index pulls.
- Shot tracking / GPS / yardage.
- Stroke-play / Stableford tournaments.
- Individual player accounts that span tournaments (player identity is per-tournament in MVP).
- Multi-language localization.
- Payment processing or paid-tier features.
- **Real-time chat / in-app messaging / per-match comments.**
- **Automated snake-draft / tier-assignment helper** — commissioners build matchups manually; any sit-out / draft-tier rule is recorded as plain text on the tournament.
- Sudden-death playoffs for tied matches (halves are halved).
- Native mobile apps (PWA only).

## Constraints

- **Cost ceiling:** $0/month at the planned scale. Any feature that requires moving off Cloudflare free tier or D1 must be flagged.
- **Dormancy constraint:** production stack must remain fully operational after arbitrarily long idle periods with no manual "wake" step. Rules out Supabase free, Render/Fly/Railway free, Vercel Postgres free. See **Hosting & Infrastructure**.
- **No third-party identity provider** for MVP — keeps the "dead-simple to join" property.
- **No hardcoded environment values** (project IDs, domains, secrets) in source. Everything via Wrangler env / secrets bindings.
- **No third-party course-data dependency** at runtime — courses are seeded; admin can edit. Avoids API key management and rate-limit risk.
- **Cloudflare D1 limits** to respect: 5GB DB size on free tier (vastly more than needed), 100k rows/day writes (well within budget), 5M rows/day reads.
- **Engine purity:** no I/O in `src/lib/engine/`. All inputs flow in as plain objects so the engine is unit-testable and replayable.

## Resolved Decisions

All 15 open questions from the initial PRD have been answered. The decisions below govern implementation; deviations require explicit PRD update.

| # | Topic | Decision |
|---|---|---|
| 1 | Shamble allowance | **Default 85% per player** (community practice). USGA standard (75%) exposed as a one-click option. Field editable per tournament and per round. |
| 2 | Four-Ball allowance | **Default 100% per player** when left blank. USGA Appendix C standards (90% match play / 85% stroke play) exposed as one-click options. Same pattern applies to all "Net" formats: literal 100% is the default, USGA standard is one-click. |
| 3 | Split-format stroke convention | **Convention 1 (independent 9-hole CH per nine)** is the default. Fallback to Convention 2 (halved 18-hole CH) automatically when a course lacks 9-hole CR/Slope; UI surfaces a warning. |
| 4 | Sub-match point splits | Confirmed as inferred: 6-pt rounds = 1 F9 + 1 B9 per match; 9-pt Ocean = 1 F9 + 1 B9 + 1 Overall per match; 4-pt Oak = 1 F9 + 1 B9 per match × 2 matches; 5-pt Turtle = 1 Overall per Singles × 5. Halved sub-match = 0.5 / 0.5. |
| 5 | Email collection | **Commissioners only** (for magic-link). Players never need email. |
| 6 | Spectator access | **Event-code-gated by default** (matches Golf Genius). Per-tournament toggle `publicTickerEnabled` allows fully-public ticker for group-text sharing. |
| 7 | Multi-event support | **Yes from day 1.** Manager portal exposes a Switch-Tournament selector. Commissioners can own multiple tournaments under a single magic-link identity. |
| 8 | In-app chat / comments | **Out of scope for MVP.** |
| 9 | Annual use frequency | **Dormant between events** — reinforces Cloudflare Pages + D1 choice; excludes Supabase free, Render free, Vercel free for production. |
| 10 | Snake-draft / tier helper | **Out of scope for MVP.** Commissioners build matchups manually; sit-out / draft rules captured as plain text on the tournament. |
| 11 | Halved Singles after 18 | **0.5 / 0.5, no playoff** in MVP. |
| 12 | Picked-up ball | Partner's net carries in Four-Ball and Shamble; team forfeits hole only if **all** players on that side picked up. Not applicable to Scramble / Pinehurst (single ball). |
| 13 | Conceded-hole authority | **Any authenticated player in the match** (either side) can concede for their own side. No role restriction. Action attributed to `enteredByPlayerId` and audit-logged. |
| 14 | Branding & theme | Clean modern default theme (see **Branding & Theme** section). Per-tournament team colors configurable; Designer delivers in implementation phase. |
| 15 | Email provider | **Resend** (3k/mo free). `RESEND_API_KEY` stored as Workers secret. Requires verified sending domain (SPF + DKIM added to `sbcctears.com` Cloudflare DNS). |

## Appendix A — USGA References
- WHS Rule 6.1a (Course Handicap formula)
- WHS Rule 6.1b (9-hole Course Handicap)
- WHS Appendix C (Handicap Allowances by format)
- WHS Appendix E (Stroke Allocation)
- USGA Committee Procedures §LG_R7h7 (Shamble allowances)

## Appendix B — Kiawah Course Seed Data Sources
- BlueGolf course profiles for each Kiawah Island Golf Resort course (Cougar Point, Osprey Point, Oak Point, Turtle Point) — Slope, Rating, par, yardage by tee, hole-by-hole SI.
- Ocean Course official scorecard PDF for tournament tees.
- Manual verification step in P0/P1 by the Architect/Coder: cross-check seeded values against the printed course scorecards.

## Appendix C — Sample 30-Point Event Mapping (from User CSV)

| Day | Course | Players | Format | Points | Matchups |
|---|---|---|---|---|---|
| Tue 5/12 2:10 PM | Cougar Point | 10 | F9 Scramble + B9 Four-Ball | 6 | 2×2v2, 1×1v1 |
| Wed 5/13 12:10 PM | Osprey Point | 10 | F9 Pinehurst + B9 Four-Ball | 6 | 2×2v2, 1×1v1 |
| Thu 5/14 7:40 AM | Oak Point | 8 (Ted, Tim sit) | F9 Shamble + B9 Four-Ball | 4 | 2×2v2 |
| Thu 5/14 2:40 PM | Ocean Course | 10 | 18-hole F9 + B9 + Overall | 9 | 2×2v2, 1×1v1 |
| Fri 5/15 10:00 AM | Turtle Point | 10 | 18-hole Singles | 5 | 5×1v1 |
| **Total** | | | | **30** | **Win threshold 15.5** |

Sub-match point splits (confirmed, Resolved Decisions #4):

| Round | Total pts | Structure |
|---|---|---|
| Cougar Point (6) | 3 × (F9 1pt + B9 1pt) = 6 | 3 matches, split-format |
| Osprey Point (6) | 3 × (F9 1pt + B9 1pt) = 6 | 3 matches, split-format |
| Oak Point (4) | 2 × (F9 1pt + B9 1pt) = 4 | 2 matches, split-format |
| Ocean Course (9) | 3 × (F9 1pt + B9 1pt + Overall 1pt) = 9 | 3 matches, three-segment |
| Turtle Point (5) | 5 × (Overall 1pt) = 5 | 5 Singles matches |

## Appendix D — Glossary
- **PH** — Playing Handicap (CH adjusted by format allowance, rounded).
- **CH / CH9** — Course Handicap, 18-hole / 9-hole.
- **SI** — Stroke Index (1–18 ranking of hole difficulty for stroke allocation).
- **AS** — All Square.
- **Dormie** — Match lead equals holes remaining; trailing side cannot win, only halve.
- **W&R** — Won and Remaining; e.g. `4&3` = leading by 4 with 3 holes to play.
- **GGID** — Golf Genius Game ID; the short code players enter to join an event.
