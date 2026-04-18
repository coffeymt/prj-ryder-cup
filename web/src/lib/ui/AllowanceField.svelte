<script lang="ts">
  export let format: string;
  export let value: number | null;
  export let usgsaStandard: number;
  export let label: string;

  const MIN_ALLOWANCE_PERCENT = 0;
  const MAX_ALLOWANCE_PERCENT = 150;

  let inputValue = '';

  $: inputId = `allowance-${format}`.replace(/[^a-z0-9_-]/giu, '-').toLowerCase();
  $: inputName = format;
  $: inputValue = value === null ? '' : String(value);
  $: validationError = getValidationError(inputValue);

  function getValidationError(rawValue: string): string | null {
    const trimmed = rawValue.trim();

    if (trimmed.length === 0) {
      return null;
    }

    const numericValue = Number(trimmed);

    if (!Number.isFinite(numericValue)) {
      return 'Enter a valid number.';
    }

    if (numericValue < MIN_ALLOWANCE_PERCENT || numericValue > MAX_ALLOWANCE_PERCENT) {
      return `Value must be between ${MIN_ALLOWANCE_PERCENT} and ${MAX_ALLOWANCE_PERCENT}.`;
    }

    return null;
  }

  function applyUsgsaStandard(): void {
    inputValue = String(usgsaStandard);
  }
</script>

<div class="space-y-2">
  <div class="flex flex-col gap-2 sm:flex-row sm:items-end">
    <div class="flex-1">
      <label for={inputId} class="text-sm font-semibold text-text-primary">{label}</label>
      <div class="mt-2 flex items-center gap-2">
        <input
          id={inputId}
          name={inputName}
          type="number"
          min={MIN_ALLOWANCE_PERCENT}
          max={MAX_ALLOWANCE_PERCENT}
          step="0.1"
          inputmode="decimal"
          bind:value={inputValue}
          aria-invalid={validationError ? 'true' : undefined}
          aria-describedby={validationError ? `${inputId}-error` : undefined}
          class="min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
        />
        <span class="text-sm text-text-secondary">%</span>
      </div>
    </div>

    <button
      type="button"
      class="inline-flex min-h-touch items-center justify-center rounded-lg border border-border bg-transparent px-4 text-sm font-semibold text-text-primary transition hover:bg-surface-raised"
      on:click={applyUsgsaStandard}
    >
      Use USGA standard ({usgsaStandard}%)
    </button>
  </div>

  {#if validationError}
    <p id={`${inputId}-error`} class="text-sm text-status-down">{validationError}</p>
  {/if}
</div>
