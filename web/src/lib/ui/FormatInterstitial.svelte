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
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="format-change-heading"
    tabindex="-1"
    on:keydown={handleKeydown}
  >
    <div class="w-full max-w-md rounded-2xl border border-border bg-surface-raised p-6 text-text-primary shadow-2xl">
      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">{segment} starts now</p>
      <h2 id="format-change-heading" class="mt-2 font-display text-2xl font-semibold tracking-tight">{newFormat}</h2>
      <p class="mt-3 text-sm text-text-secondary">Stroke allowances have changed for this segment.</p>
      <button
        type="button"
        bind:this={continueButton}
        class="mt-5 inline-flex min-h-touch w-full items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-text transition hover:bg-accent-hover"
        on:click={onContinue}
      >
        Continue
      </button>
    </div>
  </div>
{/if}
