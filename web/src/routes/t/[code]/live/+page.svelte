<script lang="ts">
  import MatchCard, { type MatchCardData } from '$lib/ui/MatchCard.svelte';
  import TickerHeader from '$lib/ui/TickerHeader.svelte';
  import { useLiveFeed } from '$lib/hooks/useLiveFeed';
  import { onMount } from 'svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  const feed = useLiveFeed(data.code, data.initialData);
  const liveData = feed.data;
  const connected = feed.connected;

  let nowMs = Date.now();

  onMount(() => {
    const intervalId = setInterval(() => {
      nowMs = Date.now();
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  });

  function formatPoints(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  function formatRoundStatus(status: 'pending' | 'in_progress' | 'complete'): string {
    if (status === 'in_progress') {
      return 'In Progress';
    }

    if (status === 'complete') {
      return 'Complete';
    }

    return 'Not Started';
  }

  function roundStatusClasses(status: 'pending' | 'in_progress' | 'complete'): string {
    if (status === 'in_progress') {
      return 'border-status-halved bg-surface-raised text-status-halved';
    }

    if (status === 'complete') {
      return 'border-status-up bg-surface-raised text-status-up';
    }

    return 'border-status-closed bg-surface-raised text-status-closed';
  }

  function mapSegment(segment: 'F9' | 'B9' | 'OVERALL' | 'FULL18'): string {
    if (segment === 'F9' || segment === 'B9') {
      return segment;
    }

    return '18';
  }

  function mapMatchStatus(status: 'pending' | 'in_progress' | 'closed'): MatchCardData['status'] {
    if (status === 'in_progress') {
      return 'inProgress';
    }

    if (status === 'closed') {
      return 'closed';
    }

    return 'notStarted';
  }

  function safeDateLabel(value: string): string {
    const parsedMs = Date.parse(value);

    if (Number.isNaN(parsedMs)) {
      return 'Date TBD';
    }

    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }).format(parsedMs);
  }

  function progressPercent(points: number, pointsToWin: number): number {
    if (pointsToWin <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(100, (points / pointsToWin) * 100));
  }

  function lastUpdatedSeconds(lastUpdated: string): number | null {
    const timestamp = Date.parse(lastUpdated);

    if (Number.isNaN(timestamp)) {
      return null;
    }

    return Math.max(0, Math.floor((nowMs - timestamp) / 1000));
  }

  function resolveTeamColor(color: string | null | undefined, fallbackVar: string): string {
    const trimmed = color?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : fallbackVar;
  }

  $: snapshot = $liveData;
  $: teamsById = new Map(snapshot.teams.map((team) => [team.id, team]));
  $: firstTeam = snapshot.teams[0];
  $: secondTeam = snapshot.teams[1];
  $: pointsToWin = snapshot.tournament.pointsToWin;
  $: teamA = {
    name: firstTeam?.name ?? 'Team A',
    color: resolveTeamColor(firstTeam?.color, 'var(--color-accent)'),
    points: firstTeam?.totalPoints ?? 0
  };
  $: teamB = {
    name: secondTeam?.name ?? 'Team B',
    color: resolveTeamColor(secondTeam?.color, 'var(--color-status-down)'),
    points: secondTeam?.totalPoints ?? 0
  };
  $: teamAProgress = progressPercent(teamA.points, pointsToWin);
  $: teamBProgress = progressPercent(teamB.points, pointsToWin);
  $: secondsSinceUpdate = lastUpdatedSeconds(snapshot.lastUpdated);
  $: rounds = snapshot.rounds.map((round) => ({
    ...round,
    cards: round.matches
      .map<MatchCardData>((match) => {
        const sideATeam = teamsById.get(match.sideA.teamId);
        const sideBTeam = teamsById.get(match.sideB.teamId);

        return {
          id: match.id,
          segment: mapSegment(match.segment),
          format: match.format,
          status: mapMatchStatus(match.status),
          matchState: match.matchState,
          closeNotation: match.closeNotation,
          sideA: {
            teamName: sideATeam?.name ?? 'Team A',
            teamColor: resolveTeamColor(sideATeam?.color, 'var(--color-accent)'),
            playerNames: match.sideA.playerNames,
            points: match.sideA.points
          },
          sideB: {
            teamName: sideBTeam?.name ?? 'Team B',
            teamColor: resolveTeamColor(sideBTeam?.color, 'var(--color-status-down)'),
            playerNames: match.sideB.playerNames,
            points: match.sideB.points
          }
        };
      })
      .sort((left, right) => {
        const rank = { inProgress: 0, notStarted: 1, closed: 2 } as const;
        return rank[left.status] - rank[right.status];
      })
  }));
</script>

<svelte:head>
  <title>{snapshot.tournament.name} | Live Ticker</title>
  <meta name="description" content="Live spectator ticker with team totals and match status updates." />
</svelte:head>

<div
  data-theme="dark"
  style={`--color-team-a: ${teamA.color}; --color-team-b: ${teamB.color};`}
  class="relative -mx-4 -my-5 min-h-[calc(100vh-7rem)] bg-bg px-3 py-4 text-text-primary sm:-mx-6 sm:-my-6 sm:px-6 sm:py-6 2xl:px-8 2xl:py-8 min-[1920px]:px-12 min-[1920px]:py-10"
>
  <div class="mx-auto w-full max-w-[120rem] space-y-4 sm:space-y-5 2xl:space-y-7 min-[1920px]:space-y-9">
    <TickerHeader {pointsToWin} {teamA} {teamB} />

    <section class="rounded-2xl border border-border bg-surface p-card-padding shadow-sm sm:p-5 2xl:p-6 min-[1920px]:rounded-3xl min-[1920px]:p-8">
      <h2 class="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary sm:text-sm">Progress to Win</h2>
      <div class="mt-3 grid gap-4 lg:grid-cols-2 min-[1920px]:gap-6">
        <div class="space-y-2">
          <div class="flex items-center justify-between text-sm min-[1920px]:text-xl">
            <span class="font-semibold text-team-a">{teamA.name}</span>
            <span class="tabular-nums text-text-secondary">{formatPoints(teamA.points)} / {formatPoints(pointsToWin)}</span>
          </div>
          <div class="h-3 overflow-hidden rounded-full bg-surface-raised min-[1920px]:h-5">
            <div
              class="h-full rounded-full bg-team-a transition-all duration-500"
              style={`width: ${teamAProgress}%;`}
              aria-label={`${teamA.name} progress`}
            ></div>
          </div>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between text-sm min-[1920px]:text-xl">
            <span class="font-semibold text-team-b">{teamB.name}</span>
            <span class="tabular-nums text-text-secondary">{formatPoints(teamB.points)} / {formatPoints(pointsToWin)}</span>
          </div>
          <div class="h-3 overflow-hidden rounded-full bg-surface-raised min-[1920px]:h-5">
            <div
              class="h-full rounded-full bg-team-b transition-all duration-500"
              style={`width: ${teamBProgress}%;`}
              aria-label={`${teamB.name} progress`}
            ></div>
          </div>
        </div>
      </div>
    </section>

    <section class="space-y-4 sm:space-y-5 min-[1920px]:space-y-7">
      {#if rounds.length === 0}
        <p
          class="rounded-2xl border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-text-secondary min-[1920px]:rounded-3xl min-[1920px]:py-12 min-[1920px]:text-lg"
        >
          No rounds are available yet.
        </p>
      {:else}
        {#each rounds as round (round.id)}
          <article
            class="space-y-3 rounded-2xl border border-border bg-surface p-card-padding shadow-sm sm:space-y-4 sm:p-5 2xl:p-6 min-[1920px]:rounded-3xl min-[1920px]:space-y-6 min-[1920px]:p-8"
          >
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 class="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl min-[1920px]:text-4xl">{round.name}</h2>
                <p class="text-sm text-text-secondary sm:text-base min-[1920px]:text-xl">{safeDateLabel(round.date)}</p>
              </div>

              <span
                class={`rounded-full border px-3 py-1 text-xs font-semibold sm:text-sm min-[1920px]:px-5 min-[1920px]:py-2 min-[1920px]:text-lg ${roundStatusClasses(round.status)}`}
              >
                {formatRoundStatus(round.status)}
              </span>
            </div>

            {#if round.cards.length === 0}
              <p
                class="rounded-xl border border-dashed border-border bg-surface-raised px-3 py-5 text-sm text-text-secondary sm:text-base min-[1920px]:px-5 min-[1920px]:py-8 min-[1920px]:text-xl"
              >
                Matchups for this round have not been published yet.
              </p>
            {:else}
              <div class="grid gap-3 md:gap-4 xl:grid-cols-2 min-[1920px]:grid-cols-3 min-[1920px]:gap-6">
                {#each round.cards as match (match.id)}
                  <MatchCard {match} />
                {/each}
              </div>
            {/if}
          </article>
        {/each}
      {/if}
    </section>
  </div>

  <div
    class="fixed bottom-3 right-3 z-20 rounded-full border border-border bg-surface-raised px-3 py-2 shadow-sm backdrop-blur sm:bottom-4 sm:right-4 sm:px-4 min-[1920px]:bottom-8 min-[1920px]:right-8 min-[1920px]:px-6 min-[1920px]:py-4"
  >
    <div class="flex items-center gap-2 text-xs sm:text-sm min-[1920px]:gap-3 min-[1920px]:text-xl">
      <span class={`h-2.5 w-2.5 rounded-full min-[1920px]:h-4 min-[1920px]:w-4 ${$connected ? 'bg-online' : 'animate-pulse bg-offline'}`}></span>
      <span class="font-medium text-text-primary">{$connected ? 'Live updates connected' : 'Reconnecting live feed'}</span>
    </div>
    <p class="mt-1 text-[11px] text-text-secondary sm:text-xs min-[1920px]:text-base">
      Last updated:
      {#if secondsSinceUpdate === null}
        unavailable
      {:else}
        {secondsSinceUpdate}s ago
      {/if}
    </p>
  </div>
</div>
