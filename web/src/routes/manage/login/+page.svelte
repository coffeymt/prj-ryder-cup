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

<section class="bg-bg text-text-primary min-h-dvh px-4 py-10">
  <div class="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-xl items-center justify-center">
    <div class="border-border bg-surface p-card-padding w-full rounded-2xl border shadow-sm sm:p-8">
      <h1 class="text-text-primary text-2xl font-semibold tracking-tight">Kiawah Golf Manager</h1>
      <p class="text-text-secondary mt-2 text-sm">
        Enter your email to receive a magic sign-in link.
      </p>

      <form method="POST" use:enhance={signInEnhance} class="mt-6 space-y-4">
        <div>
          <label for="email" class="text-text-primary text-sm font-semibold">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autocomplete="email"
            required
            autofocus
            value={form?.email ?? ''}
            class="min-h-touch border-border bg-bg text-text-primary focus:border-accent focus:ring-accent mt-2 w-full rounded-lg border px-4 text-base transition outline-none focus:ring-1"
          />
          {#if displayedError}
            <p class="text-status-down mt-2 text-sm">{displayedError}</p>
          {/if}
        </div>

        <button
          type="submit"
          class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {#if isSubmitting}
            <span
              aria-hidden="true"
              class="border-accent-text/60 h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
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
