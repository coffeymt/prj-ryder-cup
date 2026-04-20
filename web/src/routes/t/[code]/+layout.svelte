<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { outbox } from '$lib/outbox/useOutbox';
  import { startSyncListener } from '$lib/outbox/sync';
  import OnlineOfflinePill from '$lib/ui/OnlineOfflinePill.svelte';
  import PendingSyncBadge from '$lib/ui/PendingSyncBadge.svelte';
  import type { LayoutData } from './$types';

  export let data: LayoutData;
  const pendingCount = outbox.pendingCount;

  $: basePath = `/t/${encodeURIComponent(data.tournament.code)}`;
  $: currentPath = $page.url.pathname;
  $: isOnDashboard = currentPath === basePath;
  $: isOnLive = currentPath === `${basePath}/live`;
  $: isOnMatch = currentPath.startsWith(`${basePath}/matches`);
  $: isOnLeaderboard = currentPath === `${basePath}/leaderboard`;

  onMount(() => {
    void outbox.refreshCount();
    const stopSyncListener = startSyncListener();
    const refreshInterval = window.setInterval(() => {
      void outbox.refreshCount();
    }, 2_000);
    const refreshPendingCount = (): void => {
      void outbox.refreshCount();
    };

    window.addEventListener('online', refreshPendingCount);
    window.addEventListener('offline', refreshPendingCount);

    return () => {
      stopSyncListener();
      window.clearInterval(refreshInterval);
      window.removeEventListener('online', refreshPendingCount);
      window.removeEventListener('offline', refreshPendingCount);
    };
  });

  $: opponentTeam = data.team
    ? (data.allTeams.find((candidate) => candidate.id !== data.team?.id) ?? null)
    : (data.allTeams[1] ?? null);
  $: teamAColor = data.team?.color ?? data.allTeams[0]?.color ?? null;
  $: teamBColor = opponentTeam?.color ?? data.allTeams[1]?.color ?? null;

  function wrapperStyle(primaryColor: string | null, secondaryColor: string | null): string {
    return `--color-team-a: ${primaryColor ?? 'var(--color-team-a)'}; --color-team-b: ${secondaryColor ?? 'var(--color-team-b)'};`;
  }
</script>

<svelte:head>
  <title>{data.tournament.name} | Tears Tourneys</title>
  <meta name="description" content="Live player dashboard and scoring for your tournament." />
</svelte:head>

<div class="bg-bg min-h-screen" style={wrapperStyle(teamAColor, teamBColor)}>
  <header
    class={`border-border bg-surface-glass sticky top-0 z-30 border-b backdrop-blur-md ${
      data.team?.color ? 'border-l-team-a border-l-4' : ''
    }`}
  >
    <div class="mx-auto w-full max-w-5xl space-y-2 px-4 py-3 sm:px-6">
      <!-- Top row: Home + title + team badge + status -->
      <div class="flex items-center gap-3">
        <a
          href="/"
          class="text-text-secondary hover:text-text-primary focus-visible:outline-accent inline-flex shrink-0 items-center gap-1.5 rounded-lg p-1.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          aria-label="Home"
          title="Back to home"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            class="h-4 w-4"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              d="M9.293 2.293a1 1 0 011.414 0l7 7A1 1 0 0117 11h-1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3a1 1 0 00-1-1H9a1 1 0 00-1 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-6H3a1 1 0 01-.707-1.707l7-7z"
              clip-rule="evenodd"
            />
          </svg>
        </a>
        <div class="min-w-0 flex-1">
          <p class="text-text-muted text-xs font-semibold tracking-[0.22em] uppercase">
            Tournament
          </p>
          <h1 class="font-display text-text-primary truncate text-lg font-semibold tracking-tight">
            {data.tournament.name}
          </h1>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          {#if data.team}
            <span
              class="text-text-primary inline-flex items-center gap-1.5 text-sm font-medium"
              title={data.team.name}
            >
              <span class="bg-team-a h-2.5 w-2.5 rounded-full shadow-sm" aria-hidden="true"></span>
              <span class="max-w-[8rem] truncate">{data.team.name}</span>
            </span>
          {/if}
          <OnlineOfflinePill />
          <PendingSyncBadge count={$pendingCount} />
        </div>
      </div>

      <!-- Bottom row: Navigation -->
      <nav class="flex items-center gap-3 overflow-x-auto" aria-label="Tournament sections">
        {#if isOnLive || isOnMatch || isOnLeaderboard}
          <a
            href={basePath}
            class={`min-h-touch duration-base focus-visible:outline-accent inline-flex shrink-0 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
              isOnDashboard
                ? 'bg-accent text-accent-text hover:bg-accent-hover shadow-md'
                : 'bg-surface-raised text-text-primary hover:bg-surface border border-border hover:shadow-md'
            }`}
            aria-current={isOnDashboard ? 'page' : undefined}
          >
            My Matches
          </a>
        {/if}

        <a
          href={`${basePath}/live`}
          class={`min-h-touch duration-base focus-visible:outline-accent inline-flex shrink-0 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
            isOnLive
              ? 'bg-accent text-accent-text hover:bg-accent-hover shadow-md'
              : 'bg-surface-raised text-text-primary hover:bg-surface border border-border hover:shadow-md'
          }`}
          aria-current={isOnLive ? 'page' : undefined}
        >
          Live Scores
        </a>

        <a
          href={`${basePath}/leaderboard`}
          class={`min-h-touch duration-base focus-visible:outline-accent inline-flex shrink-0 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
            isOnLeaderboard
              ? 'bg-accent text-accent-text hover:bg-accent-hover shadow-md'
              : 'bg-surface-raised text-text-primary hover:bg-surface border border-border hover:shadow-md'
          }`}
          aria-current={isOnLeaderboard ? 'page' : undefined}
        >
          Leaderboard
        </a>
      </nav>
    </div>
  </header>

  <main class="animate-fade-in mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-6">
    <slot />
  </main>
</div>
