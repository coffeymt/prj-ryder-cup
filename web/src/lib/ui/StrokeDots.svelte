<script lang="ts">
  export let strokes = 0;

  $: normalized = Math.min(2, Math.max(0, Math.trunc(strokes)));
  $: dots = normalized === 0 ? '' : '•'.repeat(normalized);
</script>

<span
  class="inline-flex min-h-touch min-w-[2.5rem] items-center justify-center rounded-full border border-border bg-surface-raised px-2 text-sm font-bold tracking-wide text-text-secondary"
  aria-label={normalized === 0 ? 'No handicap strokes on this hole' : `${normalized} handicap stroke${normalized === 1 ? '' : 's'} on this hole`}
>
  {#if dots}
    {dots}
  {:else}
    <span aria-hidden="true">—</span>
  {/if}
</span>
