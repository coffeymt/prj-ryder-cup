<script lang="ts">
  import { afterNavigate, goto } from '$app/navigation';
  import { page } from '$app/stores';
  import TournamentSwitcher from '$lib/ui/TournamentSwitcher.svelte';
  import type { LayoutData } from './$types';

  type NavigationLink = {
    label: string;
    href: string;
    active: boolean;
  };

  const AUTH_ROUTE_IDS = new Set(['/manage/login', '/manage/magic-link-sent']);

  export let data: LayoutData;
  let mobileNavOpen = false;
  let isLoggingOut = false;
  let logoutError: string | null = null;

  $: currentPath = $page.url.pathname;
  $: isAuthRoute = AUTH_ROUTE_IDS.has($page.route.id ?? '');
  $: currentTournamentId = data.currentTournamentId;
  $: tournamentBasePath = currentTournamentId ? `/manage/tournaments/${currentTournamentId}` : null;
  $: navLinks = tournamentBasePath ? buildNavigationLinks(currentPath, tournamentBasePath) : [];

  afterNavigate(() => {
    mobileNavOpen = false;
    logoutError = null;
  });

  function isPathPrefix(pathname: string, href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function buildNavigationLinks(pathname: string, tournamentPath: string): NavigationLink[] {
    return [
      {
        label: 'Overview',
        href: tournamentPath,
        active: pathname === tournamentPath,
      },
      {
        label: 'Teams & Players',
        href: `${tournamentPath}/teams`,
        active: isPathPrefix(pathname, `${tournamentPath}/teams`),
      },
      {
        label: 'Courses',
        href: '/manage/courses',
        active: isPathPrefix(pathname, '/manage/courses'),
      },
      {
        label: 'Rounds',
        href: `${tournamentPath}/rounds`,
        active: isPathPrefix(pathname, `${tournamentPath}/rounds`),
      },
      {
        label: 'Overrides',
        href: `${tournamentPath}/overrides`,
        active: isPathPrefix(pathname, `${tournamentPath}/overrides`),
      },
    ];
  }

  async function handleLogout(): Promise<void> {
    if (isLoggingOut) {
      return;
    }

    isLoggingOut = true;
    logoutError = null;

    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to log out.');
      }

      await goto('/manage/login', { replaceState: true });
    } catch {
      logoutError = 'Could not log out. Try again.';
    } finally {
      isLoggingOut = false;
    }
  }
</script>

{#if isAuthRoute}
  <slot />
{:else}
  <div class="bg-bg text-text-primary min-h-dvh">
    <header class="border-border bg-surface-glass border-b backdrop-blur-md">
      <div
        class="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-4"
      >
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="min-h-touch min-w-touch border-border text-text-primary hover:bg-surface-raised duration-base inline-flex items-center justify-center rounded-lg border bg-transparent transition-all md:hidden"
            aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileNavOpen}
            aria-controls="manage-side-nav"
            on:click={() => (mobileNavOpen = !mobileNavOpen)}
          >
            {#if mobileNavOpen}
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" class="h-5 w-5">
                <path
                  fill-rule="evenodd"
                  d="M4.22 4.22a.75.75 0 011.06 0L10 8.94l4.72-4.72a.75.75 0 111.06 1.06L11.06 10l4.72 4.72a.75.75 0 11-1.06 1.06L10 11.06l-4.72 4.72a.75.75 0 01-1.06-1.06L8.94 10 4.22 5.28a.75.75 0 010-1.06z"
                  clip-rule="evenodd"
                />
              </svg>
            {:else}
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" class="h-5 w-5">
                <path
                  fill-rule="evenodd"
                  d="M3 5.75A.75.75 0 013.75 5h12.5a.75.75 0 010 1.5H3.75A.75.75 0 013 5.75zm0 4.25a.75.75 0 01.75-.75h12.5a.75.75 0 010 1.5H3.75A.75.75 0 013 10zm0 4.25a.75.75 0 01.75-.75h12.5a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75z"
                  clip-rule="evenodd"
                />
              </svg>
            {/if}
          </button>

          <a href="/manage" class="text-text-primary text-lg font-semibold tracking-tight"
            >Kiawah Golf</a
          >
        </div>

        <div class="hidden min-w-0 flex-1 justify-center sm:flex">
          <TournamentSwitcher
            tournaments={data.tournaments}
            currentTournamentId={data.currentTournamentId}
          />
        </div>

        <div class="flex items-center gap-2">
          <a
            href="/manage/tournaments/new"
            class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover inline-flex items-center justify-center rounded-xl px-4 text-sm font-semibold shadow-sm transition hover:shadow-md"
          >
            + New Tournament
          </a>
          <button
            type="button"
            class="min-h-touch border-border text-text-primary hover:bg-surface-raised inline-flex items-center justify-center rounded-lg border bg-transparent px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
            on:click={handleLogout}
            disabled={isLoggingOut}
            aria-busy={isLoggingOut}
          >
            {isLoggingOut ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      </div>

      <div class="border-border border-t px-3 py-3 sm:hidden">
        <TournamentSwitcher
          tournaments={data.tournaments}
          currentTournamentId={data.currentTournamentId}
        />
      </div>

      {#if logoutError}
        <p class="text-status-down px-3 pb-3 text-sm sm:px-4">{logoutError}</p>
      {/if}
    </header>

    <div class="relative mx-auto flex w-full max-w-7xl flex-1">
      {#if mobileNavOpen}
        <button
          type="button"
          class="bg-text-primary/40 absolute inset-0 z-20 md:hidden"
          aria-label="Close navigation menu"
          on:click={() => (mobileNavOpen = false)}
        ></button>
      {/if}

      <aside
        id="manage-side-nav"
        class={`border-border bg-surface absolute inset-y-0 left-0 z-30 w-72 border-r p-4 transition-transform md:static md:w-64 md:translate-x-0 ${
          mobileNavOpen
            ? 'translate-x-0 shadow-md md:shadow-none'
            : '-translate-x-full md:shadow-none'
        }`}
      >
        <div class="text-text-secondary mb-3 text-xs font-semibold tracking-wide uppercase">
          Tournament Menu
        </div>

        {#if navLinks.length > 0}
          <nav aria-label="Tournament navigation" class="space-y-1">
            {#each navLinks as link (link.href)}
              <a
                href={link.href}
                class={`min-h-touch flex items-center rounded-lg px-3 text-sm font-semibold transition ${
                  link.active
                    ? 'bg-accent text-accent-text shadow-sm'
                    : 'text-text-primary hover:bg-surface-raised hover:text-text-primary'
                }`}
                aria-current={link.active ? 'page' : undefined}
              >
                {link.label}
              </a>
            {/each}
          </nav>
        {:else}
          <div
            class="border-border bg-surface-raised p-card-padding text-text-secondary rounded-xl border text-sm shadow-sm"
          >
            Create your first tournament to unlock manager navigation.
            <a
              href="/manage/tournaments/new"
              class="min-h-touch text-accent mt-3 inline-flex items-center font-semibold underline"
            >
              Create tournament
            </a>
          </div>
        {/if}
      </aside>

      <main class="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <slot />
      </main>
    </div>
  </div>
{/if}
