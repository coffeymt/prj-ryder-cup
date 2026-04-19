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
    const fallback = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-preset-black')
      .trim();
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
        class={`min-h-touch min-w-touch focus-visible:outline-accent inline-flex items-center justify-center rounded-full border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
          normalizedValue === resolveCssColor(swatch.token).toUpperCase()
            ? 'border-accent ring-accent ring-offset-bg ring-2 ring-offset-2'
            : 'border-border hover:scale-105'
        }`}
        style={`background-color: var(${swatch.token});`}
        on:click={() => handlePresetSelect(swatch.token)}
      >
        <span class="sr-only">{swatch.name}</span>
      </button>
    {/each}
  </div>

  <label class="text-text-primary block text-sm font-semibold">
    Custom color
    <input
      type="color"
      value={normalizedValue}
      on:input={handleCustomColorInput}
      class="min-h-touch border-border bg-bg mt-2 block w-24 cursor-pointer rounded-md border p-1"
      aria-label="Choose custom team color"
    />
  </label>
</div>
