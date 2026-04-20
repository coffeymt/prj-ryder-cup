<script lang="ts">
  export type MatchCardData = {
    id: string;
    segment: string;
    format: string;
    status: 'inProgress' | 'closed' | 'notStarted';
    matchState: string;
    closeNotation: string | null;
    teeTime: string | null;
    sideA: { teamName: string; teamColor: string; playerNames: string[]; points: number };
    sideB: { teamName: string; teamColor: string; playerNames: string[]; points: number };
  };

  export let match: MatchCardData;

  function formatPoints(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
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
      return 'bg-status-halved/10 text-status-halved';
    }

    if (status === 'closed') {
      return 'bg-status-up/10 text-status-up';
    }

    return 'bg-status-closed/10 text-status-closed';
  }

  function formatTeeTime(time: string): string {
    const parts = /^(\d{1,2}):(\d{2})$/.exec(time);
    if (!parts) return time;
    const hours = parseInt(parts[1], 10);
    const minutes = parts[2];
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    return `${displayHour}:${minutes} ${period}`;
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
  style={`${match.sideA.teamColor ? `--color-team-a: ${match.sideA.teamColor};` : ''} ${match.sideB.teamColor ? `--color-team-b: ${match.sideB.teamColor};` : ''}`.trim() ||
    undefined}
  class={`border-border bg-surface p-card-padding duration-base ease-standard space-y-3 rounded-2xl border transition-all min-[1920px]:space-y-6 min-[1920px]:rounded-3xl min-[1920px]:p-8 sm:space-y-4 sm:p-5 ${
    match.status === 'notStarted'
      ? 'opacity-80 shadow-sm'
      : match.status === 'inProgress'
        ? 'border-l-accent border-l-4 shadow-md'
        : 'shadow-sm'
  } ${match.status !== 'notStarted' ? 'hover:-translate-y-0.5 hover:shadow-md' : ''}`}
>
  <div class="flex flex-wrap items-start justify-between gap-2">
    <div>
      <p class="text-text-primary text-sm font-semibold min-[1920px]:text-xl sm:text-base">
        {match.format} · {match.segment}
      </p>
      {#if match.teeTime}
        <p class="text-text-secondary mt-0.5 text-xs min-[1920px]:text-base sm:text-sm">
          Tee: {formatTeeTime(match.teeTime)}
        </p>
      {/if}
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
      class={`rounded-full px-2.5 py-1 text-xs font-semibold min-[1920px]:px-4 min-[1920px]:py-2 min-[1920px]:text-lg sm:text-sm ${statusClasses(match.status)}`}
    >
      {statusLabel(match.status)}
    </span>
  </div>

  <div class="space-y-2 min-[1920px]:space-y-4">
    <div
      class="border-y-border border-r-border border-l-team-a bg-team-a/5 rounded-xl border-y border-r border-l-4 p-3 min-[1920px]:rounded-2xl min-[1920px]:p-6 sm:p-4"
    >
      <div class="flex items-center justify-between gap-2">
        <p class="text-team-a font-semibold min-[1920px]:text-2xl sm:text-lg">
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
      class="border-y-border border-r-border border-l-team-b bg-team-b/5 rounded-xl border-y border-r border-l-4 p-3 min-[1920px]:rounded-2xl min-[1920px]:p-6 sm:p-4"
    >
      <div class="flex items-center justify-between gap-2">
        <p class="text-team-b font-semibold min-[1920px]:text-2xl sm:text-lg">
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
