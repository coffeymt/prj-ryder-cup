<script lang="ts">
  import type { PageData } from './$types';

  export let data: PageData;

  function sideStyle(teamColor: string): string {
    return `--team-color: ${teamColor};`;
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
</script>

<svelte:head>
  <title>Match {data.match.matchNumber} | {data.match.formatName}</title>
</svelte:head>

<div class="animate-fade-in space-y-4">
  <a
    href={`/t/${encodeURIComponent(data.tournament.code)}`}
    class="min-h-touch bg-surface-raised text-text-primary hover:bg-surface duration-base inline-flex items-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition-all hover:shadow-md"
  >
    &larr; Back to Dashboard
  </a>

  <section
    class="border-border bg-surface p-card-padding space-y-3 rounded-2xl border shadow-md sm:p-5"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-text-muted text-xs font-semibold tracking-[0.2em] uppercase">
          Match {data.match.matchNumber}
        </p>
        <h2 class="font-display text-text-primary mt-1 text-xl font-semibold">
          {data.match.formatName}
        </h2>
        <p class="text-text-secondary mt-1 text-sm font-medium">{data.match.segmentLabel}</p>
      </div>
      <p
        class={`rounded-full px-3 py-1 text-sm font-semibold ${matchStateClasses(data.matchState)}`}
      >
        {data.matchState}
      </p>
    </div>

    <div class="grid gap-2 sm:grid-cols-2">
      {#each data.sides as side (side.id)}
        <article
          class="border-border bg-surface-raised duration-base rounded-xl border p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          style={sideStyle(side.teamColor)}
        >
          <p class="text-text-primary flex items-center gap-2 text-sm font-semibold">
            <span
              class="border-border h-2.5 w-2.5 rounded-full border bg-[var(--team-color)]"
              aria-hidden="true"
            ></span>
            {side.teamName}
          </p>
          <p class="text-text-secondary mt-1 text-sm">
            {side.players.map((player) => player.name).join(' / ')}
          </p>
        </article>
      {/each}
    </div>

    <a
      href={`/t/${encodeURIComponent(data.tournament.code)}/matches/${encodeURIComponent(data.match.id)}/hole/${data.currentHole}`}
      class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover focus-visible:outline-accent duration-base inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-base font-bold no-underline shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      role="button"
    >
      Enter Hole {data.currentHole}
    </a>
  </section>

  <section class="border-border bg-surface p-card-padding rounded-2xl border shadow-sm sm:p-5">
    <h3 class="font-display text-text-primary text-lg font-semibold">Completed Holes</h3>

    {#if data.completedHoles.length === 0}
      <p
        class="border-border text-text-secondary mt-3 rounded-xl border border-dashed px-4 py-5 text-sm"
      >
        No completed holes yet.
      </p>
    {:else}
      <ul class="mt-3 space-y-2">
        {#each data.completedHoles as hole (hole.holeNumber)}
          <li
            class="border-border bg-surface-raised hover:bg-surface duration-fast rounded-xl border px-3 py-2.5 transition-colors"
          >
            <p class="text-text-primary text-sm font-semibold">Hole {hole.holeNumber}</p>
            <p class="text-text-secondary text-sm">{hole.resultLabel}</p>
            {#if hole.sideANet !== null && hole.sideBNet !== null}
              <p class="text-text-muted text-xs">Net {hole.sideANet} vs {hole.sideBNet}</p>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>
