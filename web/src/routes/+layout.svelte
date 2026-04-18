<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import favicon from '$lib/assets/favicon.svg';
  import { registerServiceWorker } from '$lib/pwa/register';

  let { children } = $props();

  onMount(() => {
    if (typeof window !== 'undefined') {
      void registerServiceWorker();
    }
  });
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
