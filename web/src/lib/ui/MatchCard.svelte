<script lang="ts">
  export type MatchCardData = {
    id: string;
    segment: string;
    format: string;
    status: 'inProgress' | 'closed' | 'notStarted';
    matchState: string;
    closeNotation: string | null;
    sideA: { teamName: string; teamColor: string; playerNames: string[]; points: number };
    sideB: { teamName: string; teamColor: string; playerNames: string[]; points: number };
  };

  export let match: MatchCardData;

  function formatPoints(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  function teamStyle(color: string): string {
    const trimmed = color?.trim();
    return `--team-color: ${trimmed && trimmed.length > 0 ? trimmed : 'var(--color-text-primary)'}`;
  }

  function statusLabel(status: MatchCardData['status']): string {
    if (status === 'inProgress') {
      return 'In Progress';
    }

    if (status === 'closed') {
      return 'Final';
    }

    return 'Not Started';
  }

  function statusClasses(status: MatchCardData['status']): string {
    if (status === 'inProgress') {
      return 'border-status-halved bg-surface-raised text-status-halved';
    }

    if (status === 'closed') {
      return 'border-status-up bg-surface-raised text-status-up';
    }

    return 'border-status-closed bg-surface-raised text-status-closed';
  }

  function closedResultLabel(value: MatchCardData): string {
    if (value.closeNotation) {
      return value.closeNotation;
    }

    if (value.matchState === 'AS') {
      return 'Halved';
    }

    return value.matchState;
  }
</script>

<article
  class={`border-border bg-surface p-card-padding space-y-3 rounded-2xl border shadow-sm min-[1920px]:space-y-6 min-[1920px]:rounded-3xl min-[1920px]:p-8 sm:space-y-4 sm:p-5 ${
    match.status === 'notStarted' ? 'opacity-80' : ''
  }`}
>
  <div class="flex flex-wrap items-start justify-between gap-2">
    <div>
      <p class="text-text-primary text-sm font-semibold min-[1920px]:text-xl sm:text-base">
        {match.format} · {match.segment}
      </p>
      {#if match.status === 'inProgress'}
        <p class="text-status-halved mt-1 text-base font-semibold min-[1920px]:text-2xl sm:text-lg">
          {match.matchState}
        </p>
      {:else if match.status === 'closed'}
        <p class="text-status-up mt-1 text-base font-semibold min-[1920px]:text-2xl sm:text-lg">
          {closedResultLabel(match)}
        </p>
      {:else}
        <p class="text-text-secondary mt-1 text-sm min-[1920px]:text-xl sm:text-base">
          Awaiting first score
        </p>
      {/if}
    </div>

    <span
      class={`rounded-full border px-2.5 py-1 text-xs font-semibold min-[1920px]:px-4 min-[1920px]:py-2 min-[1920px]:text-lg sm:text-sm ${statusClasses(match.status)}`}
    >
      {statusLabel(match.status)}
    </span>
  </div>

  <div class="space-y-2 min-[1920px]:space-y-4">
    <div
      style={teamStyle(match.sideA.teamColor)}
      class="border-border bg-surface-raised rounded-xl border p-3 min-[1920px]:rounded-2xl min-[1920px]:p-6 sm:p-4"
    >
      <div class="flex items-center justify-between gap-2">
        <p class="font-semibold text-[var(--team-color)] min-[1920px]:text-2xl sm:text-lg">
          {match.sideA.teamName || 'Team A'}
        </p>
        <p
          class="text-text-primary text-sm font-semibold tabular-nums min-[1920px]:text-2xl sm:text-base"
        >
          {formatPoints(match.sideA.points)} pts
        </p>
      </div>
      {#if match.status !== 'closed'}
        <p
          class="text-text-secondary mt-1 truncate text-sm min-[1920px]:mt-2 min-[1920px]:text-xl sm:text-base"
        >
          {match.sideA.playerNames.join(' / ') || 'Lineup TBD'}
        </p>
      {/if}
    </div>

    <div
      style={teamStyle(match.sideB.teamColor)}
      class="border-border bg-surface-raised rounded-xl border p-3 min-[1920px]:rounded-2xl min-[1920px]:p-6 sm:p-4"
    >
      <div class="flex items-center justify-between gap-2">
        <p class="font-semibold text-[var(--team-color)] min-[1920px]:text-2xl sm:text-lg">
          {match.sideB.teamName || 'Team B'}
        </p>
        <p
          class="text-text-primary text-sm font-semibold tabular-nums min-[1920px]:text-2xl sm:text-base"
        >
          {formatPoints(match.sideB.points)} pts
        </p>
      </div>
      {#if match.status !== 'closed'}
        <p
          class="text-text-secondary mt-1 truncate text-sm min-[1920px]:mt-2 min-[1920px]:text-xl sm:text-base"
        >
          {match.sideB.playerNames.join(' / ') || 'Lineup TBD'}
        </p>
      {/if}
    </div>
  </div>
</article>
