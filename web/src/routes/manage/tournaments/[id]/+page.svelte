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

</script>

<svelte:head>
  <title>{data.tournament.name} Overview | Golf Manager</title>
</svelte:head>

<section class="mx-auto w-full max-w-3xl space-y-8 animate-fade-in">
  <header class="space-y-3">
    <p class="text-text-secondary text-xs font-semibold tracking-[0.2em] uppercase">
      Commissioner Portal
    </p>
    <div class="space-y-2">
      <h1 class="font-display text-text-primary text-2xl font-bold tracking-tight sm:text-3xl">
        {data.tournament.name}
      </h1>
      <div class="text-text-secondary flex flex-wrap items-center gap-2 text-sm">
        <span
          class="border-border bg-surface-raised text-text-primary inline-flex h-8 items-center rounded-full border px-3 font-mono text-sm font-semibold tracking-[0.18em] shadow-sm"
        >
          {data.tournament.code}
        </span>
        <span aria-hidden="true" class="text-text-muted">&bull;</span>
        <span class="font-medium">{formatDateRange(data.tournament.start_date, data.tournament.end_date)}</span>
      </div>
    </div>
  </header>

  <section>
    <h2 class="font-display text-text-primary mb-4 text-lg font-semibold">Overview</h2>
    <div class="grid gap-4 sm:grid-cols-3">
      <article class="bg-surface-raised rounded-2xl shadow-sm p-5 border border-border">
        <p class="text-text-muted text-xs font-semibold tracking-wider uppercase mb-2">Teams</p>
        <p class={`font-display text-3xl font-bold ${data.teams.length > 0 ? 'text-text-primary' : 'text-text-muted'}`}>
          {data.teams.length}
        </p>
      </article>

      <article class="bg-surface-raised rounded-2xl shadow-sm p-5 border border-border">
        <p class="text-text-muted text-xs font-semibold tracking-wider uppercase mb-2">Players</p>
        <p class={`font-display text-3xl font-bold ${data.players.length > 0 ? 'text-text-primary' : 'text-text-muted'}`}>
          {data.players.length}
        </p>
      </article>

      <article class="bg-surface-raised rounded-2xl shadow-sm p-5 border border-border">
        <p class="text-text-muted text-xs font-semibold tracking-wider uppercase mb-2">
          Rounds
        </p>
        <p class={`font-display text-3xl font-bold ${data.rounds.length > 0 ? 'text-status-up' : 'text-text-muted'}`}>
          {data.rounds.length}
        </p>
      </article>
    </div>
  </section>

  <section>
    <div class="mb-4">
      <h2 class="font-display text-text-primary text-lg font-semibold">Tournament Management</h2>
      <p class="text-text-secondary mt-1 text-sm">
        Configure and manage your event.
      </p>
    </div>
    <div class="grid gap-3 sm:grid-cols-2">
      <a
        href={`/manage/tournaments/${data.tournament.id}/teams`}
        class="group bg-surface rounded-xl border border-border p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-base ease-standard flex items-start gap-4"
      >
        <div class="text-2xl" aria-hidden="true">👥</div>
        <div class="flex-1">
          <p class="text-text-primary text-sm font-semibold flex items-center justify-between">
            Teams &amp; Players
            <span class="text-text-muted group-hover:text-accent transition-colors">&rarr;</span>
          </p>
          <p class="text-text-secondary mt-1 text-sm">
            Create teams, assign captains, and manage roster entries.
          </p>
        </div>
      </a>

      <a
        href={`/manage/tournaments/${data.tournament.id}/rounds`}
        class="group bg-surface rounded-xl border border-border p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-base ease-standard flex items-start gap-4"
      >
        <div class="text-2xl" aria-hidden="true">⛳</div>
        <div class="flex-1">
          <p class="text-text-primary text-sm font-semibold flex items-center justify-between">
            Rounds
            <span class="text-text-muted group-hover:text-accent transition-colors">&rarr;</span>
          </p>
          <p class="text-text-secondary mt-1 text-sm">
            Build round schedules and configure match formats.
          </p>
        </div>
      </a>

      <a
        href={`/manage/tournaments/${data.tournament.id}/settings`}
        class="group bg-surface rounded-xl border border-border p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-base ease-standard flex items-start gap-4"
      >
        <div class="text-2xl" aria-hidden="true">⚙️</div>
        <div class="flex-1">
          <p class="text-text-primary text-sm font-semibold flex items-center justify-between">
            Settings
            <span class="text-text-muted group-hover:text-accent transition-colors">&rarr;</span>
          </p>
          <p class="text-text-secondary mt-1 text-sm">
            Update event rules, allowances, and spectator access.
          </p>
        </div>
      </a>

      <a
        href={`/manage/tournaments/${data.tournament.id}/overrides`}
        class="group bg-surface rounded-xl border border-border p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-base ease-standard flex items-start gap-4"
      >
        <div class="text-2xl" aria-hidden="true">✏️</div>
        <div class="flex-1">
          <p class="text-text-primary text-sm font-semibold flex items-center justify-between">
            Overrides
            <span class="text-text-muted group-hover:text-accent transition-colors">&rarr;</span>
          </p>
          <p class="text-text-secondary mt-1 text-sm">
            Apply score corrections and manual point adjustments.
          </p>
        </div>
      </a>
    </div>
  </section>

  <section class="bg-accent-soft border-accent/20 rounded-2xl border p-card-padding shadow-sm sm:p-6 text-center">
    <h2 class="font-display text-text-primary text-lg font-semibold">Invite Players</h2>
    <p class="text-text-secondary mt-1 text-sm mb-4">Share this code with players so they can join the tournament.</p>
    <div class="bg-surface inline-block rounded-xl border border-border px-6 py-4 shadow-inner group cursor-pointer hover:border-accent transition-colors">
      <p
        class="text-text-primary font-mono text-4xl font-bold tracking-[0.25em] sm:text-5xl group-hover:text-accent transition-colors"
        aria-label={`Tournament event code ${data.tournament.code}`}
      >
        {data.tournament.code}
      </p>
    </div>
    <p class="text-text-muted mt-3 text-xs uppercase tracking-wide font-semibold">Code is ready to share</p>
  </section>
</section>
