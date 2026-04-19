<script lang="ts">
  import { enhance } from '$app/forms';
  import type { SubmitFunction } from '@sveltejs/kit';
  import AllowanceField from '$lib/ui/AllowanceField.svelte';
  import type { ActionData, PageData } from './$types';

  type AllowanceFieldKey =
    | 'allowanceShamble'
    | 'allowanceFourball'
    | 'allowanceScrambleLow'
    | 'allowanceScrambleHigh'
    | 'allowancePinehurstLow'
    | 'allowancePinehurstHigh'
    | 'allowanceSingles';

  export let data: PageData;
  export let form: ActionData;

  let isSubmitting = false;

  $: mergedValues = {
    ...data.defaults,
    ...(form?.values ?? {}),
  };

  $: formErrors = form?.errors ?? {};
  $: allowanceSectionOpen = data.allowanceFields.some((allowanceField) =>
    Boolean((formErrors as Record<string, string | undefined>)[allowanceField.key])
  );

  const createTournamentEnhance: SubmitFunction = () => {
    isSubmitting = true;

    return async ({ update }) => {
      isSubmitting = false;
      await update({ reset: false });
    };
  };

  function toNumberOrNull(rawValue: string | undefined): number | null {
    if (!rawValue) {
      return null;
    }

    const parsedValue = Number(rawValue);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  function allowanceValue(key: AllowanceFieldKey): number | null {
    return toNumberOrNull(mergedValues[key]);
  }
</script>

<section class="mx-auto w-full max-w-4xl space-y-6">
  <header class="space-y-2">
    <h1 class="text-text-primary text-2xl font-semibold tracking-tight sm:text-3xl">
      Create tournament
    </h1>
    <p class="text-text-secondary text-sm sm:text-base">
      Set your event schedule, match points, spectator visibility, and optional handicap allowances.
    </p>
  </header>

  <div class="border-border bg-surface p-card-padding rounded-2xl border shadow-sm sm:p-6">
    {#if formErrors.form}
      <p
        class="border-status-down/30 bg-status-down/10 text-status-down mb-4 rounded-lg border px-4 py-3 text-sm"
      >
        {formErrors.form}
      </p>
    {/if}

    <form method="POST" use:enhance={createTournamentEnhance} class="space-y-6">
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <label for="name" class="text-text-primary text-sm font-semibold">Tournament name</label>
          <input
            id="name"
            name="name"
            type="text"
            maxlength="100"
            required
            value={mergedValues.name}
            aria-invalid={formErrors.name ? 'true' : undefined}
            aria-describedby={formErrors.name ? 'name-error' : undefined}
            class="min-h-touch border-border bg-bg text-text-primary focus:border-accent focus:ring-accent mt-2 w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
          />
          {#if formErrors.name}
            <p id="name-error" class="text-status-down mt-2 text-sm">{formErrors.name}</p>
          {/if}
        </div>

        <div>
          <label for="startDate" class="text-text-primary text-sm font-semibold">Start date</label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            required
            value={mergedValues.startDate}
            aria-invalid={formErrors.startDate ? 'true' : undefined}
            aria-describedby={formErrors.startDate ? 'startDate-error' : undefined}
            class="min-h-touch border-border bg-bg text-text-primary focus:border-accent focus:ring-accent mt-2 w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
          />
          {#if formErrors.startDate}
            <p id="startDate-error" class="text-status-down mt-2 text-sm">{formErrors.startDate}</p>
          {/if}
        </div>

        <div>
          <label for="endDate" class="text-text-primary text-sm font-semibold">End date</label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            required
            value={mergedValues.endDate}
            aria-invalid={formErrors.endDate ? 'true' : undefined}
            aria-describedby={formErrors.endDate ? 'endDate-error' : undefined}
            class="min-h-touch border-border bg-bg text-text-primary focus:border-accent focus:ring-accent mt-2 w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
          />
          {#if formErrors.endDate}
            <p id="endDate-error" class="text-status-down mt-2 text-sm">{formErrors.endDate}</p>
          {/if}
        </div>

        <div class="sm:col-span-2">
          <label for="pointsToWin" class="text-text-primary text-sm font-semibold"
            >Points to win</label
          >
          <input
            id="pointsToWin"
            name="pointsToWin"
            type="number"
            min="0.5"
            step="0.5"
            required
            value={mergedValues.pointsToWin}
            aria-invalid={formErrors.pointsToWin ? 'true' : undefined}
            aria-describedby={formErrors.pointsToWin ? 'pointsToWin-error' : undefined}
            class="min-h-touch border-border bg-bg text-text-primary focus:border-accent focus:ring-accent mt-2 w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1 sm:max-w-xs"
          />
          {#if formErrors.pointsToWin}
            <p id="pointsToWin-error" class="text-status-down mt-2 text-sm">
              {formErrors.pointsToWin}
            </p>
          {/if}
        </div>
      </div>

      <fieldset class="space-y-3">
        <legend class="text-text-primary text-sm font-semibold">Spectator access</legend>
        <div class="grid gap-3">
          <label
            class="min-h-touch border-border bg-surface-raised flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3"
          >
            <input
              type="radio"
              name="spectatorAccess"
              value="requireCode"
              checked={mergedValues.spectatorAccess !== 'public'}
              class="border-border text-accent focus:ring-accent mt-1 h-4 w-4"
            />
            <span class="space-y-1">
              <span class="text-text-primary block text-sm font-semibold"
                >Require event code (default)</span
              >
              <span class="text-text-secondary block text-xs">
                Spectators must enter the event code before viewing the ticker.
              </span>
            </span>
          </label>

          <label
            class="min-h-touch border-border bg-surface-raised flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3"
          >
            <input
              type="radio"
              name="spectatorAccess"
              value="public"
              checked={mergedValues.spectatorAccess === 'public'}
              class="border-border text-accent focus:ring-accent mt-1 h-4 w-4"
            />
            <span class="space-y-1">
              <span class="text-text-primary block text-sm font-semibold">Fully public ticker</span>
              <span class="text-text-secondary block text-xs"
                >Anyone with the URL can view live scoring updates.</span
              >
            </span>
          </label>
        </div>
      </fieldset>

      <details
        class="border-border bg-surface-raised p-card-padding rounded-xl border"
        open={allowanceSectionOpen}
      >
        <summary class="text-text-primary cursor-pointer text-sm font-semibold">
          Per-format allowances (optional overrides)
        </summary>
        <p class="text-text-secondary mt-2 text-xs">
          Defaults are pre-filled. Use a USGA button to quickly apply the standard recommendation.
        </p>

        <div class="mt-4 grid gap-4">
          {#each data.allowanceFields as allowanceField (allowanceField.key)}
            <div class="border-border bg-surface rounded-lg border p-3 sm:p-4">
              <AllowanceField
                format={allowanceField.key}
                label={allowanceField.label}
                value={allowanceValue(allowanceField.key as AllowanceFieldKey)}
                usgsaStandard={allowanceField.usgaPercent}
              />
              {#if (formErrors as Record<string, string | undefined>)[allowanceField.key]}
                <p class="text-status-down mt-2 text-sm">
                  {(formErrors as Record<string, string | undefined>)[allowanceField.key]}
                </p>
              {/if}
            </div>
          {/each}
        </div>
      </details>

      <div class="pt-2">
        <button
          type="submit"
          class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover inline-flex w-full items-center justify-center rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-6"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? 'Creating...' : 'Create Tournament'}
        </button>
      </div>
    </form>
  </div>
</section>
