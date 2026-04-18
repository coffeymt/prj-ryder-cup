<script lang="ts">
  import type { PageData } from './$types';

  export let data: PageData;
</script>

<svelte:head>
  <title>Ryder Cup</title>
  <meta name="description" content="Live Ryder Cup scoring for your golf trip." />
</svelte:head>

<main class="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
  <section class="space-y-10 rounded-3xl border border-border bg-surface p-card-padding shadow-sm">
    <div class="space-y-4 text-center">
      <p class="text-xs font-semibold uppercase tracking-[0.32em] text-text-muted">Ryder Cup</p>
      <h1 class="font-display text-4xl font-semibold tracking-tight text-text-primary">Ryder Cup</h1>
      <p class="text-base leading-relaxed text-text-secondary">Live Ryder Cup scoring for your golf trip.</p>
    </div>

    <div class="space-y-4">
      {#if data.primaryAction.type === 'continue'}
        <a
          href={`/t/${data.primaryAction.tournamentCode}`}
          class="flex min-h-touch w-full items-center justify-center rounded-lg bg-accent px-6 text-base font-semibold text-accent-text transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Continue to {data.primaryAction.tournamentName}
        </a>
      {:else if data.primaryAction.type === 'manage'}
        <a
          href="/manage"
          class="flex min-h-touch w-full items-center justify-center rounded-lg bg-accent px-6 text-base font-semibold text-accent-text transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Go to Manager Portal
        </a>
      {:else}
        <a
          href="/join"
          class="flex min-h-touch w-full items-center justify-center rounded-lg bg-accent px-6 text-base font-semibold text-accent-text transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Enter Event Code
        </a>
      {/if}

      <a
        href="/manage/login"
        class="inline-flex min-h-touch w-full items-center justify-center text-sm font-medium text-text-secondary underline underline-offset-4 transition hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Commissioner Login
      </a>
    </div>
  </section>
</main>
