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
    ...(form?.values ?? {})
  };

  $: formErrors = form?.errors ?? {};
  $: allowanceSectionOpen = data.allowanceFields.some(
    (allowanceField) => Boolean((formErrors as Record<string, string | undefined>)[allowanceField.key])
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
    <h1 class="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">Create tournament</h1>
    <p class="text-sm text-text-secondary sm:text-base">
      Set your event schedule, match points, spectator visibility, and optional handicap allowances.
    </p>
  </header>

  <div class="rounded-2xl border border-border bg-surface p-card-padding shadow-sm sm:p-6">
    {#if formErrors.form}
      <p class="mb-4 rounded-lg border border-status-down/30 bg-status-down/10 px-4 py-3 text-sm text-status-down">
        {formErrors.form}
      </p>
    {/if}

    <form method="POST" use:enhance={createTournamentEnhance} class="space-y-6">
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <label for="name" class="text-sm font-semibold text-text-primary">Tournament name</label>
          <input
            id="name"
            name="name"
            type="text"
            maxlength="100"
            required
            value={mergedValues.name}
            aria-invalid={formErrors.name ? 'true' : undefined}
            aria-describedby={formErrors.name ? 'name-error' : undefined}
            class="mt-2 min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
          />
          {#if formErrors.name}
            <p id="name-error" class="mt-2 text-sm text-status-down">{formErrors.name}</p>
          {/if}
        </div>

        <div>
          <label for="startDate" class="text-sm font-semibold text-text-primary">Start date</label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            required
            value={mergedValues.startDate}
            aria-invalid={formErrors.startDate ? 'true' : undefined}
            aria-describedby={formErrors.startDate ? 'startDate-error' : undefined}
            class="mt-2 min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
          />
          {#if formErrors.startDate}
            <p id="startDate-error" class="mt-2 text-sm text-status-down">{formErrors.startDate}</p>
          {/if}
        </div>

        <div>
          <label for="endDate" class="text-sm font-semibold text-text-primary">End date</label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            required
            value={mergedValues.endDate}
            aria-invalid={formErrors.endDate ? 'true' : undefined}
            aria-describedby={formErrors.endDate ? 'endDate-error' : undefined}
            class="mt-2 min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
          />
          {#if formErrors.endDate}
            <p id="endDate-error" class="mt-2 text-sm text-status-down">{formErrors.endDate}</p>
          {/if}
        </div>

        <div class="sm:col-span-2">
          <label for="pointsToWin" class="text-sm font-semibold text-text-primary">Points to win</label>
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
            class="mt-2 min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent sm:max-w-xs"
          />
          {#if formErrors.pointsToWin}
            <p id="pointsToWin-error" class="mt-2 text-sm text-status-down">{formErrors.pointsToWin}</p>
          {/if}
        </div>
      </div>

      <fieldset class="space-y-3">
        <legend class="text-sm font-semibold text-text-primary">Spectator access</legend>
        <div class="grid gap-3">
          <label class="flex min-h-touch cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-raised px-4 py-3">
            <input
              type="radio"
              name="spectatorAccess"
              value="requireCode"
              checked={mergedValues.spectatorAccess !== 'public'}
              class="mt-1 h-4 w-4 border-border text-accent focus:ring-accent"
            />
            <span class="space-y-1">
              <span class="block text-sm font-semibold text-text-primary">Require event code (default)</span>
              <span class="block text-xs text-text-secondary">
                Spectators must enter the event code before viewing the ticker.
              </span>
            </span>
          </label>

          <label class="flex min-h-touch cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-raised px-4 py-3">
            <input
              type="radio"
              name="spectatorAccess"
              value="public"
              checked={mergedValues.spectatorAccess === 'public'}
              class="mt-1 h-4 w-4 border-border text-accent focus:ring-accent"
            />
            <span class="space-y-1">
              <span class="block text-sm font-semibold text-text-primary">Fully public ticker</span>
              <span class="block text-xs text-text-secondary">Anyone with the URL can view live scoring updates.</span>
            </span>
          </label>
        </div>
      </fieldset>

      <details class="rounded-xl border border-border bg-surface-raised p-card-padding" open={allowanceSectionOpen}>
        <summary class="cursor-pointer text-sm font-semibold text-text-primary">
          Per-format allowances (optional overrides)
        </summary>
        <p class="mt-2 text-xs text-text-secondary">
          Defaults are pre-filled. Use a USGA button to quickly apply the standard recommendation.
        </p>

        <div class="mt-4 grid gap-4">
          {#each data.allowanceFields as allowanceField (allowanceField.key)}
            <div class="rounded-lg border border-border bg-surface p-3 sm:p-4">
              <AllowanceField
                format={allowanceField.key}
                label={allowanceField.label}
                value={allowanceValue(allowanceField.key as AllowanceFieldKey)}
                usgsaStandard={allowanceField.usgaPercent}
              />
              {#if (formErrors as Record<string, string | undefined>)[allowanceField.key]}
                <p class="mt-2 text-sm text-status-down">
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
          class="inline-flex min-h-touch w-full items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-text transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-6"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? 'Creating...' : 'Create Tournament'}
        </button>
      </div>
    </form>
  </div>
</section>
