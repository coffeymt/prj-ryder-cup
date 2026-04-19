<script lang="ts">
  export let strokes = 0;

  $: normalized = Math.min(2, Math.max(0, Math.trunc(strokes)));
  $: dots = normalized === 0 ? '' : '•'.repeat(normalized);
</script>

<span
  class={`min-h-touch border-border inline-flex min-w-[2.5rem] items-center justify-center rounded-full border px-2 text-sm font-bold tracking-wide ${
    normalized > 0 ? 'bg-accent-soft text-accent' : 'bg-surface-raised text-text-secondary'
  }`}
  aria-label={normalized === 0
    ? 'No handicap strokes on this hole'
    : `${normalized} handicap stroke${normalized === 1 ? '' : 's'} on this hole`}
>
  {#if dots}
    {dots}
  {:else}
    <span aria-hidden="true">—</span>
  {/if}
</span>
