<script lang="ts">
  export let count = 0;

  $: pendingCount = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
</script>

{#if pendingCount > 0}
  <span
    class="min-h-touch bg-status-down/10 text-status-down inline-flex items-center gap-1.5 rounded-full px-1 text-xs font-semibold sm:px-2.5"
    aria-label={`${pendingCount} score submissions pending sync`}
  >
    <span
      class="bg-status-down animate-pulse-soft inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[0.65rem] leading-none font-bold text-white"
      aria-hidden="true"
    >
      {pendingCount}
    </span>
    <span class="hidden sm:inline">pending</span>
  </span>
{/if}
