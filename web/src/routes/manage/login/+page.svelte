<script lang="ts">
  import { dev } from '$app/environment';
  import { enhance } from '$app/forms';
  import { page } from '$app/stores';
  import type { SubmitFunction } from '@sveltejs/kit';
  import type { ActionData } from './$types';

  export let form: ActionData;

  let isSubmitting = false;
  let inlineError: string | null = null;

  $: invalidLinkMessage =
    $page.url.searchParams.get('error') === 'invalid_link'
      ? 'That sign-in link is invalid or expired. Request a new one.'
      : null;
  $: displayedError = inlineError ?? form?.error ?? invalidLinkMessage;

  const signInEnhance: SubmitFunction = () => {
    isSubmitting = true;
    inlineError = null;

    return async ({ result, update }) => {
      isSubmitting = false;

      if (result.type === 'failure') {
        inlineError =
          dev && typeof result.data?.error === 'string'
            ? result.data.error
            : 'Could not send magic link. Try again.';
        await update({ reset: false });
        return;
      }

      await update();
    };
  };
</script>

<section class="min-h-dvh bg-bg px-4 py-10 text-text-primary">
  <div class="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-xl items-center justify-center">
    <div class="w-full rounded-2xl border border-border bg-surface p-card-padding shadow-sm sm:p-8">
      <h1 class="text-2xl font-semibold tracking-tight text-text-primary">Kiawah Golf Manager</h1>
      <p class="mt-2 text-sm text-text-secondary">Enter your email to receive a magic sign-in link.</p>

      <form method="POST" use:enhance={signInEnhance} class="mt-6 space-y-4">
        <div>
          <label for="email" class="text-sm font-semibold text-text-primary">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autocomplete="email"
            required
            autofocus
            value={form?.email ?? ''}
            class="mt-2 min-h-touch w-full rounded-lg border border-border bg-bg px-4 text-base text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
          />
          {#if displayedError}
            <p class="mt-2 text-sm text-status-down">{displayedError}</p>
          {/if}
        </div>

        <button
          type="submit"
          class="inline-flex min-h-touch w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-base font-semibold text-accent-text transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {#if isSubmitting}
            <span
              aria-hidden="true"
              class="h-4 w-4 animate-spin rounded-full border-2 border-accent-text/60 border-t-transparent"
            ></span>
            <span>Sending...</span>
          {:else}
            <span>Send sign-in link</span>
          {/if}
        </button>
      </form>
    </div>
  </div>
</section>
