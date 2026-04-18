<script lang="ts">
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData | undefined;

  type HoleDraft = {
    holeNumber: number;
    par: number;
    strokeIndex: number;
  };

  const HOLE_COUNT = 18;
  const ALLOWED_PARS = [3, 4, 5] as const;

  let localError: string | null = null;
  let loadedHoleSignature = '';
  let holes: HoleDraft[] = [];

  $: serverError = typeof form?.error === 'string' ? form.error : null;
  $: serverSuccess = typeof form?.success === 'string' ? form.success : null;
  $: displayedError = localError ?? serverError;
  $: holeStrokeIndexErrors = buildStrokeIndexErrors(holes);
  $: hasHoleStrokeIndexErrors = holeStrokeIndexErrors.some((entry) => entry !== null);
  $: holesJson = JSON.stringify(holes);

  $: {
    const nextSignature = JSON.stringify(data.holes);

    if (nextSignature !== loadedHoleSignature) {
      holes = data.holes.map((hole) => ({
        holeNumber: hole.holeNumber,
        par: hole.par,
        strokeIndex: hole.strokeIndex
      }));
      loadedHoleSignature = nextSignature;
    }
  }

  function buildStrokeIndexErrors(holeRows: HoleDraft[]): Array<string | null> {
    const counts = new Map<number, number>();

    for (const hole of holeRows) {
      counts.set(hole.strokeIndex, (counts.get(hole.strokeIndex) ?? 0) + 1);
    }

    return holeRows.map((hole) => {
      if (!Number.isInteger(hole.strokeIndex) || hole.strokeIndex < 1 || hole.strokeIndex > 18) {
        return 'SI must be between 1 and 18.';
      }

      if ((counts.get(hole.strokeIndex) ?? 0) > 1) {
        return 'SI value must be unique.';
      }

      return null;
    });
  }

  function validateHoles(): string | null {
    if (holes.length !== HOLE_COUNT) {
      return `Exactly ${HOLE_COUNT} holes are required.`;
    }

    for (const hole of holes) {
      if (![...ALLOWED_PARS].includes(hole.par as (typeof ALLOWED_PARS)[number])) {
        return `Hole ${hole.holeNumber} par must be 3, 4, or 5.`;
      }
    }

    if (hasHoleStrokeIndexErrors) {
      return 'Fix the stroke index errors before saving holes.';
    }

    return null;
  }

  function handleHoleSubmit(event: SubmitEvent): void {
    localError = null;
    const validationError = validateHoles();

    if (validationError) {
      event.preventDefault();
      localError = validationError;
    }
  }

  function setAllParToFour(): void {
    holes = holes.map((hole) => ({ ...hole, par: 4 }));
  }

  function resetStrokeIndexes(): void {
    holes = holes.map((hole, index) => ({ ...hole, strokeIndex: index + 1 }));
  }

  function teeMissingNineHoleRatings(tee: PageData['tees'][number]): boolean {
    return (
      tee.cr9f === null ||
      tee.slope9f === null ||
      tee.par9f === null ||
      tee.cr9b === null ||
      tee.slope9b === null ||
      tee.par9b === null
    );
  }
</script>

<svelte:head>
  <title>{data.course.name} | Course Library</title>
</svelte:head>

<section class="mx-auto w-full max-w-6xl space-y-6">
  <header class="space-y-2">
    <a href="/manage/courses" class="inline-flex min-h-touch items-center text-sm font-medium text-text-secondary hover:text-text-primary">
      ← Back to courses
    </a>
    <h1 class="text-2xl font-semibold tracking-tight text-text-primary">{data.course.name}</h1>
    <p class="text-sm text-text-secondary">Edit course settings, tee ratings, and 18-hole setup.</p>
  </header>

  {#if data.course.is_seed === 1}
    <p class="rounded-lg border border-status-up/30 bg-status-up/10 px-4 py-3 text-sm font-medium text-status-up">
      This is a seeded Kiawah course.
    </p>
  {/if}

  {#if data.splitFormatUnavailable}
    <p class="rounded-lg border border-status-halved/30 bg-status-halved/10 px-4 py-3 text-sm font-medium text-status-halved">
      Split-format rounds are unavailable without 9-hole ratings.
    </p>
  {/if}

  {#if serverSuccess}
    <p class="rounded-lg border border-status-up/30 bg-status-up/10 px-4 py-3 text-sm font-medium text-status-up">
      {serverSuccess}
    </p>
  {/if}

  {#if displayedError}
    <p class="rounded-lg border border-status-down/30 bg-status-down/10 px-4 py-3 text-sm font-medium text-status-down">
      {displayedError}
    </p>
  {/if}

  <section class="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-6">
    <h2 class="text-lg font-semibold text-text-primary">Course Info</h2>
    <form method="POST" action="?/updateCourse" class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <label class="space-y-2 text-sm font-semibold text-text-primary">
        <span>Name</span>
        <input
          name="name"
          type="text"
          required
          value={data.course.name}
          class="min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
        />
      </label>

      <label class="space-y-2 text-sm font-semibold text-text-primary">
        <span>Location</span>
        <input
          name="location"
          type="text"
          value={data.course.location ?? ''}
          class="min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
        />
      </label>

      <div class="sm:col-span-2">
        <button
          type="submit"
          class="inline-flex min-h-touch items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-text transition hover:bg-accent-hover"
        >
          Save Course Info
        </button>
      </div>
    </form>
  </section>

  <section class="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-6">
    <div class="space-y-1">
      <h2 class="text-lg font-semibold text-text-primary">Tees</h2>
      <p class="text-sm text-text-secondary">Update CR, slope, and par values for each tee.</p>
    </div>

    {#if data.tees.length === 0}
      <p class="mt-4 rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-text-primary">
        No tees added yet. Add one below to enable hole setup.
      </p>
    {:else}
      <div class="mt-4 space-y-4">
        {#each data.tees as tee (tee.id)}
          <article class="rounded-xl border border-border p-4">
            <div class="mb-4 flex items-center justify-between">
              <h3 class="text-base font-semibold text-text-primary">{tee.name}</h3>
              <span class="text-xs font-medium uppercase tracking-wide text-text-secondary">ID {tee.id}</span>
            </div>

            <form method="POST" action="?/updateTee" class="space-y-4">
              <input type="hidden" name="teeId" value={tee.id} />

              <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label class="space-y-1 text-sm text-text-primary">
                  <span class="font-medium">CR 18</span>
                  <input
                    name="cr18"
                    type="number"
                    step="0.1"
                    min="1"
                    required
                    value={tee.cr18}
                    class="min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                  />
                </label>
                <label class="space-y-1 text-sm text-text-primary">
                  <span class="font-medium">Slope 18</span>
                  <input
                    name="slope18"
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={tee.slope18}
                    class="min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                  />
                </label>
                <label class="space-y-1 text-sm text-text-primary">
                  <span class="font-medium">Par 18</span>
                  <input
                    name="par18"
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={tee.par18}
                    class="min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                  />
                </label>
              </div>

              <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label class="space-y-1 text-sm text-text-primary">
                  <span class="font-medium">CR 9F</span>
                  <input
                    name="cr9F"
                    type="number"
                    step="0.1"
                    min="1"
                    value={tee.cr9f ?? ''}
                    class="min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                  />
                </label>
                <label class="space-y-1 text-sm text-text-primary">
                  <span class="font-medium">Slope 9F</span>
                  <input
                    name="slope9F"
                    type="number"
                    step="1"
                    min="1"
                    value={tee.slope9f ?? ''}
                    class="min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                  />
                </label>
                <label class="space-y-1 text-sm text-text-primary">
                  <span class="font-medium">Par 9F</span>
                  <input
                    name="par9F"
                    type="number"
                    step="1"
                    min="1"
                    value={tee.par9f ?? ''}
                    class="min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                  />
                </label>
              </div>

              <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label class="space-y-1 text-sm text-text-primary">
                  <span class="font-medium">CR 9B</span>
                  <input
                    name="cr9B"
                    type="number"
                    step="0.1"
                    min="1"
                    value={tee.cr9b ?? ''}
                    class="min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                  />
                </label>
                <label class="space-y-1 text-sm text-text-primary">
                  <span class="font-medium">Slope 9B</span>
                  <input
                    name="slope9B"
                    type="number"
                    step="1"
                    min="1"
                    value={tee.slope9b ?? ''}
                    class="min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                  />
                </label>
                <label class="space-y-1 text-sm text-text-primary">
                  <span class="font-medium">Par 9B</span>
                  <input
                    name="par9B"
                    type="number"
                    step="1"
                    min="1"
                    value={tee.par9b ?? ''}
                    class="min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                  />
                </label>
              </div>

              {#if teeMissingNineHoleRatings(tee)}
                <p class="rounded-lg border border-status-halved/30 bg-status-halved/10 px-3 py-2 text-sm text-status-halved">
                  9-hole ratings required for split-format rounds.
                </p>
              {/if}

              <button
                type="submit"
                class="inline-flex min-h-touch items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-text transition hover:bg-accent-hover"
              >
                Save Tee
              </button>
            </form>
          </article>
        {/each}
      </div>
    {/if}

    <article class="mt-6 rounded-xl border border-border p-4">
      <h3 class="text-base font-semibold text-text-primary">Add Tee</h3>
      <form method="POST" action="?/addTee" class="mt-4 space-y-4">
        <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label class="space-y-1 text-sm text-text-primary">
            <span class="font-medium">Name</span>
            <input
              name="name"
              type="text"
              required
              class="min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
              placeholder="Blue"
            />
          </label>
          <label class="space-y-1 text-sm text-text-primary">
            <span class="font-medium">Gender</span>
            <select
              name="gender"
              class="min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
            >
              <option value="M">M</option>
              <option value="F">F</option>
              <option value="X">X</option>
            </select>
          </label>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label class="space-y-1 text-sm text-text-primary">
            <span class="font-medium">CR 18</span>
            <input
              name="cr18"
              type="number"
              step="0.1"
              min="1"
              required
              class="min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </label>
          <label class="space-y-1 text-sm text-text-primary">
            <span class="font-medium">Slope 18</span>
            <input
              name="slope18"
              type="number"
              step="1"
              min="1"
              required
              class="min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </label>
          <label class="space-y-1 text-sm text-text-primary">
            <span class="font-medium">Par 18</span>
            <input
              name="par18"
              type="number"
              step="1"
              min="1"
              required
              class="min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </label>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label class="space-y-1 text-sm text-text-primary">
            <span class="font-medium">CR 9F</span>
            <input
              name="cr9F"
              type="number"
              step="0.1"
              min="1"
              class="min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </label>
          <label class="space-y-1 text-sm text-text-primary">
            <span class="font-medium">Slope 9F</span>
            <input
              name="slope9F"
              type="number"
              step="1"
              min="1"
              class="min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </label>
          <label class="space-y-1 text-sm text-text-primary">
            <span class="font-medium">Par 9F</span>
            <input
              name="par9F"
              type="number"
              step="1"
              min="1"
              class="min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </label>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label class="space-y-1 text-sm text-text-primary">
            <span class="font-medium">CR 9B</span>
            <input
              name="cr9B"
              type="number"
              step="0.1"
              min="1"
              class="min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </label>
          <label class="space-y-1 text-sm text-text-primary">
            <span class="font-medium">Slope 9B</span>
            <input
              name="slope9B"
              type="number"
              step="1"
              min="1"
              class="min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </label>
          <label class="space-y-1 text-sm text-text-primary">
            <span class="font-medium">Par 9B</span>
            <input
              name="par9B"
              type="number"
              step="1"
              min="1"
              class="min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </label>
        </div>

        <button
          type="submit"
          class="inline-flex min-h-touch items-center justify-center rounded-lg border border-border bg-transparent px-4 text-sm font-semibold text-text-primary transition hover:bg-surface-raised"
        >
          Add Tee
        </button>
      </form>
    </article>
  </section>

  <section class="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="text-lg font-semibold text-text-primary">Holes</h2>
        <p class="text-sm text-text-secondary">Edit par and stroke index values for holes 1 through 18.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          on:click={setAllParToFour}
          class="inline-flex min-h-touch items-center justify-center rounded-lg border border-border bg-transparent px-3 text-sm font-semibold text-text-primary transition hover:bg-surface-raised"
        >
          Set all par to 4
        </button>
        <button
          type="button"
          on:click={resetStrokeIndexes}
          class="inline-flex min-h-touch items-center justify-center rounded-lg border border-border bg-transparent px-3 text-sm font-semibold text-text-primary transition hover:bg-surface-raised"
        >
          Reset SI to 1–18
        </button>
      </div>
    </div>

    <form method="POST" action="?/updateHoles" class="mt-4 space-y-4" on:submit={handleHoleSubmit}>
      <input type="hidden" name="holesJson" value={holesJson} />
      <div class="overflow-x-auto">
        <table class="min-w-[520px] w-full border-collapse">
          <thead>
            <tr class="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
              <th class="px-2 py-2">Hole</th>
              <th class="px-2 py-2">Par</th>
              <th class="px-2 py-2">Stroke Index</th>
            </tr>
          </thead>
          <tbody>
            {#each holes as hole, holeIndex (hole.holeNumber)}
              <tr class="border-b border-border/70">
                <td class="px-2 py-2 text-sm font-semibold text-text-primary">{hole.holeNumber}</td>
                <td class="px-2 py-2">
                  <select
                    bind:value={hole.par}
                    class="min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                  >
                    {#each ALLOWED_PARS as allowedPar (allowedPar)}
                      <option value={allowedPar}>{allowedPar}</option>
                    {/each}
                  </select>
                </td>
                <td class="px-2 py-2">
                  <input
                    type="number"
                    step="1"
                    min="1"
                    max="18"
                    bind:value={hole.strokeIndex}
                    class={`block min-h-touch w-full rounded-lg border px-3 text-base outline-none transition focus:ring-1 ${
                      holeStrokeIndexErrors[holeIndex]
                        ? 'border-status-down/30 focus:border-status-down focus:ring-status-down'
                        : 'border-border focus:border-accent focus:ring-accent'
                    }`}
                  />
                  {#if holeStrokeIndexErrors[holeIndex]}
                    <p class="mt-1 text-xs font-medium text-status-down">{holeStrokeIndexErrors[holeIndex]}</p>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <button
        type="submit"
        disabled={data.tees.length === 0}
        class="inline-flex min-h-touch items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-text transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        Save Holes
      </button>
      {#if data.tees.length === 0}
        <p class="text-sm text-text-secondary">Add at least one tee before updating holes.</p>
      {/if}
    </form>
  </section>
</section>
