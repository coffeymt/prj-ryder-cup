<script lang="ts">
  export let count = 0;

  $: pendingCount = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
</script>

{#if pendingCount > 0}
  <span
    class="inline-flex min-h-touch items-center gap-1.5 rounded-full border border-status-down bg-surface-raised px-1 text-xs font-semibold text-status-down sm:px-2.5"
    aria-label={`${pendingCount} score submissions pending sync`}
  >
    <span
      class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-status-down px-1 text-[0.65rem] font-bold leading-none text-white"
      aria-hidden="true"
    >
      {pendingCount}
    </span>
    <span class="hidden sm:inline">pending</span>
  </span>
{/if}
