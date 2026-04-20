# Tears Tourneys — Architecture Overview

## Stack

| Layer | Technology |
|---|---|
| Frontend + SSR | SvelteKit (`@sveltejs/adapter-cloudflare`) |
| Hosting | Cloudflare Pages (Pages Functions for server routes) |
| Database | Cloudflare D1 (SQLite, accessed via `platform.env.DB`) |
| Email | smtp2go HTTP API (magic-link delivery — Workers cannot open raw SMTP sockets) |
| Offline storage | Dexie (IndexedDB wrapper, browser-only) |
| Service worker | Workbox (precache + routing strategies) |
| Styling | Tailwind CSS with semantic design tokens |

## Directory Structure

```
web/
├── migrations/          # Ordered SQL migration files
├── scripts/             # Migration helper (apply-migrations.mjs)
├── src/
│   ├── hooks.server.ts  # Request middleware — role resolution
│   ├── service-worker.ts
│   ├── lib/
│   │   ├── auth/        # HMAC cookies, magic links, email client, guards
│   │   ├── db/          # D1 repository layer (one file per entity)
│   │   ├── engine/      # Pure scoring engine — no I/O
│   │   │   └── formats/ # Per-format engines (scramble, pinehurst, shamble, fourBall, singles)
│   │   ├── outbox/      # Dexie-backed offline queue + sync
│   │   ├── pwa/         # Service worker registration
│   │   ├── ui/          # Shared Svelte components
│   │   └── courseImport.ts  # CSV parser for bulk course/tee/hole import
│   └── routes/
│       ├── api/         # Pages Functions (REST endpoints)
│       ├── manage/      # Commissioner portal (/manage/...)
│       │   └── courses/ # Course management — list, create, CSV import
│       ├── t/[code]/    # Player + spectator views (/t/:code/...)
│       └── join/        # Player join flow
└── static/
    ├── manifest.webmanifest
    └── icons/
```

## Auth Model

Three roles, each identified by a signed HMAC cookie:

| Role | Cookie | Issued by |
|---|---|---|
| `commissioner` | Signed with `COOKIE_SIGNING_KEY` | Magic-link consume endpoint |
| `player` | Signed with `COOKIE_SIGNING_KEY` | `/api/join/:code/select-player` |
| `spectator` | Signed with `SPECTATOR_COOKIE_KEY` | Spectator join flow |
| `anonymous` | — | No cookie present |

`hooks.server.ts` resolves the role on every request and attaches it to `event.locals`. When both `rc_commissioner` and `rc_player` cookies are present, `rc_commissioner` takes priority — the resolved role is `commissioner`. The hook then also resolves the `rc_player` cookie: if valid, `event.locals.playerId` and `event.locals.playerTournamentId` are set as supplementary fields. Route handlers call `requireRole()` to gate access. Magic links are single-use, HMAC-signed, stored as a hash in `magic_link_tokens`, and expire after 15 minutes.

**Dual-role (commissioner + player):** Commissioners may join a tournament as a player via the standard join flow (`/join`); the join routes do not redirect commissioners. The resulting `rc_player` cookie coexists with `rc_commissioner`; role remains `commissioner`. `App.Locals` carries `playerTournamentId` separately from `tournamentId` to avoid conflicts. The `/t/[code]` layout no longer hard-redirects commissioners to `/manage`; `loadCurrentPlayer()` uses `locals.playerTournamentId || locals.tournamentId` to authorize the commissioner into the player view for the same tournament. Cross-tournament access is blocked at the home page level: the dual "Continue to [Tournament]" / "Go to Manager Portal" CTAs only render when the player tournament matches the commissioner tournament. Commissioner score-entry override is preserved and not restricted to a specific side.

## Data Flow

```
Browser request
  → SvelteKit server load / form action (Pages Function)
    → hooks.server.ts (role resolution)
      → src/lib/db/ (D1 prepared statements)
        → src/lib/engine/ (pure computation, no I/O)
          → response to client
```

The engine layer (`src/lib/engine/`) has no imports from `src/lib/db/` or any I/O module. Repository functions pass raw data in; engine functions return computed results; the route handler writes results back to D1.

## Offline Flow (Score Entry)

```
Player enters score (offline)
  → optimistic UI update (hole advances immediately)
    → outbox.enqueue() → Dexie IndexedDB (opId = Idempotency-Key)
      → PendingSyncBadge shows pending count

On reconnect
  → outbox/sync.ts drains queue in creation order
    → POST /api/matches/:matchId/holes with Idempotency-Key header
      → server checks processed_ops(op_id, match_id) — duplicate = no-op
        → badge clears; server-authoritative state reconciled
```

`processed_ops.match_id` scopes idempotency keys per match, added by migration `0003`.

## Live Data

`GET /api/live/[code]` builds a `LiveSnapshot` (teams, rounds, matches, `lastUpdated`) consumed by SSE clients and direct pollers.

| Concern | Implementation |
|---|---|
| Match deduplication | `loadMatches()` uses `ROW_NUMBER() OVER (PARTITION BY match_id ORDER BY computed_at DESC)` CTE — only the latest `match_results` row per match is returned, preventing duplicates from multi-segment tournaments |
| SSE change detection | `loadLastUpdated()` queries `MAX(hs.updated_at)` from `hole_scores` — score corrections (which update `updated_at` without inserting a new row) correctly trigger a live feed push |
| Leaderboard auto-refresh | `/t/[code]/leaderboard` calls `invalidateAll()` on a 15-second interval (guarded by `document.visibilityState === 'visible'`) and immediately on `visibilitychange`; interval is cleared on component destroy |

## Service Worker Strategies

| Route pattern | Strategy | Cache name |
|---|---|---|
| App shell (`build` + `files`) | Precache (revision-keyed) | Workbox default |
| `GET /api/courses/**`, `/api/tournaments/*/rounds`, `/api/live/**` | StaleWhileRevalidate | `metadata-cache` |
| `GET /api/auth/**`, `/api/matches/*/holes/**`, `/api/join/**` | NetworkFirst (no-store) | `network-first-no-store-{version}` |
| `/manifest.webmanifest`, `/icons/**` | CacheFirst | `static-assets-cache-{version}` |

Score writes (`POST`) bypass the service worker and go directly to the network; the outbox handles offline queuing at the application layer.

`SKIP_WAITING` is triggered via `postMessage({ type: 'SKIP_WAITING' })` on activate to ensure fresh deploys propagate immediately.

## Key Security Decisions

| Decision | Rationale |
|---|---|
| Side-scoped score authorization | Only players assigned to a match side can submit scores for that side; commissioner override required for any other edit |
| Scoped idempotency keys | `(op_id, match_id)` unique index prevents cross-match key collisions from silently succeeding |
| Atomic claim-first token consumption | `magic_link_tokens` rows are marked used in a single UPDATE; second-use check is a SELECT before the UPDATE to return the same result idempotently |
| Separate cookie signing keys | `COOKIE_SIGNING_KEY`, `SPECTATOR_COOKIE_KEY`, and `MAGIC_LINK_KEY` are independent — rotating one class does not invalidate other sessions |
| No ORM | All D1 queries use prepared statements; no string-concatenated SQL anywhere in `src/lib/db/` |

## Environment Summary

See [`INFRASTRUCTURE.md`](./INFRASTRUCTURE.md) for full resource inventory and verify commands.

| Environment | D1 database | Domain |
|---|---|---|
| local | SQLite file (`.wrangler/state/`) | `localhost:5173` |
| preview | `golf-preview` | `<branch>.golf.pages.dev` |
| production | `golf-prod` | `golf.sbcctears.com` (also `golf.pages.dev`) |
