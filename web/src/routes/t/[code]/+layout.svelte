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
  <title>{data.tournament.name} | Golf</title>
  <meta name="description" content="Live player dashboard and scoring for your tournament." />
</svelte:head>

<div class="min-h-screen bg-[var(--color-bg)]" style={wrapperStyle(teamAColor, teamBColor)}>
  <header
    class={`border-border bg-surface border-b backdrop-blur ${
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

      <div class="ml-auto flex items-center gap-2">
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

        <a
          href={`/t/${encodeURIComponent(data.tournament.code)}/live`}
          class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center justify-center rounded-full px-4 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
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
