---
applyTo: 'web/migrations/**/*.sql,web/src/lib/db/**/*.ts'
---

# D1 Database Conventions

Rules for writing D1 (SQLite) queries and migrations in this project.

## Prepared Statements Only

All D1 queries MUST use prepared statements with parameter binding:

```typescript
// ✅ Correct
const row = await db.prepare('SELECT * FROM players WHERE id = ?').bind(playerId).first();

// ❌ Forbidden — SQL injection risk
const row = await db.prepare(`SELECT * FROM players WHERE id = '${playerId}'`).first();
```

Never use string interpolation, concatenation, or template literals to build SQL.

## Repository Layer Pattern

Each entity has one file in `src/lib/db/`:

| File | Entity | Key operations |
|---|---|---|
| `tournaments.ts` | Tournaments | CRUD, lookup by code |
| `matches.ts` | Matches | CRUD, lookup by round/tournament |
| `players.ts` | Players + player_tournaments | Standalone player CRUD; tournament membership via `player_tournaments` join; `getPlayerWithTournament()` for scope validation |
| `teams.ts` | Teams | CRUD, team assignment |
| `rounds.ts` | Rounds | CRUD, round ordering |
| `holeScores.ts` | Hole scores | Score entry, bulk read per match |
| `courses.ts` | Courses | Course/tee/hole CRUD, search, batch tee/hole insert |
| `courseImport.ts` *(lib root)* | Course import | CSV → `CourseImportData`; used by `/manage/courses/import` action |
| `processedOps.ts` | Idempotency keys | Dedup check for offline sync |
| `magicLinks.ts` | Magic link tokens | Create, consume, expire |
| `commissioners.ts` | Commissioner accounts | Lookup, create |
| `auditLog.ts` | Audit trail | Append-only logging |

Repository functions:
- Accept `D1Database` as the first parameter
- Return plain TypeScript objects (not D1-specific types)
- Handle `null` returns for not-found cases
- Never call engine functions — they are pure data access

## Migration Conventions

Migrations live in `web/migrations/` and are applied in filename order:

| Convention | Example |
|---|---|
| Prefix with zero-padded sequence number | `0001_init.sql`, `0002_seed_kiawah.sql` |
| Use descriptive kebab-case suffix | `0005_nullable_commissioner_tournament.sql` |
| One logical change per migration file | Don't mix schema changes with seed data |
| Seed data in separate migrations | `0004_seed_demo_tournament.sql` |

### Apply commands

```bash
# Local development
wrangler d1 migrations apply DB --local

# Preview environment
wrangler d1 migrations apply DB --remote --env preview

# Production environment
wrangler d1 migrations apply DB --remote --env production
```

Or use the npm script: `npm run migrations:apply` (local), `npm run migrations:apply:preview`, `npm run migrations:apply:production`.

## SQLite Constraints

D1 is SQLite. Respect these constraints:

- **Single writer** — No concurrent write transactions. Keep write operations short.
- **No ALTER COLUMN** — SQLite doesn't support modifying existing columns. To change a column, create a new table, copy data, drop old, rename.
- **No native ENUM** — Use CHECK constraints or TEXT with application-level validation.
- **INTEGER PRIMARY KEY** is the rowid alias — use it for auto-increment IDs.
- **DATETIME** — Store as ISO 8601 TEXT strings. Use `datetime('now')` for server timestamps.

## Idempotency Pattern

Offline score entry uses idempotency keys scoped per match:

```sql
-- Check before insert
SELECT 1 FROM processed_ops WHERE op_id = ? AND match_id = ?;

-- Record after processing
INSERT INTO processed_ops (op_id, match_id) VALUES (?, ?);
```

The `(op_id, match_id)` unique index prevents cross-match key collisions.
