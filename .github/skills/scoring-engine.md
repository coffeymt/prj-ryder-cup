---
applyTo: 'web/src/lib/engine/**/*.ts'
---

# Scoring Engine Rules

The scoring engine at `src/lib/engine/` is the core domain logic for Ryder Cup-style golf scoring. It is **pure computation** — zero I/O, zero side effects.

## Purity Constraint (Non-Negotiable)

The engine layer must NEVER import:
- `$lib/db/` or any database module
- `$app/` or any SvelteKit module
- `platform.env` or any environment binding
- `fetch`, `XMLHttpRequest`, or any network API
- `Dexie`, `IndexedDB`, or any storage API

Engine functions receive data as plain TypeScript arguments and return computed results. Route handlers are responsible for reading from D1, calling engine functions, and writing results back.

## Architecture

```
src/lib/engine/
├── types.ts            # Shared type definitions for engine
├── matchState.ts       # Match status computation (UP/DN/AS/dormie/closed)
├── pointTally.ts       # Point aggregation across matches
├── courseHandicap.ts    # Course handicap calculations
├── strokeAllocation.ts # Stroke distribution per hole
├── allowances.ts       # Handicap allowance by format
├── splitFormat.ts      # Split-format match handling
└── formats/            # Per-format scoring engines
    ├── fourBall.ts
    ├── singles.ts
    ├── scramble.ts
    ├── pinehurst.ts
    └── shamble.ts
```

## Key Concepts

| Concept | Description |
|---|---|
| **Match state** | `UP X`, `DN X`, `AS` (All Square), `DORMIE`, closed with result (e.g., `4&3`) |
| **Point tally** | Aggregates match results into team totals. Win = 1pt, halve = 0.5pt |
| **Course handicap** | Converts player handicap index to a course-specific handicap |
| **Stroke allocation** | Distributes handicap strokes to specific holes based on hole SI (stroke index) |
| **Format allowance** | Adjusts handicap percentage by match format (e.g., singles = 100%, fourball = 90%) |

## Testing

Every engine module has a co-located `.spec.ts` file. Engine tests:
- Run with Vitest (`npm run test` from `web/`)
- Use no mocks (pure functions need no mocking)
- Cover edge cases: all-square after 18, dormie scenarios, halved matches, concessions
- Verify format-specific rules (e.g., fourball best-ball selection, scramble team score)

When modifying engine logic, always update the corresponding `.spec.ts` file and run `npm run test`.

## CRITICAL Change Gate

Any change to scoring engine logic is **CRITICAL** and requires:
1. Explicit user approval before implementation
2. Full downstream impact analysis (which routes, which formats, which UI components consume the changed function)
3. Comprehensive test updates covering the change
