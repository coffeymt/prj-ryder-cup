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
  <title>{data.tournament.name} Teams | Golf Manager</title>
</svelte:head>

<section class="space-y-6">
  <div class="space-y-3">
    <p class="text-text-secondary text-xs font-semibold tracking-[0.2em] uppercase">
      Commissioner Portal
    </p>
    <h1 class="text-text-primary text-2xl font-semibold tracking-tight">{data.tournament.name}</h1>
    <div class="flex flex-wrap gap-2">
      <a
        href={`/manage/tournaments/${data.tournament.id}/teams`}
        class="min-h-touch bg-accent text-accent-text inline-flex items-center rounded-lg px-4 text-sm font-semibold"
        aria-current="page"
      >
        Teams
      </a>
      <a
        href={`/manage/tournaments/${data.tournament.id}/players`}
        class="min-h-touch border-border text-text-primary hover:bg-surface-raised inline-flex items-center rounded-lg border bg-transparent px-4 text-sm font-semibold transition"
      >
        Players
      </a>
    </div>
  </div>

  {#if formState?.success}
    <p
      class="border-status-up/30 bg-status-up/10 text-status-up rounded-lg border px-3 py-2 text-sm font-medium"
      role="status"
    >
      {formState.success}
    </p>
  {/if}

  {#if formState?.error && formState.action === 'deleteTeam'}
    <p
      class="border-status-down/30 bg-status-down/10 text-status-down rounded-lg border px-3 py-2 text-sm font-medium"
    >
      {formState.error}
    </p>
  {/if}

  <section class="border-border bg-surface rounded-2xl border p-4 shadow-sm sm:p-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-text-primary text-lg font-semibold">Teams</h2>
      {#if !showCreateForm}
        <button
          type="button"
          class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover inline-flex items-center rounded-lg px-4 text-sm font-semibold transition"
          on:click={() => (showCreateForm = true)}
        >
          + Add Team
        </button>
      {/if}
    </div>

    {#if showCreateForm}
      <form
        method="POST"
        action="?/createTeam"
        class="border-border mt-4 space-y-4 rounded-xl border p-4"
      >
        <div class="space-y-2">
          <label for="create-team-name" class="text-text-primary block text-sm font-semibold"
            >Team name</label
          >
          <input
            id="create-team-name"
            name="name"
            type="text"
            bind:value={createTeamName}
            class="border-border text-text-primary focus:border-accent focus:ring-accent h-11 w-full rounded-lg border px-3 text-sm transition outline-none focus:ring-1"
            placeholder="Enter team name"
            required
          />
        </div>

        <div class="space-y-2">
          <p class="text-text-primary text-sm font-semibold">Team color</p>
          <ColorPicker value={createTeamColor} onchange={(color) => (createTeamColor = color)} />
          <input type="hidden" name="color" value={createTeamColor} />
        </div>

        {#if formState?.action === 'createTeam' && formState.error}
          <p class="text-status-down text-sm font-medium">{formState.error}</p>
        {/if}

        <div class="flex flex-wrap gap-2">
          <button
            type="submit"
            class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover inline-flex items-center rounded-lg px-4 text-sm font-semibold transition"
          >
            Save Team
          </button>
          <button
            type="button"
            class="min-h-touch border-border text-text-primary hover:bg-surface-raised inline-flex items-center rounded-lg border bg-transparent px-4 text-sm font-semibold transition"
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
        <p
          class="border-border bg-surface-raised text-text-secondary rounded-lg border border-dashed px-4 py-4 text-sm"
        >
          No teams yet. Add your first team to begin assigning players.
        </p>
      {:else}
        {#each data.teams as team (team.id)}
          <article class="border-border bg-surface-raised rounded-xl border p-4">
            {#if editingTeamId === team.id}
              <form method="POST" action="?/updateTeam" class="space-y-4">
                <input type="hidden" name="teamId" value={team.id} />
                <input type="hidden" name="color" value={editTeamColor} />

                <div class="space-y-2">
                  <label
                    for={`team-name-${team.id}`}
                    class="text-text-primary block text-sm font-semibold"
                  >
                    Team name
                  </label>
                  <input
                    id={`team-name-${team.id}`}
                    name="name"
                    type="text"
                    bind:value={editTeamName}
                    class="border-border text-text-primary focus:border-accent focus:ring-accent h-11 w-full rounded-lg border px-3 text-sm transition outline-none focus:ring-1"
                    required
                  />
                </div>

                <div class="space-y-2">
                  <p class="text-text-primary text-sm font-semibold">Team color</p>
                  <ColorPicker
                    value={editTeamColor}
                    onchange={(color) => (editTeamColor = color)}
                  />
                </div>

                <div class="space-y-2">
                  <label
                    for={`team-captain-${team.id}`}
                    class="text-text-primary block text-sm font-semibold"
                  >
                    Captain
                  </label>
                  <select
                    id={`team-captain-${team.id}`}
                    name="captainPlayerId"
                    bind:value={editCaptainPlayerId}
                    class="border-border text-text-primary focus:border-accent focus:ring-accent h-11 w-full rounded-lg border px-3 text-sm transition outline-none focus:ring-1"
                  >
                    <option value="">No captain</option>
                    {#each getTeamPlayers(team.id) as player (player.id)}
                      <option value={player.id}>{player.name}</option>
                    {/each}
                  </select>
                </div>

                {#if formState?.action === 'updateTeam' && formState.error && formState.teamId === team.id}
                  <p class="text-status-down text-sm font-medium">{formState.error}</p>
                {/if}

                <div class="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover inline-flex items-center rounded-lg px-4 text-sm font-semibold transition"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    class="min-h-touch border-border text-text-primary hover:bg-surface-raised inline-flex items-center rounded-lg border bg-transparent px-4 text-sm font-semibold transition"
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
                      class="border-border h-11 w-11 rounded-full border"
                      style={`background-color: ${team.color};`}
                      aria-hidden="true"
                    ></span>
                    <h3 class="text-text-primary text-base font-semibold">{team.name}</h3>
                  </div>
                  <p class="text-text-secondary text-sm">Captain: {getCaptainName(team)}</p>
                </div>

                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="min-h-touch border-border text-text-primary hover:bg-surface-raised inline-flex items-center rounded-lg border bg-transparent px-4 text-sm font-semibold transition"
                    on:click={() => beginEdit(team)}
                  >
                    Edit
                  </button>

                  <form
                    method="POST"
                    action="?/deleteTeam"
                    on:submit={(event) => confirmDelete(event, team.name)}
                  >
                    <input type="hidden" name="teamId" value={team.id} />
                    <button
                      type="submit"
                      class="min-h-touch border-status-down/30 bg-surface text-status-down hover:bg-status-down/10 inline-flex items-center rounded-lg border px-4 text-sm font-medium transition"
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
