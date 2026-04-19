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

<div class="border-border bg-surface flex items-center gap-3 rounded-xl border p-1">
  <button
    type="button"
    class="min-h-stepper min-w-stepper border-border bg-surface-raised text-text-primary hover:bg-surface inline-flex items-center justify-center rounded-xl border text-3xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-45"
    aria-label="Decrease strokes"
    disabled={value <= min}
    on:click={() => update(value - 1)}
  >
    −
  </button>

  <div
    class={`min-h-stepper border-border bg-surface-raised font-display flex min-w-[6rem] items-center justify-center rounded-xl border px-4 text-4xl font-semibold tabular-nums ${relationClass}`}
  >
    {value}
  </div>

  <button
    type="button"
    class="min-h-stepper min-w-stepper border-border bg-surface-raised text-text-primary hover:bg-surface inline-flex items-center justify-center rounded-xl border text-3xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-45"
    aria-label="Increase strokes"
    disabled={value >= max}
    on:click={() => update(value + 1)}
  >
    +
  </button>
</div>
