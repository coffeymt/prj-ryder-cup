<script lang="ts">
  import type { PageData } from './$types';

  export let data: PageData;

  $: teamA = data.teamTotals.teamA;
  $: teamB = data.teamTotals.teamB;
  $: pointsToWin = data.tournament.points_to_win;
  $: leadingTeam = teamA.points >= teamB.points ? teamA : teamB;
  $: leadingPoints = Math.max(teamA.points, teamB.points);
  $: teamsAreTied = teamA.points === teamB.points;
  $: progressPercent =
    pointsToWin > 0 ? Math.min(100, Math.max(0, (leadingPoints / pointsToWin) * 100)) : 0;

  function teamColorStyle(
    teamColor: string | null,
    fallbackToken: '--color-team-a' | '--color-team-b'
  ): string {
    return `--team-color: ${teamColor ?? `var(${fallbackToken})`};`;
  }

  function formatPoints(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  function formatSchedule(value: string): string {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.valueOf())) {
      return value;
    }

    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(parsed);
  }

  function matchesForRound(roundId: string): PageData['myMatches'] {
    return data.myMatches.filter((match) => match.roundId === roundId);
  }

  function roundStatusClasses(status: string): string {
    if (status === 'Final') {
      return 'border border-status-closed bg-surface-raised text-status-closed';
    }

    if (status === 'In progress') {
      return 'border border-status-halved bg-surface-raised text-status-halved';
    }

    return 'border border-status-closed bg-surface-raised text-status-closed';
  }

  function matchStateClasses(label: string): string {
    const normalized = label.toUpperCase();

    if (normalized.includes(' DN')) {
      return 'border border-status-down bg-surface-raised text-status-down';
    }

    if (normalized.includes(' UP')) {
      return 'border border-status-up bg-surface-raised text-status-up';
    }

    if (normalized.includes('AS') || normalized.includes('HALVED') || normalized.startsWith('T')) {
      return 'border border-status-halved bg-surface-raised text-status-halved';
    }

    return 'border border-status-closed bg-surface-raised text-status-closed';
  }

  function leadingTeamClasses(): string {
    if (teamsAreTied) {
      return 'border border-status-halved bg-surface-raised text-status-halved';
    }

    return 'border border-status-up bg-surface-raised text-status-up';
  }
</script>

<svelte:head>
  <title>{data.tournament.name} | Player Dashboard</title>
  <meta name="description" content="Team totals, today's rounds, and your live scoring matches." />
</svelte:head>

<div class="animate-fade-in space-y-5">
  <section class="border-border bg-surface p-card-padding rounded-2xl border shadow-lg sm:p-5">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="text-text-muted text-xs font-semibold tracking-[0.2em] uppercase">Team Totals</p>
        <h2 class="font-display text-text-primary mt-1 text-xl font-semibold tracking-tight">
          Race to {formatPoints(pointsToWin)}
        </h2>
      </div>
      <span class={`rounded-full px-3 py-1 text-xs font-semibold ${leadingTeamClasses()}`}>
        {#if teamsAreTied}
          AS
        {:else}
          {leadingTeam.name || 'Leading team'} leads
        {/if}
      </span>
    </div>

    <div class="mt-4 grid gap-3">
      <div
        class="min-h-touch border-border bg-surface-raised flex items-center justify-between rounded-xl border px-3 py-2"
        style={teamColorStyle(teamA.color, '--color-team-a')}
      >
        <div class="flex min-w-0 items-center gap-2">
          <span
            class="border-border h-3 w-3 rounded-full border bg-[var(--team-color)]"
            aria-hidden="true"
          ></span>
          <span class="text-text-primary truncate font-medium">{teamA.name || 'Team A'}</span>
        </div>
        <span class="text-text-primary text-lg font-semibold tabular-nums"
          >{formatPoints(teamA.points)}</span
        >
      </div>

      <div
        class="min-h-touch border-border bg-surface-raised flex items-center justify-between rounded-xl border px-3 py-2"
        style={teamColorStyle(teamB.color, '--color-team-b')}
      >
        <div class="flex min-w-0 items-center gap-2">
          <span
            class="border-border h-3 w-3 rounded-full border bg-[var(--team-color)]"
            aria-hidden="true"
          ></span>
          <span class="text-text-primary truncate font-medium">{teamB.name || 'Team B'}</span>
        </div>
        <span class="text-text-primary text-lg font-semibold tabular-nums"
          >{formatPoints(teamB.points)}</span
        >
      </div>
    </div>

    <div class="mt-4 space-y-2">
      <div class="bg-surface-raised h-3 overflow-hidden rounded-full" aria-hidden="true">
        <div
          class="h-full rounded-full bg-[var(--team-color)] transition-all duration-slow"
          style={`${teamColorStyle(leadingTeam.color, '--color-team-a')} width: ${progressPercent}%`}
        ></div>
      </div>
      <p class="text-text-secondary text-sm">
        {leadingTeam.name || 'Leading team'} has {formatPoints(leadingPoints)} of {formatPoints(
          pointsToWin
        )} points needed to win.
      </p>
    </div>
  </section>

  <section
    class="border-border bg-surface p-card-padding space-y-3 rounded-2xl border shadow-md sm:p-5"
  >
    <div class="flex items-center justify-between gap-3">
      <h2 class="font-display text-text-primary text-lg font-semibold">Today's Rounds</h2>
      {#if data.player}
        <span class="text-text-secondary text-sm">{data.player.name}</span>
      {/if}
    </div>

    {#if data.todayRounds.length === 0}
      <p
        class="border-border text-text-secondary rounded-xl border border-dashed px-4 py-5 text-sm"
      >
        No rounds are scheduled yet.
      </p>
    {:else}
      <div class="space-y-4">
        {#each data.todayRounds as round (round.id)}
          <article class="border-border bg-surface-raised space-y-3 rounded-xl border p-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 class="text-text-primary text-base font-semibold">{round.name}</h3>
                <p class="text-text-secondary text-sm">
                  {round.formatSummary} · {formatSchedule(round.scheduledAt)}
                </p>
              </div>
              <span
                class={`rounded-full px-3 py-1 text-xs font-semibold ${roundStatusClasses(round.status)}`}
              >
                {round.status}
              </span>
            </div>

            {#if matchesForRound(round.id).length === 0}
              <p
                class="border-border text-text-secondary rounded-lg border border-dashed px-3 py-4 text-sm"
              >
                {#if data.player}
                  You are not assigned to a match in this round.
                {:else}
                  Sign in as a player to enter scores.
                {/if}
              </p>
            {:else}
              <div class="space-y-3">
                {#each matchesForRound(round.id) as match (match.id)}
                  <article
                    class="min-h-touch border-border bg-surface space-y-3 rounded-xl border p-3 shadow-sm transition-all duration-base hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div class="flex items-start justify-between gap-3">
                      <div>
                        <p class="text-text-primary text-sm font-semibold">
                          Match {match.matchNumber} · {match.format}
                        </p>
                        <p
                          class="text-text-secondary text-xs font-semibold tracking-wide uppercase"
                        >
                          {match.statusLabel}
                        </p>
                      </div>
                      <span
                        class={`rounded-full px-2.5 py-1 text-xs font-semibold ${matchStateClasses(match.statusLabel)}`}
                      >
                        {match.statusLabel}
                      </span>
                    </div>

                    <div class="space-y-2 text-sm">
                      {#each match.sides as side (side.sideLabel)}
                        <p
                          class="min-h-touch border-border bg-surface-raised flex items-center gap-2 rounded-lg border px-2.5"
                          style={teamColorStyle(
                            side.teamColor,
                            side.sideLabel === 'A' ? '--color-team-a' : '--color-team-b'
                          )}
                        >
                          <span
                            class="border-border h-2.5 w-2.5 rounded-full border bg-[var(--team-color)]"
                            aria-hidden="true"
                          ></span>
                          <span class="text-text-primary font-semibold"
                            >{side.teamName || `Side ${side.sideLabel}`}</span
                          >
                          <span class="text-text-secondary truncate"
                            >{side.playerNames.join(' / ') || 'Lineup TBD'}</span
                          >
                        </p>
                      {/each}
                    </div>

                    <a
                      href={`/t/${encodeURIComponent(data.tournament.code)}/matches/${encodeURIComponent(match.id)}`}
                      class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover focus-visible:outline-accent inline-flex w-full items-center justify-center rounded-xl px-4 text-sm font-semibold shadow-sm transition-all duration-base hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      Enter Scores
                    </a>
                  </article>
                {/each}
              </div>
            {/if}
          </article>
        {/each}
      </div>
    {/if}
  </section>

  <section class="border-border bg-surface p-card-padding rounded-2xl border shadow-sm sm:p-5">
    <details open>
      <summary class="min-h-touch flex cursor-pointer list-none items-center justify-between gap-3">
        <h2 class="font-display text-text-primary text-lg font-semibold">All Rounds</h2>
        <span
          class="border-border bg-surface-raised text-text-secondary rounded-full border px-3 py-1 text-xs font-semibold"
        >
          {data.allRounds.length}
        </span>
      </summary>

      <div class="mt-3 space-y-2">
        {#if data.allRounds.length === 0}
          <p
            class="border-border text-text-secondary rounded-lg border border-dashed px-3 py-4 text-sm"
          >
            No rounds have been created yet.
          </p>
        {:else}
          {#each data.allRounds as round (round.id)}
            <article
              class="min-h-touch border-border bg-surface-raised flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5"
            >
              <div class="min-w-0">
                <p class="text-text-primary truncate text-sm font-semibold">
                  Round {round.roundNumber}: {round.name}
                </p>
                <p class="text-text-secondary truncate text-xs">
                  {round.formatSummary} · {formatSchedule(round.scheduledAt)}
                </p>
              </div>
              <span
                class={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${roundStatusClasses(round.status)}`}
              >
                {round.status}
              </span>
            </article>
          {/each}
        {/if}
      </div>
    </details>
  </section>
</div>
