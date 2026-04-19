<script lang="ts">
  import type { PageData } from './$types';

  export let data: PageData;

  function formatDateTime(value: string): string {
    const parsed = Date.parse(value);

    if (Number.isNaN(parsed)) {
      return value;
    }

    return new Date(parsed).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  function formatPoints(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  function statusLabel(value: 'draft' | 'inProgress' | 'complete'): string {
    if (value === 'inProgress') {
      return 'In Progress';
    }

    if (value === 'complete') {
      return 'Complete';
    }

    return 'Draft';
  }

  function statusClasses(value: 'draft' | 'inProgress' | 'complete'): string {
    if (value === 'inProgress') {
      return 'border-status-halved/30 bg-status-halved/10 text-status-halved';
    }

    if (value === 'complete') {
      return 'border-status-up/30 bg-status-up/10 text-status-up';
    }

    return 'border-border bg-surface-raised text-text-secondary';
  }
</script>

<svelte:head>
  <title>{data.tournament.name} Rounds | Golf Manager</title>
</svelte:head>

<section class="space-y-5">
  <header class="space-y-3">
    <p class="text-text-secondary text-xs font-semibold tracking-[0.2em] uppercase">
      Commissioner Portal
    </p>
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-text-primary text-2xl font-semibold tracking-tight">
          {data.tournament.name}
        </h1>
        <p class="text-text-secondary text-sm">
          Build and edit your tournament rounds and matchups.
        </p>
      </div>
      <a
        href={`/manage/tournaments/${data.tournament.id}/rounds/new`}
        class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover inline-flex items-center rounded-lg px-4 text-sm font-semibold transition"
      >
        + Add Round
      </a>
    </div>
  </header>

  <p
    class="border-border bg-surface text-text-primary rounded-lg border px-4 py-3 text-sm font-semibold shadow-sm"
  >
    {formatPoints(data.configuredPoints)} / {formatPoints(data.targetPoints)} points configured
  </p>

  {#if data.rounds.length === 0}
    <p
      class="border-border bg-surface-raised text-text-secondary rounded-xl border border-dashed px-4 py-4 text-sm"
    >
      No rounds yet. Add your first round to start building matchups.
    </p>
  {:else}
    <div class="space-y-3">
      {#each data.rounds as round (round.id)}
        <a
          href={`/manage/tournaments/${data.tournament.id}/rounds/${round.id}`}
          class="border-border bg-surface hover:border-border block rounded-xl border p-4 shadow-sm transition hover:shadow"
        >
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p class="text-text-secondary text-sm font-semibold">Round {round.roundNumber}</p>
              <h2 class="text-text-primary text-lg font-semibold">{round.name}</h2>
            </div>
            <span
              class={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-semibold tracking-wide uppercase ${statusClasses(round.status)}`}
            >
              {statusLabel(round.status)}
            </span>
          </div>

          <dl class="text-text-secondary mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt class="text-text-primary font-semibold">Date</dt>
              <dd>{formatDateTime(round.scheduledAt)}</dd>
            </div>
            <div>
              <dt class="text-text-primary font-semibold">Course</dt>
              <dd>{round.courseName}</dd>
            </div>
            <div class="sm:col-span-2">
              <dt class="text-text-primary font-semibold">Format</dt>
              <dd>{round.formatSummary}</dd>
            </div>
            <div>
              <dt class="text-text-primary font-semibold">Points</dt>
              <dd>{formatPoints(round.points)}</dd>
            </div>
          </dl>
        </a>
      {/each}
    </div>
  {/if}
</section>
