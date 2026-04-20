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
    <p class="text-text-secondary text-xs font-semibold tracking-[0.2em] uppercase">
      Commissioner Portal
    </p>
    <h1 class="text-text-primary text-2xl font-semibold tracking-tight">{data.tournament.name}</h1>
    <div class="flex flex-wrap gap-2">
      <a
        href={`/manage/tournaments/${data.tournament.id}/teams`}
        class="min-h-touch border-border text-text-primary hover:bg-surface-raised inline-flex items-center rounded-lg border bg-transparent px-4 text-sm font-semibold transition"
      >
        Teams
      </a>
      <a
        href={`/manage/tournaments/${data.tournament.id}/players`}
        class="min-h-touch bg-accent text-accent-text inline-flex items-center rounded-lg px-4 text-sm font-semibold"
        aria-current="page"
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

  {#if formState?.error && formState.action === 'deletePlayer'}
    <p
      class="border-status-down/30 bg-status-down/10 text-status-down rounded-lg border px-3 py-2 text-sm font-medium"
    >
      {formState.error}
    </p>
  {/if}

  <section class="border-border bg-surface space-y-4 rounded-2xl border p-4 shadow-sm sm:p-5">
    <h2 class="text-text-primary text-lg font-semibold">Roster</h2>

    {#if data.players.length === 0}
      <p
        class="border-border bg-surface-raised text-text-secondary rounded-lg border border-dashed px-4 py-4 text-sm"
      >
        No players yet. Add players below or import from CSV.
      </p>
    {:else}
      <div class="space-y-3">
        {#each data.players as player (player.id)}
          <article class="border-border bg-surface-raised rounded-xl border p-4">
            <div class="space-y-3">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="space-y-1">
                  <p class="text-text-primary text-base font-semibold">{player.name}</p>
                  <p class="text-text-secondary text-sm">
                    Handicap: {player.effective_handicap}{#if player.handicap_index_override !== null}&nbsp;<span
                        class="text-text-muted text-xs">(override)</span
                      >{/if}
                  </p>
                  {#if player.email}
                    <p class="text-text-secondary text-xs">{player.email}</p>
                  {/if}
                  {#if player.ghin_number}
                    <p class="text-text-secondary text-xs">GHIN: {player.ghin_number}</p>
                  {/if}
                </div>

                {#if isCaptain(player)}
                  <span
                    class="border-status-halved/30 bg-status-halved/10 text-status-halved inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-semibold tracking-wide uppercase"
                  >
                    Captain
                  </span>
                {/if}
              </div>

              <div class="text-text-primary flex items-center gap-2 text-sm">
                {#if getTeam(player.team_id)}
                  <span
                    class="border-border h-5 w-5 rounded-full border"
                    style={`background-color: ${getTeam(player.team_id)?.color};`}
                    aria-hidden="true"
                  ></span>
                  <span>{getTeam(player.team_id)?.name}</span>
                {:else}
                  <span class="border-border rounded-full border px-2 py-0.5 text-xs"
                    >Unassigned</span
                  >
                {/if}
              </div>

              {#if editingPlayerId === player.id}
                <form
                  method="POST"
                  action="?/updatePlayer"
                  class="border-border bg-surface space-y-3 rounded-lg border p-3"
                >
                  <input type="hidden" name="playerId" value={player.id} />

                  <div class="space-y-2">
                    <label
                      for={`edit-name-${player.id}`}
                      class="text-text-primary block text-sm font-semibold"
                    >
                      Player name
                    </label>
                    <input
                      id={`edit-name-${player.id}`}
                      name="displayName"
                      type="text"
                      bind:value={editDisplayName}
                      class="border-border text-text-primary focus:border-accent focus:ring-accent h-11 w-full rounded-lg border px-3 text-sm transition outline-none focus:ring-1"
                      required
                    />
                  </div>

                  <div class="space-y-2">
                    <label
                      for={`edit-handicap-${player.id}`}
                      class="text-text-primary block text-sm font-semibold"
                    >
                      Handicap index
                    </label>
                    <input
                      id={`edit-handicap-${player.id}`}
                      name="handicapIndex"
                      type="number"
                      step="0.1"
                      bind:value={editHandicapIndex}
                      class="border-border text-text-primary focus:border-accent focus:ring-accent h-11 w-full rounded-lg border px-3 text-sm transition outline-none focus:ring-1"
                      required
                    />
                  </div>

                  <div class="space-y-2">
                    <label
                      for={`edit-team-${player.id}`}
                      class="text-text-primary block text-sm font-semibold"
                    >
                      Team
                    </label>
                    <select
                      id={`edit-team-${player.id}`}
                      name="teamId"
                      bind:value={editTeamId}
                      class="border-border text-text-primary focus:border-accent focus:ring-accent h-11 w-full rounded-lg border px-3 text-sm transition outline-none focus:ring-1"
                    >
                      <option value="">Unassigned</option>
                      {#each data.teams as team (team.id)}
                        <option value={team.id}>{team.name}</option>
                      {/each}
                    </select>
                  </div>

                  <div class="space-y-2">
                    <label
                      for={`edit-email-${player.id}`}
                      class="text-text-primary block text-sm font-semibold"
                    >
                      Email (optional)
                    </label>
                    <input
                      id={`edit-email-${player.id}`}
                      name="email"
                      type="email"
                      bind:value={editEmail}
                      class="border-border text-text-primary focus:border-accent focus:ring-accent h-11 w-full rounded-lg border px-3 text-sm transition outline-none focus:ring-1"
                      placeholder="name@example.com"
                    />
                  </div>

                  {#if formState?.action === 'updatePlayer' && formState.error && formState.playerId === player.id}
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
                <div class="border-border bg-surface space-y-3 rounded-lg border p-3">
                  <form method="POST" action="?/updatePlayer" class="space-y-2">
                    <input type="hidden" name="playerId" value={player.id} />
                    <label
                      for={`assign-team-${player.id}`}
                      class="text-text-primary block text-sm font-semibold"
                    >
                      Assign to team
                    </label>
                    <div class="flex flex-col gap-2 sm:flex-row">
                      <select
                        id={`assign-team-${player.id}`}
                        name="teamId"
                        class="border-border text-text-primary focus:border-accent focus:ring-accent h-11 flex-1 rounded-lg border px-3 text-sm transition outline-none focus:ring-1"
                      >
                        <option value="" selected={!player.team_id}>Unassigned</option>
                        {#each data.teams as team (team.id)}
                          <option value={team.id} selected={team.id === player.team_id}
                            >{team.name}</option
                          >
                        {/each}
                      </select>
                      <button
                        type="submit"
                        class="min-h-touch border-border text-text-primary hover:bg-surface-raised inline-flex items-center justify-center rounded-lg border bg-transparent px-4 text-sm font-semibold transition"
                      >
                        Save Team
                      </button>
                    </div>
                  </form>

                  <div class="flex flex-wrap gap-2">
                    <form method="POST" action="?/updatePlayer">
                      <input type="hidden" name="playerId" value={player.id} />
                      <input
                        type="hidden"
                        name="isCaptain"
                        value={isCaptain(player) ? 'false' : 'true'}
                      />
                      {#if !isCaptain(player)}
                        <input type="hidden" name="teamId" value={player.team_id ?? ''} />
                      {/if}
                      <button
                        type="submit"
                        disabled={!isCaptain(player) && !player.team_id}
                        class="min-h-touch border-border text-text-primary hover:bg-surface-raised disabled:text-text-secondary inline-flex items-center rounded-lg border bg-transparent px-4 text-sm font-semibold transition disabled:cursor-not-allowed"
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
                      class="min-h-touch border-border text-text-primary hover:bg-surface-raised inline-flex items-center rounded-lg border bg-transparent px-4 text-sm font-semibold transition"
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
                        class="min-h-touch border-status-down/30 bg-surface text-status-down hover:bg-status-down/10 inline-flex items-center rounded-lg border px-4 text-sm font-medium transition"
                      >
                        Delete
                      </button>
                    </form>
                  </div>

                  {#if formState?.action === 'updatePlayer' && formState.error && formState.playerId === player.id}
                    <p class="text-status-down text-sm font-medium">{formState.error}</p>
                  {/if}
                </div>
              {/if}
            </div>
          </article>
        {/each}
      </div>
    {/if}
  </section>

  <section class="border-border bg-surface space-y-4 rounded-2xl border p-4 shadow-sm sm:p-5">
    <h2 class="text-text-primary text-lg font-semibold">Add Players</h2>

    <form
      method="POST"
      action="?/createPlayer"
      class="border-border bg-surface-raised space-y-3 rounded-xl border p-4"
    >
      <div class="space-y-2">
        <label for="create-player-name" class="text-text-primary block text-sm font-semibold"
          >Player name</label
        >
        <input
          id="create-player-name"
          name="displayName"
          type="text"
          bind:value={createDisplayName}
          class="border-border text-text-primary focus:border-accent focus:ring-accent h-11 w-full rounded-lg border px-3 text-sm transition outline-none focus:ring-1"
          required
        />
      </div>

      <div class="space-y-2">
        <label for="create-player-handicap" class="text-text-primary block text-sm font-semibold">
          Handicap index
        </label>
        <input
          id="create-player-handicap"
          name="handicapIndex"
          type="number"
          step="0.1"
          bind:value={createHandicapIndex}
          class="border-border text-text-primary focus:border-accent focus:ring-accent h-11 w-full rounded-lg border px-3 text-sm transition outline-none focus:ring-1"
          required
        />
      </div>

      <div class="space-y-2">
        <label for="create-player-team" class="text-text-primary block text-sm font-semibold"
          >Team (optional)</label
        >
        <select
          id="create-player-team"
          name="teamId"
          bind:value={createTeamId}
          class="border-border text-text-primary focus:border-accent focus:ring-accent h-11 w-full rounded-lg border px-3 text-sm transition outline-none focus:ring-1"
        >
          <option value="">Unassigned</option>
          {#each data.teams as team (team.id)}
            <option value={team.id}>{team.name}</option>
          {/each}
        </select>
      </div>

      <div class="space-y-2">
        <label for="create-player-email" class="text-text-primary block text-sm font-semibold"
          >Email (optional)</label
        >
        <input
          id="create-player-email"
          name="email"
          type="email"
          bind:value={createEmail}
          class="border-border text-text-primary focus:border-accent focus:ring-accent h-11 w-full rounded-lg border px-3 text-sm transition outline-none focus:ring-1"
          placeholder="name@example.com"
        />
      </div>

      {#if formState?.action === 'createPlayer' && formState.error}
        <p class="text-status-down text-sm font-medium">{formState.error}</p>
      {/if}

      <button
        type="submit"
        class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover inline-flex items-center rounded-lg px-4 text-sm font-semibold transition"
      >
        Add Player
      </button>
    </form>

    <section class="border-border bg-surface-raised space-y-3 rounded-xl border p-4">
      <div class="space-y-1">
        <h3 class="text-text-primary text-base font-semibold">CSV Bulk Import</h3>
        <p class="text-text-secondary text-sm">
          Paste rows in this format: Name, HandicapIndex, Email(optional).
        </p>
      </div>

      <form method="POST" action="?/bulkImport" class="space-y-3">
        <label for="bulk-csv" class="sr-only">CSV rows</label>
        <textarea
          id="bulk-csv"
          name="csvText"
          bind:value={csvText}
          rows="7"
          class="border-border text-text-primary focus:border-accent focus:ring-accent w-full rounded-lg border px-3 py-2 text-sm transition outline-none focus:ring-1"
          placeholder="Player One, 10.2, one@example.com&#10;Player Two, 14.8"
        ></textarea>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="min-h-touch border-border text-text-primary hover:bg-surface-raised inline-flex items-center rounded-lg border bg-transparent px-4 text-sm font-semibold transition"
            on:click={parsePreview}
          >
            Parse &amp; Preview
          </button>
          <button
            type="submit"
            class="min-h-touch bg-accent text-accent-text hover:bg-accent-hover inline-flex items-center rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canConfirmImport}
          >
            Confirm Import
          </button>
        </div>

        {#if !canConfirmImport && previewParsed}
          <p class="text-text-secondary text-sm">
            Resolve all preview errors before confirming import.
          </p>
        {/if}

        {#if formState?.action === 'bulkImport' && formState.error}
          <p class="text-status-down text-sm font-medium">{formState.error}</p>
        {/if}
      </form>

      {#if previewParsed}
        <div class="space-y-2">
          <p class="text-text-primary text-sm font-semibold">
            Preview: {previewValidCount} valid, {previewErrorCount} invalid
          </p>

          <div class="space-y-2">
            {#each previewRows as row (row.row)}
              <div
                class={`rounded-lg border px-3 py-2 text-sm ${
                  row.errors.length > 0
                    ? 'border-status-down/30 bg-status-down/10'
                    : 'border-status-up/30 bg-status-up/10'
                }`}
              >
                <p class="text-text-primary font-semibold">
                  Row {row.row}: {row.displayName || '(missing name)'} | {row.handicapRaw ||
                    '(missing handicap)'}
                  {#if row.email}
                    | {row.email}
                  {/if}
                </p>
                {#if row.errors.length > 0}
                  <ul class="text-status-down mt-1 space-y-1">
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
        <div class="border-status-down/30 bg-status-down/10 rounded-lg border px-3 py-2">
          <p class="text-status-down text-sm font-semibold">Import errors:</p>
          <ul class="text-status-down mt-1 space-y-1 text-sm">
            {#each formState.bulkErrors as rowError (`${rowError.row}-${rowError.issues.join('|')}`)}
              <li>Row {rowError.row}: {rowError.issues.join(' ')}</li>
            {/each}
          </ul>
        </div>
      {/if}
    </section>
  </section>
</section>
