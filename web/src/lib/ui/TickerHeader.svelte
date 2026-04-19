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
  class="border-border bg-surface p-card-padding space-y-4 rounded-2xl border shadow-sm min-[1920px]:space-y-7 min-[1920px]:rounded-3xl min-[1920px]:p-10 sm:space-y-5 sm:p-6 2xl:p-8"
>
  <p
    class="text-text-secondary text-xs font-semibold tracking-[0.2em] uppercase min-[1920px]:text-lg sm:text-sm"
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

  <div class="grid gap-3 min-[1920px]:gap-6 lg:grid-cols-2">
    <div class="space-y-2">
      <div
        class="text-text-secondary flex items-center justify-between text-sm min-[1920px]:text-xl sm:text-base"
      >
        <span class="text-team-a font-semibold">{teamA.name || 'Team A'}</span>
        <span class="tabular-nums">{formatPoints(teamA.points)} pts</span>
      </div>
      <div class="bg-surface-raised h-2.5 overflow-hidden rounded-full min-[1920px]:h-4">
        <div
          style={`width: ${toPercent(teamA.points)}%`}
          class="bg-team-a h-full rounded-full transition-all duration-500"
          aria-hidden="true"
        ></div>
      </div>
    </div>

    <div class="space-y-2">
      <div
        class="text-text-secondary flex items-center justify-between text-sm min-[1920px]:text-xl sm:text-base"
      >
        <span class="text-team-b font-semibold">{teamB.name || 'Team B'}</span>
        <span class="tabular-nums">{formatPoints(teamB.points)} pts</span>
      </div>
      <div class="bg-surface-raised h-2.5 overflow-hidden rounded-full min-[1920px]:h-4">
        <div
          style={`width: ${toPercent(teamB.points)}%`}
          class="bg-team-b h-full rounded-full transition-all duration-500"
          aria-hidden="true"
        ></div>
      </div>
    </div>
  </div>
</section>
