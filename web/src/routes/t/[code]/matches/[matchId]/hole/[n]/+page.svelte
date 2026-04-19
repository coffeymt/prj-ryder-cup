<script lang="ts">
  import { goto } from '$app/navigation';
  import { outbox } from '$lib/outbox/useOutbox';
  import FormatInterstitial from '$lib/ui/FormatInterstitial.svelte';
  import HoleStepper from '$lib/ui/HoleStepper.svelte';
  import MatchStatusHeader from '$lib/ui/MatchStatusHeader.svelte';
  import StrokeDots from '$lib/ui/StrokeDots.svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  type RowDraft = PageData['players'][number] & {
    grossStrokes: number;
    conceded: boolean;
    pickedUp: boolean;
  };

  let rows: RowDraft[] = data.players.map((playerRow) => ({
    ...playerRow,
    grossStrokes: playerRow.currentScore?.grossStrokes ?? data.par,
    conceded: playerRow.currentScore?.conceded ?? false,
    pickedUp: playerRow.currentScore?.pickedUp ?? false,
  }));
  let isSaving = false;
  let errorMessage = '';
  let showInterstitial = data.isFormatChangeHole;

  $: basePath = `/t/${encodeURIComponent(data.tournament.code)}/matches/${encodeURIComponent(data.match.id)}`;
  $: backHref = data.holeNumber > 1 ? `${basePath}/hole/${data.holeNumber - 1}` : basePath;

  function teamStyle(color: string): string {
    return `--team-color: ${color};`;
  }

  function updateGross(rowId: string, nextGross: number): void {
    rows = rows.map((row) => (row.id === rowId ? { ...row, grossStrokes: nextGross } : row));
  }

  function toggleConceded(rowId: string): void {
    rows = rows.map((row) =>
      row.id === rowId
        ? {
            ...row,
            conceded: !row.conceded,
            pickedUp: row.conceded ? row.pickedUp : false,
          }
        : row
    );
  }

  function togglePickedUp(rowId: string): void {
    rows = rows.map((row) =>
      row.id === rowId
        ? {
            ...row,
            pickedUp: !row.pickedUp,
            conceded: row.pickedUp ? row.conceded : false,
          }
        : row
    );
  }

  async function submitHoleScore(row: RowDraft): Promise<void> {
    await outbox.submitScore(`/api/matches/${encodeURIComponent(data.match.id)}/holes`, {
      playerId: row.submitPlayerId,
      holeNumber: data.holeNumber,
      grossStrokes: row.conceded || row.pickedUp ? null : row.grossStrokes,
      conceded: row.conceded,
      pickedUp: row.pickedUp,
    });
  }

  async function saveAndNext(): Promise<void> {
    if (isSaving) {
      return;
    }

    errorMessage = '';
    isSaving = true;

    try {
      for (const row of rows) {
        await submitHoleScore(row);
      }

      const nextHole = data.holeNumber + 1;

      if (nextHole > data.match.totalHoles) {
        await goto(basePath);
        return;
      }

      await goto(`${basePath}/hole/${nextHole}`);
    } catch (submitError) {
      const fallbackMessage = 'Could not save this hole. Please try again.';
      errorMessage = submitError instanceof Error ? submitError.message : fallbackMessage;
    } finally {
      isSaving = false;
    }
  }
</script>

<svelte:head>
  <title>Match {data.match.id} · Hole {data.holeNumber}</title>
</svelte:head>

<FormatInterstitial
  show={showInterstitial}
  newFormat={data.segmentFormat}
  segment={data.segmentLabel.split(' — ')[0] ?? 'Next segment'}
  onContinue={() => (showInterstitial = false)}
/>

<div class="space-y-4 pb-8">
  <MatchStatusHeader
    matchState={data.matchState}
    teamAName={data.match.teamAName}
    teamBName={data.match.teamBName}
    teamAColor={data.match.teamAColor}
    teamBColor={data.match.teamBColor}
  />

  <section class="border-border bg-surface p-card-padding rounded-2xl border shadow-sm">
    <p class="text-text-muted text-xs font-semibold tracking-[0.2em] uppercase">
      {data.segmentLabel}
    </p>
    <h1 class="font-display text-text-primary mt-1 text-2xl font-semibold tracking-tight">
      Hole {data.holeNumber}
      <span class="text-text-secondary text-base font-medium">
        · Par {data.par} · SI {data.strokeIndex}</span
      >
    </h1>
  </section>

  <section class="space-y-3">
    {#each rows as row (row.id)}
      <article
        class="border-border bg-surface p-card-padding space-y-3 rounded-2xl border shadow-sm"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p
              class="text-text-primary flex items-center gap-2 text-base font-semibold"
              style={teamStyle(row.player.teamColor)}
            >
              <span
                class="border-border h-2.5 w-2.5 shrink-0 rounded-full border bg-[var(--team-color)]"
                aria-hidden="true"
              ></span>
              <span class="truncate">{row.player.name}</span>
            </p>
            <p class="text-text-secondary text-sm">
              {#if row.isTeamEntry}
                {row.teammateNames.join(' / ')}
              {:else}
                {row.player.teamName}
              {/if}
            </p>
            {#if row.player.courseHandicap !== null}
              <p class="text-text-muted text-xs">
                Course HCP {row.player.courseHandicap.toFixed(1)}
              </p>
            {/if}
          </div>
          <StrokeDots strokes={row.strokesOnHole} />
        </div>

        <HoleStepper
          value={row.grossStrokes}
          min={1}
          max={15}
          par={data.par}
          onChange={(nextValue) => updateGross(row.id, nextValue)}
        />

        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            class={`min-h-touch rounded-lg border px-3 text-sm font-semibold transition ${
              row.conceded
                ? 'border-status-down bg-surface-raised text-status-down'
                : 'border-border bg-surface-raised text-text-primary hover:bg-surface'
            }`}
            aria-pressed={row.conceded}
            on:click={() => toggleConceded(row.id)}
          >
            Concede
          </button>
          <button
            type="button"
            class={`min-h-touch rounded-lg border px-3 text-sm font-semibold transition ${
              row.pickedUp
                ? 'border-status-halved bg-surface-raised text-status-halved'
                : 'border-border bg-surface-raised text-text-primary hover:bg-surface'
            }`}
            aria-pressed={row.pickedUp}
            on:click={() => togglePickedUp(row.id)}
          >
            Picked Up
          </button>
        </div>
      </article>
    {/each}
  </section>

  <div class="grid grid-cols-2 gap-2">
    <a
      href={backHref}
      class="min-h-touch border-border text-text-primary hover:bg-surface-raised inline-flex items-center justify-center rounded-lg border bg-transparent px-4 text-sm font-semibold transition"
    >
      &larr; Back
    </a>
    <button
      type="button"
      class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover inline-flex items-center justify-center rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
      disabled={isSaving}
      on:click={saveAndNext}
    >
      {isSaving ? 'Saving...' : 'Save & Next'}
    </button>
  </div>
</div>

{#if errorMessage}
  <div
    class="border-status-down bg-surface-raised text-status-down fixed inset-x-3 bottom-3 z-40 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg"
    role="alert"
  >
    {errorMessage}
  </div>
{/if}
