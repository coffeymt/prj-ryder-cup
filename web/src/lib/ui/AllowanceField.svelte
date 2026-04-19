<script lang="ts">
  export let format: string;
  export let value: number | null;
  export let usgsaStandard: number;
  export let label: string;

  const MIN_ALLOWANCE_PERCENT = 0;
  const MAX_ALLOWANCE_PERCENT = 150;

  let inputValue: string;

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
      <label for={inputId} class="text-text-primary text-sm font-semibold">{label}</label>
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
          class="min-h-touch border-border bg-bg text-text-primary focus:border-accent focus:ring-accent w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
        />
        <span class="text-text-secondary text-sm">%</span>
      </div>
    </div>

    <button
      type="button"
      class="min-h-touch border-border text-text-primary hover:bg-surface-raised inline-flex items-center justify-center rounded-lg border bg-transparent px-4 text-sm font-semibold transition"
      on:click={applyUsgsaStandard}
    >
      Use USGA standard ({usgsaStandard}%)
    </button>
  </div>

  {#if validationError}
    <p id={`${inputId}-error`} class="text-status-down text-sm">{validationError}</p>
  {/if}
</div>
