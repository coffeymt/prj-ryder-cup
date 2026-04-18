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
  class={`inline-flex min-h-touch items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
    isOnline
      ? 'bg-online text-white'
      : 'bg-offline text-white'
  }`}
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  <span
    class="h-2 w-2 rounded-full bg-white/90"
    aria-hidden="true"
  ></span>

  {#if isOnline}
    <span class="hidden sm:inline">Online</span>
    <span class="sr-only sm:hidden">Online</span>
  {:else}
    <span>Offline</span>
  {/if}
</span>
