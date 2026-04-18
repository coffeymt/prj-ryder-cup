<script lang="ts">
  import { onMount } from 'svelte';
  import { outbox } from '$lib/outbox/useOutbox';
  import { startSyncListener } from '$lib/outbox/sync';
  import OnlineOfflinePill from '$lib/ui/OnlineOfflinePill.svelte';
  import PendingSyncBadge from '$lib/ui/PendingSyncBadge.svelte';
  import type { LayoutData } from './$types';

  export let data: LayoutData;
  const pendingCount = outbox.pendingCount;

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
  <title>{data.tournament.name} | Ryder Cup</title>
  <meta name="description" content="Live player dashboard and scoring for your tournament." />
</svelte:head>

<div class="min-h-screen bg-[var(--color-bg)]" style={wrapperStyle(teamAColor, teamBColor)}>
  <header
    class={`border-b border-border bg-surface backdrop-blur ${
      data.team?.color ? 'border-l-4 border-l-team-a' : ''
    }`}
  >
    <div class="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
      <div class="min-w-0 space-y-1">
        <p class="text-xs font-semibold uppercase tracking-[0.22em] text-text-muted">Tournament</p>
        <h1 class="truncate font-display text-lg font-semibold tracking-tight text-text-primary">
          {data.tournament.name}
        </h1>
      </div>

      <div class="ml-auto flex items-center gap-2">
        {#if data.team}
          <span
            class="inline-flex min-h-touch items-center gap-2 rounded-full border border-border bg-surface-raised px-3 text-sm font-medium text-text-primary"
            title={data.team.name}
          >
            <span class="h-2.5 w-2.5 rounded-full border border-border bg-team-a" aria-hidden="true"></span>
            <span class="max-w-[8rem] truncate">{data.team.name}</span>
          </span>
        {:else}
          <span class="inline-flex min-h-touch items-center rounded-full border border-border bg-surface-raised px-3 text-sm font-medium text-text-secondary">
            Spectator
          </span>
        {/if}

        <OnlineOfflinePill />
        <PendingSyncBadge count={$pendingCount} />

        <a
          href={`/t/${encodeURIComponent(data.tournament.code)}/live`}
          class="inline-flex min-h-touch items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-text transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Live Scores
        </a>
      </div>
    </div>
  </header>

  <main class="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-6">
    <slot />
  </main>
</div>
