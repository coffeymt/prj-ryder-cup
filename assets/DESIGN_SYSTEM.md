# Golf App — Design System

This document outlines the design patterns, tokens, and component guidelines for the Golf App.

## 1. Tokens & Theming

All colors must be referenced via semantic Tailwind classes (e.g., `bg-surface`, `text-text-primary`). Do not use hardcoded hex values or Tailwind's default color palette (like `bg-gray-100`) directly in components.

### Dark Mode
Dark mode is implemented via CSS variables. The system automatically respects `prefers-color-scheme: dark`. 
To force dark mode on a specific page (like the public ticker), add `data-theme="dark"` to the `<body>` or a wrapper element.

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
- **Primary:** `bg-accent text-accent-text hover:bg-accent-hover min-h-touch rounded-lg px-4 font-semibold`
- **Secondary (Outlined):** `border border-border bg-transparent text-text-primary hover:bg-surface-raised min-h-touch rounded-lg px-4 font-semibold`
- **Danger:** `bg-status-down text-white hover:opacity-90 min-h-touch rounded-lg px-4 font-semibold`
- **Destructive Confirm:** Use danger styling with explicit confirmation text.

### Cards
- **Surface Card:** `bg-surface border border-border rounded-2xl p-card-padding shadow-sm`
- **Raised Card:** `bg-surface-raised border border-border rounded-xl p-card-padding shadow-sm`
- **Status Card:** Use a left border to indicate status: `border-l-4 border-l-status-up bg-surface ...`

### Badges / Pills
- **Status Badge (UP/DN/AS/T):** `rounded-full px-2.5 py-1 text-xs font-semibold`
  - UP: `bg-status-up/10 text-status-up`
  - DN: `bg-status-down/10 text-status-down`
  - AS: `bg-status-halved/10 text-status-halved`
  - Closed: `bg-status-closed/10 text-status-closed`
- **Team Badge:** `flex items-center gap-2 rounded-full border border-border bg-surface px-2 py-1` with a colored dot `<span class="h-2.5 w-2.5 rounded-full bg-team-a"></span>`
- **Online/Offline Pill:** `rounded-full px-3 py-1 text-xs font-semibold` using `bg-online text-white` or `bg-offline text-white`.

### Steppers
- **Score Stepper:** Must have a minimum touch target of 56px. Use `min-h-stepper min-w-stepper`.
- **Layout:** Flex row with `-` button, score display, `+` button.
- **Classes:** `flex items-center justify-between rounded-xl border border-border bg-surface p-1`

### Progress Bars
- **Team Totals:** A continuous bar representing the points needed to win.
- **Implementation:** 
  ```html
  <div class="h-3 w-full overflow-hidden rounded-full bg-surface-raised">
    <div class="h-full bg-team-a transition-all" style="width: 45%;"></div>
  </div>
  ```

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
