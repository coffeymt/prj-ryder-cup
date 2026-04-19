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
  let holes: HoleDraft[] = [];

  $: serverError = typeof form?.error === 'string' ? form.error : null;
  $: serverSuccess = typeof form?.success === 'string' ? form.success : null;
  $: displayedError = localError ?? serverError;
  $: holeStrokeIndexErrors = buildStrokeIndexErrors(holes);
  $: hasHoleStrokeIndexErrors = holeStrokeIndexErrors.some((entry) => entry !== null);
  $: holesJson = JSON.stringify(holes);

  $: holes = data.holes.map((hole) => ({
    holeNumber: hole.holeNumber,
    par: hole.par,
    strokeIndex: hole.strokeIndex,
  }));

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
    <a
      href="/manage/courses"
      class="min-h-touch text-text-secondary hover:text-text-primary inline-flex items-center text-sm font-medium"
    >
      ← Back to courses
    </a>
    <h1 class="text-text-primary text-2xl font-semibold tracking-tight">{data.course.name}</h1>
    <p class="text-text-secondary text-sm">Edit course settings, tee ratings, and 18-hole setup.</p>
  </header>

  {#if data.course.is_seed === 1}
    <p
      class="border-status-up/30 bg-status-up/10 text-status-up rounded-lg border px-4 py-3 text-sm font-medium"
    >
      This is a seeded Kiawah course.
    </p>
  {/if}

  {#if data.splitFormatUnavailable}
    <p
      class="border-status-halved/30 bg-status-halved/10 text-status-halved rounded-lg border px-4 py-3 text-sm font-medium"
    >
      Split-format rounds are unavailable without 9-hole ratings.
    </p>
  {/if}

  {#if serverSuccess}
    <p
      class="border-status-up/30 bg-status-up/10 text-status-up rounded-lg border px-4 py-3 text-sm font-medium"
    >
      {serverSuccess}
    </p>
  {/if}

  {#if displayedError}
    <p
      class="border-status-down/30 bg-status-down/10 text-status-down rounded-lg border px-4 py-3 text-sm font-medium"
    >
      {displayedError}
    </p>
  {/if}

  <section class="border-border bg-surface rounded-2xl border p-4 shadow-sm sm:p-6">
    <h2 class="text-text-primary text-lg font-semibold">Course Info</h2>
    <form method="POST" action="?/updateCourse" class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <label class="text-text-primary space-y-2 text-sm font-semibold">
        <span>Name</span>
        <input
          name="name"
          type="text"
          required
          value={data.course.name}
          class="min-h-touch border-border bg-bg text-text-primary focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
        />
      </label>

      <label class="text-text-primary space-y-2 text-sm font-semibold">
        <span>Location</span>
        <input
          name="location"
          type="text"
          value={data.course.location ?? ''}
          class="min-h-touch border-border bg-bg text-text-primary focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
        />
      </label>

      <div class="sm:col-span-2">
        <button
          type="submit"
          class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover inline-flex items-center justify-center rounded-lg px-4 text-sm font-semibold transition"
        >
          Save Course Info
        </button>
      </div>
    </form>
  </section>

  <section class="border-border bg-surface rounded-2xl border p-4 shadow-sm sm:p-6">
    <div class="space-y-1">
      <h2 class="text-text-primary text-lg font-semibold">Tees</h2>
      <p class="text-text-secondary text-sm">Update CR, slope, and par values for each tee.</p>
    </div>

    {#if data.tees.length === 0}
      <p
        class="border-border bg-surface-raised text-text-primary mt-4 rounded-lg border px-4 py-3 text-sm"
      >
        No tees added yet. Add one below to enable hole setup.
      </p>
    {:else}
      <div class="mt-4 space-y-4">
        {#each data.tees as tee (tee.id)}
          <article class="border-border rounded-xl border p-4">
            <div class="mb-4 flex items-center justify-between">
              <h3 class="text-text-primary text-base font-semibold">{tee.name}</h3>
              <span class="text-text-secondary text-xs font-medium tracking-wide uppercase"
                >ID {tee.id}</span
              >
            </div>

            <form method="POST" action="?/updateTee" class="space-y-4">
              <input type="hidden" name="teeId" value={tee.id} />

              <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label class="text-text-primary space-y-1 text-sm">
                  <span class="font-medium">CR 18</span>
                  <input
                    name="cr18"
                    type="number"
                    step="0.1"
                    min="1"
                    required
                    value={tee.cr18}
                    class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
                  />
                </label>
                <label class="text-text-primary space-y-1 text-sm">
                  <span class="font-medium">Slope 18</span>
                  <input
                    name="slope18"
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={tee.slope18}
                    class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
                  />
                </label>
                <label class="text-text-primary space-y-1 text-sm">
                  <span class="font-medium">Par 18</span>
                  <input
                    name="par18"
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={tee.par18}
                    class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
                  />
                </label>
              </div>

              <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label class="text-text-primary space-y-1 text-sm">
                  <span class="font-medium">CR 9F</span>
                  <input
                    name="cr9F"
                    type="number"
                    step="0.1"
                    min="1"
                    value={tee.cr9f ?? ''}
                    class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
                  />
                </label>
                <label class="text-text-primary space-y-1 text-sm">
                  <span class="font-medium">Slope 9F</span>
                  <input
                    name="slope9F"
                    type="number"
                    step="1"
                    min="1"
                    value={tee.slope9f ?? ''}
                    class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
                  />
                </label>
                <label class="text-text-primary space-y-1 text-sm">
                  <span class="font-medium">Par 9F</span>
                  <input
                    name="par9F"
                    type="number"
                    step="1"
                    min="1"
                    value={tee.par9f ?? ''}
                    class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
                  />
                </label>
              </div>

              <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label class="text-text-primary space-y-1 text-sm">
                  <span class="font-medium">CR 9B</span>
                  <input
                    name="cr9B"
                    type="number"
                    step="0.1"
                    min="1"
                    value={tee.cr9b ?? ''}
                    class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
                  />
                </label>
                <label class="text-text-primary space-y-1 text-sm">
                  <span class="font-medium">Slope 9B</span>
                  <input
                    name="slope9B"
                    type="number"
                    step="1"
                    min="1"
                    value={tee.slope9b ?? ''}
                    class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
                  />
                </label>
                <label class="text-text-primary space-y-1 text-sm">
                  <span class="font-medium">Par 9B</span>
                  <input
                    name="par9B"
                    type="number"
                    step="1"
                    min="1"
                    value={tee.par9b ?? ''}
                    class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
                  />
                </label>
              </div>

              {#if teeMissingNineHoleRatings(tee)}
                <p
                  class="border-status-halved/30 bg-status-halved/10 text-status-halved rounded-lg border px-3 py-2 text-sm"
                >
                  9-hole ratings required for split-format rounds.
                </p>
              {/if}

              <button
                type="submit"
                class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover inline-flex items-center justify-center rounded-lg px-4 text-sm font-semibold transition"
              >
                Save Tee
              </button>
            </form>
          </article>
        {/each}
      </div>
    {/if}

    <article class="border-border mt-6 rounded-xl border p-4">
      <h3 class="text-text-primary text-base font-semibold">Add Tee</h3>
      <form method="POST" action="?/addTee" class="mt-4 space-y-4">
        <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label class="text-text-primary space-y-1 text-sm">
            <span class="font-medium">Name</span>
            <input
              name="name"
              type="text"
              required
              class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
              placeholder="Blue"
            />
          </label>
          <label class="text-text-primary space-y-1 text-sm">
            <span class="font-medium">Gender</span>
            <select
              name="gender"
              class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
            >
              <option value="M">M</option>
              <option value="F">F</option>
              <option value="X">X</option>
            </select>
          </label>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label class="text-text-primary space-y-1 text-sm">
            <span class="font-medium">CR 18</span>
            <input
              name="cr18"
              type="number"
              step="0.1"
              min="1"
              required
              class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
            />
          </label>
          <label class="text-text-primary space-y-1 text-sm">
            <span class="font-medium">Slope 18</span>
            <input
              name="slope18"
              type="number"
              step="1"
              min="1"
              required
              class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
            />
          </label>
          <label class="text-text-primary space-y-1 text-sm">
            <span class="font-medium">Par 18</span>
            <input
              name="par18"
              type="number"
              step="1"
              min="1"
              required
              class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
            />
          </label>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label class="text-text-primary space-y-1 text-sm">
            <span class="font-medium">CR 9F</span>
            <input
              name="cr9F"
              type="number"
              step="0.1"
              min="1"
              class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
            />
          </label>
          <label class="text-text-primary space-y-1 text-sm">
            <span class="font-medium">Slope 9F</span>
            <input
              name="slope9F"
              type="number"
              step="1"
              min="1"
              class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
            />
          </label>
          <label class="text-text-primary space-y-1 text-sm">
            <span class="font-medium">Par 9F</span>
            <input
              name="par9F"
              type="number"
              step="1"
              min="1"
              class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
            />
          </label>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label class="text-text-primary space-y-1 text-sm">
            <span class="font-medium">CR 9B</span>
            <input
              name="cr9B"
              type="number"
              step="0.1"
              min="1"
              class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
            />
          </label>
          <label class="text-text-primary space-y-1 text-sm">
            <span class="font-medium">Slope 9B</span>
            <input
              name="slope9B"
              type="number"
              step="1"
              min="1"
              class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
            />
          </label>
          <label class="text-text-primary space-y-1 text-sm">
            <span class="font-medium">Par 9B</span>
            <input
              name="par9B"
              type="number"
              step="1"
              min="1"
              class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
            />
          </label>
        </div>

        <button
          type="submit"
          class="min-h-touch border-border text-text-primary hover:bg-surface-raised inline-flex items-center justify-center rounded-lg border bg-transparent px-4 text-sm font-semibold transition"
        >
          Add Tee
        </button>
      </form>
    </article>
  </section>

  <section class="border-border bg-surface rounded-2xl border p-4 shadow-sm sm:p-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="text-text-primary text-lg font-semibold">Holes</h2>
        <p class="text-text-secondary text-sm">
          Edit par and stroke index values for holes 1 through 18.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          on:click={setAllParToFour}
          class="min-h-touch border-border text-text-primary hover:bg-surface-raised inline-flex items-center justify-center rounded-lg border bg-transparent px-3 text-sm font-semibold transition"
        >
          Set all par to 4
        </button>
        <button
          type="button"
          on:click={resetStrokeIndexes}
          class="min-h-touch border-border text-text-primary hover:bg-surface-raised inline-flex items-center justify-center rounded-lg border bg-transparent px-3 text-sm font-semibold transition"
        >
          Reset SI to 1–18
        </button>
      </div>
    </div>

    <form method="POST" action="?/updateHoles" class="mt-4 space-y-4" on:submit={handleHoleSubmit}>
      <input type="hidden" name="holesJson" value={holesJson} />
      <div class="overflow-x-auto">
        <table class="w-full min-w-[520px] border-collapse">
          <thead>
            <tr
              class="border-border text-text-secondary border-b text-left text-xs font-semibold tracking-wide uppercase"
            >
              <th class="px-2 py-2">Hole</th>
              <th class="px-2 py-2">Par</th>
              <th class="px-2 py-2">Stroke Index</th>
            </tr>
          </thead>
          <tbody>
            {#each holes as hole, holeIndex (hole.holeNumber)}
              <tr class="border-border/70 border-b">
                <td class="text-text-primary px-2 py-2 text-sm font-semibold">{hole.holeNumber}</td>
                <td class="px-2 py-2">
                  <select
                    bind:value={hole.par}
                    class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
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
                    class={`min-h-touch block w-full rounded-lg border px-3 text-base transition outline-none focus:ring-1 ${
                      holeStrokeIndexErrors[holeIndex]
                        ? 'border-status-down/30 focus:border-status-down focus:ring-status-down'
                        : 'border-border focus:border-accent focus:ring-accent'
                    }`}
                  />
                  {#if holeStrokeIndexErrors[holeIndex]}
                    <p class="text-status-down mt-1 text-xs font-medium">
                      {holeStrokeIndexErrors[holeIndex]}
                    </p>
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
        class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover inline-flex items-center justify-center rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
      >
        Save Holes
      </button>
      {#if data.tees.length === 0}
        <p class="text-text-secondary text-sm">Add at least one tee before updating holes.</p>
      {/if}
    </form>
  </section>
</section>
