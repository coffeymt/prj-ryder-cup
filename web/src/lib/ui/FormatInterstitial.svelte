<script lang="ts">
  import { tick } from 'svelte';

  export let show = false;
  export let newFormat = '';
  export let segment = '';
  export let onContinue: () => void = () => undefined;

  let continueButton: HTMLButtonElement | null = null;

  async function focusContinue(): Promise<void> {
    await tick();
    continueButton?.focus();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (!show) {
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      continueButton?.focus();
    }
  }

  $: if (show) {
    void focusContinue();
  }
</script>

{#if show}
  <div
    class="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="format-change-heading"
    tabindex="-1"
    on:keydown={handleKeydown}
  >
    <div
      class="border-border bg-surface-raised text-text-primary animate-slide-up-fade w-full max-w-md rounded-2xl border p-6 shadow-xl"
    >
      <p class="text-text-muted text-xs font-semibold tracking-[0.2em] uppercase">
        {segment} starts now
      </p>
      <h2
        id="format-change-heading"
        class="font-display mt-2 text-2xl font-semibold tracking-tight"
      >
        {newFormat}
      </h2>
      <p class="text-text-secondary mt-3 text-sm">
        Stroke allowances have changed for this segment.
      </p>
      <button
        type="button"
        bind:this={continueButton}
        class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover mt-5 inline-flex w-full items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition"
        on:click={onContinue}
      >
        Continue
      </button>
    </div>
  </div>
{/if}
