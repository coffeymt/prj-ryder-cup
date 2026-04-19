# Tasks: Holistic Visual Design Overhaul

Plan directory: `plan/design-overhaul/`
PRD: `plan/design-overhaul/prd.md`

Task lifecycle: implementation agents flip `- [ ]` → `- [x]` on completion. The orchestrator uses unchecked items to track progress.

Universal requirements for every Coder/Designer delegation in this plan:

- Reference `.github/skills/plan-management.md` for task tracking conventions.
- Read target files in full before editing. Preserve all props, events, bindings, imports (except explicitly added ones for transitions), ARIA attributes, `role=`, `aria-pressed`, `aria-live`, `aria-current`, `aria-modal`, `tabindex`, `min-h-touch`, `min-h-stepper`.
- Do NOT hardcode hex colors inside components (only inside `web/src/app.css`). Use semantic Tailwind tokens (`bg-accent`, `text-text-primary`, etc.).
- Do NOT add npm dependencies. Web font is the only allowed external asset, loaded via CDN `<link>` in `web/src/app.html`.
- Do NOT change routing, load functions, service worker, outbox logic, or any business behavior.
- After your tasks, mark them as done in `plan/design-overhaul/tasks.md` (`- [ ]` → `- [x]`).
- After your final task, run `npm --prefix web run check && npm --prefix web run lint && npm --prefix web run format:check && npm --prefix web run build`. Fix any failures you introduced.
- All motion must be guarded by `@media (prefers-reduced-motion: reduce)`.
- Mobile-first: verify at 360px first, then scale up.

---

## Phase 0 — Branch setup

- [ ] **Task 0.1** — Create and check out a new git branch `feature/design-overhaul` from `main` before any code change. → Coder | Files: N/A (git)
  - Depends on: none
  - Acceptance: `git status` shows clean on new branch `feature/design-overhaul`; no files modified yet.

---

## Phase 1 — Foundation (tokens, config, shell, branding)

All four tasks are parallel (distinct files). Phase 2+ cannot start until the whole phase lands, because every downstream consumer depends on the new tokens/classes.

- [x] **Task 1.1** — Rewrite design tokens, add shadow system, add motion keyframes, preserve all existing tokens, add richer dark mode. → Coder | Files: `web/src/app.css`
  - Depends on: Task 0.1
  - Must preserve every existing CSS custom property name (values may update). Add new tokens; never remove.
  - Add:
    - Emerald-family accent: `--color-accent`, `--color-accent-hover`, `--color-accent-text` (light + dark blocks).
    - New tokens: `--color-accent-soft` (tinted background for accent-on-surface), `--color-accent-ring` (focus ring).
    - Shadow tokens: `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-xl` (subtler tint in light, deeper in dark).
    - Glass tokens: `--color-surface-glass` (semi-transparent surface for sticky headers), `--color-bg-gradient-start`, `--color-bg-gradient-end` (for optional landing flourish).
    - Motion tokens: `--ease-standard: cubic-bezier(0.2, 0, 0, 1)`, `--duration-fast: 150ms`, `--duration-base: 200ms`, `--duration-slow: 300ms`.
    - `--font-display` and `--font-body` updated to `'Inter', system-ui, -apple-system, sans-serif` (with distinct weights applied via utilities — do not add a separate display family unless the PRD is amended).
    - Keyframes: `@keyframes fade-in`, `@keyframes slide-up-fade`, `@keyframes pulse-soft`, `@keyframes shimmer` (for loading states, no functional change).
    - `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; } }`.
  - Update the `body` selector to apply subtle base font smoothing (`-webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;`).
  - Acceptance: `npm --prefix web run build` succeeds; opening any page shows Inter rendering; no CSS variable removed.

- [x] **Task 1.2** — Extend Tailwind theme with new shadow tokens, animation utilities, backdrop-blur scale, transition durations. → Coder | Files: `web/tailwind.config.ts`
  - Depends on: Task 0.1 (can run in parallel with Task 1.1)
  - Extend (additive only):
    - `boxShadow`: `sm`, `md`, `lg`, `xl` mapped to the CSS variables introduced in Task 1.1.
    - `colors`: `'accent-soft': 'var(--color-accent-soft)'`, `'surface-glass': 'var(--color-surface-glass)'`.
    - `transitionDuration`: `fast`, `base`, `slow` mapped to `--duration-*`.
    - `transitionTimingFunction`: `standard` → `var(--ease-standard)`.
    - `keyframes` and `animation`: `fade-in`, `slide-up-fade`, `pulse-soft`, `shimmer`.
    - `backdropBlur`: keep defaults; add `xs: '2px'` if needed for subtle glass.
  - Do not rename or remove any existing `extend.*` entry.
  - Acceptance: `npm --prefix web run build` succeeds; `tailwindcss` emits the new utilities (e.g., `shadow-md`, `animate-fade-in`, `duration-base`).

- [x] **Task 1.3** — Add web font preconnect + stylesheet, keep existing meta tags, do not change `%sveltekit.head%` position. → Coder | Files: `web/src/app.html`
  - Depends on: Task 0.1 (parallel with 1.1 / 1.2)
  - Add (before `%sveltekit.head%`):
    ```html
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
      rel="stylesheet"
    />
    ```
  - Do NOT remove `<meta name="theme-color">`, manifest link, or Apple touch icon.
  - Consider updating `<meta name="theme-color">` to match the new accent-derived brand color once Task 1.1 lands (planner default: `#0f172a` in dark, unchanged if unsure — optional).
  - Acceptance: network panel in dev shows Google Fonts CSS loading with `font-display: swap`; `Inter` applied to body after hydration.

- [x] **Task 1.4** — Replace default Svelte favicon with a golf-themed SVG. → Designer | Files: `web/src/lib/assets/favicon.svg`
  - Depends on: Task 0.1 (parallel with 1.1 / 1.2 / 1.3)
  - Produce a clean monochrome or duotone SVG (flag-on-green motif, golf ball on tee motif, or a stylized "K") at a 24×24 or 32×32 viewBox. Should legibly render at 16×16.
  - Keep filename `favicon.svg`; the root layout imports it as a module — do not change the import path.
  - Use accent green as primary fill referencing either the hex `#059669` family directly (SVG is a static asset, not a Svelte component, so hex is appropriate here) or make it two-tone with neutral.
  - Acceptance: open the root route; the browser tab icon is the new mark, not the Svelte logo.

**Phase 1 exit gate:** `npm --prefix web run check && npm --prefix web run lint && npm --prefix web run format:check && npm --prefix web run build` all green. No downstream file changed yet.

---

## Phase 2 — Shared UI components (parallel with Phase 3 + Phase 6)

All 8 tasks run in parallel; each targets a distinct file. Every task must:

- Keep exports (`export let ...`), event handlers, reactive declarations (`$: ...`), and markup structure (tags, ARIA) intact.
- Only change class strings, add animation classes, add wrapper `<span>`/`<div>` when needed for visual layering (do not change the component's public surface).
- Apply new shadow tokens per role (flat = `shadow-sm`, elevated card = `shadow-md`, featured hero = `shadow-lg`, modal/overlay = `shadow-xl`).

- [x] **Task 2.1** — Refresh `MatchCard` with status-driven elevation, subtle hover lift, richer team rows, refined status chip. → Coder | Files: `web/src/lib/ui/MatchCard.svelte`
  - Depends on: Phase 1 complete
  - Behavior: add `transition` + `hover:shadow-md hover:-translate-y-0.5` on the `<article>` when `match.status !== 'notStarted'`. Keep conditional opacity for `notStarted`. Add a left accent stripe tied to `--team-color` for the leading side when `inProgress`. Keep the existing 1920px and `sm:` responsive rules.
  - Acceptance: Cards visually differ by status (in-progress lifted, closed flat, not-started dimmed). No prop or type change to `MatchCardData`.

- [x] **Task 2.2** — Redesign `TickerHeader` as a broadcast scoreboard: larger team-name/score typography, stronger team-color contrast, refined progress bars, subtle pulse on live indicator area. → Coder | Files: `web/src/lib/ui/TickerHeader.svelte`
  - Depends on: Phase 1 complete
  - Behavior: expand score typography (already 2xl → 4xl → 7xl at 1920px; add mid-breakpoint treatment). Use `bg-gradient-to-r` from team-a to team-b for a thin divider strip under the title (opacity-30). Keep all existing exports.
  - Acceptance: Looks dramatically more "broadcast" on the live ticker page; identical props.

- [x] **Task 2.3** — Premium tactile stepper: larger +/− buttons, active-state press animation, animated color transition on the center display when value crosses par. → Coder | Files: `web/src/lib/ui/HoleStepper.svelte`
  - Depends on: Phase 1 complete
  - Behavior: add `active:scale-95 transition-transform duration-fast` on the buttons; add `transition-colors duration-base` on the center display. Keep min-h/min-w-stepper. Keep `relationClass` reactive.
  - Acceptance: Touch-press feels tactile; number color smoothly transitions when crossing par; `onChange`, `value`, `min`, `max`, `par` props unchanged.

- [x] **Task 2.4** — Glass-effect sticky header: semi-transparent surface + `backdrop-blur-md` + subtle border tint. → Coder | Files: `web/src/lib/ui/MatchStatusHeader.svelte`
  - Depends on: Phase 1 complete
  - Behavior: replace `bg-surface` with `bg-surface-glass` (from Task 1.1/1.2) and add `backdrop-blur-md`. Keep sticky positioning and `z-20`. Keep tone functions and ARIA implicit in role.
  - Acceptance: Scrolling the score entry page shows content blurring under the sticky header.

- [x] **Task 2.5** — Refined modal: backdrop fade-in, dialog slide-up, `shadow-xl`, keep focus trap and `aria-modal`. → Coder | Files: `web/src/lib/ui/FormatInterstitial.svelte`
  - Depends on: Phase 1 complete
  - Behavior: add `animate-fade-in` to the backdrop, `animate-slide-up-fade` to the dialog, upgrade `shadow-2xl` reference to the new `shadow-xl` token (or keep 2xl if Tailwind default is preferred — the token is the source of truth). Preserve `handleKeydown`, `focusContinue`, `continueButton` binding.
  - Acceptance: Modal enters smoothly; focus still lands on continue button; Esc/Tab behavior unchanged.

- [x] **Task 2.6** — Refine `StrokeDots` pill: tighter sizing, optional subtle background tint when strokes > 0. → Coder | Files: `web/src/lib/ui/StrokeDots.svelte`
  - Depends on: Phase 1 complete
  - Behavior: slightly reduced vertical padding; add conditional `bg-accent-soft text-text-primary` when `normalized > 0`, else keep current neutral treatment. Keep the full `aria-label`.
  - Acceptance: Visual distinction between 0 / 1 / 2 strokes is immediately clear.

- [x] **Task 2.7** — Subtler online/offline pill: reduced weight when online (it's the default), stronger treatment when offline (pulse). → Coder | Files: `web/src/lib/ui/OnlineOfflinePill.svelte`
  - Depends on: Phase 1 complete
  - Behavior: keep full pill when offline (with a subtle `animate-pulse-soft`), soften to a small dot + hidden-on-mobile label when online. Keep `role="status"`, `aria-live="polite"`, `aria-atomic="true"`.
  - Acceptance: Online state is unobtrusive; offline state clearly signals attention.

- [x] **Task 2.8** — Refine pending-sync badge with `animate-pulse-soft` on the count chip. → Coder | Files: `web/src/lib/ui/PendingSyncBadge.svelte`
  - Depends on: Phase 1 complete
  - Behavior: add the pulse to the inner count `<span>` (not the outer wrapper). Keep aria-label dynamic message.
  - Acceptance: A pending count is visually alive without being distracting.

**Phase 2 exit gate:** `npm --prefix web run check && npm --prefix web run build` pass. Visual QA at 360px on any page that renders the component.

---

## Phase 3 — Landing + auth pages (parallel with Phase 2 and Phase 6)

All 4 tasks run in parallel; distinct files.

- [x] **Task 3.1** — Landing redesign with brand-hero treatment. → Designer + Coder | Files: `web/src/routes/+page.svelte`
  - Depends on: Phase 1 complete
  - Behavior: introduce a hero section with the wordmark "Kiawah Golf", a tagline, and the two existing CTAs (primary + secondary, based on `data.primaryAction.type`). Add subtle radial/linear background flourish using `--color-bg-gradient-start/end` tokens. Add `animate-fade-in` + `animate-slide-up-fade` on the hero container. Keep all three conditional CTA branches, including the `/join` fallback and `/manage/login` secondary link. Preserve `data.primaryAction` type discrimination and href patterns.
  - Acceptance: Landing page reads as "brand page" not "centered card"; all three CTA branches still render the correct links.

- [x] **Task 3.2** — Polish `/join` to match landing aesthetic; larger code input, animated focus ring. → Coder | Files: `web/src/routes/join/+page.svelte`
  - Depends on: Phase 1 complete
  - Behavior: keep `handleCodeInput` normalizer, `form.codeError` / `data.queryError` paths, `maxlength="6"`, `autocapitalize="characters"`. Only update class strings and optionally wrap in a hero-like container. Add `animate-fade-in` to the section.
  - Acceptance: Error paths still render; code input still uppercases and strips; 6-char max still enforced.

- [x] **Task 3.3** — Polish `/manage/login`. → Coder | Files: `web/src/routes/manage/login/+page.svelte`
  - Depends on: Phase 1 complete
  - Behavior: only visual refresh. Keep `use:enhance={signInEnhance}`, the `isSubmitting` spinner, `displayedError` derivation, `invalidLinkMessage` check. Add subtle card entry animation.
  - Acceptance: Submitting sends magic link exactly as before; all three error sources still display.

- [x] **Task 3.4** — Polish `/manage/magic-link-sent`. → Coder | Files: `web/src/routes/manage/magic-link-sent/+page.svelte`
  - Depends on: Phase 1 complete
  - Behavior: visual polish, keep copy intent and existing links. Add `animate-fade-in`.
  - Acceptance: Page structure identical; visually consistent with login.

---

## Phase 4 — Player experience (depends on Phases 1 + 2)

All 4 tasks run in parallel; distinct files. Each consumes shared UI components updated in Phase 2.

- [x] **Task 4.1** — Glass sticky header on player layout; refined team chip; subtle page enter transition. → Coder | Files: `web/src/routes/t/[code]/+layout.svelte`
  - Depends on: Phase 1; Phase 2.7 (OnlineOfflinePill) and 2.8 (PendingSyncBadge)
  - Behavior: swap `bg-surface` on `<header>` for `bg-surface-glass backdrop-blur-md` and add `sticky top-0 z-30`. Keep the left-border-accent rule based on `data.team?.color`. Preserve `wrapperStyle`, `opponentTeam`, `teamAColor`, `teamBColor` reactive logic. Keep all interval logic, event listeners, and service-worker-adjacent sync hooks. Wrap `<main>` children with an `animate-fade-in` inner div so the page body fades on navigation.
  - Acceptance: Header visually persists on scroll with blur; team chip, spectator chip, `OnlineOfflinePill`, `PendingSyncBadge`, and `Live Scores` CTA all render; `outbox.refreshCount()` logic unchanged.

- [x] **Task 4.2** — Player dashboard depth hierarchy: featured round = `shadow-lg`, routine rounds = `shadow-md`, closed = flat. → Coder | Files: `web/src/routes/t/[code]/+page.svelte`
  - Depends on: Phase 1; Task 4.1 (layout) not blocking because files distinct but coordinate visually
  - Behavior: preserve all `$:` reactive derivations (`teamA`, `teamB`, `pointsToWin`, `leadingTeam`, `teamsAreTied`, `progressPercent`, `matchesForRound`, `roundStatusClasses`, `matchStateClasses`). Change only class strings and optional wrapping `<div>` elements. Apply stagger via `style="animation-delay: ..."` on enter for each round card (gated by reduced-motion).
  - Acceptance: Dashboard reads with visible depth hierarchy; every reactive derivation still fires; all CTA hrefs preserved.

- [x] **Task 4.3** — Match detail visual refresh. → Coder | Files: `web/src/routes/t/[code]/matches/[matchId]/+page.svelte`
  - Depends on: Phase 1
  - Behavior: keep `sideStyle`, `matchStateClasses` helpers. Upgrade cards with new shadow tokens, refined back-button styling, tighter mobile layout.
  - Acceptance: Layout stays functional; deeper visual polish.

- [x] **Task 4.4** — Immersive score-entry redesign. → Designer + Coder | Files: `web/src/routes/t/[code]/matches/[matchId]/hole/[n]/+page.svelte`
  - Depends on: Phase 1; Phase 2.3 (HoleStepper), 2.4 (MatchStatusHeader), 2.5 (FormatInterstitial), 2.6 (StrokeDots)
  - Behavior: remove the "cramped-in-a-card" feel. Break the hole/par/SI header out of the surface card into a larger display-typography treatment (hole number as display font, 4xl+, par/SI inline beneath). Each player becomes a "focus card" with stronger border-left accent in team color and `shadow-md`. Concede / Picked-Up buttons get tactile press animation. Keep every handler: `updateGross`, `toggleConceded`, `togglePickedUp`, `submitHoleScore`, `saveAndNext`. Preserve `rows` reactive initialization, `isSaving`, `errorMessage`, `showInterstitial`, `FormatInterstitial` mount, back/next grid, error toast. Preserve the exact `/api/matches/.../holes` call shape.
  - Acceptance: Score entry feels immersive and focused. Submitting scores still calls outbox with identical payload. Keyboard navigation still reaches every control.

---

## Phase 5 — Live ticker (depends on Phases 1 + 2)

- [x] **Task 5.1** — Broadcast-overlay treatment. → Designer + Coder | Files: `web/src/routes/t/[code]/live/+page.svelte`
  - Depends on: Phase 1; Phase 2.1 (MatchCard), 2.2 (TickerHeader)
  - Behavior: keep `data-theme="dark"` wrapper. Introduce a deeper background (radial gradient using `--color-bg-gradient-start/end` or just `bg-bg` with overlay layer). Elevate the team totals section. Make round section headers feel like broadcast chyrons (uppercase, slightly larger, team-color divider underneath). Keep every reactive derivation: `useLiveFeed`, `snapshot`, `teamsById`, `firstTeam`, `secondTeam`, `pointsToWin`, `teamA`, `teamB`, `teamAProgress`, `teamBProgress`, `secondsSinceUpdate`, `rounds`. Keep the fixed "Live updates connected" pill at bottom-right; upgrade its visual (glass + pulse on connecting state). Preserve all 1920px / 2xl / min-[1920px] rules.
  - Acceptance: On a large display, the ticker reads as a spectator scoreboard; live reconnection indicator still behaves. No reactivity or data wiring altered.

---

## Phase 6 — Manager portal (parallel with Phase 2 + Phase 3)

- [x] **Task 6.1** — Manage layout visual refresh: header polish, sidebar active-state refinement, new tournament CTA style. → Coder | Files: `web/src/routes/manage/+layout.svelte`
  - Depends on: Phase 1
  - Behavior: preserve `AUTH_ROUTE_IDS`, `isAuthRoute`, `buildNavigationLinks`, `handleLogout`, `mobileNavOpen`, `afterNavigate`, `TournamentSwitcher` mount points (both desktop and mobile). Only refresh classes. Active nav item gets `bg-accent text-accent-text shadow-md` + subtle `animate-pulse-soft` on the leading edge (optional). Sidebar becomes visually distinct from content via `shadow-md` when open on mobile.
  - Acceptance: Logout flow works exactly as before; mobile nav toggle still functional; `TournamentSwitcher` still renders in both slots; all ARIA attributes retained.

---

## Phase 7 — Documentation

- [x] **Task 7.1** — Update `DESIGN_SYSTEM.md` to reflect the new tokens, shadow system, motion rules, glass-header pattern, favicon, and web font. → Documenter | Files: `assets/DESIGN_SYSTEM.md`
  - Depends on: Phases 1–6 complete and reviewed
  - Reference `.github/skills/documentation-standards.md`.
  - Must:
    - Update the Tokens & Theming section with the new accent color family, shadow tokens, glass surface token, motion tokens, and Inter font family.
    - Update the Cards section to document the shadow hierarchy (flat / raised / featured / modal).
    - Add a new "Motion" subsection documenting the keyframes, durations, easing, and the reduced-motion guard.
    - Add a "Glass Surfaces" subsection documenting `bg-surface-glass backdrop-blur-md` usage on sticky headers and overlays.
    - Keep unchanged rules that still apply (no hardcoded hex in components, stepper sizing, progress bar pattern, etc.).
  - Acceptance: Reading the doc allows a new engineer to reproduce the new visual language without reading individual component files.

---

## Summary (phase → tasks)

| Phase | Tasks                               | Parallel? | Blocks                       |
| ----- | ----------------------------------- | --------- | ---------------------------- |
| 0     | 0.1                                 | —         | everything                   |
| 1     | 1.1, 1.2, 1.3, 1.4                  | Yes       | phases 2–6                   |
| 2     | 2.1–2.8                             | Yes       | phases 4, 5                  |
| 3     | 3.1, 3.2, 3.3, 3.4                  | Yes       | phase 7                      |
| 4     | 4.1, 4.2, 4.3, 4.4                  | Yes       | phase 7                      |
| 5     | 5.1                                 | —         | phase 7                      |
| 6     | 6.1                                 | —         | phase 7                      |
| 7     | 7.1                                 | —         | —                            |

Phases 2, 3, and 6 can execute concurrently after Phase 1. Phases 4 and 5 kick off once Phase 2 lands (they depend on shared UI updates). Phase 7 is last.
