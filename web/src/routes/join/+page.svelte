<script lang="ts">
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData | undefined;

  let code = form?.code ?? '';

  function handleCodeInput(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const normalized = input.value.toUpperCase().replace(/[^A-Z0-9]/gu, '').slice(0, 6);
    code = normalized;
    input.value = normalized;
  }
</script>

<svelte:head>
  <title>Join Tournament | Ryder Cup</title>
  <meta name="description" content="Enter your 6-character event code to join your Ryder Cup tournament." />
</svelte:head>

<main class="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
  <section class="space-y-8 rounded-3xl border border-border bg-surface p-card-padding shadow-sm">
    <div class="space-y-2 text-center">
      <h1 class="font-display text-3xl font-semibold tracking-tight text-text-primary">Enter Event Code</h1>
      <p class="text-sm text-text-secondary">Type your 6-character tournament code to see the roster.</p>
    </div>

    <form method="POST" class="space-y-5">
      <div class="space-y-2">
        <label for="event-code" class="block text-xs font-semibold uppercase tracking-[0.24em] text-text-muted">
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
          class="min-h-touch w-full rounded-lg border border-border bg-[var(--color-bg)] px-4 text-center font-display text-3xl font-semibold uppercase tracking-[0.28em] text-text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent"
          placeholder="ABC123"
          required
        />
      </div>

      {#if form?.codeError}
        <p class="text-sm font-medium text-status-down">{form.codeError}</p>
      {:else if data.queryError}
        <p class="text-sm font-medium text-status-down">{data.queryError}</p>
      {/if}

      <button
        type="submit"
        class="flex min-h-touch w-full items-center justify-center rounded-lg bg-accent px-6 text-base font-semibold text-accent-text transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Join Tournament
      </button>
    </form>
  </section>
</main>
