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

  let isSaving = false;
  let isRegenerating = false;
  let isArchiving = false;

  $: mergedValues = {
    ...data.tournament,
    ...(form?.values ?? {}),
  };

  $: eventCode = form?.eventCode ?? data.eventCode;
  $: formErrors = form?.errors ?? {};
  $: saveErrors =
    form?.action === 'save'
      ? (formErrors as Record<string, string | undefined>)
      : ({} as Record<string, string>);
  $: allowanceSectionOpen = data.allowanceFields.some((allowanceField) =>
    Boolean(saveErrors[allowanceField.key])
  );

  const saveEnhance: SubmitFunction = () => {
    isSaving = true;

    return async ({ update }) => {
      isSaving = false;
      await update({ reset: false });
    };
  };

  const regenerateEnhance: SubmitFunction = () => {
    isRegenerating = true;

    return async ({ update }) => {
      isRegenerating = false;
      await update({ reset: false });
    };
  };

  const archiveEnhance: SubmitFunction = () => {
    isArchiving = true;

    return async ({ update }) => {
      isArchiving = false;
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
      Tournament settings
    </h1>
    <p class="text-text-secondary text-sm sm:text-base">
      Update event details, allowances, spectator visibility, and access code controls.
    </p>
  </header>

  {#if form?.success}
    <p
      class="border-status-up/30 bg-status-up/10 text-status-up rounded-lg border px-4 py-3 text-sm"
    >
      {form.success}
    </p>
  {/if}

  {#if formErrors.form}
    <p
      class="border-status-down/30 bg-status-down/10 text-status-down rounded-lg border px-4 py-3 text-sm"
    >
      {formErrors.form}
    </p>
  {/if}

  <div class="border-border bg-surface p-card-padding rounded-2xl border shadow-sm sm:p-6">
    <div
      class="border-border bg-surface-raised p-card-padding flex flex-col gap-4 rounded-xl border sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="space-y-1">
        <p class="text-text-secondary text-xs font-semibold tracking-wide uppercase">Event code</p>
        <p class="text-text-primary text-2xl font-semibold tracking-widest">{eventCode}</p>
      </div>

      <form method="POST" action="?/regenerate" use:enhance={regenerateEnhance}>
        <button
          type="submit"
          class="min-h-touch border-border text-text-primary hover:bg-surface-raised inline-flex w-full items-center justify-center rounded-lg border bg-transparent px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          disabled={isRegenerating}
          aria-busy={isRegenerating}
        >
          {isRegenerating ? 'Regenerating...' : 'Regenerate'}
        </button>
      </form>
    </div>
  </div>

  <div class="border-border bg-surface p-card-padding rounded-2xl border shadow-sm sm:p-6">
    <form method="POST" action="?/save" use:enhance={saveEnhance} class="space-y-6">
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
            aria-invalid={saveErrors.name ? 'true' : undefined}
            aria-describedby={saveErrors.name ? 'name-error' : undefined}
            class="min-h-touch border-border bg-bg text-text-primary focus:border-accent focus:ring-accent mt-2 w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
          />
          {#if saveErrors.name}
            <p id="name-error" class="text-status-down mt-2 text-sm">{saveErrors.name}</p>
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
            aria-invalid={saveErrors.startDate ? 'true' : undefined}
            aria-describedby={saveErrors.startDate ? 'startDate-error' : undefined}
            class="min-h-touch border-border bg-bg text-text-primary focus:border-accent focus:ring-accent mt-2 w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
          />
          {#if saveErrors.startDate}
            <p id="startDate-error" class="text-status-down mt-2 text-sm">{saveErrors.startDate}</p>
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
            aria-invalid={saveErrors.endDate ? 'true' : undefined}
            aria-describedby={saveErrors.endDate ? 'endDate-error' : undefined}
            class="min-h-touch border-border bg-bg text-text-primary focus:border-accent focus:ring-accent mt-2 w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
          />
          {#if saveErrors.endDate}
            <p id="endDate-error" class="text-status-down mt-2 text-sm">{saveErrors.endDate}</p>
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
            aria-invalid={saveErrors.pointsToWin ? 'true' : undefined}
            aria-describedby={saveErrors.pointsToWin ? 'pointsToWin-error' : undefined}
            class="min-h-touch border-border bg-bg text-text-primary focus:border-accent focus:ring-accent mt-2 w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1 sm:max-w-xs"
          />
          {#if saveErrors.pointsToWin}
            <p id="pointsToWin-error" class="text-status-down mt-2 text-sm">
              {saveErrors.pointsToWin}
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
              {#if saveErrors[allowanceField.key]}
                <p class="text-status-down mt-2 text-sm">{saveErrors[allowanceField.key]}</p>
              {/if}
            </div>
          {/each}
        </div>
      </details>

      <div class="pt-2">
        <button
          type="submit"
          class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover inline-flex w-full items-center justify-center rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-6"
          disabled={isSaving}
          aria-busy={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </form>
  </div>

  <div
    class="border-status-down/30 bg-status-down/10 p-card-padding rounded-2xl border shadow-sm sm:p-6"
  >
    <h2 class="text-status-down text-base font-semibold">Danger zone</h2>
    <p class="text-status-down mt-2 text-sm">
      Archiving removes this tournament from active management workflows.
    </p>

    <form method="POST" action="?/archive" use:enhance={archiveEnhance} class="mt-4">
      <button
        type="submit"
        class="min-h-touch bg-status-down inline-flex w-full items-center justify-center rounded-lg px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-6"
        disabled={isArchiving}
        aria-busy={isArchiving}
      >
        {isArchiving ? 'Archiving...' : 'Archive Tournament'}
      </button>
    </form>
  </div>
</section>
