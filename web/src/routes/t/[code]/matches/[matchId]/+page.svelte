<script lang="ts">
  import type { PageData } from './$types';

  export let data: PageData;

  function sideStyle(teamColor: string): string {
    return `--team-color: ${teamColor};`;
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
</script>

<svelte:head>
  <title>Match {data.match.matchNumber} | {data.match.formatName}</title>
</svelte:head>

<div class="space-y-4">
  <a
    href={`/t/${encodeURIComponent(data.tournament.code)}`}
    class="inline-flex min-h-touch items-center rounded-lg border border-border bg-transparent px-4 text-sm font-semibold text-text-primary transition hover:bg-surface-raised"
  >
    &larr; Back to Dashboard
  </a>

  <section class="space-y-3 rounded-2xl border border-border bg-surface p-card-padding shadow-sm sm:p-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Match {data.match.matchNumber}</p>
        <h2 class="mt-1 font-display text-xl font-semibold text-text-primary">{data.match.formatName}</h2>
        <p class="mt-1 text-sm font-medium text-text-secondary">{data.match.segmentLabel}</p>
      </div>
      <p class={`rounded-full px-3 py-1 text-sm font-semibold ${matchStateClasses(data.matchState)}`}>{data.matchState}</p>
    </div>

    <div class="grid gap-2 sm:grid-cols-2">
      {#each data.sides as side (side.id)}
        <article
          class="rounded-xl border border-border bg-surface-raised p-3"
          style={sideStyle(side.teamColor)}
        >
          <p class="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <span class="h-2.5 w-2.5 rounded-full border border-border bg-[var(--team-color)]" aria-hidden="true"></span>
            {side.teamName}
          </p>
          <p class="mt-1 text-sm text-text-secondary">{side.players.map((player) => player.name).join(' / ')}</p>
        </article>
      {/each}
    </div>

    <a
      href={`/t/${encodeURIComponent(data.tournament.code)}/matches/${encodeURIComponent(data.match.id)}/hole/${data.currentHole}`}
      class="inline-flex min-h-touch w-full items-center justify-center rounded-lg bg-accent px-4 py-3 text-base font-semibold text-accent-text transition hover:bg-accent-hover"
    >
      Enter Hole {data.currentHole}
    </a>
  </section>

  <section class="rounded-2xl border border-border bg-surface p-card-padding shadow-sm sm:p-5">
    <h3 class="font-display text-lg font-semibold text-text-primary">Completed Holes</h3>

    {#if data.completedHoles.length === 0}
      <p class="mt-3 rounded-xl border border-dashed border-border px-4 py-5 text-sm text-text-secondary">
        No completed holes yet.
      </p>
    {:else}
      <ul class="mt-3 space-y-2">
        {#each data.completedHoles as hole}
          <li class="rounded-xl border border-border bg-surface-raised px-3 py-2.5">
            <p class="text-sm font-semibold text-text-primary">Hole {hole.holeNumber}</p>
            <p class="text-sm text-text-secondary">{hole.resultLabel}</p>
            {#if hole.sideANet !== null && hole.sideBNet !== null}
              <p class="text-xs text-text-muted">Net {hole.sideANet} vs {hole.sideBNet}</p>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>
