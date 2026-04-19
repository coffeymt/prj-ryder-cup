<script lang="ts">
  import type { PageData } from './$types';

  export let data: PageData;
</script>

<svelte:head>
  <title>Kiawah Golf</title>
  <meta name="description" content="Live tournament scoring for your golf trip." />
</svelte:head>

<main class="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
  <section class="border-border bg-surface p-card-padding space-y-10 rounded-3xl border shadow-sm">
    <div class="space-y-4 text-center">
      <p class="text-text-muted text-xs font-semibold tracking-[0.32em] uppercase">Kiawah Golf</p>
      <h1 class="font-display text-text-primary text-4xl font-semibold tracking-tight">
        Kiawah Golf
      </h1>
      <p class="text-text-secondary text-base leading-relaxed">
        Live tournament scoring for your golf trip.
      </p>
    </div>

    <div class="space-y-4">
      {#if data.primaryAction.type === 'continue'}
        <a
          href={`/t/${data.primaryAction.tournamentCode}`}
          class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover focus-visible:outline-accent flex w-full items-center justify-center rounded-lg px-6 text-base font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Continue to {data.primaryAction.tournamentName}
        </a>
      {:else if data.primaryAction.type === 'manage'}
        <a
          href="/manage"
          class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover focus-visible:outline-accent flex w-full items-center justify-center rounded-lg px-6 text-base font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Go to Manager Portal
        </a>
      {:else}
        <a
          href="/join"
          class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover focus-visible:outline-accent flex w-full items-center justify-center rounded-lg px-6 text-base font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Enter Event Code
        </a>
      {/if}

      <a
        href="/manage/login"
        class="min-h-touch text-text-secondary hover:text-text-primary focus-visible:outline-accent inline-flex w-full items-center justify-center text-sm font-medium underline underline-offset-4 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Commissioner Login
      </a>
    </div>
  </section>
</main>
