# PRD: Holistic Visual Design Overhaul

> Mobile-first visual refresh of the Kiawah Golf SvelteKit web app. Zero functionality changes.

## 1. Problem Statement

The Kiawah Golf app (SvelteKit 2 + Svelte 5 + Tailwind 4, deployed on Cloudflare Pages) is functionally complete but visually generic. Today the app looks like a developer-default UI: `system-ui` typography, a stock blue accent (`#1d4ed8`), flat grayscale surfaces, identical `shadow-sm` on every card, the default Svelte favicon, and no animations. The landing page, manager portal, and live ticker all share the same flat treatment despite serving very different audiences (new users, commissioners, spectators, players on-course).

**Who experiences this:**

- **Players** entering scores on a phone mid-round — the score entry screen feels like "another form" rather than an immersive, tactile focus point.
- **Spectators** watching the live ticker — lacks broadcast drama; looks like a dashboard, not a scoreboard.
- **Commissioners** managing a tournament — functional but uninspiring; does not feel like a premium product.
- **First-time visitors** hitting `/` — no brand identity, no signal that this is a polished golf product.

**Why existing treatment fails:** No typography personality, no color identity tied to golf, no visual depth hierarchy, no motion, no differentiation between routine and showpiece screens. Modern 2025/2026 mobile web expectations (refined web fonts, subtle glass-morphism, depth through shadow systems, micro-animations) are unmet.

## 2. Goals & Success Metrics

### Primary goals

1. **Brand personality** — Establish a cohesive, golf-course-inspired visual identity (deep green/emerald accent, refined typography pairing, themed favicon) that reads as premium on first impression.
2. **Visual depth & hierarchy** — Replace uniform `shadow-sm` with a purposeful shadow system (`sm` / `md` / `lg` / `xl`) so important cards feel lifted and routine cards sit flat.
3. **Mobile-first polish** — Every screen must feel native-quality at 360px, then scale up cleanly.
4. **Screen-specific treatment** — The live ticker should feel like a broadcast overlay; score entry should feel immersive and tactile; landing should feel like a brand page.
5. **Motion** — Micro-animations (150–300ms eased transitions) on hovers, state changes, page enters, and sync indicators.

### Success criteria (how we know we're done)

- [ ] No occurrence of `system-ui` in `--font-display` / `--font-body`.
- [ ] Accent tokens in `--color-accent` are not `#1d4ed8`; use a sophisticated green/emerald family.
- [ ] At least 3 distinct shadow tokens used in practice across the app (routine vs. raised vs. featured).
- [ ] Favicon is not the default Svelte logo — it is a golf-themed SVG.
- [ ] App shell loads a web font with `font-display: swap` behind `<link rel="preconnect">`.
- [ ] At least one `backdrop-blur` + semi-transparent surface on a sticky header (player layout and/or match status header).
- [ ] Live ticker page renders with visibly darker, more dramatic treatment (distinct from in-app dark mode) with larger team score typography and team-color prominence.
- [ ] Score entry (`/t/[code]/matches/[matchId]/hole/[n]`) has a full-bleed/immersive layout (no cramped card) and a redesigned premium stepper.
- [ ] All ARIA attributes, `role=` attributes, `aria-live`, `aria-pressed`, and `aria-current` references preserved or expanded — never removed.
- [ ] All existing CSS custom properties still resolve (no component references a removed variable).
- [ ] No new npm dependencies added. Web font loaded via CDN `<link>` only.
- [ ] `npm run check` (SvelteKit sync + `svelte-check`) passes; `npm run lint` and `npm run format:check` pass.
- [ ] `npm run build` succeeds.
- [ ] Lighthouse mobile performance on `/` does not regress by more than 5 points vs. baseline (web font is swap + preconnected).

### Non-goals

- No changes to routing, data flow, endpoints, load functions, service worker behavior, outbox logic, or any business logic.
- No new UI components or pages.
- No redesign of information architecture.
- No Svelte 5 runes migration (file-by-file syntax is preserved).
- No new npm packages.

## 3. Capability Tree

```
Design Overhaul
├── Foundation (design tokens)
│   ├── Typography
│   │   ├── inputs: web font family (display + body)
│   │   ├── outputs: --font-display, --font-body, font-size scale, leading scale
│   │   └── behavior: Inter (or similar) via preconnect + stylesheet link, font-display: swap
│   ├── Color palette
│   │   ├── inputs: golf-course-inspired hues
│   │   ├── outputs: --color-accent (+ hover/text), refined neutrals, richer dark mode
│   │   └── behavior: preserve status, team, preset tokens unchanged
│   ├── Shadow system
│   │   ├── inputs: elevation levels (flat, sm, md, lg, xl)
│   │   ├── outputs: shadow tokens + Tailwind extension
│   │   └── behavior: dark mode gets adjusted shadow tints
│   ├── Motion system
│   │   ├── inputs: durations (150/200/300ms), easings
│   │   ├── outputs: @keyframes (fade-in, slide-up, pulse-soft), utility classes
│   │   └── behavior: respects prefers-reduced-motion
│   └── Branding
│       ├── inputs: golf iconography
│       └── outputs: new favicon.svg (flag/ball/tee motif)
├── Shared UI Components (depend on tokens)
│   ├── MatchCard — richer card with status-driven elevation + subtle hover lift
│   ├── TickerHeader — broadcast-grade scoreboard treatment
│   ├── HoleStepper — tactile premium stepper (larger, weightier, animated)
│   ├── MatchStatusHeader — glass-effect sticky header
│   ├── FormatInterstitial — refined modal with backdrop blur + enter animation
│   ├── StrokeDots — refined indicator
│   ├── OnlineOfflinePill — subtler, pill-size-optimized
│   └── PendingSyncBadge — refined badge with pulse animation
├── Route Experiences
│   ├── Landing (+page.svelte) — brand hero, feature tagline, dual CTAs, subtle visual flourish
│   ├── Join (/join) — polish, hero alignment with landing
│   ├── Manager auth (/manage/login, /manage/magic-link-sent) — polish
│   ├── Player layout (/t/[code]/+layout) — glass sticky header
│   ├── Player dashboard (/t/[code]) — depth hierarchy, richer cards
│   ├── Match detail (/t/[code]/matches/[matchId]) — richer treatment
│   ├── Score entry (/t/[code]/matches/[matchId]/hole/[n]) — immersive full-bleed redesign
│   ├── Live ticker (/t/[code]/live) — broadcast overlay treatment
│   └── Manage layout (/manage/+layout) — header / sidebar visual refresh
└── Documentation
    └── DESIGN_SYSTEM.md — regenerated tokens, new shadow rules, motion rules
```

### Feature-level contracts

| Feature                       | Inputs                                               | Outputs                                                      | Behavior notes                                                                                             |
| ----------------------------- | ---------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Web font loading              | `app.html`                                           | `<link rel="preconnect">` + stylesheet `<link>` with swap    | Must not block first paint.                                                                                |
| Token update                  | `app.css`                                            | Updated `:root` + `[data-theme='dark']` + media-query blocks | All existing var names retained; new vars added.                                                           |
| Tailwind theme extension      | `tailwind.config.ts`                                 | Extended `boxShadow`, `transitionDuration`, `animation`, `keyframes`, `backdropBlur` | Pure additive; existing `colors`, `fontFamily`, `fontSize` extensions kept. |
| Favicon                       | `$lib/assets/favicon.svg`                            | New golf-motif SVG                                           | Rendered via existing `<link rel="icon">` in root layout.                                                  |
| Component refactor            | Existing `.svelte` files                             | Updated class strings + minor markup wrappers                | Props, events, data flow, ARIA unchanged.                                                                  |
| Page refactor                 | Existing route `+page.svelte` / `+layout.svelte`     | Updated class strings, optional subtle wrapper divs          | Load functions, data bindings, imports (other than ones added for transitions) unchanged.                  |
| Docs update                   | `assets/DESIGN_SYSTEM.md`                            | Refreshed token + pattern docs                               | No content removal without replacement.                                                                    |

## 4. Repository Structure

### Foundation layer

- `web/src/app.css` — semantic tokens, animation keyframes, utility classes
- `web/tailwind.config.ts` — theme extensions (shadow, motion, backdrop-blur)
- `web/src/app.html` — font preconnect + stylesheet link
- `web/src/lib/assets/favicon.svg` — branded SVG

### Shared UI component layer (depends on foundation)

- `web/src/lib/ui/MatchCard.svelte`
- `web/src/lib/ui/TickerHeader.svelte`
- `web/src/lib/ui/HoleStepper.svelte`
- `web/src/lib/ui/MatchStatusHeader.svelte`
- `web/src/lib/ui/FormatInterstitial.svelte`
- `web/src/lib/ui/StrokeDots.svelte`
- `web/src/lib/ui/OnlineOfflinePill.svelte`
- `web/src/lib/ui/PendingSyncBadge.svelte`

### Route layer (depends on foundation + shared UI)

- `web/src/routes/+layout.svelte`
- `web/src/routes/+page.svelte`
- `web/src/routes/join/+page.svelte`
- `web/src/routes/manage/login/+page.svelte`
- `web/src/routes/manage/magic-link-sent/+page.svelte`
- `web/src/routes/t/[code]/+layout.svelte`
- `web/src/routes/t/[code]/+page.svelte`
- `web/src/routes/t/[code]/matches/[matchId]/+page.svelte`
- `web/src/routes/t/[code]/matches/[matchId]/hole/[n]/+page.svelte`
- `web/src/routes/t/[code]/live/+page.svelte`
- `web/src/routes/manage/+layout.svelte`

### Documentation

- `assets/DESIGN_SYSTEM.md` (note: actual repo path; the user's request referenced `web/assets/DESIGN_SYSTEM.md`, but the only existing design-system doc is at `assets/DESIGN_SYSTEM.md`. This plan updates the existing file. See Open Questions.)

## 5. Dependency Chain (topological)

```
Layer 0 (no deps):
  - web/src/app.css           (design tokens, keyframes, utilities)
  - web/tailwind.config.ts    (theme extension)
  - web/src/app.html          (font loading)
  - web/src/lib/assets/favicon.svg (branding)

Layer 1 (depends on Layer 0 only; all parallelizable with each other):
  - web/src/routes/+layout.svelte          (root transition wrapper)
  - web/src/lib/ui/MatchCard.svelte
  - web/src/lib/ui/TickerHeader.svelte
  - web/src/lib/ui/HoleStepper.svelte
  - web/src/lib/ui/MatchStatusHeader.svelte
  - web/src/lib/ui/FormatInterstitial.svelte
  - web/src/lib/ui/StrokeDots.svelte
  - web/src/lib/ui/OnlineOfflinePill.svelte
  - web/src/lib/ui/PendingSyncBadge.svelte
  - web/src/routes/+page.svelte           (landing)
  - web/src/routes/join/+page.svelte
  - web/src/routes/manage/login/+page.svelte
  - web/src/routes/manage/magic-link-sent/+page.svelte
  - web/src/routes/manage/+layout.svelte

Layer 2 (depends on Layer 1 shared UI + Layer 0 tokens):
  - web/src/routes/t/[code]/+layout.svelte
  - web/src/routes/t/[code]/+page.svelte
  - web/src/routes/t/[code]/matches/[matchId]/+page.svelte
  - web/src/routes/t/[code]/matches/[matchId]/hole/[n]/+page.svelte
  - web/src/routes/t/[code]/live/+page.svelte

Layer 3 (depends on everything being final):
  - assets/DESIGN_SYSTEM.md
```

No circular dependencies. All Layer 1 tasks can run in parallel because they target distinct files. All Layer 2 tasks target distinct files and can run in parallel. Layer 3 waits on Layers 0–2.

## 6. Development Phases

### Phase 1 — Foundation

- **Entry:** PRD approved.
- **Parallelizable tasks:** tokens / tailwind config / app.html / favicon all touch different files but must all land before any consumer is changed. Treat Phase 1 as a single atomic phase; within it, the four tasks may run in parallel.
- **Exit:** `npm run check`, `npm run lint`, `npm run format:check`, `npm run build` all pass. Old tokens still resolve. No downstream file changes yet.

### Phase 2 — Shared UI components

- **Entry:** Phase 1 complete.
- **Parallelizable:** Yes — each component is a distinct file.
- **Exit:** All 8 components updated. `npm run check` + `npm run build` pass.

### Phase 3 — Landing + auth pages (parallel with Phase 2 and Phase 6)

- **Entry:** Phase 1 complete.
- **Parallelizable:** Yes — four distinct files.
- **Exit:** Landing, join, login, magic-link-sent pages updated. Build passes.

### Phase 4 — Player experience

- **Entry:** Phase 1 and Phase 2 complete.
- **Parallelizable:** Yes — four distinct files.
- **Exit:** Tournament layout, dashboard, match detail, score entry updated. Build passes. Interactive QA on a 360px viewport succeeds.

### Phase 5 — Live ticker

- **Entry:** Phase 1 and Phase 2 complete (specifically `TickerHeader` + `MatchCard`).
- **Parallelizable:** Single task.
- **Exit:** Ticker page updated. Build passes. Visual QA confirms broadcast-overlay treatment.

### Phase 6 — Manager portal (parallel with Phase 2 and Phase 3)

- **Entry:** Phase 1 complete.
- **Parallelizable:** Single task.
- **Exit:** Manage layout updated. Build passes.

### Phase 7 — Documentation

- **Entry:** Phases 1–6 complete and reviewed.
- **Exit:** `assets/DESIGN_SYSTEM.md` reflects the new token set, shadow system, motion rules, and glass-header pattern.

## 7. Out of Scope

- Redesigning any non-visual concerns: auth flow, service worker, outbox logic, routing, i18n, accessibility semantics.
- Any change to the `web/src/routes/manage/tournaments/**` pages beyond what propagates automatically from token changes.
- Component library migration.
- New dependencies (npm or otherwise). Only exception: a web font CDN link.
- Logo design beyond a single favicon SVG.

## 8. Technical Constraints

- **SvelteKit 2 + Svelte 5** — preserve `export let` vs. runes usage per file; do not migrate syntax.
- **Tailwind CSS 4** — extend `theme.extend`, do not replace theme.
- **Cloudflare Pages** — static serving; no server-side font hosting. Web font must come from a CDN (Google Fonts).
- **CSP / perf** — preconnect to the font host, use `font-display: swap`, load stylesheet non-render-blocking where feasible.
- **Dark mode** — two paths preserved: `[data-theme='dark']` explicit and `prefers-color-scheme: dark` default; both blocks must be updated symmetrically.
- **Team color tokens** (`--color-team-a`, `--color-team-b`) remain dynamic per tournament; do not hardcode.
- **Accessibility** — keep or improve contrast (WCAG AA min for body text), preserve all ARIA and keyboard affordances, keep `min-h-touch` / `min-h-stepper` targets.
- **Reduced motion** — all new animations must be guarded by `prefers-reduced-motion: reduce`.
- **Mobile-first** — verify 360px viewport before any desktop breakpoint.
- **No hardcoded hex in components** — colors continue to flow through semantic tokens (per existing `DESIGN_SYSTEM.md` rule). Hex values are allowed only inside `app.css`.

## 9. Open Questions

1. **Web font choice** — The PRD direction calls for "Inter or similar" for body and a "distinctive display weight". Does the owner want:
   - (a) Inter for both body and display (with a heavier display weight like 700/800)? — safe, modern, free, fast.
   - (b) Inter body + a distinctive display face (e.g., Fraunces, Playfair, Manrope)? — more personality, slightly larger font payload.

   **Planner default (used below unless overridden):** Inter (400/500/600/700) for both; display elements use 700/800 with tighter tracking. Minimal payload, maximum consistency.

2. **Accent hue** — "Deep green or emerald". Sub-options:
   - (a) Deep fairway green (`#0d5f3f` family) — classical.
   - (b) Emerald (`#059669` family) — modern.
   - (c) Mossy sage (`#3d5a47` family) — understated.

   **Planner default:** option (b) emerald family (`#059669` primary, `#047857` hover, with richer dark-mode variants), because it pairs well with the existing preset palette and delivers "modern" clearly.

3. **Documentation path** — User request says `web/assets/DESIGN_SYSTEM.md`, but the canonical doc today is `assets/DESIGN_SYSTEM.md`. Plan assumes we update the existing file in place. Confirm before Phase 7.

4. **Animations on data-heavy screens** — Should live-ticker team totals animate (count-up effect) on update? Not in scope for this visual pass unless requested, because it touches Svelte reactivity, not just class strings.

## 10. Acceptance Criteria

- All Success Criteria in §2 met.
- All downstream files compile and type-check (`npm run check`).
- No console errors/warnings introduced in development mode on any targeted route.
- Screenshots (manual QA) at 360px, 768px, 1280px for: landing, join, player dashboard, score entry, live ticker, manage overview.
- `DESIGN_SYSTEM.md` updated and consistent with the new tokens.

## 11. Infrastructure Requirements

None. This work does not add, modify, or remove cloud resources. The only network-level change is adding a Google Fonts CDN origin to the page, which Cloudflare Pages serves without additional configuration.

## 12. Security & Access Review

- No new IAM, no new secrets, no new service accounts, no new environment variables.
- Web font `<link>` is a third-party asset; acceptable because Google Fonts is already commonly whitelisted and Cloudflare Pages has no CSP configured that would block it. If a future CSP is added, `fonts.googleapis.com` and `fonts.gstatic.com` must be allowlisted.

## 13. Rollback Plan

All changes are front-end only and scoped to a feature branch (`feature/design-overhaul`). Rollback is a single revert of the merge commit. No data migrations, no infra changes, no background workers affected.
