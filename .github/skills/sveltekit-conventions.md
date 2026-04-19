---
applyTo: '**/*.svelte,**/*.ts,**/+page.server.ts,**/+layout.server.ts,**/+server.ts,**/+page.ts'
---

# SvelteKit & Svelte 5 Conventions

Rules for writing SvelteKit code in this project. All agents that read or write `.svelte` or route files must follow these.

## Svelte 5 Runes (Mandatory)

Use Svelte 5 runes exclusively. Legacy syntax is forbidden.

| Use | Do NOT use |
|---|---|
| `$state()` | `let x = ...` (reactive) |
| `$derived()` | `$: x = ...` |
| `$effect()` | `$: { ... }` (side effects) |
| `$props()` | `export let prop` |
| `$bindable()` | `export let prop` (two-way) |

## Server / Client Boundary

| Rule | Why |
|---|---|
| Server-only code in `+page.server.ts`, `+layout.server.ts`, `+server.ts` | D1, secrets, auth are server-only |
| Never import `$lib/db/` from `+page.svelte` or any client module | D1 binding is only available in Pages Functions |
| Never import `$lib/auth/` from client code | Cookie signing keys are server-side secrets |
| Use `+page.ts` (universal load) only when data needs no server context | Runs on both client and server |

## Engine / DB Boundary

The scoring engine (`src/lib/engine/`) is **pure computation** with zero I/O:

- `src/lib/engine/` must NEVER import from `src/lib/db/`, `$app/`, `platform.env`, or `fetch`
- Route handlers pass raw data into engine functions and write results back to D1
- Engine functions receive data as arguments and return computed results — no side effects

This boundary enables unit testing without mocking D1 or network calls.

## Routing Patterns

| Route | Role | Purpose |
|---|---|---|
| `/manage/**` | Commissioner | Tournament setup, player management, round config |
| `/t/[code]/**` | Player / Spectator | Tournament views, scoring, leaderboard |
| `/join/**` | Anonymous → Player | Join flow, player selection |
| `/api/**` | All (gated) | REST endpoints (Pages Functions) |

## Auth Pattern

Every protected route must call `requireRole()` in `+page.server.ts` or `+server.ts`:

```typescript
// +page.server.ts
export const load: PageServerLoad = async (event) => {
  const { commissioner } = requireRole(event, 'commissioner');
  // ... use commissioner context
};
```

Auth state comes from `event.locals` (set by `hooks.server.ts`), never from client-side state.

## D1 Access

- Always use `platform.env.DB` from server load functions and API routes
- Always use prepared statements with `.bind()` — never string interpolation
- One repository file per entity in `src/lib/db/` (e.g., `matches.ts`, `players.ts`)
- Return plain objects from db functions — no D1-specific types in return signatures

## Styling

- Use semantic Tailwind classes (`bg-surface`, `text-accent`) — never raw palette (`bg-green-500`)
- Reference `assets/DESIGN_SYSTEM.md` for the full token list and component patterns
- Hex values are only permitted in `web/src/app.css` token definitions
