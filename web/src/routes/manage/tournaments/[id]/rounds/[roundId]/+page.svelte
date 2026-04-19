<script lang="ts">
  import type { ActionData, PageData } from './$types';

  type FormState = {
    action?: 'updateRound' | 'closeMatch';
    error?: string;
    success?: string;
    matchId?: string;
  };

  export let data: PageData;
  export let form: ActionData | undefined;

  let formState: FormState | undefined;
  $: formState = form as FormState | undefined;

  let editName = data.round.name ?? `Round ${data.round.roundNumber}`;
  let editDateTime = toInputDateTime(data.round.dateTime);

  $: if (formState?.action !== 'updateRound' || !formState.error) {
    editName = data.round.name ?? `Round ${data.round.roundNumber}`;
    editDateTime = toInputDateTime(data.round.dateTime);
  }

  function toInputDateTime(value: string): string {
    const parsed = Date.parse(value);

    if (Number.isNaN(parsed)) {
      return '';
    }

    const date = new Date(parsed);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hour}:${minute}`;
  }

  function formatDateTime(value: string): string {
    const parsed = Date.parse(value);

    if (Number.isNaN(parsed)) {
      return value;
    }

    return new Date(parsed).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }

  function formatPoints(value: number | null): string {
    if (value === null) {
      return '-';
    }

    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  function roundStatusLabel(status: 'draft' | 'inProgress' | 'complete'): string {
    if (status === 'inProgress') {
      return 'In Progress';
    }

    if (status === 'complete') {
      return 'Complete';
    }

    return 'Draft';
  }

  function roundStatusClasses(status: 'draft' | 'inProgress' | 'complete'): string {
    if (status === 'inProgress') {
      return 'border-status-halved/30 bg-status-halved/10 text-status-halved';
    }

    if (status === 'complete') {
      return 'border-status-up/30 bg-status-up/10 text-status-up';
    }

    return 'border-border bg-surface-raised text-text-secondary';
  }

  function matchStatusLabel(status: 'PENDING' | 'IN_PROGRESS' | 'FINAL'): string {
    if (status === 'IN_PROGRESS') {
      return 'In Progress';
    }

    if (status === 'FINAL') {
      return 'Final';
    }

    return 'Pending';
  }

  function matchStatusClasses(status: 'PENDING' | 'IN_PROGRESS' | 'FINAL'): string {
    if (status === 'IN_PROGRESS') {
      return 'border-status-halved/30 bg-status-halved/10 text-status-halved';
    }

    if (status === 'FINAL') {
      return 'border-status-up/30 bg-status-up/10 text-status-up';
    }

    return 'border-border bg-surface-raised text-text-secondary';
  }

  function formatSegment(segment: 'F9' | 'B9' | '18' | null): string {
    if (!segment) {
      return 'Unknown segment';
    }

    if (segment === '18') {
      return 'Overall 18';
    }

    return segment;
  }

  function sideByLabel(
    sides: PageData['matches'][number]['sides'],
    label: 'A' | 'B'
  ): PageData['matches'][number]['sides'][number] | null {
    return sides.find((side) => side.sideLabel === label) ?? null;
  }

  function playerNames(side: PageData['matches'][number]['sides'][number] | null): string {
    if (!side || side.players.length === 0) {
      return 'No players assigned';
    }

    return side.players.map((player) => player.name).join(' / ');
  }

  function defaultSplitPoints(pointsAtStake: number | null, side: 'A' | 'B'): string {
    if (pointsAtStake === null) {
      return side === 'A' ? '0' : '0';
    }

    const half = pointsAtStake / 2;
    return Number.isInteger(half) ? String(half) : half.toFixed(1);
  }
</script>

<svelte:head>
  <title>{data.round.name ?? `Round ${data.round.roundNumber}`} | Golf Manager</title>
</svelte:head>

<section class="space-y-5">
  <header class="space-y-2">
    <a
      href={`/manage/tournaments/${data.tournament.id}/rounds`}
      class="inline-flex min-h-touch items-center text-sm font-medium text-text-secondary hover:text-text-primary"
    >
      ← Back to rounds
    </a>
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-text-primary">
          {data.round.name ?? `Round ${data.round.roundNumber}`}
        </h1>
        <p class="text-sm text-text-secondary">{data.courseName} · {data.teeName}</p>
      </div>
      <span
        class={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-semibold uppercase tracking-wide ${roundStatusClasses(data.round.status)}`}
      >
        {roundStatusLabel(data.round.status)}
      </span>
    </div>
  </header>

  {#if formState?.success}
    <p class="rounded-lg border border-status-up/30 bg-status-up/10 px-3 py-2 text-sm font-medium text-status-up">
      {formState.success}
    </p>
  {/if}

  {#if formState?.error && formState.action === 'updateRound'}
    <p class="rounded-lg border border-status-down/30 bg-status-down/10 px-3 py-2 text-sm font-medium text-status-down">
      {formState.error}
    </p>
  {/if}

  <section class="space-y-4 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
    <h2 class="text-lg font-semibold text-text-primary">Round info</h2>

    <dl class="grid gap-2 text-sm text-text-secondary sm:grid-cols-2">
      <div>
        <dt class="font-semibold text-text-primary">Scheduled</dt>
        <dd>{formatDateTime(data.round.dateTime)}</dd>
      </div>
      <div>
        <dt class="font-semibold text-text-primary">Round number</dt>
        <dd>{data.round.roundNumber}</dd>
      </div>
    </dl>

    <form method="POST" action="?/updateRound" class="grid gap-3 rounded-xl border border-border bg-surface-raised p-4 sm:grid-cols-2">
      <label class="space-y-1 text-sm text-text-primary">
        <span class="font-medium">Round name</span>
        <input
          name="name"
          type="text"
          bind:value={editName}
          class="min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
          required
        />
      </label>

      <label class="space-y-1 text-sm text-text-primary">
        <span class="font-medium">Date &amp; time</span>
        <input
          name="dateTime"
          type="datetime-local"
          bind:value={editDateTime}
          class="min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
          required
        />
      </label>

      <div class="sm:col-span-2">
        <button
          type="submit"
          class="inline-flex min-h-touch items-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-text transition hover:bg-accent-hover"
        >
          Save round details
        </button>
      </div>
    </form>
  </section>

  <section class="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
    <h2 class="text-lg font-semibold text-text-primary">Segments</h2>
    <div class="space-y-2">
      {#each data.round.segments as segment (segment.id)}
        <article class="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="font-semibold text-text-primary">{formatSegment(segment.segment)} · {segment.format}</p>
            <p>{formatPoints(segment.pointsAtStake)} pts</p>
          </div>
        </article>
      {/each}
    </div>
  </section>

  <section class="space-y-4 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
    <h2 class="text-lg font-semibold text-text-primary">Matches</h2>

    {#if data.matches.length === 0}
      <p class="rounded-lg border border-dashed border-border bg-surface-raised px-3 py-3 text-sm text-text-secondary">
        No matches have been created for this round yet.
      </p>
    {:else}
      <div class="space-y-3">
        {#each data.matches as match (match.id)}
          <article class="space-y-3 rounded-xl border border-border bg-surface-raised p-4">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p class="text-sm font-semibold text-text-secondary">Match {match.matchNumber}</p>
                <p class="text-base font-semibold text-text-primary">
                  {match.format ?? 'Format TBD'} · {formatSegment(match.segment)}
                </p>
              </div>
              <span
                class={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-semibold uppercase tracking-wide ${matchStatusClasses(match.status)}`}
              >
                {matchStatusLabel(match.status)}
              </span>
            </div>

            <div class="grid gap-2 text-sm text-text-primary md:grid-cols-2">
              <div class="rounded-lg border border-border bg-surface px-3 py-2">
                <p class="font-semibold text-text-primary">Side A</p>
                <p>{playerNames(sideByLabel(match.sides, 'A'))}</p>
              </div>
              <div class="rounded-lg border border-border bg-surface px-3 py-2">
                <p class="font-semibold text-text-primary">Side B</p>
                <p>{playerNames(sideByLabel(match.sides, 'B'))}</p>
              </div>
            </div>

            <p class="text-sm text-text-secondary">Points at stake: {formatPoints(match.pointsAtStake)}</p>

            {#if formState?.action === 'closeMatch' && formState.matchId === match.id && formState.error}
              <p class="rounded-lg border border-status-down/30 bg-status-down/10 px-3 py-2 text-sm font-medium text-status-down">
                {formState.error}
              </p>
            {/if}

            {#if data.round.status !== 'draft' && match.status !== 'FINAL'}
              <form method="POST" action="?/closeMatch" class="space-y-3 rounded-lg border border-border bg-surface p-3">
                <input type="hidden" name="matchId" value={match.id} />
                <div class="grid gap-3 sm:grid-cols-2">
                  <label class="space-y-1 text-sm text-text-primary">
                    <span class="font-medium">Side A points</span>
                    <input
                      name="sideAPoints"
                      type="number"
                      min="0"
                      step="0.5"
                      value={defaultSplitPoints(match.pointsAtStake, 'A')}
                      class="min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                      required
                    />
                  </label>

                  <label class="space-y-1 text-sm text-text-primary">
                    <span class="font-medium">Side B points</span>
                    <input
                      name="sideBPoints"
                      type="number"
                      min="0"
                      step="0.5"
                      value={defaultSplitPoints(match.pointsAtStake, 'B')}
                      class="min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                      required
                    />
                  </label>
                </div>

                <label class="space-y-1 text-sm text-text-primary">
                  <span class="font-medium">Reason</span>
                  <input
                    name="reason"
                    type="text"
                    minlength="5"
                    placeholder="Reason for manual close"
                    class="min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                    required
                  />
                </label>

                <button
                  type="submit"
                  class="inline-flex min-h-touch items-center rounded-lg border border-status-down/30 bg-status-down/10 px-4 text-sm font-medium text-status-down transition hover:bg-status-down/10"
                >
                  Manually close match
                </button>
              </form>
            {/if}
          </article>
        {/each}
      </div>
    {/if}
  </section>
</section>
