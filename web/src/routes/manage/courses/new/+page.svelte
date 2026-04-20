<script lang="ts">
  import { enhance } from '$app/forms';
  import type { SubmitFunction } from '@sveltejs/kit';
  import type { ActionData } from './$types';

  const { form }: { form: ActionData | undefined } = $props();

  const MAX_TEES = 5;
  const HOLE_COUNT = 18;
  const ALLOWED_PARS = [3, 4, 5] as const;

  type TeeGender = 'M' | 'F' | 'X';

  type TeeDraft = {
    name: string;
    gender: TeeGender;
    cr18: number | null;
    slope18: number | null;
    par18: number | null;
    cr9F: number | null;
    slope9F: number | null;
    par9F: number | null;
    cr9B: number | null;
    slope9B: number | null;
    par9B: number | null;
  };

  type HoleDraft = {
    holeNumber: number;
    par: number;
    strokeIndex: number;
  };

  let isSubmitting = $state(false);
  let localError = $state<string | null>(null);
  let tees = $state<TeeDraft[]>([createDefaultTee()]);
  let holes = $state<HoleDraft[]>(createDefaultHoles());

  const serverError = $derived(typeof form?.error === 'string' ? form.error : null);
  const displayedError = $derived(localError ?? serverError);
  const strokeIndexErrors = $derived(buildStrokeIndexErrors(holes));
  const hasStrokeIndexErrors = $derived(strokeIndexErrors.some((entry) => entry !== null));
  const teesJson = $derived(JSON.stringify(tees));
  const holesJson = $derived(JSON.stringify(holes));

  function createDefaultTee(): TeeDraft {
    return {
      name: '',
      gender: 'X',
      cr18: null,
      slope18: null,
      par18: null,
      cr9F: null,
      slope9F: null,
      par9F: null,
      cr9B: null,
      slope9B: null,
      par9B: null,
    };
  }

  function createDefaultHoles(): HoleDraft[] {
    return Array.from({ length: HOLE_COUNT }, (_, index) => ({
      holeNumber: index + 1,
      par: 4,
      strokeIndex: index + 1,
    }));
  }

  function addTee(): void {
    if (tees.length >= MAX_TEES) {
      return;
    }

    tees = [...tees, createDefaultTee()];
  }

  function removeTee(index: number): void {
    if (tees.length <= 1) {
      return;
    }

    tees = tees.filter((_, teeIndex) => teeIndex !== index);
  }

  function setAllParToFour(): void {
    holes = holes.map((hole) => ({ ...hole, par: 4 }));
  }

  function resetStrokeIndexes(): void {
    holes = holes.map((hole, index) => ({ ...hole, strokeIndex: index + 1 }));
  }

  function isMissingNineHoleRatings(tee: TeeDraft): boolean {
    return tee.cr9F === null || tee.slope9F === null || tee.par9F === null;
  }

  function isFiniteNumber(value: number | null): value is number {
    return typeof value === 'number' && Number.isFinite(value);
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

  function validateTees(): string | null {
    if (tees.length === 0) {
      return 'Add at least one tee.';
    }

    if (tees.length > MAX_TEES) {
      return `You can add up to ${MAX_TEES} tees.`;
    }

    for (const [index, tee] of tees.entries()) {
      const teeLabel = `Tee ${index + 1}`;

      if (tee.name.trim().length === 0) {
        return `${teeLabel} name is required.`;
      }

      if (!isFiniteNumber(tee.cr18) || tee.cr18 <= 0) {
        return `${teeLabel} CR 18 is required.`;
      }

      if (!isFiniteNumber(tee.slope18) || !Number.isInteger(tee.slope18) || tee.slope18 <= 0) {
        return `${teeLabel} Slope 18 must be a positive integer.`;
      }

      if (!isFiniteNumber(tee.par18) || !Number.isInteger(tee.par18) || tee.par18 <= 0) {
        return `${teeLabel} Par 18 must be a positive integer.`;
      }
    }

    return null;
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

    if (hasStrokeIndexErrors) {
      return 'Fix the stroke index errors before saving.';
    }

    return null;
  }

  function validateForm(): string | null {
    return validateTees() ?? validateHoles();
  }

  const createCourseEnhance: SubmitFunction = ({ cancel, formData }) => {
    localError = null;
    const validationError = validateForm();

    if (validationError) {
      localError = validationError;
      cancel();
      return;
    }

    formData.set('teesJson', teesJson);
    formData.set('holesJson', holesJson);
    isSubmitting = true;

    return async ({ result, update }) => {
      isSubmitting = false;

      if (result.type === 'failure') {
        localError =
          typeof result.data?.error === 'string' ? result.data.error : 'Could not create course.';
        await update({ reset: false });
        return;
      }

      await update();
    };
  };
</script>

<svelte:head>
  <title>Add Course | Golf Manager</title>
</svelte:head>

<section class="mx-auto w-full max-w-6xl space-y-6">
  <header class="space-y-2">
    <a
      href="/manage/courses"
      class="min-h-touch text-text-secondary hover:text-text-primary inline-flex items-center text-sm font-medium"
    >
      ← Back to courses
    </a>
    <h1 class="text-text-primary text-2xl font-semibold tracking-tight">Add Course</h1>
    <p class="text-text-secondary text-sm">
      Create a course with tee ratings and an 18-hole par/stroke-index grid.
    </p>
  </header>

  {#if displayedError}
    <p
      class="border-status-down/30 bg-status-down/10 text-status-down rounded-lg border px-4 py-3 text-sm font-medium"
    >
      {displayedError}
    </p>
  {/if}

  <form method="POST" use:enhance={createCourseEnhance} class="space-y-8">
    <input type="hidden" name="teesJson" value={teesJson} />
    <input type="hidden" name="holesJson" value={holesJson} />

    <section class="border-border bg-surface rounded-2xl border p-4 shadow-sm sm:p-6">
      <h2 class="text-text-primary text-lg font-semibold">Course Info</h2>
      <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label class="text-text-primary space-y-2 text-sm font-semibold">
          <span>Name</span>
          <input
            name="name"
            type="text"
            required
            class="min-h-touch border-border bg-bg text-text-primary focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
            placeholder="Course name"
          />
        </label>

        <label class="text-text-primary space-y-2 text-sm font-semibold">
          <span>Location</span>
          <input
            name="location"
            type="text"
            class="min-h-touch border-border bg-bg text-text-primary focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
            placeholder="City, State"
          />
        </label>
      </div>
    </section>

    <section class="border-border bg-surface rounded-2xl border p-4 shadow-sm sm:p-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-text-primary text-lg font-semibold">Tees</h2>
          <p class="text-text-secondary text-sm">Add up to {MAX_TEES} tee configurations.</p>
        </div>
        <button
          type="button"
          onclick={addTee}
          disabled={tees.length >= MAX_TEES}
          class="min-h-touch border-border text-text-primary hover:bg-surface-raised disabled:text-text-secondary inline-flex items-center justify-center rounded-lg border bg-transparent px-4 text-sm font-semibold transition disabled:cursor-not-allowed"
        >
          + Add Tee
        </button>
      </div>

      <div class="mt-4 space-y-4">
        {#each tees as tee, teeIndex (teeIndex)}
          <article class="border-border rounded-xl border p-4">
            <div class="mb-4 flex items-center justify-between">
              <h3 class="text-text-secondary text-sm font-semibold tracking-wide uppercase">
                Tee {teeIndex + 1}
              </h3>
              {#if tees.length > 1}
                <button
                  type="button"
                  onclick={() => removeTee(teeIndex)}
                  class="min-h-touch text-status-down hover:bg-status-down/10 inline-flex items-center rounded-lg px-3 text-sm font-medium transition"
                >
                  Remove
                </button>
              {/if}
            </div>

            <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label class="text-text-primary space-y-1 text-sm">
                <span class="font-medium">Name</span>
                <input
                  type="text"
                  bind:value={tee.name}
                  class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
                  placeholder="Blue"
                  required
                />
              </label>

              <label class="text-text-primary space-y-1 text-sm">
                <span class="font-medium">Gender</span>
                <select
                  bind:value={tee.gender}
                  class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
                >
                  <option value="M">M</option>
                  <option value="F">F</option>
                  <option value="X">X</option>
                </select>
              </label>
            </div>

            <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label class="text-text-primary space-y-1 text-sm">
                <span class="font-medium">CR 18</span>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  bind:value={tee.cr18}
                  class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
                  required
                />
              </label>
              <label class="text-text-primary space-y-1 text-sm">
                <span class="font-medium">Slope 18</span>
                <input
                  type="number"
                  step="1"
                  min="1"
                  bind:value={tee.slope18}
                  class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
                  required
                />
              </label>
              <label class="text-text-primary space-y-1 text-sm">
                <span class="font-medium">Par 18</span>
                <input
                  type="number"
                  step="1"
                  min="1"
                  bind:value={tee.par18}
                  class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
                  required
                />
              </label>
            </div>

            <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label class="text-text-primary space-y-1 text-sm">
                <span class="font-medium">CR 9F</span>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  bind:value={tee.cr9F}
                  class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
                />
              </label>
              <label class="text-text-primary space-y-1 text-sm">
                <span class="font-medium">Slope 9F</span>
                <input
                  type="number"
                  step="1"
                  min="1"
                  bind:value={tee.slope9F}
                  class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
                />
              </label>
              <label class="text-text-primary space-y-1 text-sm">
                <span class="font-medium">Par 9F</span>
                <input
                  type="number"
                  step="1"
                  min="1"
                  bind:value={tee.par9F}
                  class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
                />
              </label>
            </div>

            <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label class="text-text-primary space-y-1 text-sm">
                <span class="font-medium">CR 9B</span>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  bind:value={tee.cr9B}
                  class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
                />
              </label>
              <label class="text-text-primary space-y-1 text-sm">
                <span class="font-medium">Slope 9B</span>
                <input
                  type="number"
                  step="1"
                  min="1"
                  bind:value={tee.slope9B}
                  class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
                />
              </label>
              <label class="text-text-primary space-y-1 text-sm">
                <span class="font-medium">Par 9B</span>
                <input
                  type="number"
                  step="1"
                  min="1"
                  bind:value={tee.par9B}
                  class="min-h-touch border-border bg-bg focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
                />
              </label>
            </div>

            {#if isMissingNineHoleRatings(tee)}
              <p
                class="border-status-halved/30 bg-status-halved/10 text-status-halved mt-3 rounded-lg border px-3 py-2 text-sm"
              >
                9-hole ratings required for split-format rounds.
              </p>
            {/if}
          </article>
        {/each}
      </div>
    </section>

    <section class="border-border bg-surface rounded-2xl border p-4 shadow-sm sm:p-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-text-primary text-lg font-semibold">Holes</h2>
          <p class="text-text-secondary text-sm">Par and stroke index for holes 1 through 18.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            onclick={setAllParToFour}
            class="min-h-touch border-border text-text-primary hover:bg-surface-raised inline-flex items-center justify-center rounded-lg border bg-transparent px-3 text-sm font-semibold transition"
          >
            Set all par to 4
          </button>
          <button
            type="button"
            onclick={resetStrokeIndexes}
            class="min-h-touch border-border text-text-primary hover:bg-surface-raised inline-flex items-center justify-center rounded-lg border bg-transparent px-3 text-sm font-semibold transition"
          >
            Reset SI to 1–18
          </button>
        </div>
      </div>

      <div class="mt-4 overflow-x-auto">
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
                      strokeIndexErrors[holeIndex]
                        ? 'border-status-down/30 focus:border-status-down focus:ring-status-down'
                        : 'border-border focus:border-accent focus:ring-accent'
                    }`}
                  />
                  {#if strokeIndexErrors[holeIndex]}
                    <p class="text-status-down mt-1 text-xs font-medium">
                      {strokeIndexErrors[holeIndex]}
                    </p>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <div class="flex flex-col gap-3 sm:flex-row sm:justify-end">
      <button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover inline-flex items-center justify-center rounded-lg px-5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? 'Saving...' : 'Create Course'}
      </button>
    </div>
  </form>
</section>
