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
    grossStrokes: number | null;
    conceded: boolean;
    pickedUp: boolean;
  };

  let rows: RowDraft[] = data.players.map((playerRow) => ({
    ...playerRow,
    grossStrokes: playerRow.currentScore?.grossStrokes ?? null,
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
    if (row.grossStrokes === null && !row.conceded && !row.pickedUp) {
      throw new Error(`Enter a score for ${row.player.name} or mark them as conceded or picked up.`);
    }
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

    const missingScore = rows.find((row) => row.grossStrokes === null && !row.conceded && !row.pickedUp);
    if (missingScore) {
      errorMessage = `Enter a score for ${missingScore.player.name} or mark them as conceded or picked up.`;
      return;
    }

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

<div class="animate-fade-in space-y-5 pb-8">
  <MatchStatusHeader
    matchState={data.matchState}
    teamAName={data.match.teamAName}
    teamBName={data.match.teamBName}
    teamAColor={data.match.teamAColor}
    teamBColor={data.match.teamBColor}
  />

  <section class="space-y-2 py-3 sm:py-5">
    <p class="text-text-muted text-xs font-semibold tracking-[0.2em] uppercase">
      {data.segmentLabel}
    </p>
    <h1 class="font-display text-text-primary mt-1 text-4xl font-bold tracking-tight sm:text-5xl">
      Hole {data.holeNumber}
      <span class="text-text-secondary mt-1 block text-sm font-medium sm:text-base">
        · Par {data.par} · SI {data.strokeIndex}</span
      >
    </h1>
  </section>

  <section class="space-y-3">
    {#each rows as row (row.id)}
      <article
        class={`border-border bg-surface p-card-padding duration-base rounded-2xl border border-l-4 shadow-md transition-all ${
          row.player.teamColor === data.match.teamBColor ? 'border-l-team-b' : 'border-l-team-a'
        }`}
      >
        <div class="flex items-stretch gap-3">
          <div class="flex w-2/5 min-w-0 flex-col gap-2">
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

          <div class="flex flex-1 flex-col gap-2">
            <div class="flex-1">
              <HoleStepper
                value={row.grossStrokes}
                min={1}
                max={15}
                par={data.par}
                onChange={(nextValue) => updateGross(row.id, nextValue)}
              />
            </div>

            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                class={`min-h-touch duration-fast rounded-lg border px-4 text-base font-semibold transition-all active:scale-95 ${
                  row.conceded
                    ? 'border-status-down bg-status-down/10 text-status-down'
                    : 'border-border bg-surface-raised text-text-primary hover:bg-surface'
                }`}
                aria-pressed={row.conceded}
                on:click={() => toggleConceded(row.id)}
              >
                Concede
              </button>
              <button
                type="button"
                class={`min-h-touch duration-fast rounded-lg border px-4 text-base font-semibold transition-all active:scale-95 ${
                  row.pickedUp
                    ? 'border-status-halved bg-status-halved/10 text-status-halved'
                    : 'border-border bg-surface-raised text-text-primary hover:bg-surface'
                }`}
                aria-pressed={row.pickedUp}
                on:click={() => togglePickedUp(row.id)}
              >
                Picked Up
              </button>
            </div>
          </div>
        </div>
      </article>
    {/each}
  </section>

  <div class="grid grid-cols-2 gap-2">
    <a
      href={backHref}
      class="min-h-touch bg-surface-raised text-text-primary hover:bg-surface duration-base inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition-all hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      &larr; Back
    </a>
    <button
      type="button"
      class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover duration-base inline-flex items-center justify-center rounded-xl px-4 text-base font-semibold shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
      disabled={isSaving}
      on:click={saveAndNext}
    >
      {isSaving ? 'Saving...' : 'Save & Next'}
    </button>
  </div>
</div>

{#if errorMessage}
  <div
    class="border-status-down bg-status-down/10 text-status-down animate-slide-up-fade fixed inset-x-3 bottom-3 z-40 rounded-xl border px-4 py-3 text-sm font-medium shadow-xl"
    role="alert"
  >
    {errorMessage}
  </div>
{/if}
