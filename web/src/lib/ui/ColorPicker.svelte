<script lang="ts">
  type PresetColor = {
    name: string;
    token: string;
  };

  const PRESET_COLORS: PresetColor[] = [
    { name: 'Red', token: '--color-preset-red' },
    { name: 'Blue', token: '--color-preset-blue' },
    { name: 'Green', token: '--color-preset-green' },
    { name: 'Gold', token: '--color-preset-gold' },
    { name: 'Navy', token: '--color-preset-navy' },
    { name: 'White', token: '--color-preset-white' },
    { name: 'Black', token: '--color-preset-black' },
    { name: 'Orange', token: '--color-preset-orange' },
    { name: 'Purple', token: '--color-preset-purple' },
    { name: 'Teal', token: '--color-preset-teal' },
    { name: 'Mint', token: '--color-preset-mint' },
    { name: 'Maroon', token: '--color-preset-maroon' },
  ];

  export let value = '';
  export let onchange: (color: string) => void = () => {};

  $: normalizedValue = normalizeColorValue(value, '--color-accent');

  function handlePresetSelect(token: string): void {
    onchange(resolveCssColor(token).toUpperCase());
  }

  function handleCustomColorInput(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    onchange(input.value.toUpperCase());
  }

  function normalizeColorValue(rawValue: string, fallbackToken: string): string {
    const trimmed = rawValue.trim();
    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/u.test(trimmed)) {
      return trimmed.toUpperCase();
    }
    return resolveCssColor(fallbackToken).toUpperCase();
  }

  function resolveCssColor(token: string): string {
    if (typeof window === 'undefined') {
      return '';
    }

    const resolved = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/u.test(resolved)) {
      return resolved;
    }
    const fallback = getComputedStyle(document.documentElement).getPropertyValue('--color-preset-black').trim();
    return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/u.test(fallback) ? fallback : '';
  }
</script>

<div class="space-y-3">
  <div class="flex flex-wrap gap-2">
    {#each PRESET_COLORS as swatch (swatch.token)}
      <button
        type="button"
        aria-label={`Select ${swatch.name}`}
        aria-pressed={normalizedValue === resolveCssColor(swatch.token).toUpperCase()}
        class={`inline-flex min-h-touch min-w-touch items-center justify-center rounded-full border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          normalizedValue === resolveCssColor(swatch.token).toUpperCase()
            ? 'border-accent ring-2 ring-accent ring-offset-2 ring-offset-bg'
            : 'border-border hover:scale-105'
        }`}
        style={`background-color: var(${swatch.token});`}
        on:click={() => handlePresetSelect(swatch.token)}
      >
        <span class="sr-only">{swatch.name}</span>
      </button>
    {/each}
  </div>

  <label class="block text-sm font-semibold text-text-primary">
    Custom color
    <input
      type="color"
      value={normalizedValue}
      on:input={handleCustomColorInput}
      class="mt-2 block min-h-touch w-24 cursor-pointer rounded-md border border-border bg-bg p-1"
      aria-label="Choose custom team color"
    />
  </label>
</div>
