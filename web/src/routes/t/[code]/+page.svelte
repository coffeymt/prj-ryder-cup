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

<div class="animate-fade-in space-y-6">
  <!-- Team Totals Hero Section -->
  <section class="bg-surface-raised border-border rounded-2xl border p-6 shadow-lg">
    <div class="mb-6 text-center">
      <p class="text-text-secondary mb-4 text-sm font-medium tracking-widest uppercase">
        Race to {formatPoints(pointsToWin)}
      </p>

      <!-- Subtle Progress Bar -->
      <div class="bg-surface h-2 overflow-hidden rounded-full mb-3" aria-hidden="true">
        <div
          class="h-full rounded-full transition-all duration-slow"
          style={`background-color: var(--team-color); ${teamColorStyle(leadingTeam.color, '--color-team-a')} width: ${progressPercent}%`}
        ></div>
      </div>
    </div>

    <div class="flex items-center justify-between">
      <!-- Team A -->
      <div
        class="flex min-w-0 flex-1 flex-col items-center"
        style={teamColorStyle(teamA.color, '--color-team-a')}
      >
        <div
          class="mb-2 h-4 w-4 rounded-full bg-[var(--team-color)] shadow-sm"
          aria-hidden="true"
        ></div>
        <h3
          class="font-display text-text-primary w-full px-1 text-center text-base font-bold truncate sm:text-xl"
        >
          {teamA.name || 'Team A'}
        </h3>
        <span class="font-display text-text-primary mt-1 tabular-nums tracking-tight text-3xl font-bold"
          >{formatPoints(teamA.points)}</span
        >
      </div>

      <!-- Divider -->
      <div class="font-display text-text-muted px-2 text-lg font-medium sm:px-4">-</div>

      <!-- Team B -->
      <div
        class="flex min-w-0 flex-1 flex-col items-center"
        style={teamColorStyle(teamB.color, '--color-team-b')}
      >
        <div
          class="mb-2 h-4 w-4 rounded-full bg-[var(--team-color)] shadow-sm"
          aria-hidden="true"
        ></div>
        <h3
          class="font-display text-text-primary w-full px-1 text-center text-base font-bold truncate sm:text-xl"
        >
          {teamB.name || 'Team B'}
        </h3>
        <span class="font-display text-text-primary mt-1 tabular-nums tracking-tight text-3xl font-bold"
          >{formatPoints(teamB.points)}</span
        >
      </div>
    </div>

    <div class="mt-8 flex justify-center">
      <span class={`rounded-full px-4 py-1.5 text-xs font-semibold shadow-sm ${leadingTeamClasses()}`}>
        {#if teamsAreTied}
          All Square
        {:else}
          {leadingTeam.name || 'Leading team'} leads
        {/if}
      </span>
    </div>
  </section>

  <!-- Today's Rounds Section -->
  <section class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-text-muted text-xs font-bold tracking-widest uppercase">Today's Rounds</h2>
      {#if data.player}
        <span class="text-text-secondary text-xs font-semibold">{data.player.name}</span>
      {/if}
    </div>

    {#if data.todayRounds.length === 0}
      <p
        class="border-border text-text-secondary rounded-2xl border border-dashed p-6 text-center text-sm"
      >
        No rounds are scheduled yet.
      </p>
    {:else}
      <div class="space-y-6">
        {#each data.todayRounds as round (round.id)}
          <article class="bg-surface border-border overflow-hidden rounded-2xl border shadow-sm">
            <div
              class="border-border bg-surface-raised flex flex-wrap items-center justify-between gap-2 border-b p-4"
            >
              <div>
                <h3 class="font-display text-text-primary text-base font-semibold">{round.name}</h3>
                <p class="text-text-secondary text-sm">
                  {round.formatSummary} · {formatSchedule(round.scheduledAt)}
                </p>
              </div>
              <span
                class={`rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${roundStatusClasses(round.status)}`}
              >
                {round.status}
              </span>
            </div>

            <div class="bg-surface p-4">
              {#if matchesForRound(round.id).length === 0}
                <p
                  class="border-border text-text-secondary rounded-xl border border-dashed px-3 py-6 text-center text-sm"
                >
                  {#if data.player}
                    You are not assigned to a match in this round.
                  {:else}
                    Sign in as a player to enter scores.
                  {/if}
                </p>
              {:else}
                <div class="space-y-4">
                  {#each matchesForRound(round.id) as match (match.id)}
                    <article
                      class="bg-surface-raised border-border space-y-4 rounded-xl border p-4 shadow-sm"
                    >
                      <div class="flex items-start justify-between gap-3">
                        <div>
                          <p class="font-display text-text-primary text-sm font-semibold">
                            Match {match.matchNumber} <span class="text-text-muted mx-1 font-normal"
                              >|</span
                            > {match.format}
                          </p>
                        </div>
                        <span
                          class={`rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${matchStateClasses(match.statusLabel)}`}
                        >
                          {match.statusLabel}
                        </span>
                      </div>

                      <div class="space-y-2">
                        {#each match.sides as side (side.sideLabel)}
                          <div
                            class="flex items-center gap-3 rounded-lg px-2 py-1.5"
                            style={teamColorStyle(
                              side.teamColor,
                              side.sideLabel === 'A' ? '--color-team-a' : '--color-team-b'
                            )}
                          >
                            <span
                              class="border-border h-3 w-3 rounded-full border bg-[var(--team-color)] shadow-sm"
                              aria-hidden="true"
                            ></span>
                            <div class="min-w-0">
                              <p class="text-text-primary truncate text-sm font-semibold leading-tight">
                                {side.teamName || `Side ${side.sideLabel}`}
                              </p>
                              <p class="text-text-secondary mt-0.5 truncate text-xs">
                                {side.playerNames.join(' / ') || 'Lineup TBD'}
                              </p>
                            </div>
                          </div>
                        {/each}
                      </div>

                      <div class="pt-2">
                        <a
                          href={`/t/${encodeURIComponent(data.tournament.code)}/matches/${encodeURIComponent(match.id)}`}
                          class="bg-accent text-accent-text hover:bg-accent-hover focus-visible:outline-accent min-h-touch inline-flex w-full items-center justify-center rounded-xl px-4 text-sm font-semibold shadow-md transition-all duration-base hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                          Enter Scores
                        </a>
                      </div>
                    </article>
                  {/each}
                </div>
              {/if}
            </div>
          </article>
        {/each}
      </div>
    {/if}
  </section>

  <!-- All Rounds Section -->
  <section class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-text-muted text-xs font-bold tracking-widest uppercase">All Rounds</h2>
      <span
        class="border-border bg-surface-raised text-text-secondary rounded-full border px-2.5 py-0.5 text-xs font-semibold"
      >
        {data.allRounds.length}
      </span>
    </div>

    <div class="space-y-3">
      {#if data.allRounds.length === 0}
        <p
          class="border-border text-text-secondary rounded-2xl border border-dashed px-4 py-6 text-center text-sm"
        >
          No rounds have been created yet.
        </p>
      {:else}
        {#each data.allRounds as round (round.id)}
          <article
            class="min-h-touch bg-surface-raised border-border hover:bg-surface flex items-center justify-between gap-3 rounded-xl border px-4 py-3 shadow-sm transition-all"
          >
            <div class="min-w-0 flex-1">
              <p class="font-display text-text-primary truncate text-sm font-semibold">
                Round {round.roundNumber}: {round.name}
              </p>
              <p class="text-text-secondary mt-0.5 truncate text-xs">
                {round.formatSummary} · {formatSchedule(round.scheduledAt)}
              </p>
            </div>
            <span
              class={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${roundStatusClasses(round.status)}`}
            >
              {round.status}
            </span>
          </article>
        {/each}
      {/if}
    </div>
  </section>
</div>
