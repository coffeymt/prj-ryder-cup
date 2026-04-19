<script lang="ts">
  import type { PageData } from './$types';

  export let data: PageData;
</script>

<svelte:head>
  <title>Kiawah Golf</title>
  <meta name="description" content="Live tournament scoring for your golf trip." />
</svelte:head>

<main
  class="bg-gradient-to-b from-[var(--color-bg-gradient-start)] to-[var(--color-bg-gradient-end)]"
>
  <div class="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
    <section
      class="border-border bg-surface p-card-padding animate-slide-up-fade space-y-10 rounded-3xl border shadow-lg"
    >
      <div class="space-y-5 text-center">
        <div class="mx-auto mb-2 flex w-fit items-center gap-2">
          <span class="bg-accent h-1.5 w-1.5 rounded-full"></span>
          <span class="bg-accent/60 h-px w-10"></span>
        </div>
        <p class="text-text-muted text-xs font-semibold tracking-[0.32em] uppercase">Kiawah Golf</p>
        <h1 class="font-display text-text-primary text-5xl font-bold tracking-tight">
          Kiawah Golf
        </h1>
        <span class="bg-accent/70 mx-auto block h-1 w-20 rounded-full"></span>
        <p class="text-text-secondary pt-1 text-base leading-relaxed">
          Live tournament scoring for your golf trip.
        </p>
      </div>

      <div class="space-y-4">
        {#if data.primaryAction.type === 'continue'}
          <a
            href={`/t/${data.primaryAction.tournamentCode}`}
            class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover focus-visible:outline-accent flex w-full items-center justify-center rounded-xl px-6 text-base font-semibold shadow-md transition hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Continue to {data.primaryAction.tournamentName}
          </a>
        {:else if data.primaryAction.type === 'manage'}
          {#if data.playerTournament}
            <a
              href={`/t/${data.playerTournament.code}`}
              class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover focus-visible:outline-accent flex w-full items-center justify-center rounded-xl px-6 text-base font-semibold shadow-md transition hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Continue to {data.playerTournament.name}
            </a>
            <a
              href="/manage"
              class="min-h-touch border-border text-text-primary hover:bg-surface-raised focus-visible:outline-accent flex w-full items-center justify-center rounded-xl border px-6 text-base font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Go to Manager Portal
            </a>
            <a
              href="/join"
              class="min-h-touch text-text-secondary hover:text-text-primary focus-visible:outline-accent inline-flex w-full items-center justify-center text-sm font-medium underline underline-offset-4 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Enter Event Code
            </a>
          {:else}
            <a
              href="/manage"
              class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover focus-visible:outline-accent flex w-full items-center justify-center rounded-xl px-6 text-base font-semibold shadow-md transition hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Go to Manager Portal
            </a>
            <a
              href="/join"
              class="min-h-touch border-border text-text-primary hover:bg-surface-raised focus-visible:outline-accent flex w-full items-center justify-center rounded-xl border px-6 text-base font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Enter Event Code
            </a>
          {/if}
        {:else}
          <a
            href="/join"
            class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover focus-visible:outline-accent flex w-full items-center justify-center rounded-xl px-6 text-base font-semibold shadow-md transition hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Enter Event Code
          </a>
        {/if}

        {#if !data.isCommissioner}
          <a
            href="/manage/login"
            class="min-h-touch text-text-secondary hover:text-text-primary focus-visible:outline-accent inline-flex w-full items-center justify-center text-sm font-medium underline underline-offset-4 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Commissioner Login
          </a>
        {/if}
      </div>
    </section>
  </div>
</main>
