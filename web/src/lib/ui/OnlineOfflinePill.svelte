<script lang="ts">
  import { onMount } from 'svelte';

  let isOnline = true;

  if (typeof navigator !== 'undefined') {
    isOnline = navigator.onLine;
  }

  function updateOnlineStatus(): void {
    isOnline = navigator.onLine;
  }

  onMount(() => {
    updateOnlineStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  });
</script>

<span
  class={`min-h-touch inline-flex items-center gap-1.5 rounded-full font-semibold ${
    isOnline
      ? 'bg-accent-soft text-accent px-2.5 py-0.5 text-[0.6875rem]'
      : 'bg-offline animate-pulse-soft px-3 py-1 text-xs text-white'
  }`}
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  <span class={`h-2 w-2 rounded-full ${isOnline ? 'bg-accent' : 'bg-white/90'}`} aria-hidden="true"
  ></span>

  {#if isOnline}
    <span class="hidden sm:inline">Online</span>
    <span class="sr-only sm:hidden">Online</span>
  {:else}
    <span>Offline</span>
  {/if}
</span>
