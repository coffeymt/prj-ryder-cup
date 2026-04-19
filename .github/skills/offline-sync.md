---
applyTo: 'web/src/lib/outbox/**/*.ts,web/src/service-worker.ts,web/src/lib/pwa/**/*.ts'
---

# Offline-First & Sync Patterns

Rules for implementing offline functionality in the golf scoring app. The app must work on a golf course with unreliable connectivity.

## Outbox Pattern

Score entries use an outbox queue backed by Dexie (IndexedDB):

```
Player enters score (offline)
  → optimistic UI update (hole advances immediately)
    → outbox.enqueue() → Dexie IndexedDB (opId = Idempotency-Key)
      → PendingSyncBadge shows pending count

On reconnect
  → outbox/sync.ts drains queue in FIFO order
    → POST /api/matches/:matchId/holes with Idempotency-Key header
      → server checks processed_ops(op_id, match_id)
        → duplicate = no-op (idempotent)
        → badge clears; server-authoritative state reconciled
```

### Rules

- Every outbox entry gets a client-generated UUID as its `opId` (Idempotency-Key)
- Entries are drained in creation order — never reorder
- Failed syncs retry with exponential backoff
- The server is the source of truth — client state reconciles after sync
- `processed_ops(op_id, match_id)` unique index prevents replay attacks

## Dexie (IndexedDB) Usage

- Dexie is **browser-only** — never import it in server code (`+page.server.ts`, `+server.ts`, `hooks.server.ts`)
- The Dexie database schema is defined in `src/lib/outbox/db.ts`
- Use `fake-indexeddb` in Vitest tests (already in devDependencies)

## Service Worker Strategies

Defined in `src/service-worker.ts` using Workbox:

| Route Pattern | Strategy | Rationale |
|---|---|---|
| App shell (build + files) | Precache (revision-keyed) | Instant app load offline |
| `GET /api/courses/**`, `/api/tournaments/*/rounds`, `/api/live/**` | StaleWhileRevalidate | Show cached data immediately, update in background |
| `GET /api/auth/**`, `/api/matches/*/holes/**`, `/api/join/**` | NetworkFirst | Auth and scoring data must be fresh when online |
| `/manifest.webmanifest`, `/icons/**` | CacheFirst | Static assets rarely change |

### Rules

- Score writes (`POST`) bypass the service worker entirely — the outbox handles offline
- `SKIP_WAITING` is triggered via `postMessage({ type: 'SKIP_WAITING' })` on activate
- Cache names include a version segment for safe invalidation
- Never cache `POST`, `PUT`, `DELETE` responses

## UI Indicators

- **PendingSyncBadge** — Shows count of unsynced outbox entries. Visible when count > 0.
- **Connection status** — Online dot (subtle) vs. offline pill with `animate-pulse-soft`
- Both indicators use `role="status"` and `aria-live="polite"` for accessibility
