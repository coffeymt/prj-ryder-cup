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
    const topLevelDomain =
      domainSections.length > 1 ? `.${domainSections.slice(1).join('.')}` : '';
    const maskedDomain =
      domainName.length > 1
        ? `${domainName.slice(0, 1)}${'*'.repeat(Math.max(domainName.length - 1, 1))}`
        : '*';

    return `${maskedLocal}@${maskedDomain}${topLevelDomain}`;
  }

  $: email = $page.url.searchParams.get('email')?.trim().toLowerCase() ?? '';
  $: emailDisplay = email ? maskEmail(email) : 'your inbox';
</script>

<section class="min-h-dvh bg-bg px-4 py-10 text-text-primary">
  <div class="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-xl items-center justify-center">
    <div class="w-full rounded-2xl border border-border bg-surface p-card-padding shadow-sm sm:p-8">
      <h1 class="text-2xl font-semibold tracking-tight text-text-primary">Check your email at {emailDisplay}</h1>
      <p class="mt-3 text-sm text-text-secondary">The link expires in 15 minutes.</p>

      <a
        href="/manage/login"
        class="mt-6 inline-flex min-h-touch w-full items-center justify-center rounded-lg border border-border bg-transparent px-4 text-base font-semibold text-text-primary transition hover:bg-surface-raised"
      >
        Didn&apos;t get it? Resend link
      </a>
    </div>
  </div>
</section>
