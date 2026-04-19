<script lang="ts">
  import { enhance } from '$app/forms';
  import type { SubmitFunction } from '@sveltejs/kit';
  import { onDestroy } from 'svelte';
  import type { ActionData, PageData } from './$types';

  type Panel = 'editScore' | 'forceClose' | 'pointsAdjust';

  type FormState = {
    panel?: Panel;
    errors?: Record<string, string>;
    toast?: {
      id: string;
      kind: 'success' | 'error';
      message: string;
    };
  };

  export let data: PageData;
  export let form: ActionData;

  let editMatchId = data.matches[0]?.id ?? '';
  let editPlayerId = '';
  let editHoleNumber = '1';
  let editGrossStrokes = '';
  let editConceded = false;
  let editPickedUp = false;
  let editReason = '';

  let forceCloseMatchId = data.matches.find((match) => match.status !== 'FINAL')?.id ?? '';
  let forceSideAPoints = '';
  let forceSideBPoints = '';
  let forceReason = '';

  let adjustTeamId = data.teams[0]?.id ?? '';
  let adjustDelta = '';
  let adjustReason = '';

  let submittingPanel: Panel | null = null;
  let toast: { kind: 'success' | 'error'; message: string } | null = null;
  const shownToastIds = new Set<string>();
  let toastTimeout: ReturnType<typeof setTimeout> | null = null;

  $: formState = (form ?? {}) as FormState;
  $: editErrors = formState.panel === 'editScore' ? (formState.errors ?? {}) : {};
  $: forceErrors = formState.panel === 'forceClose' ? (formState.errors ?? {}) : {};
  $: adjustErrors = formState.panel === 'pointsAdjust' ? (formState.errors ?? {}) : {};

  $: editMatch = data.matches.find((match) => match.id === editMatchId) ?? null;
  $: editPlayers = editMatch?.players ?? [];
  $: if (editPlayers.length === 0) {
    editPlayerId = '';
  } else if (!editPlayers.some((player) => player.id === editPlayerId)) {
    editPlayerId = editPlayers[0].id;
  }

  $: forceCloseMatches = data.matches.filter((match) => match.status !== 'FINAL');
  $: if (forceCloseMatches.length === 0) {
    forceCloseMatchId = '';
  } else if (!forceCloseMatches.some((match) => match.id === forceCloseMatchId)) {
    forceCloseMatchId = forceCloseMatches[0].id;
  }
  $: forceCloseMatch = forceCloseMatches.find((match) => match.id === forceCloseMatchId) ?? null;

  $: if (data.teams.length === 0) {
    adjustTeamId = '';
  } else if (!data.teams.some((team) => team.id === adjustTeamId)) {
    adjustTeamId = data.teams[0].id;
  }

  $: if ((editConceded || editPickedUp) && editGrossStrokes.length > 0) {
    editGrossStrokes = '';
  }

  $: forceSideANumber = toFiniteNumber(forceSideAPoints);
  $: forceSideBNumber = toFiniteNumber(forceSideBPoints);
  $: forcePointsMismatch =
    forceCloseMatch !== null &&
    forceSideANumber !== null &&
    forceSideBNumber !== null &&
    Math.abs(forceSideANumber + forceSideBNumber - forceCloseMatch.pointsAtStake) > 1e-9;

  $: if (formState.toast && !shownToastIds.has(formState.toast.id)) {
    shownToastIds.add(formState.toast.id);
    showToast(formState.toast.kind, formState.toast.message);
  }

  const editEnhance: SubmitFunction = () => {
    submittingPanel = 'editScore';

    return async ({ update }) => {
      submittingPanel = null;
      await update({ reset: false });
    };
  };

  const forceCloseEnhance: SubmitFunction = () => {
    submittingPanel = 'forceClose';

    return async ({ update }) => {
      submittingPanel = null;
      await update({ reset: false });
    };
  };

  const pointsAdjustEnhance: SubmitFunction = () => {
    submittingPanel = 'pointsAdjust';

    return async ({ update }) => {
      submittingPanel = null;
      await update({ reset: false });
    };
  };

  function toFiniteNumber(rawValue: string): number | null {
    const normalized = rawValue.trim();
    if (normalized.length === 0) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatMatchStatus(status: PageData['matches'][number]['status']): string {
    if (status === 'FINAL') {
      return 'Final';
    }

    if (status === 'IN_PROGRESS') {
      return 'In progress';
    }

    return 'Pending';
  }

  function showToast(kind: 'success' | 'error', message: string): void {
    toast = { kind, message };

    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }

    toastTimeout = setTimeout(() => {
      toast = null;
    }, 4500);
  }

  onDestroy(() => {
    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }
  });
</script>

<svelte:head>
  <title>{data.tournament.name} Overrides | Golf Manager</title>
</svelte:head>

{#if toast}
  <div
    class={`fixed inset-x-3 bottom-4 z-40 rounded-lg border px-4 py-3 text-sm shadow-lg sm:right-4 sm:left-auto sm:max-w-sm ${
      toast.kind === 'success'
        ? 'border-status-up/30 bg-status-up/10 text-status-up'
        : 'border-status-down/30 bg-status-down/10 text-status-down'
    }`}
    role="status"
    aria-live="polite"
  >
    {toast.message}
  </div>
{/if}

<section class="mx-auto w-full max-w-5xl space-y-6">
  <header class="space-y-2">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="space-y-2">
        <p class="text-text-secondary text-xs font-semibold tracking-[0.2em] uppercase">
          Commissioner Tools
        </p>
        <h1 class="text-text-primary text-2xl font-semibold tracking-tight sm:text-3xl">
          Overrides
        </h1>
        <p class="text-text-secondary text-sm sm:text-base">
          Apply score corrections, force-close matches, and post manual point adjustments for
          <span class="text-text-primary font-semibold">{data.tournament.name}</span>.
        </p>
      </div>
      <a
        href={`/manage/tournaments/${data.tournament.id}/audit-log`}
        class="min-h-touch border-border text-text-primary hover:bg-surface-raised inline-flex items-center rounded-lg border bg-transparent px-4 text-sm font-semibold transition"
      >
        View Audit Log
      </a>
    </div>
  </header>

  <section class="border-border bg-surface rounded-2xl border p-5 shadow-sm sm:p-6">
    <div class="space-y-1">
      <h2 class="text-text-primary text-lg font-semibold">1) Edit a hole score</h2>
      <p class="text-text-secondary text-sm">
        Override a single player score entry for a specific hole. A reason is always required.
      </p>
    </div>

    <form method="POST" action="?/editScore" use:enhance={editEnhance} class="mt-5 space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <label for="edit-match" class="text-text-primary text-sm font-semibold">Match</label>
          <select
            id="edit-match"
            name="matchId"
            bind:value={editMatchId}
            class="min-h-touch border-border bg-surface text-text-primary focus:border-accent focus:ring-accent mt-2 block w-full rounded-lg border px-4 text-sm transition outline-none focus:ring-1"
            aria-invalid={editErrors.matchId ? 'true' : undefined}
          >
            {#if data.matches.length === 0}
              <option value="">No matches available</option>
            {:else}
              {#each data.matches as match (match.id)}
                <option value={match.id}>{match.label} - {formatMatchStatus(match.status)}</option>
              {/each}
            {/if}
          </select>
          {#if editErrors.matchId}
            <p class="text-status-down mt-1 text-sm">{editErrors.matchId}</p>
          {/if}
        </div>

        <div class="sm:col-span-2">
          <label for="edit-player" class="text-text-primary text-sm font-semibold">Player</label>
          <select
            id="edit-player"
            name="playerId"
            bind:value={editPlayerId}
            disabled={editPlayers.length === 0}
            class="min-h-touch border-border bg-surface text-text-primary focus:border-accent focus:ring-accent disabled:bg-surface-raised mt-2 block w-full rounded-lg border px-4 text-sm transition outline-none focus:ring-1 disabled:cursor-not-allowed"
            aria-invalid={editErrors.playerId ? 'true' : undefined}
          >
            {#if editPlayers.length === 0}
              <option value="">No players in selected match</option>
            {:else}
              {#each editPlayers as player (player.id)}
                <option value={player.id}>{player.name} ({player.teamName})</option>
              {/each}
            {/if}
          </select>
          {#if editErrors.playerId}
            <p class="text-status-down mt-1 text-sm">{editErrors.playerId}</p>
          {/if}
        </div>

        <div>
          <label for="edit-hole-number" class="text-text-primary text-sm font-semibold"
            >Hole number</label
          >
          <input
            id="edit-hole-number"
            name="holeNumber"
            type="number"
            min="1"
            max="18"
            step="1"
            bind:value={editHoleNumber}
            class="min-h-touch border-border text-text-primary focus:border-accent focus:ring-accent mt-2 block w-full rounded-lg border px-4 text-sm transition outline-none focus:ring-1"
            aria-invalid={editErrors.holeNumber ? 'true' : undefined}
          />
          {#if editErrors.holeNumber}
            <p class="text-status-down mt-1 text-sm">{editErrors.holeNumber}</p>
          {/if}
        </div>

        <div>
          <label for="edit-gross-strokes" class="text-text-primary text-sm font-semibold"
            >Gross strokes</label
          >
          <input
            id="edit-gross-strokes"
            name="grossStrokes"
            type="number"
            min="1"
            max="15"
            step="1"
            bind:value={editGrossStrokes}
            disabled={editConceded || editPickedUp}
            class="min-h-touch border-border text-text-primary focus:border-accent focus:ring-accent disabled:bg-surface-raised mt-2 block w-full rounded-lg border px-4 text-sm transition outline-none focus:ring-1 disabled:cursor-not-allowed"
            aria-invalid={editErrors.grossStrokes ? 'true' : undefined}
          />
          {#if editErrors.grossStrokes}
            <p class="text-status-down mt-1 text-sm">{editErrors.grossStrokes}</p>
          {/if}
        </div>

        <div class="sm:col-span-2">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label
              class="min-h-touch border-border text-text-primary inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm"
            >
              <input
                type="checkbox"
                name="conceded"
                bind:checked={editConceded}
                on:change={() => {
                  if (editConceded) {
                    editPickedUp = false;
                  }
                }}
                class="border-border text-text-primary focus:ring-accent h-4 w-4 rounded"
              />
              Conceded
            </label>
            <label
              class="min-h-touch border-border text-text-primary inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm"
            >
              <input
                type="checkbox"
                name="pickedUp"
                bind:checked={editPickedUp}
                on:change={() => {
                  if (editPickedUp) {
                    editConceded = false;
                  }
                }}
                class="border-border text-text-primary focus:ring-accent h-4 w-4 rounded"
              />
              Picked up
            </label>
          </div>
          {#if editErrors.flags}
            <p class="text-status-down mt-1 text-sm">{editErrors.flags}</p>
          {/if}
        </div>

        <div class="sm:col-span-2">
          <label for="edit-reason" class="text-text-primary text-sm font-semibold"
            >Reason (min 5 chars)</label
          >
          <textarea
            id="edit-reason"
            name="reason"
            rows="3"
            bind:value={editReason}
            class="border-border bg-bg text-text-primary focus:border-accent focus:ring-accent mt-2 w-full rounded-lg border px-4 py-3 text-sm transition outline-none focus:ring-1"
            aria-invalid={editErrors.reason ? 'true' : undefined}
            required
          ></textarea>
          {#if editErrors.reason}
            <p class="text-status-down mt-1 text-sm">{editErrors.reason}</p>
          {/if}
        </div>
      </div>

      {#if editErrors.form}
        <p
          class="border-status-down/30 bg-status-down/10 text-status-down rounded-lg border px-3 py-2 text-sm"
        >
          {editErrors.form}
        </p>
      {/if}

      <button
        type="submit"
        disabled={submittingPanel === 'editScore' || !editMatchId || !editPlayerId}
        class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover inline-flex w-full items-center justify-center rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {submittingPanel === 'editScore' ? 'Saving override...' : 'Submit score override'}
      </button>
    </form>
  </section>

  <section class="border-border bg-surface rounded-2xl border p-5 shadow-sm sm:p-6">
    <div class="space-y-1">
      <h2 class="text-text-primary text-lg font-semibold">2) Force-close a match</h2>
      <p class="text-text-secondary text-sm">
        Finalize an open match with commissioner-assigned points. Use only when the normal scoring
        flow cannot finish.
      </p>
    </div>

    <form
      method="POST"
      action="?/forceClose"
      use:enhance={forceCloseEnhance}
      class="mt-5 space-y-4"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <label for="force-match" class="text-text-primary text-sm font-semibold"
            >Open / in-progress match</label
          >
          <select
            id="force-match"
            name="matchId"
            bind:value={forceCloseMatchId}
            class="min-h-touch border-border bg-surface text-text-primary focus:border-accent focus:ring-accent mt-2 block w-full rounded-lg border px-4 text-sm transition outline-none focus:ring-1"
            aria-invalid={forceErrors.matchId ? 'true' : undefined}
          >
            {#if forceCloseMatches.length === 0}
              <option value="">No open matches</option>
            {:else}
              {#each forceCloseMatches as match (match.id)}
                <option value={match.id}>{match.label}</option>
              {/each}
            {/if}
          </select>
          {#if forceErrors.matchId}
            <p class="text-status-down mt-1 text-sm">{forceErrors.matchId}</p>
          {/if}
        </div>

        <div>
          <label for="force-side-a" class="text-text-primary text-sm font-semibold"
            >Side A points</label
          >
          <input
            id="force-side-a"
            name="sideAPoints"
            type="number"
            min="0"
            step="0.5"
            value={forceSideAPoints}
            on:input={(event) =>
              (forceSideAPoints = (event.currentTarget as HTMLInputElement).value)}
            class="min-h-touch border-border text-text-primary focus:border-accent focus:ring-accent mt-2 block w-full rounded-lg border px-4 text-sm transition outline-none focus:ring-1"
            aria-invalid={forceErrors.sideAPoints ? 'true' : undefined}
          />
          {#if forceErrors.sideAPoints}
            <p class="text-status-down mt-1 text-sm">{forceErrors.sideAPoints}</p>
          {/if}
        </div>

        <div>
          <label for="force-side-b" class="text-text-primary text-sm font-semibold"
            >Side B points</label
          >
          <input
            id="force-side-b"
            name="sideBPoints"
            type="number"
            min="0"
            step="0.5"
            value={forceSideBPoints}
            on:input={(event) =>
              (forceSideBPoints = (event.currentTarget as HTMLInputElement).value)}
            class="min-h-touch border-border text-text-primary focus:border-accent focus:ring-accent mt-2 block w-full rounded-lg border px-4 text-sm transition outline-none focus:ring-1"
            aria-invalid={forceErrors.sideBPoints ? 'true' : undefined}
          />
          {#if forceErrors.sideBPoints}
            <p class="text-status-down mt-1 text-sm">{forceErrors.sideBPoints}</p>
          {/if}
        </div>

        {#if forceCloseMatch}
          <div class="sm:col-span-2">
            <p class="text-text-secondary text-xs font-medium tracking-wide uppercase">
              Points at stake: {forceCloseMatch.pointsAtStake}
            </p>
            {#if forcePointsMismatch}
              <p
                class="border-status-halved/30 bg-status-halved/10 text-status-halved mt-2 rounded-lg border px-3 py-2 text-sm"
              >
                Warning: Side A + Side B does not equal {forceCloseMatch.pointsAtStake}.
              </p>
            {/if}
          </div>
        {/if}

        <div class="sm:col-span-2">
          <label for="force-reason" class="text-text-primary text-sm font-semibold">Reason</label>
          <textarea
            id="force-reason"
            name="reason"
            rows="3"
            bind:value={forceReason}
            class="border-border bg-bg text-text-primary focus:border-accent focus:ring-accent mt-2 w-full rounded-lg border px-4 py-3 text-sm transition outline-none focus:ring-1"
            aria-invalid={forceErrors.reason ? 'true' : undefined}
            required
          ></textarea>
          {#if forceErrors.reason}
            <p class="text-status-down mt-1 text-sm">{forceErrors.reason}</p>
          {/if}
          {#if forceErrors.pointsTotal}
            <p class="text-status-down mt-1 text-sm">{forceErrors.pointsTotal}</p>
          {/if}
        </div>
      </div>

      {#if forceErrors.form}
        <p
          class="border-status-down/30 bg-status-down/10 text-status-down rounded-lg border px-3 py-2 text-sm"
        >
          {forceErrors.form}
        </p>
      {/if}

      <button
        type="submit"
        disabled={submittingPanel === 'forceClose' || !forceCloseMatchId}
        class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover inline-flex w-full items-center justify-center rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {submittingPanel === 'forceClose' ? 'Applying force-close...' : 'Submit force-close'}
      </button>
    </form>
  </section>

  <section class="border-border bg-surface rounded-2xl border p-5 shadow-sm sm:p-6">
    <div class="space-y-1">
      <h2 class="text-text-primary text-lg font-semibold">3) Manual point adjustment</h2>
      <p class="text-text-secondary text-sm">
        Record a positive or negative points delta for a team when a tournament-level correction is
        required.
      </p>
    </div>

    <form
      method="POST"
      action="?/pointsAdjust"
      use:enhance={pointsAdjustEnhance}
      class="mt-5 space-y-4"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <label for="adjust-team" class="text-text-primary text-sm font-semibold">Team</label>
          <select
            id="adjust-team"
            name="teamId"
            bind:value={adjustTeamId}
            class="min-h-touch border-border bg-surface text-text-primary focus:border-accent focus:ring-accent mt-2 block w-full rounded-lg border px-4 text-sm transition outline-none focus:ring-1"
            aria-invalid={adjustErrors.teamId ? 'true' : undefined}
          >
            {#if data.teams.length === 0}
              <option value="">No teams available</option>
            {:else}
              {#each data.teams as team (team.id)}
                <option value={team.id}>{team.name}</option>
              {/each}
            {/if}
          </select>
          {#if adjustErrors.teamId}
            <p class="text-status-down mt-1 text-sm">{adjustErrors.teamId}</p>
          {/if}
        </div>

        <div class="sm:col-span-2">
          <label for="adjust-delta" class="text-text-primary text-sm font-semibold">Delta</label>
          <input
            id="adjust-delta"
            name="delta"
            type="number"
            step="0.5"
            value={adjustDelta}
            on:input={(event) => (adjustDelta = (event.currentTarget as HTMLInputElement).value)}
            class="min-h-touch border-border text-text-primary focus:border-accent focus:ring-accent mt-2 block w-full rounded-lg border px-4 text-sm transition outline-none focus:ring-1 sm:max-w-xs"
            aria-invalid={adjustErrors.delta ? 'true' : undefined}
            placeholder="Example: 1.0 or -0.5"
          />
          {#if adjustErrors.delta}
            <p class="text-status-down mt-1 text-sm">{adjustErrors.delta}</p>
          {/if}
        </div>

        <div class="sm:col-span-2">
          <label for="adjust-reason" class="text-text-primary text-sm font-semibold">Reason</label>
          <textarea
            id="adjust-reason"
            name="reason"
            rows="3"
            bind:value={adjustReason}
            class="border-border bg-bg text-text-primary focus:border-accent focus:ring-accent mt-2 w-full rounded-lg border px-4 py-3 text-sm transition outline-none focus:ring-1"
            aria-invalid={adjustErrors.reason ? 'true' : undefined}
            required
          ></textarea>
          {#if adjustErrors.reason}
            <p class="text-status-down mt-1 text-sm">{adjustErrors.reason}</p>
          {/if}
        </div>
      </div>

      {#if adjustErrors.form}
        <p
          class="border-status-down/30 bg-status-down/10 text-status-down rounded-lg border px-3 py-2 text-sm"
        >
          {adjustErrors.form}
        </p>
      {/if}

      <button
        type="submit"
        disabled={submittingPanel === 'pointsAdjust' || !adjustTeamId}
        class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover inline-flex w-full items-center justify-center rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {submittingPanel === 'pointsAdjust' ? 'Saving adjustment...' : 'Submit point adjustment'}
      </button>
    </form>
  </section>
</section>
