<script lang="ts">
  import type { ActionData, PageData } from './$types';

  type TeamRecord = PageData['teams'][number];
  type PlayerRecord = PageData['players'][number];
  type BulkError = { row: number; issues: string[] };
  type PreviewRow = {
    row: number;
    displayName: string;
    handicapRaw: string;
    handicapIndex: number | null;
    email: string;
    errors: string[];
  };

  type FormState = {
    action?: string;
    error?: string;
    success?: string;
    playerId?: string;
    importedCount?: number;
    values?: Partial<
      Record<'displayName' | 'handicapIndex' | 'teamId' | 'email' | 'isCaptain' | 'csvText', string>
    >;
    bulkErrors?: BulkError[];
  };

  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

  export let data: PageData;
  export let form: ActionData | undefined;

  let formState: FormState | undefined;
  $: formState = form as FormState | undefined;

  let editingPlayerId: string | null = null;
  let editDisplayName = '';
  let editHandicapIndex = '';
  let editTeamId = '';
  let editEmail = '';

  let createDisplayName = '';
  let createHandicapIndex = '';
  let createTeamId = '';
  let createEmail = '';

  let csvText = '';
  let previewRows: PreviewRow[] = [];
  let previewParsed = false;

  $: if (formState?.action === 'createPlayer') {
    if (formState.error) {
      createDisplayName = formState.values?.displayName ?? '';
      createHandicapIndex = formState.values?.handicapIndex ?? '';
      createTeamId = formState.values?.teamId ?? '';
      createEmail = formState.values?.email ?? '';
    } else {
      createDisplayName = '';
      createHandicapIndex = '';
      createTeamId = '';
      createEmail = '';
    }
  }

  $: if (formState?.action === 'updatePlayer' && formState.error && formState.playerId) {
    editingPlayerId = formState.playerId;
    editDisplayName = formState.values?.displayName ?? '';
    editHandicapIndex = formState.values?.handicapIndex ?? '';
    editTeamId = formState.values?.teamId ?? '';
    editEmail = formState.values?.email ?? '';
  }

  $: if (formState?.action === 'bulkImport') {
    csvText = formState.values?.csvText ?? '';
  }

  $: previewErrorCount = previewRows.filter((row) => row.errors.length > 0).length;
  $: previewValidCount = previewRows.length - previewErrorCount;
  $: canConfirmImport = previewParsed && previewRows.length > 0 && previewErrorCount === 0;

  function beginEdit(player: PlayerRecord): void {
    editingPlayerId = player.id;
    editDisplayName = player.name;
    editHandicapIndex = String(player.handicap_index);
    editTeamId = player.team_id ?? '';
    editEmail = '';
  }

  function cancelEdit(): void {
    editingPlayerId = null;
    editDisplayName = '';
    editHandicapIndex = '';
    editTeamId = '';
    editEmail = '';
  }

  function getTeam(teamId: string | null): TeamRecord | null {
    if (!teamId) {
      return null;
    }

    return data.teams.find((team) => team.id === teamId) ?? null;
  }

  function isCaptain(player: PlayerRecord): boolean {
    const team = getTeam(player.team_id);
    return team?.captain_player_id === player.id;
  }

  function confirmDelete(event: SubmitEvent, playerName: string): void {
    if (!confirm(`Delete player "${playerName}"? This cannot be undone.`)) {
      event.preventDefault();
    }
  }

  function parsePreview(): void {
    const lines = csvText
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    previewRows = lines.map((line, index) => {
      const rawCells = line.split(',').map((cell) => cell.trim());
      const [displayName = '', handicapRaw = '', email = ''] = rawCells;
      const errors: string[] = [];

      if (rawCells.length < 2 || rawCells.length > 3) {
        errors.push('Expected format: Name, HandicapIndex, Email(optional).');
      }

      if (!displayName) {
        errors.push('Name is required.');
      }

      const handicapIndex = Number(handicapRaw);

      if (handicapRaw.length === 0 || !Number.isFinite(handicapIndex)) {
        errors.push('Handicap index must be a finite number.');
      }

      if (email.length > 0 && !EMAIL_PATTERN.test(email)) {
        errors.push('Email must be valid when provided.');
      }

      return {
        row: index + 1,
        displayName,
        handicapRaw,
        handicapIndex: Number.isFinite(handicapIndex) ? handicapIndex : null,
        email,
        errors,
      };
    });

    previewParsed = true;
  }
</script>

<svelte:head>
  <title>{data.tournament.name} Players | Golf Manager</title>
</svelte:head>

<section class="space-y-6">
  <div class="space-y-3">
    <p class="text-xs font-semibold uppercase tracking-[0.2em] text-text-secondary">Commissioner Portal</p>
    <h1 class="text-2xl font-semibold tracking-tight text-text-primary">{data.tournament.name}</h1>
    <div class="flex flex-wrap gap-2">
      <a
        href={`/manage/tournaments/${data.tournament.id}/teams`}
        class="inline-flex min-h-touch items-center rounded-lg border border-border bg-transparent px-4 text-sm font-semibold text-text-primary transition hover:bg-surface-raised"
      >
        Teams
      </a>
      <a
        href={`/manage/tournaments/${data.tournament.id}/players`}
        class="inline-flex min-h-touch items-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-text"
        aria-current="page"
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

  {#if formState?.error && formState.action === 'deletePlayer'}
    <p class="rounded-lg border border-status-down/30 bg-status-down/10 px-3 py-2 text-sm font-medium text-status-down">
      {formState.error}
    </p>
  {/if}

  <section class="space-y-4 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
    <h2 class="text-lg font-semibold text-text-primary">Roster</h2>

    {#if data.players.length === 0}
      <p class="rounded-lg border border-dashed border-border bg-surface-raised px-4 py-4 text-sm text-text-secondary">
        No players yet. Add players below or import from CSV.
      </p>
    {:else}
      <div class="space-y-3">
        {#each data.players as player (player.id)}
          <article class="rounded-xl border border-border bg-surface-raised p-4">
            <div class="space-y-3">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="space-y-1">
                  <p class="text-base font-semibold text-text-primary">{player.name}</p>
                  <p class="text-sm text-text-secondary">Handicap Index: {player.handicap_index}</p>
                </div>

                {#if isCaptain(player)}
                  <span
                    class="inline-flex min-h-8 items-center rounded-full border border-status-halved/30 bg-status-halved/10 px-3 text-xs font-semibold uppercase tracking-wide text-status-halved"
                  >
                    Captain
                  </span>
                {/if}
              </div>

              <div class="flex items-center gap-2 text-sm text-text-primary">
                {#if getTeam(player.team_id)}
                  <span
                    class="h-5 w-5 rounded-full border border-border"
                    style={`background-color: ${getTeam(player.team_id)?.color};`}
                    aria-hidden="true"
                  ></span>
                  <span>{getTeam(player.team_id)?.name}</span>
                {:else}
                  <span class="rounded-full border border-border px-2 py-0.5 text-xs">Unassigned</span>
                {/if}
              </div>

              {#if editingPlayerId === player.id}
                <form method="POST" action="?/updatePlayer" class="space-y-3 rounded-lg border border-border bg-surface p-3">
                  <input type="hidden" name="playerId" value={player.id} />

                  <div class="space-y-2">
                    <label for={`edit-name-${player.id}`} class="block text-sm font-semibold text-text-primary">
                      Player name
                    </label>
                    <input
                      id={`edit-name-${player.id}`}
                      name="displayName"
                      type="text"
                      bind:value={editDisplayName}
                      class="h-11 w-full rounded-lg border border-border px-3 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                      required
                    />
                  </div>

                  <div class="space-y-2">
                    <label for={`edit-handicap-${player.id}`} class="block text-sm font-semibold text-text-primary">
                      Handicap index
                    </label>
                    <input
                      id={`edit-handicap-${player.id}`}
                      name="handicapIndex"
                      type="number"
                      step="0.1"
                      bind:value={editHandicapIndex}
                      class="h-11 w-full rounded-lg border border-border px-3 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                      required
                    />
                  </div>

                  <div class="space-y-2">
                    <label for={`edit-team-${player.id}`} class="block text-sm font-semibold text-text-primary">
                      Team
                    </label>
                    <select
                      id={`edit-team-${player.id}`}
                      name="teamId"
                      bind:value={editTeamId}
                      class="h-11 w-full rounded-lg border border-border px-3 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                    >
                      <option value="">Unassigned</option>
                      {#each data.teams as team (team.id)}
                        <option value={team.id}>{team.name}</option>
                      {/each}
                    </select>
                  </div>

                  <div class="space-y-2">
                    <label for={`edit-email-${player.id}`} class="block text-sm font-semibold text-text-primary">
                      Email (optional)
                    </label>
                    <input
                      id={`edit-email-${player.id}`}
                      name="email"
                      type="email"
                      bind:value={editEmail}
                      class="h-11 w-full rounded-lg border border-border px-3 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                      placeholder="name@example.com"
                    />
                  </div>

                  {#if formState?.action === 'updatePlayer' && formState.error && formState.playerId === player.id}
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
                <div class="space-y-3 rounded-lg border border-border bg-surface p-3">
                  <form method="POST" action="?/updatePlayer" class="space-y-2">
                    <input type="hidden" name="playerId" value={player.id} />
                    <label for={`assign-team-${player.id}`} class="block text-sm font-semibold text-text-primary">
                      Assign to team
                    </label>
                    <div class="flex flex-col gap-2 sm:flex-row">
                      <select
                        id={`assign-team-${player.id}`}
                        name="teamId"
                        class="h-11 flex-1 rounded-lg border border-border px-3 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                      >
                        <option value="" selected={!player.team_id}>Unassigned</option>
                        {#each data.teams as team (team.id)}
                          <option value={team.id} selected={team.id === player.team_id}>{team.name}</option>
                        {/each}
                      </select>
                      <button
                        type="submit"
                        class="inline-flex min-h-touch items-center justify-center rounded-lg border border-border bg-transparent px-4 text-sm font-semibold text-text-primary transition hover:bg-surface-raised"
                      >
                        Save Team
                      </button>
                    </div>
                  </form>

                  <div class="flex flex-wrap gap-2">
                    <form method="POST" action="?/updatePlayer">
                      <input type="hidden" name="playerId" value={player.id} />
                      <input type="hidden" name="isCaptain" value={isCaptain(player) ? 'false' : 'true'} />
                      {#if !isCaptain(player)}
                        <input type="hidden" name="teamId" value={player.team_id ?? ''} />
                      {/if}
                      <button
                        type="submit"
                        disabled={!isCaptain(player) && !player.team_id}
                        class="inline-flex min-h-touch items-center rounded-lg border border-border bg-transparent px-4 text-sm font-semibold text-text-primary transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:text-text-secondary"
                      >
                        {#if isCaptain(player)}
                          Remove Captain
                        {:else}
                          Make Captain
                        {/if}
                      </button>
                    </form>

                    <button
                      type="button"
                      class="inline-flex min-h-touch items-center rounded-lg border border-border bg-transparent px-4 text-sm font-semibold text-text-primary transition hover:bg-surface-raised"
                      on:click={() => beginEdit(player)}
                    >
                      Edit
                    </button>

                    <form
                      method="POST"
                      action="?/deletePlayer"
                      on:submit={(event) => confirmDelete(event, player.name)}
                    >
                      <input type="hidden" name="playerId" value={player.id} />
                      <button
                        type="submit"
                        class="inline-flex min-h-touch items-center rounded-lg border border-status-down/30 bg-surface px-4 text-sm font-medium text-status-down transition hover:bg-status-down/10"
                      >
                        Delete
                      </button>
                    </form>
                  </div>

                  {#if formState?.action === 'updatePlayer' && formState.error && formState.playerId === player.id}
                    <p class="text-sm font-medium text-status-down">{formState.error}</p>
                  {/if}
                </div>
              {/if}
            </div>
          </article>
        {/each}
      </div>
    {/if}
  </section>

  <section class="space-y-4 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
    <h2 class="text-lg font-semibold text-text-primary">Add Players</h2>

    <form method="POST" action="?/createPlayer" class="space-y-3 rounded-xl border border-border bg-surface-raised p-4">
      <div class="space-y-2">
        <label for="create-player-name" class="block text-sm font-semibold text-text-primary">Player name</label>
        <input
          id="create-player-name"
          name="displayName"
          type="text"
          bind:value={createDisplayName}
          class="h-11 w-full rounded-lg border border-border px-3 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
          required
        />
      </div>

      <div class="space-y-2">
        <label for="create-player-handicap" class="block text-sm font-semibold text-text-primary">
          Handicap index
        </label>
        <input
          id="create-player-handicap"
          name="handicapIndex"
          type="number"
          step="0.1"
          bind:value={createHandicapIndex}
          class="h-11 w-full rounded-lg border border-border px-3 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
          required
        />
      </div>

      <div class="space-y-2">
        <label for="create-player-team" class="block text-sm font-semibold text-text-primary">Team (optional)</label>
        <select
          id="create-player-team"
          name="teamId"
          bind:value={createTeamId}
          class="h-11 w-full rounded-lg border border-border px-3 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
        >
          <option value="">Unassigned</option>
          {#each data.teams as team (team.id)}
            <option value={team.id}>{team.name}</option>
          {/each}
        </select>
      </div>

      <div class="space-y-2">
        <label for="create-player-email" class="block text-sm font-semibold text-text-primary">Email (optional)</label>
        <input
          id="create-player-email"
          name="email"
          type="email"
          bind:value={createEmail}
          class="h-11 w-full rounded-lg border border-border px-3 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
          placeholder="name@example.com"
        />
      </div>

      {#if formState?.action === 'createPlayer' && formState.error}
        <p class="text-sm font-medium text-status-down">{formState.error}</p>
      {/if}

      <button
        type="submit"
        class="inline-flex min-h-touch items-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-text transition hover:bg-accent-hover"
      >
        Add Player
      </button>
    </form>

    <section class="space-y-3 rounded-xl border border-border bg-surface-raised p-4">
      <div class="space-y-1">
        <h3 class="text-base font-semibold text-text-primary">CSV Bulk Import</h3>
        <p class="text-sm text-text-secondary">Paste rows in this format: Name, HandicapIndex, Email(optional).</p>
      </div>

      <form method="POST" action="?/bulkImport" class="space-y-3">
        <label for="bulk-csv" class="sr-only">CSV rows</label>
        <textarea
          id="bulk-csv"
          name="csvText"
          bind:value={csvText}
          rows="7"
          class="w-full rounded-lg border border-border px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
          placeholder="Player One, 10.2, one@example.com&#10;Player Two, 14.8"
        ></textarea>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="inline-flex min-h-touch items-center rounded-lg border border-border bg-transparent px-4 text-sm font-semibold text-text-primary transition hover:bg-surface-raised"
            on:click={parsePreview}
          >
            Parse &amp; Preview
          </button>
          <button
            type="submit"
            class="inline-flex min-h-touch items-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-text transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canConfirmImport}
          >
            Confirm Import
          </button>
        </div>

        {#if !canConfirmImport && previewParsed}
          <p class="text-sm text-text-secondary">
            Resolve all preview errors before confirming import.
          </p>
        {/if}

        {#if formState?.action === 'bulkImport' && formState.error}
          <p class="text-sm font-medium text-status-down">{formState.error}</p>
        {/if}
      </form>

      {#if previewParsed}
        <div class="space-y-2">
          <p class="text-sm font-semibold text-text-primary">
            Preview: {previewValidCount} valid, {previewErrorCount} invalid
          </p>

          <div class="space-y-2">
            {#each previewRows as row (row.row)}
              <div
                class={`rounded-lg border px-3 py-2 text-sm ${
                  row.errors.length > 0 ? 'border-status-down/30 bg-status-down/10' : 'border-status-up/30 bg-status-up/10'
                }`}
              >
                <p class="font-semibold text-text-primary">
                  Row {row.row}: {row.displayName || '(missing name)'} | {row.handicapRaw || '(missing handicap)'}
                  {#if row.email}
                    | {row.email}
                  {/if}
                </p>
                {#if row.errors.length > 0}
                  <ul class="mt-1 space-y-1 text-status-down">
                    {#each row.errors as issue (issue)}
                      <li>{issue}</li>
                    {/each}
                  </ul>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if formState?.action === 'bulkImport' && formState.bulkErrors && formState.bulkErrors.length > 0}
        <div class="rounded-lg border border-status-down/30 bg-status-down/10 px-3 py-2">
          <p class="text-sm font-semibold text-status-down">Import errors:</p>
          <ul class="mt-1 space-y-1 text-sm text-status-down">
            {#each formState.bulkErrors as rowError (`${rowError.row}-${rowError.issues.join('|')}`)}
              <li>Row {rowError.row}: {rowError.issues.join(' ')}</li>
            {/each}
          </ul>
        </div>
      {/if}
    </section>
  </section>
</section>
