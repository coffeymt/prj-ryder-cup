<script lang="ts">
  import ColorPicker from '$lib/ui/ColorPicker.svelte';
  import type { ActionData, PageData } from './$types';

  const FALLBACK_COLOR_TOKEN = '--color-accent';

  export let data: PageData;
  export let form: ActionData | undefined;

  type PlayerRecord = PageData['players'][number];
  type TeamRecord = PageData['teams'][number];
  type FormState = {
    action?: string;
    error?: string;
    success?: string;
    teamId?: string;
    values?: Partial<Record<'name' | 'color' | 'captainPlayerId', string>>;
  };

  let showCreateForm = false;
  let createTeamName = '';
  let createTeamColor = '';

  let editingTeamId: string | null = null;
  let editTeamName = '';
  let editTeamColor = '';
  let editCaptainPlayerId = '';

  let formState: FormState | undefined;
  $: formState = form as FormState | undefined;

  $: if (formState?.action === 'createTeam') {
    if (formState.error) {
      showCreateForm = true;
      createTeamName = formState.values?.name ?? '';
      createTeamColor = formState.values?.color ?? resolveThemeColor(FALLBACK_COLOR_TOKEN);
    } else {
      showCreateForm = false;
      createTeamName = '';
      createTeamColor = resolveThemeColor(FALLBACK_COLOR_TOKEN);
    }
  }

  $: if (formState?.action === 'updateTeam' && formState.error && formState.teamId) {
    editingTeamId = formState.teamId;
    editTeamName = formState.values?.name ?? '';
    editTeamColor = formState.values?.color ?? resolveThemeColor(FALLBACK_COLOR_TOKEN);
    editCaptainPlayerId = formState.values?.captainPlayerId ?? '';
  }

  function beginEdit(team: TeamRecord): void {
    editingTeamId = team.id;
    editTeamName = team.name;
    editTeamColor = team.color;
    editCaptainPlayerId = team.captain_player_id ?? '';
  }

  function cancelEdit(): void {
    editingTeamId = null;
    editTeamName = '';
    editTeamColor = resolveThemeColor(FALLBACK_COLOR_TOKEN);
    editCaptainPlayerId = '';
  }

  function resolveThemeColor(token: string): string {
    if (typeof window === 'undefined') {
      return '';
    }
    return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  }

  $: if (!createTeamColor) {
    createTeamColor = resolveThemeColor(FALLBACK_COLOR_TOKEN);
  }

  $: if (!editTeamColor) {
    editTeamColor = resolveThemeColor(FALLBACK_COLOR_TOKEN);
  }

  function getTeamPlayers(teamId: string): PlayerRecord[] {
    return data.players.filter((player) => player.team_id === teamId);
  }

  function getCaptainName(team: TeamRecord): string {
    if (!team.captain_player_id) {
      return 'No captain assigned';
    }

    const captain = data.players.find((player) => player.id === team.captain_player_id);
    return captain?.name ?? 'Captain not found';
  }

  function confirmDelete(event: SubmitEvent, teamName: string): void {
    if (!confirm(`Delete team "${teamName}"? This cannot be undone.`)) {
      event.preventDefault();
    }
  }
</script>

<svelte:head>
  <title>{data.tournament.name} Teams | Ryder Cup Manager</title>
</svelte:head>

<section class="space-y-6">
  <div class="space-y-3">
    <p class="text-xs font-semibold uppercase tracking-[0.2em] text-text-secondary">Commissioner Portal</p>
    <h1 class="text-2xl font-semibold tracking-tight text-text-primary">{data.tournament.name}</h1>
    <div class="flex flex-wrap gap-2">
      <a
        href={`/manage/tournaments/${data.tournament.id}/teams`}
        class="inline-flex min-h-touch items-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-text"
        aria-current="page"
      >
        Teams
      </a>
      <a
        href={`/manage/tournaments/${data.tournament.id}/players`}
        class="inline-flex min-h-touch items-center rounded-lg border border-border bg-transparent px-4 text-sm font-semibold text-text-primary transition hover:bg-surface-raised"
      >
        Players
      </a>
    </div>
  </div>

  {#if formState?.success}
    <p
      class="rounded-lg border border-status-up/30 bg-status-up/10 px-3 py-2 text-sm font-medium text-status-up"
      role="status"
    >
      {formState.success}
    </p>
  {/if}

  {#if formState?.error && formState.action === 'deleteTeam'}
    <p class="rounded-lg border border-status-down/30 bg-status-down/10 px-3 py-2 text-sm font-medium text-status-down">
      {formState.error}
    </p>
  {/if}

  <section class="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-lg font-semibold text-text-primary">Teams</h2>
      {#if !showCreateForm}
        <button
          type="button"
          class="inline-flex min-h-touch items-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-text transition hover:bg-accent-hover"
          on:click={() => (showCreateForm = true)}
        >
          + Add Team
        </button>
      {/if}
    </div>

    {#if showCreateForm}
      <form method="POST" action="?/createTeam" class="mt-4 space-y-4 rounded-xl border border-border p-4">
        <div class="space-y-2">
          <label for="create-team-name" class="block text-sm font-semibold text-text-primary">Team name</label>
          <input
            id="create-team-name"
            name="name"
            type="text"
            bind:value={createTeamName}
            class="h-11 w-full rounded-lg border border-border px-3 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
            placeholder="Enter team name"
            required
          />
        </div>

        <div class="space-y-2">
          <p class="text-sm font-semibold text-text-primary">Team color</p>
          <ColorPicker value={createTeamColor} onchange={(color) => (createTeamColor = color)} />
          <input type="hidden" name="color" value={createTeamColor} />
        </div>

        {#if formState?.action === 'createTeam' && formState.error}
          <p class="text-sm font-medium text-status-down">{formState.error}</p>
        {/if}

        <div class="flex flex-wrap gap-2">
          <button
            type="submit"
            class="inline-flex min-h-touch items-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-text transition hover:bg-accent-hover"
          >
            Save Team
          </button>
          <button
            type="button"
            class="inline-flex min-h-touch items-center rounded-lg border border-border bg-transparent px-4 text-sm font-semibold text-text-primary transition hover:bg-surface-raised"
            on:click={() => {
              showCreateForm = false;
              createTeamName = '';
              createTeamColor = resolveThemeColor(FALLBACK_COLOR_TOKEN);
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    {/if}

    <div class="mt-4 space-y-3">
      {#if data.teams.length === 0}
        <p class="rounded-lg border border-dashed border-border bg-surface-raised px-4 py-4 text-sm text-text-secondary">
          No teams yet. Add your first team to begin assigning players.
        </p>
      {:else}
        {#each data.teams as team (team.id)}
          <article class="rounded-xl border border-border bg-surface-raised p-4">
            {#if editingTeamId === team.id}
              <form method="POST" action="?/updateTeam" class="space-y-4">
                <input type="hidden" name="teamId" value={team.id} />
                <input type="hidden" name="color" value={editTeamColor} />

                <div class="space-y-2">
                  <label for={`team-name-${team.id}`} class="block text-sm font-semibold text-text-primary">
                    Team name
                  </label>
                  <input
                    id={`team-name-${team.id}`}
                    name="name"
                    type="text"
                    bind:value={editTeamName}
                    class="h-11 w-full rounded-lg border border-border px-3 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                    required
                  />
                </div>

                <div class="space-y-2">
                  <p class="text-sm font-semibold text-text-primary">Team color</p>
                  <ColorPicker value={editTeamColor} onchange={(color) => (editTeamColor = color)} />
                </div>

                <div class="space-y-2">
                  <label for={`team-captain-${team.id}`} class="block text-sm font-semibold text-text-primary">
                    Captain
                  </label>
                  <select
                    id={`team-captain-${team.id}`}
                    name="captainPlayerId"
                    bind:value={editCaptainPlayerId}
                    class="h-11 w-full rounded-lg border border-border px-3 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                  >
                    <option value="">No captain</option>
                    {#each getTeamPlayers(team.id) as player (player.id)}
                      <option value={player.id}>{player.name}</option>
                    {/each}
                  </select>
                </div>

                {#if formState?.action === 'updateTeam' && formState.error && formState.teamId === team.id}
                  <p class="text-sm font-medium text-status-down">{formState.error}</p>
                {/if}

                <div class="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    class="inline-flex min-h-touch items-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-text transition hover:bg-accent-hover"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    class="inline-flex min-h-touch items-center rounded-lg border border-border bg-transparent px-4 text-sm font-semibold text-text-primary transition hover:bg-surface-raised"
                    on:click={cancelEdit}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            {:else}
              <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div class="space-y-2">
                  <div class="flex items-center gap-3">
                    <span
                      class="h-11 w-11 rounded-full border border-border"
                      style={`background-color: ${team.color};`}
                      aria-hidden="true"
                    ></span>
                    <h3 class="text-base font-semibold text-text-primary">{team.name}</h3>
                  </div>
                  <p class="text-sm text-text-secondary">Captain: {getCaptainName(team)}</p>
                </div>

                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="inline-flex min-h-touch items-center rounded-lg border border-border bg-transparent px-4 text-sm font-semibold text-text-primary transition hover:bg-surface-raised"
                    on:click={() => beginEdit(team)}
                  >
                    Edit
                  </button>

                  <form method="POST" action="?/deleteTeam" on:submit={(event) => confirmDelete(event, team.name)}>
                    <input type="hidden" name="teamId" value={team.id} />
                    <button
                      type="submit"
                      class="inline-flex min-h-touch items-center rounded-lg border border-status-down/30 bg-surface px-4 text-sm font-medium text-status-down transition hover:bg-status-down/10"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            {/if}
          </article>
        {/each}
      {/if}
    </div>
  </section>
</section>
