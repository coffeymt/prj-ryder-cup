---
applyTo: '**/*.svelte,web/src/app.css,web/tailwind.config.ts'
---

# Design Token Rules

Rules for applying the visual design system. The canonical token reference is `assets/DESIGN_SYSTEM.md` — read it before any UI work.

## Mandatory: Semantic Classes Only

| Rule | Example |
|---|---|
| Use semantic Tailwind classes | `bg-surface`, `text-accent`, `border-border` |
| Never use raw Tailwind palette | ~~`bg-green-500`~~, ~~`text-gray-700`~~ |
| Hex values only in `app.css` | Token definitions, not components |
| Never use inline `style` for colors | Exception: dynamic team colors (`--color-team-a`, `--color-team-b`) |

## Mobile-First

- **Min touch target**: 44px (`min-h-touch` for interactive elements, `min-h-stepper`/`min-w-stepper` for score steppers)
- **Design for one-handed phone use** — primary actions reachable by thumb
- **High contrast** — assume bright outdoor sunlight conditions
- Responsive breakpoints: mobile-first, then `md:` for tablet, `lg:` for desktop

## Component Class Patterns

Quick reference for common components. Full specs in `assets/DESIGN_SYSTEM.md`.

| Component | Key classes |
|---|---|
| Primary button | `bg-accent text-accent-text hover:bg-accent-hover min-h-touch rounded-xl px-4 font-semibold shadow-md` |
| Surface card | `bg-surface border border-border rounded-2xl p-card-padding shadow-sm` |
| Glass header | `sticky top-0 z-30 bg-surface-glass backdrop-blur-md border-b border-border` |
| Score stepper | `flex items-center justify-between rounded-xl border border-border bg-surface p-1` with `min-h-stepper min-w-stepper` buttons |
| Status badge | `rounded-full px-2.5 py-1 text-xs font-semibold` with status-specific colors |
| Form input | `min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-text-primary focus:border-accent focus:ring-1 focus:ring-accent` |

## Shadow Hierarchy

| Level | Token | Usage |
|---|---|---|
| Flat | none | Disabled/not-started items |
| Routine | `shadow-sm` | Default surface cards, static items |
| Raised | `shadow-md` | Active cards, hover state, primary buttons |
| Featured | `shadow-lg` | Hero cards, broadcast ticker |
| Modal | `shadow-xl` | Modals, dialogs, popovers |

Hover states may promote one level. Never stack shadows.

## Dark Mode

- Dark mode uses `prefers-color-scheme: dark` automatically via CSS variables
- Force dark on specific sections with `data-theme="dark"` on a wrapper element
- All tokens have light/dark variants — no manual dark-mode overrides needed in components

## Motion

- Use shared duration tokens: `duration-fast` (150ms), `duration-base` (200ms), `duration-slow` (300ms)
- Use `ease-standard` for all transitions
- Hover lift: `transition hover:shadow-md hover:-translate-y-0.5 duration-base ease-standard`
- Tactile press: `active:scale-95 transition-transform duration-fast`
- All animations respect `prefers-reduced-motion: reduce` globally — no per-component opt-out needed

## Team Colors

Team colors are dynamic per-tournament, set via CSS variables:

```svelte
<div style="--color-team-a: {teamA.color}; --color-team-b: {teamB.color};">
  <!-- Use bg-team-a, text-team-b, border-team-a inside -->
</div>
```

This is the one case where inline `style` for colors is acceptable.
