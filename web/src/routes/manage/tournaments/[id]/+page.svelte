<script lang="ts">
  import type { PageData } from './$types';

  export let data: PageData;

  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  function formatDate(value: string): string {
    const parsed = Date.parse(value);

    if (Number.isNaN(parsed)) {
      return value;
    }

    return dateFormatter.format(new Date(parsed));
  }

  function formatDateRange(startDate: string, endDate: string): string {
    if (startDate === endDate) {
      return formatDate(startDate);
    }

    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  }

  function roundsStatusClass(roundCount: number): string {
    return roundCount > 0 ? 'text-status-up' : 'text-status-down';
  }
</script>

<svelte:head>
  <title>{data.tournament.name} Overview | Golf Manager</title>
</svelte:head>

<section class="mx-auto w-full max-w-4xl space-y-6">
  <header class="space-y-3">
    <p class="text-xs font-semibold uppercase tracking-[0.2em] text-text-secondary">Commissioner Portal</p>
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">{data.tournament.name}</h1>
      <div class="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
        <span
          class="inline-flex min-h-touch items-center rounded-lg border border-border bg-surface-raised px-3 font-mono text-sm font-semibold tracking-[0.18em] text-text-primary"
        >
          {data.tournament.code}
        </span>
        <span aria-hidden="true">-</span>
        <span>{formatDateRange(data.tournament.start_date, data.tournament.end_date)}</span>
      </div>
    </div>
  </header>

  <section class="rounded-2xl border border-border bg-surface p-card-padding shadow-sm">
    <h2 class="text-lg font-semibold text-text-primary">Quick stats</h2>
    <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <article class="rounded-xl border border-border bg-surface-raised p-4">
        <p class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Teams</p>
        <p class="mt-2 text-2xl font-semibold text-text-primary">{data.teams.length}</p>
      </article>

      <article class="rounded-xl border border-border bg-surface-raised p-4">
        <p class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Players</p>
        <p class="mt-2 text-2xl font-semibold text-text-primary">{data.players.length}</p>
      </article>

      <article class="rounded-xl border border-border bg-surface-raised p-4">
        <p class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Rounds configured</p>
        <p class={`mt-2 text-2xl font-semibold ${roundsStatusClass(data.rounds.length)}`}>{data.rounds.length}</p>
      </article>
    </div>
  </section>

  <section class="rounded-2xl border border-border bg-surface p-card-padding shadow-sm">
    <h2 class="text-lg font-semibold text-text-primary">Quick links</h2>
    <p class="mt-1 text-sm text-text-secondary">Jump into the most common tournament management tasks.</p>
    <div class="mt-4 grid gap-3 sm:grid-cols-2">
      <a
        href={`/manage/tournaments/${data.tournament.id}/teams`}
        class="group rounded-xl border border-border bg-surface-raised p-4 transition hover:border-accent"
      >
        <p class="text-sm font-semibold text-text-primary">Teams &amp; Players</p>
        <p class="mt-1 text-sm text-text-secondary">Create teams, assign captains, and manage roster entries.</p>
      </a>

      <a
        href={`/manage/tournaments/${data.tournament.id}/rounds`}
        class="group rounded-xl border border-border bg-surface-raised p-4 transition hover:border-accent"
      >
        <p class="text-sm font-semibold text-text-primary">Rounds</p>
        <p class="mt-1 text-sm text-text-secondary">Build round schedules and configure match formats.</p>
      </a>

      <a
        href={`/manage/tournaments/${data.tournament.id}/settings`}
        class="group rounded-xl border border-border bg-surface-raised p-4 transition hover:border-accent"
      >
        <p class="text-sm font-semibold text-text-primary">Settings</p>
        <p class="mt-1 text-sm text-text-secondary">Update event rules, allowances, and spectator access.</p>
      </a>

      <a
        href={`/manage/tournaments/${data.tournament.id}/overrides`}
        class="group rounded-xl border border-border bg-surface-raised p-4 transition hover:border-accent"
      >
        <p class="text-sm font-semibold text-text-primary">Overrides</p>
        <p class="mt-1 text-sm text-text-secondary">Apply score corrections and manual point adjustments.</p>
      </a>
    </div>
  </section>

  <section class="rounded-2xl border border-border bg-surface p-card-padding shadow-sm">
    <h2 class="text-lg font-semibold text-text-primary">Event code</h2>
    <p class="mt-1 text-sm text-text-secondary">Share this code with players to join.</p>
    <div class="mt-4 rounded-xl border border-border bg-surface-raised px-4 py-5">
      <p
        class="font-mono text-4xl font-semibold tracking-[0.25em] text-text-primary sm:text-5xl"
        aria-label={`Tournament event code ${data.tournament.code}`}
      >
        {data.tournament.code}
      </p>
    </div>
  </section>
</section>
