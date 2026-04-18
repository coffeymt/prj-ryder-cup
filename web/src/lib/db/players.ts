import type { Player } from './types';

type CreatePlayerInput = Omit<Player, 'created_at'> & Partial<Pick<Player, 'created_at'>>;
type BulkCreatePlayerInput = Omit<Player, 'id' | 'created_at' | 'updated_at'>;

const PLAYER_COLUMNS = `
  id,
  tournament_id,
  team_id,
  name,
  handicap_index,
  created_at
`;

const PLAYER_UPDATABLE_FIELDS = ['tournament_id', 'team_id', 'name', 'handicap_index'] as const;
const PLAYER_UPDATABLE_FIELD_SET = new Set<string>(PLAYER_UPDATABLE_FIELDS);

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
    tournament_id: String(row.tournament_id),
    team_id: row.team_id === null ? null : String(row.team_id)
  };
}

export async function createPlayer(db: D1Database, data: CreatePlayerInput): Promise<Player> {
  const createdAt = data.created_at ?? nowIso();

  await db
    .prepare(
      `
        INSERT INTO players (id, tournament_id, team_id, name, handicap_index, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
      `
    )
    .bind(data.id, data.tournament_id, data.team_id, data.name, data.handicap_index, createdAt)
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

export async function listPlayersByTournament(db: D1Database, tournamentId: string): Promise<Player[]> {
  const result = await db
    .prepare(
      `
        SELECT ${PLAYER_COLUMNS}
        FROM players
        WHERE tournament_id = ?1
        ORDER BY name ASC
      `
    )
    .bind(tournamentId)
    .all<Player>();

  return result.results.map((row) => ({
    ...row,
    id: String(row.id),
    tournament_id: String(row.tournament_id),
    team_id: row.team_id === null ? null : String(row.team_id)
  }));
}

export async function listPlayersByTeam(db: D1Database, teamId: string): Promise<Player[]> {
  const result = await db
    .prepare(
      `
        SELECT ${PLAYER_COLUMNS}
        FROM players
        WHERE team_id = ?1
        ORDER BY name ASC
      `
    )
    .bind(teamId)
    .all<Player>();

  return result.results.map((row) => ({
    ...row,
    id: String(row.id),
    tournament_id: String(row.tournament_id),
    team_id: row.team_id === null ? null : String(row.team_id)
  }));
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

  const setSql = assignments.map(([field], index) => `${field} = ?${index + 1}`).join(', ');
  const values = assignments.map(([, value]) => value);

  await db
    .prepare(
      `
        UPDATE players
        SET ${setSql}
        WHERE id = ?${assignments.length + 1}
      `
    )
    .bind(...values, id)
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

    const statement = db
      .prepare(
        `
          INSERT INTO players (id, tournament_id, team_id, name, handicap_index, created_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        `
      )
      .bind(id, player.tournament_id, player.team_id, player.name, player.handicap_index, createdAt);

    const createdPlayer: Player = {
      id,
      tournament_id: player.tournament_id,
      team_id: player.team_id,
      name: player.name,
      handicap_index: player.handicap_index,
      created_at: createdAt
    };

    return { statement, createdPlayer };
  });

  await db.batch(prepared.map((item) => item.statement));

  return prepared.map((item) => item.createdPlayer);
}
