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

  function formatTeeTime(time: string): string {
    const parts = /^(\d{1,2}):(\d{2})$/.exec(time);
    if (!parts) return time;
    const hours = parseInt(parts[1], 10);
    const minutes = parts[2];
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    return `${displayHour}:${minutes} ${period}`;
  }

  function roundStatusClasses(status: string): string {
    if (status === 'Final') {
      return 'bg-status-closed/10 text-status-closed';
    }

    if (status === 'In progress') {
      return 'bg-status-halved/10 text-status-halved';
    }

    return 'bg-status-closed/10 text-status-closed';
  }

  function matchStateClasses(label: string): string {
    const normalized = label.toUpperCase();

    if (normalized.includes(' DN')) {
      return 'bg-status-down/10 text-status-down';
    }

    if (normalized.includes(' UP')) {
      return 'bg-status-up/10 text-status-up';
    }

    if (normalized.includes('AS') || normalized.includes('HALVED') || normalized.startsWith('T')) {
      return 'bg-status-halved/10 text-status-halved';
    }

    return 'bg-status-closed/10 text-status-closed';
  }

  function leadingTeamClasses(): string {
    if (teamsAreTied) {
      return 'bg-status-halved/10 text-status-halved';
    }

    return 'bg-status-up/10 text-status-up';
  }
</script>

<svelte:head>
  <title>{data.tournament.name} | Player Dashboard</title>
  <meta name="description" content="Team totals, today's rounds, and your live scoring matches." />
</svelte:head>

<div class="animate-fade-in space-y-10 px-4 pb-8 sm:px-6">
  <!-- Team Totals Hero Section -->
  <section class="bg-surface-raised border-border rounded-2xl border p-6 shadow-lg">
    <div class="mb-6 text-center">
      <p class="text-text-secondary mb-4 text-sm font-medium tracking-widest uppercase">
        Race to {formatPoints(pointsToWin)}
      </p>

      <!-- Subtle Progress Bar -->
      <div class="bg-surface mb-3 h-2 overflow-hidden rounded-full" aria-hidden="true">
        <div
          class="duration-slow h-full rounded-full transition-all"
          style={`background-color: var(--team-color); ${teamColorStyle(leadingTeam.color, '--color-team-a')} width: ${progressPercent}%`}
        ></div>
      </div>
    </div>

    <div class="flex items-center justify-between">
      <!-- Team A -->
      <div
        class={`flex min-w-0 flex-1 flex-col items-center rounded-2xl p-4 transition-colors ${data.team?.name === teamA.name ? 'bg-[var(--team-color)]/5' : ''}`}
        style={teamColorStyle(teamA.color, '--color-team-a')}
      >
        <div
          class={`mb-2 h-4 w-4 rounded-full bg-[var(--team-color)] shadow-sm ${data.team?.name === teamA.name ? 'ring-offset-surface-raised ring-2 ring-[var(--team-color)] ring-offset-2' : ''}`}
          aria-hidden="true"
        ></div>
        <h3
          class="font-display text-team-a w-full truncate px-1 text-center text-base font-bold sm:text-xl"
        >
          {teamA.name || 'Team A'}
          {#if data.team?.name === teamA.name}
            <span class="block text-xs font-normal opacity-75">(Your Team)</span>
          {/if}
        </h3>
        <span class="font-display text-team-a mt-1 text-3xl font-bold tracking-tight tabular-nums"
          >{formatPoints(teamA.points)}</span
        >
      </div>

      <!-- Divider -->
      <div class="font-display text-text-muted px-2 text-lg font-medium sm:px-4">-</div>

      <!-- Team B -->
      <div
        class={`flex min-w-0 flex-1 flex-col items-center rounded-2xl p-4 transition-colors ${data.team?.name === teamB.name ? 'bg-[var(--team-color)]/5' : ''}`}
        style={teamColorStyle(teamB.color, '--color-team-b')}
      >
        <div
          class={`mb-2 h-4 w-4 rounded-full bg-[var(--team-color)] shadow-sm ${data.team?.name === teamB.name ? 'ring-offset-surface-raised ring-2 ring-[var(--team-color)] ring-offset-2' : ''}`}
          aria-hidden="true"
        ></div>
        <h3
          class="font-display text-team-b w-full truncate px-1 text-center text-base font-bold sm:text-xl"
        >
          {teamB.name || 'Team B'}
          {#if data.team?.name === teamB.name}
            <span class="block text-xs font-normal opacity-75">(Your Team)</span>
          {/if}
        </h3>
        <span class="font-display text-team-b mt-1 text-3xl font-bold tracking-tight tabular-nums"
          >{formatPoints(teamB.points)}</span
        >
      </div>
    </div>

    <div class="mt-8 flex justify-center">
      <span class={`rounded-full px-4 py-1.5 text-xs font-semibold ${leadingTeamClasses()}`}>
        {#if teamsAreTied}
          All Square
        {:else}
          {leadingTeam.name || 'Leading team'} leads
        {/if}
      </span>
    </div>
  </section>

  <!-- Today's Rounds Section -->
  <section class="space-y-6">
    <div class="border-border flex items-center justify-between border-b pb-3">
      <h2 class="text-text-primary text-sm font-bold tracking-[0.15em] uppercase">
        Today's Rounds
      </h2>
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
                class={`rounded-full px-3 py-1 text-xs font-semibold ${roundStatusClasses(round.status)}`}
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
                            Match {match.matchNumber}
                            <span class="text-text-muted mx-1 font-normal">|</span>
                            {match.format}
                          </p>
                          {#if match.teeTime}
                            <p class="text-text-secondary mt-0.5 text-xs">
                              Tee: {formatTeeTime(match.teeTime)}
                            </p>
                          {/if}
                        </div>
                        <span
                          class={`rounded-full px-2.5 py-1 text-xs font-semibold ${matchStateClasses(match.statusLabel)}`}
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
                              class="h-3 w-3 rounded-full bg-[var(--team-color)] shadow-sm"
                              aria-hidden="true"
                            ></span>
                            <div class="min-w-0">
                              <p
                                class={`truncate text-sm leading-tight font-semibold ${side.sideLabel === 'A' ? 'text-team-a' : 'text-team-b'}`}
                              >
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
                          class="bg-accent text-accent-text hover:bg-accent-hover focus-visible:outline-accent min-h-touch duration-base inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-bold no-underline shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                          role="button"
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
  <section class="space-y-6">
    <div class="border-border flex items-center justify-between border-b pb-3">
      <h2 class="text-text-primary text-sm font-bold tracking-[0.15em] uppercase">All Rounds</h2>
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
              class={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${roundStatusClasses(round.status)}`}
            >
              {round.status}
            </span>
          </article>
        {/each}
      {/if}
    </div>
  </section>
</div>
