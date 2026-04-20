<script lang="ts">
  import type { ActionData, PageData } from './$types';

  type FormState = {
    action?: 'updateRound' | 'closeMatch' | 'setTeeTime';
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
      timeStyle: 'short',
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

  function formatTeeTime(time: string): string {
    const parts = /^(\d{1,2}):(\d{2})$/.exec(time);
    if (!parts) return time;
    const hours = parseInt(parts[1], 10);
    const minutes = parts[2];
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    return `${displayHour}:${minutes} ${period}`;
  }
</script>

<svelte:head>
  <title>{data.round.name ?? `Round ${data.round.roundNumber}`} | Golf Manager</title>
</svelte:head>

<section class="space-y-5">
  <header class="space-y-2">
    <a
      href={`/manage/tournaments/${data.tournament.id}/rounds`}
      class="min-h-touch text-text-secondary hover:text-text-primary inline-flex items-center text-sm font-medium"
    >
      ← Back to rounds
    </a>
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-text-primary text-2xl font-semibold tracking-tight">
          {data.round.name ?? `Round ${data.round.roundNumber}`}
        </h1>
        <p class="text-text-secondary text-sm">{data.courseName} · {data.teeName}</p>
      </div>
      <span
        class={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-semibold tracking-wide uppercase ${roundStatusClasses(data.round.status)}`}
      >
        {roundStatusLabel(data.round.status)}
      </span>
    </div>
  </header>

  {#if formState?.success}
    <p
      class="border-status-up/30 bg-status-up/10 text-status-up rounded-lg border px-3 py-2 text-sm font-medium"
    >
      {formState.success}
    </p>
  {/if}

  {#if formState?.error && formState.action === 'updateRound'}
    <p
      class="border-status-down/30 bg-status-down/10 text-status-down rounded-lg border px-3 py-2 text-sm font-medium"
    >
      {formState.error}
    </p>
  {/if}

  <section class="border-border bg-surface space-y-4 rounded-2xl border p-4 shadow-sm sm:p-5">
    <h2 class="text-text-primary text-lg font-semibold">Round info</h2>

    <dl class="text-text-secondary grid gap-2 text-sm sm:grid-cols-2">
      <div>
        <dt class="text-text-primary font-semibold">Scheduled</dt>
        <dd>{formatDateTime(data.round.dateTime)}</dd>
      </div>
      <div>
        <dt class="text-text-primary font-semibold">Round number</dt>
        <dd>{data.round.roundNumber}</dd>
      </div>
    </dl>

    <form
      method="POST"
      action="?/updateRound"
      class="border-border bg-surface-raised grid gap-3 rounded-xl border p-4 sm:grid-cols-2"
    >
      <label class="text-text-primary space-y-1 text-sm">
        <span class="font-medium">Round name</span>
        <input
          name="name"
          type="text"
          bind:value={editName}
          class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
          required
        />
      </label>

      <label class="text-text-primary space-y-1 text-sm">
        <span class="font-medium">Date &amp; time</span>
        <input
          name="dateTime"
          type="datetime-local"
          bind:value={editDateTime}
          class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
          required
        />
      </label>

      <div class="sm:col-span-2">
        <button
          type="submit"
          class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover inline-flex items-center rounded-lg px-4 text-sm font-semibold transition"
        >
          Save round details
        </button>
      </div>
    </form>
  </section>

  <section class="border-border bg-surface space-y-3 rounded-2xl border p-4 shadow-sm sm:p-5">
    <h2 class="text-text-primary text-lg font-semibold">Segments</h2>
    <div class="space-y-2">
      {#each data.round.segments as segment (segment.id)}
        <article
          class="border-border bg-surface-raised text-text-primary rounded-lg border px-3 py-2 text-sm"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-text-primary font-semibold">
              {formatSegment(segment.segment)} · {segment.format}
            </p>
            <p>{formatPoints(segment.pointsAtStake)} pts</p>
          </div>
        </article>
      {/each}
    </div>
  </section>

  <section class="border-border bg-surface space-y-4 rounded-2xl border p-4 shadow-sm sm:p-5">
    <h2 class="text-text-primary text-lg font-semibold">Matches</h2>

    {#if data.matches.length === 0}
      <p
        class="border-border bg-surface-raised text-text-secondary rounded-lg border border-dashed px-3 py-3 text-sm"
      >
        No matches have been created for this round yet.
      </p>
    {:else}
      <div class="space-y-3">
        {#each data.matches as match (match.id)}
          <article class="border-border bg-surface-raised space-y-3 rounded-xl border p-4">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p class="text-text-secondary text-sm font-semibold">Match {match.matchNumber}</p>
                <p class="text-text-primary text-base font-semibold">
                  {match.format ?? 'Format TBD'} · {formatSegment(match.segment)}
                </p>
              </div>
              <span
                class={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-semibold tracking-wide uppercase ${matchStatusClasses(match.status)}`}
              >
                {matchStatusLabel(match.status)}
              </span>
            </div>

            <div class="text-text-primary grid gap-2 text-sm md:grid-cols-2">
              <div class="border-border bg-surface rounded-lg border px-3 py-2">
                <p class="text-text-primary font-semibold">Side A</p>
                <p>{playerNames(sideByLabel(match.sides, 'A'))}</p>
              </div>
              <div class="border-border bg-surface rounded-lg border px-3 py-2">
                <p class="text-text-primary font-semibold">Side B</p>
                <p>{playerNames(sideByLabel(match.sides, 'B'))}</p>
              </div>
            </div>

            <p class="text-text-secondary text-sm">
              Points at stake: {formatPoints(match.pointsAtStake)}
            </p>

            <div class="border-border bg-surface rounded-lg border p-3">
              <p class="text-text-primary mb-2 text-sm font-semibold">
                Tee Time
                {#if match.teeTime}
                  <span class="text-text-secondary ml-1 font-normal">({formatTeeTime(match.teeTime)})</span>
                {/if}
              </p>
              {#if formState?.action === 'setTeeTime' && formState.matchId === match.id && formState.error}
                <p class="border-status-down/30 bg-status-down/10 text-status-down mb-2 rounded border px-2 py-1 text-xs">
                  {formState.error}
                </p>
              {/if}
              {#if formState?.action === 'setTeeTime' && formState.matchId === match.id && formState.success}
                <p class="border-status-up/30 bg-status-up/10 text-status-up mb-2 rounded border px-2 py-1 text-xs">
                  {formState.success}
                </p>
              {/if}
              <form method="POST" action="?/setTeeTime" class="flex items-end gap-2">
                <input type="hidden" name="matchId" value={match.id} />
                <label class="text-text-primary flex-1 space-y-1 text-sm">
                  <span class="sr-only">Tee Time</span>
                  <input
                    name="teeTime"
                    type="time"
                    value={match.teeTime ?? ''}
                    class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-3 text-base transition outline-none focus:ring-1"
                  />
                </label>
                <button
                  type="submit"
                  class="min-h-touch border-border bg-surface hover:bg-surface-raised inline-flex items-center rounded-lg border px-3 text-sm font-medium transition"
                >
                  Save
                </button>
              </form>
            </div>

            {#if formState?.action === 'closeMatch' && formState.matchId === match.id && formState.error}
              <p
                class="border-status-down/30 bg-status-down/10 text-status-down rounded-lg border px-3 py-2 text-sm font-medium"
              >
                {formState.error}
              </p>
            {/if}

            {#if data.round.status !== 'draft' && match.status !== 'FINAL'}
              <form
                method="POST"
                action="?/closeMatch"
                class="border-border bg-surface space-y-3 rounded-lg border p-3"
              >
                <input type="hidden" name="matchId" value={match.id} />
                <div class="grid gap-3 sm:grid-cols-2">
                  <label class="text-text-primary space-y-1 text-sm">
                    <span class="font-medium">Side A points</span>
                    <input
                      name="sideAPoints"
                      type="number"
                      min="0"
                      step="0.5"
                      value={defaultSplitPoints(match.pointsAtStake, 'A')}
                      class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
                      required
                    />
                  </label>

                  <label class="text-text-primary space-y-1 text-sm">
                    <span class="font-medium">Side B points</span>
                    <input
                      name="sideBPoints"
                      type="number"
                      min="0"
                      step="0.5"
                      value={defaultSplitPoints(match.pointsAtStake, 'B')}
                      class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
                      required
                    />
                  </label>
                </div>

                <label class="text-text-primary space-y-1 text-sm">
                  <span class="font-medium">Reason</span>
                  <input
                    name="reason"
                    type="text"
                    minlength="5"
                    placeholder="Reason for manual close"
                    class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
                    required
                  />
                </label>

                <button
                  type="submit"
                  class="min-h-touch border-status-down/30 bg-status-down/10 text-status-down hover:bg-status-down/10 inline-flex items-center rounded-lg border px-4 text-sm font-medium transition"
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
