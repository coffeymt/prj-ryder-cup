<script lang="ts">
  export let value = 4;
  export let min = 1;
  export let max = 15;
  export let par = 4;
  export let onChange: (nextValue: number) => void = () => undefined;

  function clamp(nextValue: number): number {
    return Math.min(max, Math.max(min, nextValue));
  }

  function update(nextValue: number): void {
    onChange(clamp(nextValue));
  }

  $: relationClass =
    value < par ? 'text-status-up' : value > par ? 'text-status-down' : 'text-text-primary';
</script>

<div
  class="border-border bg-surface flex h-full w-full items-stretch gap-1 rounded-xl border p-1 shadow-sm"
>
  <button
    type="button"
    class="border-border bg-surface-raised text-text-primary hover:bg-surface duration-fast min-h-stepper inline-flex flex-1 items-center justify-center rounded-xl border text-5xl font-semibold transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
    aria-label="Decrease strokes"
    disabled={value <= min}
    on:click={() => update(value - 1)}
  >
    −
  </button>

  <div
    class={`border-border bg-surface-raised font-display duration-base min-h-stepper flex flex-1 items-center justify-center rounded-xl border px-2 text-6xl font-semibold tabular-nums transition-colors ${relationClass}`}
  >
    {value}
  </div>

  <button
    type="button"
    class="border-border bg-surface-raised text-text-primary hover:bg-surface duration-fast min-h-stepper inline-flex flex-1 items-center justify-center rounded-xl border text-5xl font-semibold transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
    aria-label="Increase strokes"
    disabled={value >= max}
    on:click={() => update(value + 1)}
  >
    +
  </button>
</div>
