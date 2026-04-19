<script lang="ts">
  import type { PageData } from './$types';

  export let data: PageData;

  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
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
    <p class="text-text-secondary text-xs font-semibold tracking-[0.2em] uppercase">
      Commissioner Portal
    </p>
    <div class="space-y-2">
      <h1 class="text-text-primary text-2xl font-semibold tracking-tight sm:text-3xl">
        {data.tournament.name}
      </h1>
      <div class="text-text-secondary flex flex-wrap items-center gap-2 text-sm">
        <span
          class="min-h-touch border-border bg-surface-raised text-text-primary inline-flex items-center rounded-lg border px-3 font-mono text-sm font-semibold tracking-[0.18em]"
        >
          {data.tournament.code}
        </span>
        <span aria-hidden="true">-</span>
        <span>{formatDateRange(data.tournament.start_date, data.tournament.end_date)}</span>
      </div>
    </div>
  </header>

  <section class="border-border bg-surface p-card-padding rounded-2xl border shadow-sm">
    <h2 class="text-text-primary text-lg font-semibold">Quick stats</h2>
    <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <article class="border-border bg-surface-raised rounded-xl border p-4">
        <p class="text-text-secondary text-xs font-semibold tracking-wide uppercase">Teams</p>
        <p class="text-text-primary mt-2 text-2xl font-semibold">{data.teams.length}</p>
      </article>

      <article class="border-border bg-surface-raised rounded-xl border p-4">
        <p class="text-text-secondary text-xs font-semibold tracking-wide uppercase">Players</p>
        <p class="text-text-primary mt-2 text-2xl font-semibold">{data.players.length}</p>
      </article>

      <article class="border-border bg-surface-raised rounded-xl border p-4">
        <p class="text-text-secondary text-xs font-semibold tracking-wide uppercase">
          Rounds configured
        </p>
        <p class={`mt-2 text-2xl font-semibold ${roundsStatusClass(data.rounds.length)}`}>
          {data.rounds.length}
        </p>
      </article>
    </div>
  </section>

  <section class="border-border bg-surface p-card-padding rounded-2xl border shadow-sm">
    <h2 class="text-text-primary text-lg font-semibold">Quick links</h2>
    <p class="text-text-secondary mt-1 text-sm">
      Jump into the most common tournament management tasks.
    </p>
    <div class="mt-4 grid gap-3 sm:grid-cols-2">
      <a
        href={`/manage/tournaments/${data.tournament.id}/teams`}
        class="group border-border bg-surface-raised hover:border-accent rounded-xl border p-4 transition"
      >
        <p class="text-text-primary text-sm font-semibold">Teams &amp; Players</p>
        <p class="text-text-secondary mt-1 text-sm">
          Create teams, assign captains, and manage roster entries.
        </p>
      </a>

      <a
        href={`/manage/tournaments/${data.tournament.id}/rounds`}
        class="group border-border bg-surface-raised hover:border-accent rounded-xl border p-4 transition"
      >
        <p class="text-text-primary text-sm font-semibold">Rounds</p>
        <p class="text-text-secondary mt-1 text-sm">
          Build round schedules and configure match formats.
        </p>
      </a>

      <a
        href={`/manage/tournaments/${data.tournament.id}/settings`}
        class="group border-border bg-surface-raised hover:border-accent rounded-xl border p-4 transition"
      >
        <p class="text-text-primary text-sm font-semibold">Settings</p>
        <p class="text-text-secondary mt-1 text-sm">
          Update event rules, allowances, and spectator access.
        </p>
      </a>

      <a
        href={`/manage/tournaments/${data.tournament.id}/overrides`}
        class="group border-border bg-surface-raised hover:border-accent rounded-xl border p-4 transition"
      >
        <p class="text-text-primary text-sm font-semibold">Overrides</p>
        <p class="text-text-secondary mt-1 text-sm">
          Apply score corrections and manual point adjustments.
        </p>
      </a>
    </div>
  </section>

  <section class="border-border bg-surface p-card-padding rounded-2xl border shadow-sm">
    <h2 class="text-text-primary text-lg font-semibold">Event code</h2>
    <p class="text-text-secondary mt-1 text-sm">Share this code with players to join.</p>
    <div class="border-border bg-surface-raised mt-4 rounded-xl border px-4 py-5">
      <p
        class="text-text-primary font-mono text-4xl font-semibold tracking-[0.25em] sm:text-5xl"
        aria-label={`Tournament event code ${data.tournament.code}`}
      >
        {data.tournament.code}
      </p>
    </div>
  </section>
</section>
