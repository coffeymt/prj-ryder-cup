<script lang="ts">
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData | undefined;

  let code = form?.code ?? '';

  function handleCodeInput(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const normalized = input.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/gu, '')
      .slice(0, 6);
    code = normalized;
    input.value = normalized;
  }
</script>

<svelte:head>
  <title>Join Tournament | Golf</title>
  <meta name="description" content="Enter your 6-character event code to join your tournament." />
</svelte:head>

<main
  class="bg-gradient-to-b from-[var(--color-bg-gradient-start)] to-[var(--color-bg-gradient-end)]"
>
  <div class="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
    <section
      class="border-border bg-surface p-card-padding animate-slide-up-fade space-y-8 rounded-3xl border shadow-lg"
    >
      <div class="space-y-2 text-center">
      <h1 class="font-display text-text-primary text-3xl font-semibold tracking-tight">
        Enter Event Code
      </h1>
      <p class="text-text-secondary text-sm">
        Type your 6-character tournament code to see the roster.
      </p>
      </div>

      <form method="POST" class="space-y-5">
        <div class="space-y-2">
          <label
            for="event-code"
            class="text-text-muted block text-xs font-semibold tracking-[0.24em] uppercase"
          >
            Event Code
          </label>
          <input
            id="event-code"
            name="code"
            type="text"
            inputmode="text"
            autocomplete="off"
            autocapitalize="characters"
            maxlength="6"
            bind:value={code}
            on:input={handleCodeInput}
            class="min-h-touch border-border font-display text-text-primary focus:border-accent focus:ring-accent-ring w-full rounded-xl border bg-[var(--color-bg)] px-4 text-center text-3xl font-semibold tracking-[0.28em] uppercase shadow-inner shadow-sm transition outline-none focus:ring-2"
            placeholder="ABC123"
            required
          />
        </div>

        {#if form?.codeError}
          <p class="text-status-down text-sm font-medium">{form.codeError}</p>
        {:else if data.queryError}
          <p class="text-status-down text-sm font-medium">{data.queryError}</p>
        {/if}

        <button
          type="submit"
          class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover focus-visible:outline-accent flex w-full items-center justify-center rounded-xl px-6 text-base font-semibold shadow-md transition hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Join Tournament
        </button>
      </form>
    </section>
  </div>
</main>
