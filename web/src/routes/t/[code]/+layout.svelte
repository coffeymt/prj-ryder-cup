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
  <title>{data.tournament.name} | Golf</title>
  <meta name="description" content="Live player dashboard and scoring for your tournament." />
</svelte:head>

<div class="min-h-screen bg-bg" style={wrapperStyle(teamAColor, teamBColor)}>
  <header
    class={`border-border bg-surface-glass sticky top-0 z-30 border-b backdrop-blur-md ${
      data.team?.color ? 'border-l-team-a border-l-4' : ''
    }`}
  >
    <div
      class="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6"
    >
      <div class="min-w-0 space-y-1">
        <p class="text-text-muted text-xs font-semibold tracking-[0.22em] uppercase">Tournament</p>
        <h1 class="font-display text-text-primary truncate text-lg font-semibold tracking-tight">
          {data.tournament.name}
        </h1>
      </div>

      <div class="ml-auto flex flex-wrap items-center gap-3 sm:gap-4">
        {#if data.team}
          <span
            class="min-h-touch border-border bg-surface-raised text-text-primary inline-flex items-center gap-2 rounded-full border px-3 text-sm font-medium"
            title={data.team.name}
          >
            <span class="border-border bg-team-a h-2.5 w-2.5 rounded-full border" aria-hidden="true"
            ></span>
            <span class="max-w-[8rem] truncate">{data.team.name}</span>
          </span>
        {:else}
          <span
            class="min-h-touch border-border bg-surface-raised text-text-secondary inline-flex items-center rounded-full border px-3 text-sm font-medium"
          >
            Spectator
          </span>
        {/if}

        <OnlineOfflinePill />
        <PendingSyncBadge count={$pendingCount} />

        <nav class="flex items-center gap-1.5" aria-label="Tournament sections">
          {#if isOnLive || isOnMatch}
            <a
              href={basePath}
              class={`min-h-touch inline-flex items-center justify-center rounded-full px-4 text-sm font-semibold shadow-sm transition-all duration-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                isOnDashboard
                  ? 'bg-accent text-accent-text hover:bg-accent-hover hover:shadow-md'
                  : 'border border-border bg-surface-raised text-text-primary hover:bg-surface hover:shadow-md'
              }`}
              aria-current={isOnDashboard ? 'page' : undefined}
            >
              My Matches
            </a>
          {/if}

          <a
            href={`${basePath}/live`}
            class={`min-h-touch inline-flex items-center justify-center rounded-full px-4 text-sm font-semibold shadow-sm transition-all duration-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              isOnLive
                ? 'bg-accent text-accent-text hover:bg-accent-hover hover:shadow-md'
                : 'border border-border bg-surface-raised text-text-primary hover:bg-surface hover:shadow-md'
            }`}
            aria-current={isOnLive ? 'page' : undefined}
          >
            Live Scores
          </a>
        </nav>
      </div>
    </div>
  </header>

  <main class="mx-auto w-full max-w-5xl animate-fade-in px-4 py-5 sm:px-6 sm:py-6">
    <slot />
  </main>
</div>
