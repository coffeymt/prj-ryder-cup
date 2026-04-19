<script lang="ts">
  import { page } from '$app/stores';

  function maskEmail(email: string): string {
    const [localPart, domainPart] = email.split('@');

    if (!localPart || !domainPart) {
      return email;
    }

    const visibleLocalChars = localPart.length > 1 ? 2 : 1;
    const maskedLocal = `${localPart.slice(0, visibleLocalChars)}${'*'.repeat(
      Math.max(localPart.length - visibleLocalChars, 1)
    )}`;

    const domainSections = domainPart.split('.');
    const domainName = domainSections[0] ?? '';
    const topLevelDomain = domainSections.length > 1 ? `.${domainSections.slice(1).join('.')}` : '';
    const maskedDomain =
      domainName.length > 1
        ? `${domainName.slice(0, 1)}${'*'.repeat(Math.max(domainName.length - 1, 1))}`
        : '*';

    return `${maskedLocal}@${maskedDomain}${topLevelDomain}`;
  }

  $: email = $page.url.searchParams.get('email')?.trim().toLowerCase() ?? '';
  $: emailDisplay = email ? maskEmail(email) : 'your inbox';
</script>

<section
  class="text-text-primary min-h-dvh bg-gradient-to-b from-[var(--color-bg-gradient-start)] to-[var(--color-bg-gradient-end)] px-4 py-10"
>
  <div class="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-xl items-center justify-center">
    <div
      class="border-border bg-surface p-card-padding animate-slide-up-fade w-full rounded-3xl border shadow-lg sm:p-8"
    >
      <h1 class="text-text-primary text-2xl font-semibold tracking-tight">
        Check your email at {emailDisplay}
      </h1>
      <p class="text-text-secondary mt-3 text-sm">The link expires in 15 minutes.</p>

      <a
        href="/manage/login"
        class="min-h-touch border-border text-text-primary hover:bg-surface-raised mt-6 inline-flex w-full items-center justify-center rounded-xl border bg-transparent px-4 text-base font-semibold shadow-sm transition hover:shadow-md"
      >
        Didn&apos;t get it? Resend link
      </a>
    </div>
  </div>
</section>
