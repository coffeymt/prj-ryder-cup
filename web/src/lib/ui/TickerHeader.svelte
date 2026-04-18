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
  class="space-y-4 rounded-2xl border border-border bg-surface p-card-padding shadow-sm sm:space-y-5 sm:p-6 2xl:p-8 min-[1920px]:rounded-3xl min-[1920px]:space-y-7 min-[1920px]:p-10"
>
  <p class="text-xs font-semibold uppercase tracking-[0.2em] text-text-secondary sm:text-sm min-[1920px]:text-lg">
    Live Team Totals
  </p>

  <div class="flex flex-col items-start gap-2 sm:gap-3 lg:flex-row lg:items-end lg:justify-between min-[1920px]:gap-6">
    <h1
      class="text-balance font-display text-2xl font-bold leading-tight tracking-tight text-text-primary sm:text-4xl lg:text-5xl 2xl:text-6xl min-[1920px]:text-7xl"
    >
      <span class="text-team-a">{teamA.name || 'Team A'}</span>
      <span class="mx-2 tabular-nums text-text-primary">{formatPoints(teamA.points)}</span>
      <span class="text-text-muted">-</span>
      <span class="mx-2 tabular-nums text-text-primary">{formatPoints(teamB.points)}</span>
      <span class="text-team-b">{teamB.name || 'Team B'}</span>
    </h1>
    <p class="text-sm text-text-secondary sm:text-base min-[1920px]:text-2xl">
      First to {formatPoints(pointsToWin)} points wins
    </p>
  </div>

  <div class="grid gap-3 lg:grid-cols-2 min-[1920px]:gap-6">
    <div class="space-y-2">
      <div class="flex items-center justify-between text-sm text-text-secondary sm:text-base min-[1920px]:text-xl">
        <span class="font-semibold text-team-a">{teamA.name || 'Team A'}</span>
        <span class="tabular-nums">{formatPoints(teamA.points)} pts</span>
      </div>
      <div class="h-2.5 overflow-hidden rounded-full bg-surface-raised min-[1920px]:h-4">
        <div
          style={`width: ${toPercent(teamA.points)}%`}
          class="h-full rounded-full bg-team-a transition-all duration-500"
          aria-hidden="true"
        ></div>
      </div>
    </div>

    <div class="space-y-2">
      <div class="flex items-center justify-between text-sm text-text-secondary sm:text-base min-[1920px]:text-xl">
        <span class="font-semibold text-team-b">{teamB.name || 'Team B'}</span>
        <span class="tabular-nums">{formatPoints(teamB.points)} pts</span>
      </div>
      <div class="h-2.5 overflow-hidden rounded-full bg-surface-raised min-[1920px]:h-4">
        <div
          style={`width: ${toPercent(teamB.points)}%`}
          class="h-full rounded-full bg-team-b transition-all duration-500"
          aria-hidden="true"
        ></div>
      </div>
    </div>
  </div>
</section>
