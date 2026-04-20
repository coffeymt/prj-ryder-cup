# Tears Tourneys — Design System

Visual identity and component guidelines for the Tears Tourneys ⛳ SvelteKit web app. All tokens are defined in `web/src/app.css`; Tailwind extensions in `web/tailwind.config.ts`.

## 1. Tokens & Theming

All colors must be referenced via semantic Tailwind classes (e.g., `bg-surface`, `text-text-primary`). Do not use hardcoded hex values or Tailwind's default color palette (like `bg-gray-100`) directly in components. Hex values are only permitted inside `web/src/app.css`.

### Typography

The app uses **Inter** (400/500/600/700/800) loaded via Google Fonts CDN in `web/src/app.html`. Fallback stack: `system-ui, -apple-system, sans-serif`.

| Token            | Value                                         | Usage           |
| ---------------- | --------------------------------------------- | --------------- |
| `--font-display` | `'Inter', system-ui, -apple-system, sans-serif` | Headings (h1–h6) |
| `--font-body`    | `'Inter', system-ui, -apple-system, sans-serif` | Body text       |

Display-weight headings use 700/800 with tighter tracking. Body applies `-webkit-font-smoothing: antialiased` and `text-rendering: optimizeLegibility`.

Font-size and line-height tokens (`--text-xs` through `--text-4xl`, `--leading-tight`, `--leading-normal`) are unchanged.

### Accent Colors

The accent palette is an emerald family derived from `#059669`.

| Token                  | Light            | Dark                          | Tailwind class   |
| ---------------------- | ---------------- | ----------------------------- | ---------------- |
| `--color-accent`       | `#059669`        | `#34d399`                     | `bg-accent`      |
| `--color-accent-hover` | `#047857`        | `#059669`                     | `bg-accent-hover`|
| `--color-accent-text`  | `#ffffff`        | `#ffffff`                     | `text-accent-text`|
| `--color-accent-soft`  | `#ecfdf5`        | `rgba(52, 211, 153, 0.1)`    | `bg-accent-soft` |
| `--color-accent-ring`  | `#34d399`        | `#6ee7b7`                     | `ring-accent-ring`|

- **`accent-soft`** — tinted background for accent-on-surface treatments (e.g., active stroke dots, selected states).
- **`accent-ring`** — focus ring color for interactive elements.

### Surface & Glass

| Token                      | Light                       | Dark                          | Tailwind class       |
| -------------------------- | --------------------------- | ----------------------------- | -------------------- |
| `--color-surface-glass`    | `rgba(255, 255, 255, 0.8)` | `rgba(17, 24, 39, 0.85)`     | `bg-surface-glass`   |
| `--color-bg-gradient-start`| `#f0fdf4`                   | `#0f172a`                     | — (use via CSS var)  |
| `--color-bg-gradient-end`  | `#ffffff`                   | `#111827`                     | — (use via CSS var)  |

See [Glass Surfaces](#5-glass-surfaces) for usage guidelines.

### Shadows

A four-tier shadow system provides visual depth hierarchy. Dark mode uses deeper, more opaque values.

| Token         | Tailwind class | Light value | Dark value |
| ------------- | -------------- | ----------- | ---------- |
| `--shadow-sm` | `shadow-sm`    | `0 1px 2px 0 rgba(15,23,42,0.08)` | `0 2px 6px 0 rgba(0,0,0,0.4)` |
| `--shadow-md` | `shadow-md`    | `0 6px 12px -2px …, 0 2px 4px -2px …` | `0 10px 18px -4px …, 0 4px 8px -4px …` |
| `--shadow-lg` | `shadow-lg`    | `0 14px 28px -8px …, 0 6px 10px -6px …` | `0 20px 32px -8px …, 0 8px 14px -8px …` |
| `--shadow-xl` | `shadow-xl`    | `0 24px 48px -12px …, 0 10px 20px -10px …` | `0 32px 56px -14px …, 0 14px 24px -12px …` |

See [Shadow Hierarchy](#6-shadow-hierarchy) for component-to-shadow mapping.

### Motion

| Token             | Value                        | Tailwind utility       |
| ----------------- | ---------------------------- | ---------------------- |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | `ease-standard`        |
| `--duration-fast` | `150ms`                      | `duration-fast`        |
| `--duration-base` | `200ms`                      | `duration-base`        |
| `--duration-slow` | `300ms`                      | `duration-slow`        |

See [Motion](#4-motion) for keyframes and reduced-motion rules.

### CSS Base Layer

`@layer base` in `app.css` resets anchor tags globally:

```css
a { color: inherit; text-decoration: none; }
```

This prevents browser defaults (purple/blue underlined links) from overriding Tailwind utility classes on `<a>` elements. All link appearance must be applied explicitly via Tailwind.

### Dark Mode

Dark mode is implemented via CSS variables. The system automatically respects `prefers-color-scheme: dark`.
To force dark mode on a specific page (like the public ticker), add `data-theme="dark"` to the `<body>` or a wrapper element. Both `[data-theme='dark']` and the `prefers-color-scheme` media query must be updated symmetrically.

### Team Color Accents

Team colors are dynamic and set per-tournament. They are exposed as `--color-team-a` and `--color-team-b`.
In Tailwind, use `bg-team-a`, `text-team-b`, `border-team-a`, etc.
When setting the colors dynamically in Svelte based on data, apply them as inline styles on a wrapper:

```svelte
<div style="--color-team-a: {teamA.color}; --color-team-b: {teamB.color};">
  <!-- Components inside can use bg-team-a -->
</div>
```

## 2. Component Patterns

### Buttons

- **Primary:** `bg-accent text-accent-text hover:bg-accent-hover min-h-touch rounded-xl px-4 font-semibold shadow-md`
- **Secondary (Outlined):** `border border-border bg-transparent text-text-primary hover:bg-surface-raised min-h-touch rounded-xl px-4 font-semibold`
- **Danger:** `bg-status-down text-white hover:opacity-90 min-h-touch rounded-xl px-4 font-semibold`
- **Destructive Confirm:** Use danger styling with explicit confirmation text.

Primary CTAs use `shadow-md` for visual weight. All buttons use `rounded-xl` for a softer, premium feel.

### Cards

Cards use a shadow-based depth hierarchy. See [Shadow Hierarchy](#6-shadow-hierarchy) for the full mapping.

- **Surface Card:** `bg-surface border border-border rounded-2xl p-card-padding shadow-sm`
- **Raised Card:** `bg-surface-raised border border-border rounded-xl p-card-padding shadow-md`
- **Featured / Hero Card:** `bg-surface border border-border rounded-2xl p-card-padding shadow-lg`
- **Status Card:** Use a left border to indicate status: `border-l-4 border-l-status-up bg-surface ...`
- Cards support hover lift: `transition hover:shadow-md hover:-translate-y-0.5` (when contextually appropriate, e.g., in-progress match cards).

### Badges / Pills

- **Status Badge (UP/DN/AS/T):** `rounded-full px-2.5 py-1 text-xs font-semibold`
  - UP: `bg-status-up/10 text-status-up`
  - DN: `bg-status-down/10 text-status-down`
  - AS: `bg-status-halved/10 text-status-halved`
  - Closed: `bg-status-closed/10 text-status-closed`
  - Do **not** add a `border` to status pills — the opacity background alone provides the contrast; a border creates a visual clash.
- **Team Badge:** `flex items-center gap-2 rounded-full border border-border bg-surface px-2 py-1` with a colored dot `<span class="h-2.5 w-2.5 rounded-full bg-team-a"></span>`
- **Online/Offline Pill:** Online state renders as a small unobtrusive dot; offline state shows a full pill with `animate-pulse-soft` to signal attention. Both keep `role="status"`, `aria-live="polite"`.

### Steppers

- **Score Stepper:** Must have a minimum touch target of 56px. Use `min-h-stepper min-w-stepper`.
- **Layout:** Flex row with `−` button, score display, `+` button.
- **Classes:** `flex items-center justify-between rounded-xl border border-border bg-surface p-1`
- **Tactile feedback:** Buttons use `active:scale-95 transition-transform duration-fast`. The center display uses `transition-colors duration-base` for smooth color transitions when the value crosses par.
- **Null state:** `value` prop accepts `number | null`. When `null`, the display renders `–` (en-dash) with `text-text-muted`; pressing either `+` or `−` jumps to `par`. Submission is blocked while value remains `null`.

### Navigation Pills

Used in the player layout header for contextual section navigation. Shape uses `rounded-full` to distinguish from action buttons (`rounded-xl`).

- **Active:** `bg-accent text-accent-text hover:bg-accent-hover hover:shadow-md rounded-full`
- **Inactive:** `border border-border bg-surface-raised text-text-primary hover:bg-surface hover:shadow-md rounded-full`
- **Accessibility:** Apply `aria-current="page"` to the active item.
- **Conditional visibility:** The "My Matches" link renders only when the player is on a `/live` or `/matches` sub-path. The "Live Scores" link is always visible.

### Progress Bars

- **Team Totals:** A continuous bar representing the points needed to win.
- **Implementation:**

```html
<div class="h-3 w-full overflow-hidden rounded-full bg-surface-raised shadow-inner">
  <div
    class="bg-team-a h-full rounded-full transition-all duration-slow ease-standard shadow-[0_0_12px_var(--color-team-a)]"
    style="width: 45%;"
    aria-hidden="true"
  ></div>
</div>
```

The fill bar uses `shadow-[0_0_12px_var(--color-team-a)]` to emit a team-colored glow — applied directly on the fill, not the track.

### Match State Display

- Always pair color with text (e.g., green text with "2 UP", red text with "1 DN").
- **Notation:** `X UP`, `X DN`, `AS` (All Square), `DORMIE`, `W&R` (e.g., `4&3`).

### Form Inputs

- **Group:** `space-y-2`
- **Label:** `text-sm font-medium text-text-primary`
- **Input:** `min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-text-primary focus:border-accent focus:ring-1 focus:ring-accent`
- **Error State:** `border-status-down focus:border-status-down focus:ring-status-down`
- **Disabled State:** `opacity-50 cursor-not-allowed bg-surface`

### Tables

- **Mobile:** Render as stacked cards (`flex flex-col gap-3`).
- **Desktop:** Render as a standard `<table>` with `border-b border-border` on rows. Use responsive classes (`hidden md:table`, `md:hidden`) to toggle.

## 3. Branding

- **App name:** **Tears Tourneys ⛳** — used in all user-facing copy: email subjects, email bodies, page `<title>` tags, and headings.
- **Favicon:** Golf-themed SVG at `web/src/lib/assets/favicon.svg`. Uses emerald (`#059669`) as the primary fill. Hex is acceptable in the SVG since it is a static asset, not a Svelte component.
- **Web font:** Inter loaded via `<link rel="preconnect">` + `<link rel="stylesheet">` in `web/src/app.html`. Uses `font-display: swap` to avoid blocking first paint.

### Navigation Home Links

Both global layouts provide a clear path back to `/`:

| Layout | Pattern |
|---|---|
| `routes/manage/+layout.svelte` | "Tears Tourneys ⛳" text link in the top-left header |
| `routes/t/[code]/+layout.svelte` | Labelled "Home" button (home icon + text) in the top-left header |

## 4. Motion

All motion uses the shared duration and easing tokens defined in `:root`.

### Keyframes

| Animation           | Tailwind utility        | Duration            | Use case                                  |
| ------------------- | ----------------------- | ------------------- | ----------------------------------------- |
| `fade-in`           | `animate-fade-in`       | `--duration-slow`   | Page enter, section reveal                |
| `slide-up-fade`     | `animate-slide-up-fade` | `--duration-slow`   | Hero content, modal dialog entry          |
| `pulse-soft`        | `animate-pulse-soft`    | 2s (infinite)       | Sync indicators, offline pill, live badge |
| `shimmer`           | `animate-shimmer`       | 1.5s (infinite)     | Loading skeleton placeholders             |

### Transition Utilities

For hover/state transitions on individual properties, combine Tailwind utilities:

```html
<!-- Hover lift on a card -->
<div class="transition hover:shadow-md hover:-translate-y-0.5 duration-base ease-standard">

<!-- Tactile press on a button -->
<button class="active:scale-95 transition-transform duration-fast">

<!-- Smooth color change -->
<span class="transition-colors duration-base">
```

### Reduced Motion

All animations are guarded by a global `prefers-reduced-motion: reduce` rule in `app.css` that collapses `animation-duration` and `transition-duration` to `0.01ms`. No per-component opt-out is needed — the guard is automatic.

## 5. Glass Surfaces

Glass surfaces use a semi-transparent background with a backdrop blur to let underlying content show through.

### Token

`--color-surface-glass` provides the semi-transparent fill — white at 80% opacity in light mode, dark gray at 85% opacity in dark mode.

### Pattern

```html
<header class="sticky top-0 z-30 bg-surface-glass backdrop-blur-md border-b border-border">
  <!-- header content -->
</header>
```

### When to Use

| Context                              | Apply glass? |
| ------------------------------------ | ------------ |
| Sticky player layout header          | Yes          |
| Sticky match status header           | Yes          |
| Broadcast ticker / hero score card   | Yes          |
| Modal overlay backdrop               | No — use `animate-fade-in` on a solid backdrop |
| General page sections                | No           |

Glass is reserved for sticky/floating chrome that overlaps scrolling content. Do not apply it to static page sections.

## 6. Shadow Hierarchy

Shadows encode the importance and interactivity of a surface.

| Level       | Token       | Tailwind   | Component role                                |
| ----------- | ----------- | ---------- | --------------------------------------------- |
| Flat        | (none)      | —          | Disabled cards, not-started matches            |
| Routine     | `--shadow-sm` | `shadow-sm` | Default surface cards, closed/static items    |
| Raised      | `--shadow-md` | `shadow-md` | Active cards, hover state, primary buttons, sidebar |
| Featured    | `--shadow-lg` | `shadow-lg` | Hero/featured round cards, broadcast ticker sections |
| Modal       | `--shadow-xl` | `shadow-xl` | Modals, dialogs, popovers                     |

### Guidelines

- Use **one level** per component at rest — do not stack shadows.
- Hover states may promote one level (e.g., `shadow-sm` → `shadow-md` on hover).
- Dark mode shadows are automatically deeper via the CSS variable overrides; no per-component adjustment is needed.
- Match cards use status-driven elevation: in-progress = raised (`shadow-md` + hover lift), closed = routine (`shadow-sm`), not-started = flat (no shadow, reduced opacity).
