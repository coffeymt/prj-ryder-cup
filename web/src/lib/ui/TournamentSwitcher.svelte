<script lang="ts">
  import { goto } from '$app/navigation';
  import type { Tournament } from '$lib/db/types';
  import { onMount, tick } from 'svelte';

  export let tournaments: Tournament[] = [];
  export let currentTournamentId: string | null = null;

  let isOpen = false;
  let activeIndex = -1;
  let containerElement: HTMLDivElement | null = null;
  let optionRefs: Array<HTMLButtonElement | null> = [];

  $: selectedTournament =
    tournaments.find((tournament) => tournament.id === currentTournamentId) ??
    tournaments[0] ??
    null;
  $: selectedLabel = selectedTournament?.name ?? 'No tournaments';

  function closeMenu(): void {
    isOpen = false;
    activeIndex = -1;
  }

  async function focusActiveOption(): Promise<void> {
    await tick();
    optionRefs[activeIndex]?.focus();
  }

  function openMenu(startIndex: number): void {
    if (tournaments.length === 0) {
      return;
    }

    isOpen = true;
    activeIndex = Math.min(Math.max(startIndex, 0), tournaments.length - 1);
    void focusActiveOption();
  }

  function toggleMenu(): void {
    if (isOpen) {
      closeMenu();
      return;
    }

    const selectedIndex = selectedTournament
      ? tournaments.findIndex((tournament) => tournament.id === selectedTournament.id)
      : 0;
    openMenu(selectedIndex >= 0 ? selectedIndex : 0);
  }

  function moveActive(delta: number): void {
    if (tournaments.length === 0) {
      return;
    }

    if (activeIndex < 0) {
      activeIndex = delta > 0 ? 0 : tournaments.length - 1;
    } else {
      activeIndex = (activeIndex + delta + tournaments.length) % tournaments.length;
    }

    void focusActiveOption();
  }

  async function selectTournament(tournamentId: string): Promise<void> {
    closeMenu();
    await goto(`/manage/tournaments/${tournamentId}`);
  }

  function handleTriggerKeydown(event: KeyboardEvent): void {
    if (tournaments.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      openMenu(0);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      openMenu(tournaments.length - 1);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleMenu();
    }
  }

  function handleMenuKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActive(1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(-1);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      activeIndex = 0;
      void focusActiveOption();
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      activeIndex = tournaments.length - 1;
      void focusActiveOption();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      return;
    }

    if (event.key === 'Tab') {
      closeMenu();
      return;
    }

    if ((event.key === 'Enter' || event.key === ' ') && activeIndex >= 0) {
      event.preventDefault();
      const activeTournament = tournaments[activeIndex];

      if (activeTournament) {
        void selectTournament(activeTournament.id);
      }
    }
  }

  function handleDocumentPointerDown(event: MouseEvent): void {
    if (!isOpen || !containerElement) {
      return;
    }

    const target = event.target;

    if (target instanceof Node && !containerElement.contains(target)) {
      closeMenu();
    }
  }

  function handleDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && isOpen) {
      closeMenu();
    }
  }

  onMount(() => {
    document.addEventListener('mousedown', handleDocumentPointerDown);
    document.addEventListener('keydown', handleDocumentKeydown);

    return () => {
      document.removeEventListener('mousedown', handleDocumentPointerDown);
      document.removeEventListener('keydown', handleDocumentKeydown);
    };
  });
</script>

<div class="relative w-full max-w-sm" bind:this={containerElement}>
  {#if tournaments.length === 0}
    <div
      class="min-h-touch border-border bg-surface text-text-primary flex items-center justify-between rounded-lg border px-3 text-sm"
    >
      <span>No tournaments</span>
      <a href="/manage/tournaments/new" class="text-accent font-semibold underline">Create one</a>
    </div>
  {:else}
    <button
      type="button"
      class="min-h-touch border-border bg-surface text-text-primary hover:bg-surface-raised focus-visible:ring-accent inline-flex w-full items-center justify-between rounded-lg border px-3 text-left text-sm font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2"
      aria-haspopup="menu"
      aria-expanded={isOpen}
      aria-controls="tournament-switcher-menu"
      on:click={toggleMenu}
      on:keydown={handleTriggerKeydown}
    >
      <span class="truncate pr-2">{selectedLabel}</span>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="currentColor"
        class={`text-text-secondary h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
      >
        <path
          fill-rule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.167l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.51a.75.75 0 01-1.08 0l-4.25-4.51a.75.75 0 01.02-1.06z"
          clip-rule="evenodd"
        />
      </svg>
    </button>

    {#if isOpen}
      <div
        class="border-border bg-surface absolute right-0 left-0 z-40 mt-2 rounded-lg border shadow-lg"
      >
        <ul
          id="tournament-switcher-menu"
          role="menu"
          aria-label="Tournament switcher"
          class="max-h-64 overflow-auto py-1"
          on:keydown={handleMenuKeydown}
        >
          {#each tournaments as tournament, index (tournament.id)}
            <li role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={selectedTournament?.id === tournament.id}
                bind:this={optionRefs[index]}
                class={`min-h-touch flex w-full items-center justify-between px-3 text-left text-sm transition ${
                  selectedTournament?.id === tournament.id
                    ? 'bg-accent text-accent-text'
                    : 'text-text-primary hover:bg-surface-raised'
                }`}
                on:click={() => selectTournament(tournament.id)}
                on:mouseenter={() => (activeIndex = index)}
              >
                <span class="truncate">{tournament.name}</span>
                {#if selectedTournament?.id === tournament.id}
                  <span class="ml-3 text-xs font-medium">Current</span>
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  {/if}
</div>
