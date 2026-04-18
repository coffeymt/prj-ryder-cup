<script lang="ts">
  import type { Player, Team } from '$lib/db/types';

  export type Matchup = {
    id: string;
    sideAPlayerIds: string[];
    sideBPlayerIds: string[];
  };

  export let teamA: Team;
  export let teamB: Team;
  export let teamAPlayers: Player[] = [];
  export let teamBPlayers: Player[] = [];
  export let value: Matchup[] = [];
  export let onChange: (nextValue: Matchup[]) => void = () => {};

  function createId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    return `matchup-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizePlayerIds(playerIds: string[]): string[] {
    const unique = new Set<string>();
    const normalized: string[] = [];

    for (const playerId of playerIds) {
      const trimmed = playerId.trim();

      if (!trimmed || unique.has(trimmed)) {
        continue;
      }

      unique.add(trimmed);
      normalized.push(trimmed);

      if (normalized.length === 2) {
        break;
      }
    }

    return normalized;
  }

  function normalizeMatchup(input: Matchup): Matchup {
    return {
      id: input.id || createId(),
      sideAPlayerIds: normalizePlayerIds(input.sideAPlayerIds),
      sideBPlayerIds: normalizePlayerIds(input.sideBPlayerIds)
    };
  }

  function createEmptyMatchup(): Matchup {
    return {
      id: createId(),
      sideAPlayerIds: [],
      sideBPlayerIds: []
    };
  }

  function normalizeValue(input: Matchup[]): Matchup[] {
    return input.map((entry) => normalizeMatchup(entry));
  }

  let rows: Matchup[] = [createEmptyMatchup()];
  let lastSignature = '';

  $: {
    const signature = JSON.stringify(value);

    if (signature !== lastSignature) {
      const normalized = normalizeValue(value);
      rows = normalized.length > 0 ? normalized : [createEmptyMatchup()];
      lastSignature = signature;
    }
  }

  $: duplicatePlayerIds = buildDuplicatePlayerSet(rows);

  function buildDuplicatePlayerSet(matchups: Matchup[]): Set<string> {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    for (const matchup of matchups) {
      const playersInMatchup = [...matchup.sideAPlayerIds, ...matchup.sideBPlayerIds];

      for (const playerId of playersInMatchup) {
        if (seen.has(playerId)) {
          duplicates.add(playerId);
          continue;
        }

        seen.add(playerId);
      }
    }

    return duplicates;
  }

  function emit(nextRows: Matchup[]): void {
    onChange(nextRows.map((entry) => normalizeMatchup(entry)));
  }

  function setPlayerSlot(matchupId: string, side: 'A' | 'B', slotIndex: 0 | 1, playerId: string): void {
    const nextRows = rows.map((row) => {
      if (row.id !== matchupId) {
        return row;
      }

      const nextSide = [...(side === 'A' ? row.sideAPlayerIds : row.sideBPlayerIds)];
      nextSide[slotIndex] = playerId;
      const normalizedSide = normalizePlayerIds(nextSide);

      if (side === 'A') {
        return {
          ...row,
          sideAPlayerIds: normalizedSide
        };
      }

      return {
        ...row,
        sideBPlayerIds: normalizedSide
      };
    });

    emit(nextRows);
  }

  function addPairing(): void {
    emit([...rows, createEmptyMatchup()]);
  }

  function removePairing(matchupId: string): void {
    const nextRows = rows.filter((entry) => entry.id !== matchupId);
    emit(nextRows.length > 0 ? nextRows : [createEmptyMatchup()]);
  }

  function slotValue(playerIds: string[], slotIndex: 0 | 1): string {
    return playerIds[slotIndex] ?? '';
  }

  function rowHasSideOverlap(row: Matchup): boolean {
    const sideASet = new Set(row.sideAPlayerIds);
    return row.sideBPlayerIds.some((playerId) => sideASet.has(playerId));
  }

  function rowHasMissingPlayers(row: Matchup): boolean {
    return row.sideAPlayerIds.length === 0 || row.sideBPlayerIds.length === 0;
  }

  function selectClasses(selectedPlayerId: string): string {
    if (selectedPlayerId && duplicatePlayerIds.has(selectedPlayerId)) {
      return 'border-status-halved/30 focus:border-status-halved focus:ring-status-halved';
    }

    return 'border-border focus:border-accent focus:ring-accent';
  }
</script>

<section class="space-y-4">
  <div class="space-y-3">
    {#each rows as row, rowIndex (row.id)}
      <article class="space-y-3 rounded-xl border border-border bg-surface-raised p-4">
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-sm font-semibold uppercase tracking-wide text-text-secondary">Pairing {rowIndex + 1}</h3>
          <button
            type="button"
            class="inline-flex min-h-touch items-center rounded-lg px-3 text-sm font-medium text-status-down transition hover:bg-status-down/10"
            on:click={() => removePairing(row.id)}
            aria-label={`Remove pairing ${rowIndex + 1}`}
          >
            × Remove
          </button>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <fieldset class="space-y-2">
            <legend class="text-sm font-semibold text-text-primary">{teamA.name}</legend>
            <label class="space-y-1 text-sm text-text-primary">
              <span class="font-medium">Player 1</span>
              <select
                value={slotValue(row.sideAPlayerIds, 0)}
                on:change={(event) => setPlayerSlot(row.id, 'A', 0, (event.currentTarget as HTMLSelectElement).value)}
                class={`block min-h-touch w-full rounded-lg border px-3 text-base outline-none transition focus:ring-1 ${selectClasses(slotValue(row.sideAPlayerIds, 0))}`}
              >
                <option value="">Select player</option>
                {#each teamAPlayers as player (player.id)}
                  <option value={player.id}>{player.name}</option>
                {/each}
              </select>
            </label>

            <label class="space-y-1 text-sm text-text-primary">
              <span class="font-medium">Player 2 (optional)</span>
              <select
                value={slotValue(row.sideAPlayerIds, 1)}
                on:change={(event) => setPlayerSlot(row.id, 'A', 1, (event.currentTarget as HTMLSelectElement).value)}
                class={`block min-h-touch w-full rounded-lg border px-3 text-base outline-none transition focus:ring-1 ${selectClasses(slotValue(row.sideAPlayerIds, 1))}`}
              >
                <option value="">No second player</option>
                {#each teamAPlayers as player (player.id)}
                  <option value={player.id}>{player.name}</option>
                {/each}
              </select>
            </label>
          </fieldset>

          <fieldset class="space-y-2">
            <legend class="text-sm font-semibold text-text-primary">{teamB.name}</legend>
            <label class="space-y-1 text-sm text-text-primary">
              <span class="font-medium">Player 1</span>
              <select
                value={slotValue(row.sideBPlayerIds, 0)}
                on:change={(event) => setPlayerSlot(row.id, 'B', 0, (event.currentTarget as HTMLSelectElement).value)}
                class={`block min-h-touch w-full rounded-lg border px-3 text-base outline-none transition focus:ring-1 ${selectClasses(slotValue(row.sideBPlayerIds, 0))}`}
              >
                <option value="">Select player</option>
                {#each teamBPlayers as player (player.id)}
                  <option value={player.id}>{player.name}</option>
                {/each}
              </select>
            </label>

            <label class="space-y-1 text-sm text-text-primary">
              <span class="font-medium">Player 2 (optional)</span>
              <select
                value={slotValue(row.sideBPlayerIds, 1)}
                on:change={(event) => setPlayerSlot(row.id, 'B', 1, (event.currentTarget as HTMLSelectElement).value)}
                class={`block min-h-touch w-full rounded-lg border px-3 text-base outline-none transition focus:ring-1 ${selectClasses(slotValue(row.sideBPlayerIds, 1))}`}
              >
                <option value="">No second player</option>
                {#each teamBPlayers as player (player.id)}
                  <option value={player.id}>{player.name}</option>
                {/each}
              </select>
            </label>
          </fieldset>
        </div>

        {#if rowHasMissingPlayers(row)}
          <p class="text-sm text-status-halved">Each pairing needs at least one player on both sides.</p>
        {/if}

        {#if rowHasSideOverlap(row)}
          <p class="text-sm font-medium text-status-down">A player cannot appear on both sides of the same matchup.</p>
        {/if}
      </article>
    {/each}
  </div>

  {#if duplicatePlayerIds.size > 0}
    <p class="rounded-lg border border-status-halved/30 bg-status-halved/10 px-3 py-2 text-sm font-medium text-status-halved">
      One or more players appear in multiple pairings. Each player can only be assigned once per round.
    </p>
  {/if}

  <p class="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-secondary">
    Players not added to any matchup will sit out this round.
  </p>

  <button
    type="button"
    class="inline-flex min-h-touch items-center justify-center rounded-lg border border-border bg-transparent px-4 text-sm font-semibold text-text-primary transition hover:bg-surface-raised"
    on:click={addPairing}
  >
    + Add Pairing
  </button>
</section>
