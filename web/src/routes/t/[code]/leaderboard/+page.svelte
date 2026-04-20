<script lang="ts">
  import { untrack } from 'svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // Default: expand the most recent round. Use untrack to intentionally capture initial value.
  let expandedRoundIds = $state(
    new Set<string>(
      untrack(() => (data.rounds.length > 0 ? [data.rounds[data.rounds.length - 1].id] : []))
    )
  );

  const teamA = $derived(
    data.teams[0] ?? { id: '', name: 'Team A', color: '#059669', totalPoints: 0 }
  );
  const teamB = $derived(
    data.teams[1] ?? { id: '', name: 'Team B', color: '#0ea5e9', totalPoints: 0 }
  );

  function toggleRound(id: string): void {
    if (expandedRoundIds.has(id)) {
      expandedRoundIds.delete(id);
    } else {
      expandedRoundIds.add(id);
    }
  }

  function formatPoints(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  function progressPercent(points: number, pointsToWin: number): number {
    if (pointsToWin <= 0) return 0;
    return Math.max(0, Math.min(100, (points / pointsToWin) * 100));
  }

  function safeDateLabel(value: string): string {
    const parsedMs = Date.parse(value);

    if (Number.isNaN(parsedMs)) return 'TBD';

    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(parsedMs);
  }

  function roundStatusClasses(status: 'Not Started' | 'In Progress' | 'Final'): string {
    if (status === 'In Progress') return 'bg-status-halved/10 text-status-halved';
    if (status === 'Final') return 'bg-status-up/10 text-status-up';
    return 'bg-status-closed/10 text-status-closed';
  }

  function matchStatusClasses(status: 'PENDING' | 'IN_PROGRESS' | 'FINAL'): string {
    if (status === 'IN_PROGRESS') return 'bg-status-halved/10 text-status-halved';
    if (status === 'FINAL') return 'bg-status-up/10 text-status-up';
    return 'bg-status-closed/10 text-status-closed';
  }

  function matchStatusLabel(status: 'PENDING' | 'IN_PROGRESS' | 'FINAL'): string {
    if (status === 'IN_PROGRESS') return 'In Progress';
    if (status === 'FINAL') return 'Final';
    return 'Not Started';
  }

  function matchResultLabel(match: {
    status: 'PENDING' | 'IN_PROGRESS' | 'FINAL';
    matchState: string;
    closeNotation: string | null;
  }): string {
    if (match.status === 'FINAL') {
      if (match.closeNotation) return match.closeNotation;
      if (match.matchState === 'AS') return 'Halved';
      return match.matchState;
    }

    if (match.status === 'IN_PROGRESS') {
      return match.matchState;
    }

    return '—';
  }

  const standingLabel = $derived(
    teamA.totalPoints > teamB.totalPoints
      ? `${teamA.name} Leading`
      : teamB.totalPoints > teamA.totalPoints
        ? `${teamB.name} Leading`
        : 'All Square'
  );

  const standingClasses = $derived(
    teamA.totalPoints === teamB.totalPoints
      ? 'bg-status-halved/10 text-status-halved'
      : 'bg-accent-soft text-accent'
  );

  // Column totals for the breakdown table
  const totalByTeamA = $derived(teamA.totalPoints);
  const totalByTeamB = $derived(teamB.totalPoints);
</script>

<svelte:head>
  <title>Leaderboard | Tears Tourneys</title>
  <meta
    name="description"
    content="Full tournament leaderboard with team standings and match results."
  />
</svelte:head>

<div
  style="--color-team-a: {teamA.color}; --color-team-b: {teamB.color};"
  class="space-y-5 sm:space-y-6"
>
  <!-- ── A. Team Standings Hero ─────────────────────────────────────────── -->
  <section
    class="bg-surface border-border p-card-padding animate-fade-in space-y-5 rounded-2xl border shadow-lg sm:p-6"
    aria-label="Team standings"
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-text-secondary text-xs font-semibold tracking-[0.18em] uppercase sm:text-sm">
        Overall Standings
      </h2>
      <span class={`rounded-full px-3 py-1 text-xs font-semibold sm:text-sm ${standingClasses}`}>
        {standingLabel}
      </span>
    </div>

    <!-- Score hero -->
    <div
      class="flex flex-col items-center gap-1 sm:flex-row sm:items-end sm:justify-center sm:gap-4"
    >
      <div class="flex min-w-0 flex-1 flex-col items-center gap-1 sm:items-end">
        <span class="text-team-a truncate text-lg font-bold tracking-tight sm:text-2xl">
          {teamA.name}
        </span>
        <span class="text-team-a font-display text-5xl font-extrabold tabular-nums sm:text-7xl">
          {formatPoints(teamA.totalPoints)}
        </span>
      </div>

      <div class="flex flex-col items-center gap-1">
        <span class="text-text-muted text-3xl font-light sm:text-5xl" aria-hidden="true">—</span>
        <span class="text-text-muted text-xs font-semibold tracking-widest uppercase">
          First to {formatPoints(data.pointsToWin)} wins
        </span>
      </div>

      <div class="flex min-w-0 flex-1 flex-col items-center gap-1 sm:items-start">
        <span class="text-team-b truncate text-lg font-bold tracking-tight sm:text-2xl">
          {teamB.name}
        </span>
        <span class="text-team-b font-display text-5xl font-extrabold tabular-nums sm:text-7xl">
          {formatPoints(teamB.totalPoints)}
        </span>
      </div>
    </div>

    <!-- Progress bars -->
    <div class="space-y-3">
      <div class="space-y-1.5">
        <div class="flex items-center justify-between text-sm">
          <span class="text-team-a font-semibold">{teamA.name}</span>
          <span class="text-text-secondary tabular-nums">
            {formatPoints(teamA.totalPoints)} / {formatPoints(data.pointsToWin)}
          </span>
        </div>
        <div class="bg-surface-raised h-3 overflow-hidden rounded-full shadow-inner">
          <div
            class="bg-team-a duration-slow ease-standard h-full rounded-full shadow-[0_0_12px_var(--color-team-a)] transition-all"
            style="width: {progressPercent(teamA.totalPoints, data.pointsToWin)}%;"
            aria-label="{teamA.name} progress toward {formatPoints(data.pointsToWin)} points"
            role="progressbar"
            aria-valuenow={teamA.totalPoints}
            aria-valuemax={data.pointsToWin}
          ></div>
        </div>
      </div>

      <div class="space-y-1.5">
        <div class="flex items-center justify-between text-sm">
          <span class="text-team-b font-semibold">{teamB.name}</span>
          <span class="text-text-secondary tabular-nums">
            {formatPoints(teamB.totalPoints)} / {formatPoints(data.pointsToWin)}
          </span>
        </div>
        <div class="bg-surface-raised h-3 overflow-hidden rounded-full shadow-inner">
          <div
            class="bg-team-b duration-slow ease-standard h-full rounded-full shadow-[0_0_12px_var(--color-team-b)] transition-all"
            style="width: {progressPercent(teamB.totalPoints, data.pointsToWin)}%;"
            aria-label="{teamB.name} progress toward {formatPoints(data.pointsToWin)} points"
            role="progressbar"
            aria-valuenow={teamB.totalPoints}
            aria-valuemax={data.pointsToWin}
          ></div>
        </div>
      </div>
    </div>
  </section>

  <!-- ── B. Round-by-Round Breakdown Table ─────────────────────────────── -->
  {#if data.rounds.length > 0}
    <section
      class="bg-surface border-border p-card-padding animate-slide-up-fade rounded-2xl border shadow-sm sm:p-6"
      aria-label="Round breakdown"
      style="animation-delay: 100ms;"
    >
      <h2
        class="text-text-secondary mb-4 text-xs font-semibold tracking-[0.18em] uppercase sm:text-sm"
      >
        Round Breakdown
      </h2>

      <div class="-mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
        <table class="w-full min-w-[360px] text-sm">
          <thead>
            <tr class="border-border border-b">
              <th
                class="text-text-muted pr-4 pb-2.5 text-left text-xs font-semibold tracking-[0.12em] uppercase"
                scope="col"
              >
                Round
              </th>
              <th
                class="text-text-muted hidden pr-4 pb-2.5 text-left text-xs font-semibold tracking-[0.12em] uppercase sm:table-cell"
                scope="col"
              >
                Date
              </th>
              <th
                class="text-team-a pr-4 pb-2.5 text-center text-xs font-semibold tracking-[0.12em] uppercase"
                scope="col"
              >
                {teamA.name}
              </th>
              <th
                class="text-team-b pr-4 pb-2.5 text-center text-xs font-semibold tracking-[0.12em] uppercase"
                scope="col"
              >
                {teamB.name}
              </th>
              <th
                class="text-text-muted pb-2.5 text-right text-xs font-semibold tracking-[0.12em] uppercase"
                scope="col"
              >
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {#each data.rounds as round (round.id)}
              <tr class="border-border group border-b last:border-0">
                <td class="py-3 pr-4">
                  <p class="text-text-primary font-semibold">{round.name}</p>
                  <p class="text-text-muted mt-0.5 text-xs sm:hidden">
                    {safeDateLabel(round.scheduledAt)}
                  </p>
                </td>
                <td class="text-text-secondary hidden py-3 pr-4 sm:table-cell">
                  {safeDateLabel(round.scheduledAt)}
                </td>
                <td class="py-3 pr-4 text-center">
                  <span class="text-team-a font-bold tabular-nums">
                    {formatPoints(round.teamPoints[teamA.id] ?? 0)}
                  </span>
                </td>
                <td class="py-3 pr-4 text-center">
                  <span class="text-team-b font-bold tabular-nums">
                    {formatPoints(round.teamPoints[teamB.id] ?? 0)}
                  </span>
                </td>
                <td class="py-3 text-right">
                  <span
                    class={`rounded-full px-2.5 py-1 text-xs font-semibold ${roundStatusClasses(round.status)}`}
                  >
                    {round.status}
                  </span>
                </td>
              </tr>
            {/each}
          </tbody>
          <tfoot>
            <tr class="border-border border-t">
              <td
                class="text-text-primary pt-3 pr-4 text-sm font-bold tracking-wide uppercase"
                colspan={2}
              >
                Total
              </td>
              <td class="pt-3 pr-4 text-center">
                <span class="text-team-a text-base font-extrabold tabular-nums">
                  {formatPoints(totalByTeamA)}
                </span>
              </td>
              <td class="pt-3 pr-4 text-center">
                <span class="text-team-b text-base font-extrabold tabular-nums">
                  {formatPoints(totalByTeamB)}
                </span>
              </td>
              <td class="pt-3"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>

    <!-- ── C. Match Results Grid (per round) ─────────────────────────────── -->
    <section class="space-y-3" aria-label="Match results by round">
      {#each data.rounds as round, roundIndex (round.id)}
        {@const isExpanded = expandedRoundIds.has(round.id)}
        <article
          class="bg-surface border-border animate-slide-up-fade overflow-hidden rounded-2xl border shadow-sm"
          style="animation-delay: {(roundIndex + 2) * 80}ms;"
        >
          <!-- Round header / toggle -->
          <button
            type="button"
            class="min-h-touch flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6"
            onclick={() => toggleRound(round.id)}
            aria-expanded={isExpanded}
            aria-controls="round-matches-{round.id}"
          >
            <div class="flex min-w-0 flex-col gap-0.5">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-text-primary font-bold">{round.name}</span>
                <span
                  class={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${roundStatusClasses(round.status)}`}
                >
                  {round.status}
                </span>
              </div>
              <span class="text-text-muted text-xs">{safeDateLabel(round.scheduledAt)}</span>
            </div>

            <!-- Round score summary -->
            <div class="flex shrink-0 items-center gap-3">
              <span
                class="border-border bg-surface-raised inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold tabular-nums"
              >
                <span class="text-team-a">{formatPoints(round.teamPoints[teamA.id] ?? 0)}</span>
                <span class="text-text-muted text-xs">–</span>
                <span class="text-team-b">{formatPoints(round.teamPoints[teamB.id] ?? 0)}</span>
              </span>

              <!-- Chevron icon -->
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                class="text-text-muted duration-base ease-standard h-5 w-5 shrink-0 transition-transform {isExpanded
                  ? 'rotate-180'
                  : ''}"
                aria-hidden="true"
              >
                <path
                  fill-rule="evenodd"
                  d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                  clip-rule="evenodd"
                />
              </svg>
            </div>
          </button>

          <!-- Matches grid -->
          {#if isExpanded}
            <div
              id="round-matches-{round.id}"
              class="border-border border-t px-4 py-4 sm:px-6 sm:py-5"
            >
              {#if round.matches.length === 0}
                <p
                  class="border-border text-text-secondary rounded-xl border border-dashed px-4 py-6 text-center text-sm"
                >
                  No matchups published for this round yet.
                </p>
              {:else}
                <div class="grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
                  {#each round.matches as match (match.id)}
                    {@const winnerSide =
                      match.status === 'FINAL'
                        ? match.sideA.points > match.sideB.points
                          ? 'A'
                          : match.sideB.points > match.sideA.points
                            ? 'B'
                            : null
                        : null}
                    <article
                      style="{match.sideA.teamColor
                        ? `--color-team-a: ${match.sideA.teamColor};`
                        : ''} {match.sideB.teamColor
                        ? `--color-team-b: ${match.sideB.teamColor};`
                        : ''}"
                      class={`border-border bg-surface space-y-3 rounded-xl border p-4 sm:p-5 ${
                        match.status === 'PENDING'
                          ? 'opacity-75 shadow-sm'
                          : match.status === 'IN_PROGRESS'
                            ? 'border-l-accent border-l-4 shadow-md'
                            : 'shadow-sm'
                      }`}
                    >
                      <!-- Match header -->
                      <div class="flex items-start justify-between gap-2">
                        <div>
                          <p class="text-text-primary text-sm font-semibold">
                            #{match.matchNumber} · {match.format} · {match.segment}
                          </p>
                          {#if match.teeTime}
                            <p class="text-text-muted mt-0.5 text-xs">Tee: {match.teeTime}</p>
                          {/if}
                        </div>
                        <span
                          class={`rounded-full px-2.5 py-1 text-xs font-semibold ${matchStatusClasses(match.status)}`}
                        >
                          {matchStatusLabel(match.status)}
                        </span>
                      </div>

                      <!-- Match result notation -->
                      {#if match.status !== 'PENDING'}
                        <p
                          class={`text-sm font-semibold ${
                            match.status === 'FINAL' ? 'text-status-up' : 'text-status-halved'
                          }`}
                        >
                          {matchResultLabel(match)}
                        </p>
                      {/if}

                      <!-- Sides -->
                      <div class="space-y-2">
                        <!-- Side A -->
                        <div
                          class={`border-y-border border-r-border border-l-team-a rounded-lg border-y border-r border-l-4 p-2.5 ${
                            winnerSide === 'A' ? 'bg-team-a/10' : 'bg-team-a/5'
                          }`}
                        >
                          <div class="flex items-center justify-between gap-2">
                            <div class="min-w-0">
                              <p
                                class="text-team-a text-xs font-semibold {winnerSide === 'A'
                                  ? 'font-bold'
                                  : ''}"
                              >
                                {match.sideA.teamName || 'Team A'}
                              </p>
                              {#if match.sideA.playerNames.length > 0}
                                <p class="text-text-secondary mt-0.5 truncate text-xs">
                                  {match.sideA.playerNames.join(' / ')}
                                </p>
                              {/if}
                            </div>
                            <span class="text-team-a shrink-0 text-sm font-bold tabular-nums">
                              {formatPoints(match.sideA.points)}
                            </span>
                          </div>
                        </div>

                        <!-- Side B -->
                        <div
                          class={`border-y-border border-r-border border-l-team-b rounded-lg border-y border-r border-l-4 p-2.5 ${
                            winnerSide === 'B' ? 'bg-team-b/10' : 'bg-team-b/5'
                          }`}
                        >
                          <div class="flex items-center justify-between gap-2">
                            <div class="min-w-0">
                              <p
                                class="text-team-b text-xs font-semibold {winnerSide === 'B'
                                  ? 'font-bold'
                                  : ''}"
                              >
                                {match.sideB.teamName || 'Team B'}
                              </p>
                              {#if match.sideB.playerNames.length > 0}
                                <p class="text-text-secondary mt-0.5 truncate text-xs">
                                  {match.sideB.playerNames.join(' / ')}
                                </p>
                              {/if}
                            </div>
                            <span class="text-team-b shrink-0 text-sm font-bold tabular-nums">
                              {formatPoints(match.sideB.points)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </article>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </article>
      {/each}
    </section>
  {:else}
    <div
      class="border-border bg-surface text-text-secondary animate-fade-in rounded-2xl border border-dashed px-4 py-12 text-center text-sm"
    >
      No rounds have been scheduled yet.
    </div>
  {/if}
</div>
