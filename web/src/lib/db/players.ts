import type { Player, PlayerTournament, PlayerWithTournament } from './types';

type CreatePlayerInput = {
  id: string;
  name: string;
  email?: string | null;
  ghin_number?: string | null;
  handicap_index: number;
  created_at?: string;
};

type BulkCreatePlayerInput = {
  name: string;
  email?: string | null;
  ghin_number?: string | null;
  handicap_index: number;
};

type CreatePlayerTournamentInput = {
  id?: string;
  player_id: string;
  tournament_id: string;
  team_id?: string | null;
  handicap_index_override?: number | null;
  created_at?: string;
};

type BulkCreatePlayerTournamentInput = {
  player_id: string;
  tournament_id: string;
  team_id?: string | null;
  handicap_index_override?: number | null;
};

const PLAYER_COLUMNS = `
  id,
  name,
  email,
  ghin_number,
  handicap_index,
  created_at,
  updated_at
`;

const PLAYER_TOURNAMENT_COLUMNS = `
  id,
  player_id,
  tournament_id,
  team_id,
  handicap_index_override,
  created_at
`;

const PLAYER_UPDATABLE_FIELDS = ['name', 'email', 'ghin_number', 'handicap_index'] as const;
const PLAYER_UPDATABLE_FIELD_SET = new Set<string>(PLAYER_UPDATABLE_FIELDS);

const PLAYER_TOURNAMENT_UPDATABLE_FIELDS = ['team_id', 'handicap_index_override'] as const;
const PLAYER_TOURNAMENT_UPDATABLE_FIELD_SET = new Set<string>(PLAYER_TOURNAMENT_UPDATABLE_FIELDS);

function nowIso(): string {
  return new Date().toISOString();
}

function normalizePlayer(row: Player | null): Player | null {
  if (!row) {
    return null;
  }

  return {
    ...row,
    id: String(row.id),
    email: row.email === null ? null : String(row.email),
    ghin_number: row.ghin_number === null ? null : String(row.ghin_number),
  };
}

function normalizePlayerTournament(row: PlayerTournament | null): PlayerTournament | null {
  if (!row) {
    return null;
  }

  return {
    ...row,
    id: String(row.id),
    player_id: String(row.player_id),
    tournament_id: String(row.tournament_id),
    team_id: row.team_id === null ? null : String(row.team_id),
    handicap_index_override:
      row.handicap_index_override === null ? null : Number(row.handicap_index_override),
  };
}

function normalizePlayerWithTournament(
  row: PlayerWithTournament | null
): PlayerWithTournament | null {
  if (!row) {
    return null;
  }

  return {
    ...row,
    id: String(row.id),
    email: row.email === null ? null : String(row.email),
    ghin_number: row.ghin_number === null ? null : String(row.ghin_number),
    player_tournament_id: String(row.player_tournament_id),
    tournament_id: String(row.tournament_id),
    team_id: row.team_id === null ? null : String(row.team_id),
    handicap_index_override:
      row.handicap_index_override === null ? null : Number(row.handicap_index_override),
    effective_handicap: Number(row.effective_handicap),
  };
}

// ---------------------------------------------------------------------------
// Player CRUD
// ---------------------------------------------------------------------------

export async function createPlayer(db: D1Database, data: CreatePlayerInput): Promise<Player> {
  const createdAt = data.created_at ?? nowIso();
  const updatedAt = createdAt;

  await db
    .prepare(
      `
        INSERT INTO players (id, name, email, ghin_number, handicap_index, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
      `
    )
    .bind(
      data.id,
      data.name,
      data.email ?? null,
      data.ghin_number ?? null,
      data.handicap_index,
      createdAt,
      updatedAt
    )
    .run();

  const created = await getPlayerById(db, data.id);

  if (!created) {
    throw new Error(`Failed to create player ${data.id}.`);
  }

  return created;
}

export async function getPlayerById(db: D1Database, id: string): Promise<Player | null> {
  const row = await db
    .prepare(
      `
        SELECT ${PLAYER_COLUMNS}
        FROM players
        WHERE id = ?1
        LIMIT 1
      `
    )
    .bind(id)
    .first<Player>();

  return normalizePlayer(row);
}

export async function listPlayersByTournament(
  db: D1Database,
  tournamentId: string
): Promise<PlayerWithTournament[]> {
  const result = await db
    .prepare(
      `
        SELECT p.id, p.name, p.email, p.ghin_number, p.handicap_index, p.created_at, p.updated_at,
               pt.id as player_tournament_id, pt.tournament_id, pt.team_id, pt.handicap_index_override,
               COALESCE(pt.handicap_index_override, p.handicap_index) as effective_handicap
        FROM players p
        INNER JOIN player_tournaments pt ON pt.player_id = p.id
        WHERE pt.tournament_id = ?1
        ORDER BY p.name ASC
      `
    )
    .bind(tournamentId)
    .all<PlayerWithTournament>();

  return result.results.map((row) => normalizePlayerWithTournament(row) as PlayerWithTournament);
}

export async function listPlayersByTeam(
  db: D1Database,
  teamId: string
): Promise<PlayerWithTournament[]> {
  const result = await db
    .prepare(
      `
        SELECT p.id, p.name, p.email, p.ghin_number, p.handicap_index, p.created_at, p.updated_at,
               pt.id as player_tournament_id, pt.tournament_id, pt.team_id, pt.handicap_index_override,
               COALESCE(pt.handicap_index_override, p.handicap_index) as effective_handicap
        FROM players p
        INNER JOIN player_tournaments pt ON pt.player_id = p.id
        WHERE pt.team_id = ?1
        ORDER BY p.name ASC
      `
    )
    .bind(teamId)
    .all<PlayerWithTournament>();

  return result.results.map((row) => normalizePlayerWithTournament(row) as PlayerWithTournament);
}

export async function updatePlayer(
  db: D1Database,
  id: string,
  data: Partial<Player>
): Promise<Player | null> {
  const assignments = Object.entries(data).filter(
    ([field, value]) => PLAYER_UPDATABLE_FIELD_SET.has(field) && value !== undefined
  );

  if (assignments.length === 0) {
    return getPlayerById(db, id);
  }

  const updatedAt = nowIso();
  const setSql = assignments.map(([field], index) => `${field} = ?${index + 1}`).join(', ');
  const values = assignments.map(([, value]) => value);

  await db
    .prepare(
      `
        UPDATE players
        SET ${setSql}, updated_at = ?${assignments.length + 1}
        WHERE id = ?${assignments.length + 2}
      `
    )
    .bind(...values, updatedAt, id)
    .run();

  return getPlayerById(db, id);
}

export async function deletePlayer(db: D1Database, id: string): Promise<void> {
  await db
    .prepare(
      `
        DELETE FROM players
        WHERE id = ?1
      `
    )
    .bind(id)
    .run();
}

export async function bulkCreatePlayers(
  db: D1Database,
  players: BulkCreatePlayerInput[]
): Promise<Player[]> {
  if (players.length === 0) {
    return [];
  }

  const prepared = players.map((player) => {
    const id = crypto.randomUUID();
    const createdAt = nowIso();
    const updatedAt = createdAt;

    const statement = db
      .prepare(
        `
          INSERT INTO players (id, name, email, ghin_number, handicap_index, created_at, updated_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        `
      )
      .bind(
        id,
        player.name,
        player.email ?? null,
        player.ghin_number ?? null,
        player.handicap_index,
        createdAt,
        updatedAt
      );

    const createdPlayer: Player = {
      id,
      name: player.name,
      email: player.email ?? null,
      ghin_number: player.ghin_number ?? null,
      handicap_index: player.handicap_index,
      created_at: createdAt,
      updated_at: updatedAt,
    };

    return { statement, createdPlayer };
  });

  await db.batch(prepared.map((item) => item.statement));

  return prepared.map((item) => item.createdPlayer);
}

// ---------------------------------------------------------------------------
// PlayerTournament CRUD
// ---------------------------------------------------------------------------

export async function createPlayerTournament(
  db: D1Database,
  data: CreatePlayerTournamentInput
): Promise<PlayerTournament> {
  const id = data.id ?? crypto.randomUUID();
  const createdAt = data.created_at ?? nowIso();

  await db
    .prepare(
      `
        INSERT INTO player_tournaments (id, player_id, tournament_id, team_id, handicap_index_override, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
      `
    )
    .bind(
      id,
      data.player_id,
      data.tournament_id,
      data.team_id ?? null,
      data.handicap_index_override ?? null,
      createdAt
    )
    .run();

  const created = await getPlayerTournamentById(db, id);

  if (!created) {
    throw new Error(
      `Failed to create player_tournament for player ${data.player_id} in tournament ${data.tournament_id}.`
    );
  }

  return created;
}

export async function getPlayerTournament(
  db: D1Database,
  playerId: string,
  tournamentId: string
): Promise<PlayerTournament | null> {
  const row = await db
    .prepare(
      `
        SELECT ${PLAYER_TOURNAMENT_COLUMNS}
        FROM player_tournaments
        WHERE player_id = ?1 AND tournament_id = ?2
        LIMIT 1
      `
    )
    .bind(playerId, tournamentId)
    .first<PlayerTournament>();

  return normalizePlayerTournament(row);
}

export async function getPlayerTournamentById(
  db: D1Database,
  id: string
): Promise<PlayerTournament | null> {
  const row = await db
    .prepare(
      `
        SELECT ${PLAYER_TOURNAMENT_COLUMNS}
        FROM player_tournaments
        WHERE id = ?1
        LIMIT 1
      `
    )
    .bind(id)
    .first<PlayerTournament>();

  return normalizePlayerTournament(row);
}

export async function updatePlayerTournament(
  db: D1Database,
  id: string,
  data: Partial<PlayerTournament>
): Promise<PlayerTournament | null> {
  const assignments = Object.entries(data).filter(
    ([field, value]) => PLAYER_TOURNAMENT_UPDATABLE_FIELD_SET.has(field) && value !== undefined
  );

  if (assignments.length === 0) {
    return getPlayerTournamentById(db, id);
  }

  const setSql = assignments.map(([field], index) => `${field} = ?${index + 1}`).join(', ');
  const values = assignments.map(([, value]) => value);

  await db
    .prepare(
      `
        UPDATE player_tournaments
        SET ${setSql}
        WHERE id = ?${assignments.length + 1}
      `
    )
    .bind(...values, id)
    .run();

  return getPlayerTournamentById(db, id);
}

export async function deletePlayerTournament(db: D1Database, id: string): Promise<void> {
  await db
    .prepare(
      `
        DELETE FROM player_tournaments
        WHERE id = ?1
      `
    )
    .bind(id)
    .run();
}

export async function getPlayerWithTournament(
  db: D1Database,
  playerId: string,
  tournamentId: string
): Promise<PlayerWithTournament | null> {
  const row = await db
    .prepare(
      `
        SELECT p.id, p.name, p.email, p.ghin_number, p.handicap_index, p.created_at, p.updated_at,
               pt.id as player_tournament_id, pt.tournament_id, pt.team_id, pt.handicap_index_override,
               COALESCE(pt.handicap_index_override, p.handicap_index) as effective_handicap
        FROM players p
        INNER JOIN player_tournaments pt ON pt.player_id = p.id
        WHERE p.id = ?1 AND pt.tournament_id = ?2
        LIMIT 1
      `
    )
    .bind(playerId, tournamentId)
    .first<PlayerWithTournament>();

  return normalizePlayerWithTournament(row);
}

export async function bulkCreatePlayerTournaments(
  db: D1Database,
  entries: BulkCreatePlayerTournamentInput[]
): Promise<PlayerTournament[]> {
  if (entries.length === 0) {
    return [];
  }

  const prepared = entries.map((entry) => {
    const id = crypto.randomUUID();
    const createdAt = nowIso();

    const statement = db
      .prepare(
        `
          INSERT INTO player_tournaments (id, player_id, tournament_id, team_id, handicap_index_override, created_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        `
      )
      .bind(
        id,
        entry.player_id,
        entry.tournament_id,
        entry.team_id ?? null,
        entry.handicap_index_override ?? null,
        createdAt
      );

    const createdEntry: PlayerTournament = {
      id,
      player_id: entry.player_id,
      tournament_id: entry.tournament_id,
      team_id: entry.team_id ?? null,
      handicap_index_override: entry.handicap_index_override ?? null,
      created_at: createdAt,
    };

    return { statement, createdEntry };
  });

  await db.batch(prepared.map((item) => item.statement));

  return prepared.map((item) => item.createdEntry);
}
