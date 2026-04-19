<script lang="ts">
  export let teamA: { name: string; color: string; points: number };
  export let teamB: { name: string; color: string; points: number };
  export let pointsToWin: number;

  function formatPoints(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  function toPercent(points: number): number {
    if (pointsToWin <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(100, (points / pointsToWin) * 100));
  }
</script>

<section
  class="border-border bg-surface-glass p-card-padding space-y-4 rounded-2xl border shadow-xl backdrop-blur-md min-[1920px]:space-y-7 min-[1920px]:rounded-3xl min-[1920px]:p-10 sm:space-y-5 sm:p-6 2xl:p-8"
>
  <p
    class="text-text-muted text-xs font-bold tracking-[0.25em] uppercase min-[1920px]:text-xl sm:text-sm lg:text-base"
  >
    Live Team Totals
  </p>

  <div
    class="flex flex-col items-start gap-2 min-[1920px]:gap-6 sm:gap-3 lg:flex-row lg:items-end lg:justify-between"
  >
    <h1
      class="font-display text-text-primary text-2xl leading-tight font-bold tracking-tight text-balance min-[1920px]:text-7xl sm:text-4xl lg:text-5xl 2xl:text-6xl"
    >
      <span class="text-team-a">{teamA.name || 'Team A'}</span>
      <span class="text-text-primary mx-2 tabular-nums">{formatPoints(teamA.points)}</span>
      <span class="text-text-muted">-</span>
      <span class="text-text-primary mx-2 tabular-nums">{formatPoints(teamB.points)}</span>
      <span class="text-team-b">{teamB.name || 'Team B'}</span>
    </h1>
    <p class="text-text-secondary text-sm min-[1920px]:text-2xl sm:text-base">
      First to {formatPoints(pointsToWin)} points wins
    </p>
  </div>
  <div
    class="from-team-a to-team-b mt-3 h-0.5 rounded-full bg-gradient-to-r via-transparent opacity-30"
    aria-hidden="true"
  ></div>

  <div class="grid gap-3 min-[1920px]:gap-6 lg:grid-cols-2">
    <div class="space-y-2">
      <div
        class="text-text-secondary flex items-center justify-between text-sm min-[1920px]:text-xl sm:text-base"
      >
        <span class="text-team-a font-semibold drop-shadow-sm">{teamA.name || 'Team A'}</span>
        <span class="font-bold tabular-nums">{formatPoints(teamA.points)} pts</span>
      </div>
      <div class="bg-surface-raised h-3 overflow-hidden rounded-full shadow-inner min-[1920px]:h-5">
        <div
          style={`width: ${toPercent(teamA.points)}%`}
          class="bg-team-a duration-slow ease-standard h-full rounded-full shadow-[0_0_12px_var(--color-team-a)] transition-all"
          aria-hidden="true"
        ></div>
      </div>
    </div>

    <div class="space-y-2">
      <div
        class="text-text-secondary flex items-center justify-between text-sm min-[1920px]:text-xl sm:text-base"
      >
        <span class="text-team-b font-semibold drop-shadow-sm">{teamB.name || 'Team B'}</span>
        <span class="font-bold tabular-nums">{formatPoints(teamB.points)} pts</span>
      </div>
      <div class="bg-surface-raised h-3 overflow-hidden rounded-full shadow-inner min-[1920px]:h-5">
        <div
          style={`width: ${toPercent(teamB.points)}%`}
          class="bg-team-b duration-slow ease-standard h-full rounded-full shadow-[0_0_12px_var(--color-team-b)] transition-all"
          aria-hidden="true"
        ></div>
      </div>
    </div>
  </div>
</section>
