<script lang="ts">
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData | undefined;

  function teamColorStyle(teamColor: string | null): string {
    return `--team-color: ${teamColor ?? 'var(--color-text-muted)'};`;
  }
</script>

<svelte:head>
  <title>{data.tournamentName} | Join Tournament</title>
  <meta name="description" content="Select your player profile to join live tournament scoring." />
</svelte:head>

{#if form?.joinError}
  <div class="pointer-events-none fixed inset-x-4 top-4 z-20 flex justify-center">
    <div
      class="max-w-sm rounded-xl border border-status-down bg-surface-raised px-4 py-3 text-sm font-medium text-status-down shadow-sm"
      role="status"
      aria-live="polite"
    >
      {form.joinError}
    </div>
  </div>
{/if}

<main class="mx-auto min-h-screen w-full max-w-md px-4 py-8">
  <section class="space-y-6 rounded-3xl border border-border bg-surface p-card-padding shadow-sm">
    <div class="space-y-2 text-center">
      <p class="text-xs font-semibold uppercase tracking-[0.24em] text-text-muted">Tournament</p>
      <h1 class="font-display text-2xl font-semibold tracking-tight text-text-primary">{data.tournamentName}</h1>
      <p class="text-sm text-text-secondary">Tap your name to join scoring for code {data.code}.</p>
      {#if data.publicTickerRequiresCode}
        <p class="text-xs font-medium text-text-muted">This event requires the join code for player access.</p>
      {/if}
    </div>

    <div class="space-y-3">
      {#each data.roster as player (player.id)}
        <form method="POST">
          <input type="hidden" name="playerId" value={player.id} />
          <button
            type="submit"
            class="flex min-h-touch w-full items-center justify-between gap-3 rounded-2xl border border-border bg-surface-raised px-4 py-3 text-left transition hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span class="min-w-0 space-y-1">
              <span class="block truncate text-base font-semibold text-text-primary">
                {player.displayName}
                {#if player.isCaptain}
                  <span class="ml-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Captain</span>
                {/if}
              </span>
              <span class="flex items-center gap-2 text-sm text-text-secondary">
                <span
                  class="h-2.5 w-2.5 flex-none rounded-full border border-border"
                  style={`${teamColorStyle(player.teamColor)} background-color: var(--team-color);`}
                  aria-hidden="true"
                ></span>
                <span class="truncate">{player.teamName ?? 'Unassigned Team'}</span>
              </span>
            </span>

            {#if player.id === data.selectedPlayerId}
              <span class="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-status-up text-white">
                <span aria-hidden="true">✓</span>
                <span class="sr-only">Selected player</span>
              </span>
            {/if}
          </button>
        </form>
      {/each}
    </div>
  </section>
</main>
