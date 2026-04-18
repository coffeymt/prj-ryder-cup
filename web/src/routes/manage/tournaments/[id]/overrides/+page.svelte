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
  let lastToastId = '';
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

  $: if (formState.toast && formState.toast.id !== lastToastId) {
    lastToastId = formState.toast.id;
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
    class={`fixed inset-x-3 bottom-4 z-40 rounded-lg border px-4 py-3 text-sm shadow-lg sm:left-auto sm:right-4 sm:max-w-sm ${
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
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-text-secondary">Commissioner Tools</p>
        <h1 class="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">Overrides</h1>
        <p class="text-sm text-text-secondary sm:text-base">
          Apply score corrections, force-close matches, and post manual point adjustments for
          <span class="font-semibold text-text-primary">{data.tournament.name}</span>.
        </p>
      </div>
      <a
        href={`/manage/tournaments/${data.tournament.id}/audit-log`}
        class="inline-flex min-h-touch items-center rounded-lg border border-border bg-transparent px-4 text-sm font-semibold text-text-primary transition hover:bg-surface-raised"
      >
        View Audit Log
      </a>
    </div>
  </header>

  <section class="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
    <div class="space-y-1">
      <h2 class="text-lg font-semibold text-text-primary">1) Edit a hole score</h2>
      <p class="text-sm text-text-secondary">
        Override a single player score entry for a specific hole. A reason is always required.
      </p>
    </div>

    <form method="POST" action="?/editScore" use:enhance={editEnhance} class="mt-5 space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <label for="edit-match" class="text-sm font-semibold text-text-primary">Match</label>
          <select
            id="edit-match"
            name="matchId"
            bind:value={editMatchId}
            class="mt-2 block min-h-touch w-full rounded-lg border border-border bg-surface px-4 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
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
            <p class="mt-1 text-sm text-status-down">{editErrors.matchId}</p>
          {/if}
        </div>

        <div class="sm:col-span-2">
          <label for="edit-player" class="text-sm font-semibold text-text-primary">Player</label>
          <select
            id="edit-player"
            name="playerId"
            bind:value={editPlayerId}
            disabled={editPlayers.length === 0}
            class="mt-2 block min-h-touch w-full rounded-lg border border-border bg-surface px-4 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent disabled:cursor-not-allowed disabled:bg-surface-raised"
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
            <p class="mt-1 text-sm text-status-down">{editErrors.playerId}</p>
          {/if}
        </div>

        <div>
          <label for="edit-hole-number" class="text-sm font-semibold text-text-primary">Hole number</label>
          <input
            id="edit-hole-number"
            name="holeNumber"
            type="number"
            min="1"
            max="18"
            step="1"
            bind:value={editHoleNumber}
            class="mt-2 block min-h-touch w-full rounded-lg border border-border px-4 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
            aria-invalid={editErrors.holeNumber ? 'true' : undefined}
          />
          {#if editErrors.holeNumber}
            <p class="mt-1 text-sm text-status-down">{editErrors.holeNumber}</p>
          {/if}
        </div>

        <div>
          <label for="edit-gross-strokes" class="text-sm font-semibold text-text-primary">Gross strokes</label>
          <input
            id="edit-gross-strokes"
            name="grossStrokes"
            type="number"
            min="1"
            max="15"
            step="1"
            bind:value={editGrossStrokes}
            disabled={editConceded || editPickedUp}
            class="mt-2 block min-h-touch w-full rounded-lg border border-border px-4 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent disabled:cursor-not-allowed disabled:bg-surface-raised"
            aria-invalid={editErrors.grossStrokes ? 'true' : undefined}
          />
          {#if editErrors.grossStrokes}
            <p class="mt-1 text-sm text-status-down">{editErrors.grossStrokes}</p>
          {/if}
        </div>

        <div class="sm:col-span-2">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label class="inline-flex min-h-touch cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm text-text-primary">
              <input
                type="checkbox"
                name="conceded"
                bind:checked={editConceded}
                on:change={() => {
                  if (editConceded) {
                    editPickedUp = false;
                  }
                }}
                class="h-4 w-4 rounded border-border text-text-primary focus:ring-accent"
              />
              Conceded
            </label>
            <label class="inline-flex min-h-touch cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm text-text-primary">
              <input
                type="checkbox"
                name="pickedUp"
                bind:checked={editPickedUp}
                on:change={() => {
                  if (editPickedUp) {
                    editConceded = false;
                  }
                }}
                class="h-4 w-4 rounded border-border text-text-primary focus:ring-accent"
              />
              Picked up
            </label>
          </div>
          {#if editErrors.flags}
            <p class="mt-1 text-sm text-status-down">{editErrors.flags}</p>
          {/if}
        </div>

        <div class="sm:col-span-2">
          <label for="edit-reason" class="text-sm font-semibold text-text-primary">Reason (min 5 chars)</label>
          <textarea
            id="edit-reason"
            name="reason"
            rows="3"
            bind:value={editReason}
            class="mt-2 w-full rounded-lg border border-border bg-bg px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
            aria-invalid={editErrors.reason ? 'true' : undefined}
            required
          ></textarea>
          {#if editErrors.reason}
            <p class="mt-1 text-sm text-status-down">{editErrors.reason}</p>
          {/if}
        </div>
      </div>

      {#if editErrors.form}
        <p class="rounded-lg border border-status-down/30 bg-status-down/10 px-3 py-2 text-sm text-status-down">{editErrors.form}</p>
      {/if}

      <button
        type="submit"
        disabled={submittingPanel === 'editScore' || !editMatchId || !editPlayerId}
        class="inline-flex min-h-touch w-full items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-text transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {submittingPanel === 'editScore' ? 'Saving override...' : 'Submit score override'}
      </button>
    </form>
  </section>

  <section class="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
    <div class="space-y-1">
      <h2 class="text-lg font-semibold text-text-primary">2) Force-close a match</h2>
      <p class="text-sm text-text-secondary">
        Finalize an open match with commissioner-assigned points. Use only when the normal scoring flow cannot finish.
      </p>
    </div>

    <form method="POST" action="?/forceClose" use:enhance={forceCloseEnhance} class="mt-5 space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <label for="force-match" class="text-sm font-semibold text-text-primary">Open / in-progress match</label>
          <select
            id="force-match"
            name="matchId"
            bind:value={forceCloseMatchId}
            class="mt-2 block min-h-touch w-full rounded-lg border border-border bg-surface px-4 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
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
            <p class="mt-1 text-sm text-status-down">{forceErrors.matchId}</p>
          {/if}
        </div>

        <div>
          <label for="force-side-a" class="text-sm font-semibold text-text-primary">Side A points</label>
          <input
            id="force-side-a"
            name="sideAPoints"
            type="number"
            min="0"
            step="0.5"
            value={forceSideAPoints}
            on:input={(event) => (forceSideAPoints = (event.currentTarget as HTMLInputElement).value)}
            class="mt-2 block min-h-touch w-full rounded-lg border border-border px-4 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
            aria-invalid={forceErrors.sideAPoints ? 'true' : undefined}
          />
          {#if forceErrors.sideAPoints}
            <p class="mt-1 text-sm text-status-down">{forceErrors.sideAPoints}</p>
          {/if}
        </div>

        <div>
          <label for="force-side-b" class="text-sm font-semibold text-text-primary">Side B points</label>
          <input
            id="force-side-b"
            name="sideBPoints"
            type="number"
            min="0"
            step="0.5"
            value={forceSideBPoints}
            on:input={(event) => (forceSideBPoints = (event.currentTarget as HTMLInputElement).value)}
            class="mt-2 block min-h-touch w-full rounded-lg border border-border px-4 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
            aria-invalid={forceErrors.sideBPoints ? 'true' : undefined}
          />
          {#if forceErrors.sideBPoints}
            <p class="mt-1 text-sm text-status-down">{forceErrors.sideBPoints}</p>
          {/if}
        </div>

        {#if forceCloseMatch}
          <div class="sm:col-span-2">
            <p class="text-xs font-medium uppercase tracking-wide text-text-secondary">
              Points at stake: {forceCloseMatch.pointsAtStake}
            </p>
            {#if forcePointsMismatch}
              <p class="mt-2 rounded-lg border border-status-halved/30 bg-status-halved/10 px-3 py-2 text-sm text-status-halved">
                Warning: Side A + Side B does not equal {forceCloseMatch.pointsAtStake}.
              </p>
            {/if}
          </div>
        {/if}

        <div class="sm:col-span-2">
          <label for="force-reason" class="text-sm font-semibold text-text-primary">Reason</label>
          <textarea
            id="force-reason"
            name="reason"
            rows="3"
            bind:value={forceReason}
            class="mt-2 w-full rounded-lg border border-border bg-bg px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
            aria-invalid={forceErrors.reason ? 'true' : undefined}
            required
          ></textarea>
          {#if forceErrors.reason}
            <p class="mt-1 text-sm text-status-down">{forceErrors.reason}</p>
          {/if}
          {#if forceErrors.pointsTotal}
            <p class="mt-1 text-sm text-status-down">{forceErrors.pointsTotal}</p>
          {/if}
        </div>
      </div>

      {#if forceErrors.form}
        <p class="rounded-lg border border-status-down/30 bg-status-down/10 px-3 py-2 text-sm text-status-down">{forceErrors.form}</p>
      {/if}

      <button
        type="submit"
        disabled={submittingPanel === 'forceClose' || !forceCloseMatchId}
        class="inline-flex min-h-touch w-full items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-text transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {submittingPanel === 'forceClose' ? 'Applying force-close...' : 'Submit force-close'}
      </button>
    </form>
  </section>

  <section class="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
    <div class="space-y-1">
      <h2 class="text-lg font-semibold text-text-primary">3) Manual point adjustment</h2>
      <p class="text-sm text-text-secondary">
        Record a positive or negative points delta for a team when a tournament-level correction is required.
      </p>
    </div>

    <form method="POST" action="?/pointsAdjust" use:enhance={pointsAdjustEnhance} class="mt-5 space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <label for="adjust-team" class="text-sm font-semibold text-text-primary">Team</label>
          <select
            id="adjust-team"
            name="teamId"
            bind:value={adjustTeamId}
            class="mt-2 block min-h-touch w-full rounded-lg border border-border bg-surface px-4 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
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
            <p class="mt-1 text-sm text-status-down">{adjustErrors.teamId}</p>
          {/if}
        </div>

        <div class="sm:col-span-2">
          <label for="adjust-delta" class="text-sm font-semibold text-text-primary">Delta</label>
          <input
            id="adjust-delta"
            name="delta"
            type="number"
            step="0.5"
            value={adjustDelta}
            on:input={(event) => (adjustDelta = (event.currentTarget as HTMLInputElement).value)}
            class="mt-2 block min-h-touch w-full rounded-lg border border-border px-4 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent sm:max-w-xs"
            aria-invalid={adjustErrors.delta ? 'true' : undefined}
            placeholder="Example: 1.0 or -0.5"
          />
          {#if adjustErrors.delta}
            <p class="mt-1 text-sm text-status-down">{adjustErrors.delta}</p>
          {/if}
        </div>

        <div class="sm:col-span-2">
          <label for="adjust-reason" class="text-sm font-semibold text-text-primary">Reason</label>
          <textarea
            id="adjust-reason"
            name="reason"
            rows="3"
            bind:value={adjustReason}
            class="mt-2 w-full rounded-lg border border-border bg-bg px-4 py-3 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
            aria-invalid={adjustErrors.reason ? 'true' : undefined}
            required
          ></textarea>
          {#if adjustErrors.reason}
            <p class="mt-1 text-sm text-status-down">{adjustErrors.reason}</p>
          {/if}
        </div>
      </div>

      {#if adjustErrors.form}
        <p class="rounded-lg border border-status-down/30 bg-status-down/10 px-3 py-2 text-sm text-status-down">{adjustErrors.form}</p>
      {/if}

      <button
        type="submit"
        disabled={submittingPanel === 'pointsAdjust' || !adjustTeamId}
        class="inline-flex min-h-touch w-full items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-text transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {submittingPanel === 'pointsAdjust' ? 'Saving adjustment...' : 'Submit point adjustment'}
      </button>
    </form>
  </section>
</section>
