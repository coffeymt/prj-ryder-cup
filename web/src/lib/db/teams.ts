import type { Team } from './types';

type CreateTeamInput = Omit<Team, 'id' | 'created_at'> & Partial<Pick<Team, 'created_at'>>;

const TEAM_COLUMNS = `
  id,
  tournament_id,
  name,
  color,
  captain_player_id,
  created_at
`;

const TEAM_UPDATABLE_FIELDS = ['tournament_id', 'name', 'color', 'captain_player_id'] as const;
const TEAM_UPDATABLE_FIELD_SET = new Set<string>(TEAM_UPDATABLE_FIELDS);

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeTeam(row: Team | null): Team | null {
  if (!row) {
    return null;
  }

  return {
    ...row,
    id: String(row.id),
    tournament_id: String(row.tournament_id),
    captain_player_id: row.captain_player_id === null ? null : String(row.captain_player_id),
  };
}

export async function createTeam(db: D1Database, data: CreateTeamInput): Promise<Team> {
  const createdAt = data.created_at ?? nowIso();

  const result = await db
    .prepare(
      `
        INSERT INTO teams (tournament_id, name, color, captain_player_id, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5)
      `
    )
    .bind(data.tournament_id, data.name, data.color, data.captain_player_id, createdAt)
    .run();

  const newId = String(result.meta.last_row_id);
  const created = await getTeamById(db, newId);

  if (!created) {
    throw new Error(`Failed to create team with last_row_id ${newId}.`);
  }

  return created;
}

export async function getTeamById(db: D1Database, id: string): Promise<Team | null> {
  const row = await db
    .prepare(
      `
        SELECT ${TEAM_COLUMNS}
        FROM teams
        WHERE id = ?1
        LIMIT 1
      `
    )
    .bind(id)
    .first<Team>();

  return normalizeTeam(row);
}

export async function listTeamsByTournament(db: D1Database, tournamentId: string): Promise<Team[]> {
  const result = await db
    .prepare(
      `
        SELECT ${TEAM_COLUMNS}
        FROM teams
        WHERE tournament_id = ?1
        ORDER BY created_at ASC
      `
    )
    .bind(tournamentId)
    .all<Team>();

  return result.results.map((row) => ({
    ...row,
    id: String(row.id),
    tournament_id: String(row.tournament_id),
    captain_player_id: row.captain_player_id === null ? null : String(row.captain_player_id),
  }));
}

export async function updateTeam(
  db: D1Database,
  id: string,
  data: Partial<Team>
): Promise<Team | null> {
  const assignments = Object.entries(data).filter(
    ([field, value]) => TEAM_UPDATABLE_FIELD_SET.has(field) && value !== undefined
  );

  if (assignments.length === 0) {
    return getTeamById(db, id);
  }

  const setSql = assignments.map(([field], index) => `${field} = ?${index + 1}`).join(', ');
  const values = assignments.map(([, value]) => value);

  await db
    .prepare(
      `
        UPDATE teams
        SET ${setSql}
        WHERE id = ?${assignments.length + 1}
      `
    )
    .bind(...values, id)
    .run();

  return getTeamById(db, id);
}

export async function deleteTeam(db: D1Database, id: string): Promise<void> {
  await db
    .prepare(
      `
        DELETE FROM teams
        WHERE id = ?1
      `
    )
    .bind(id)
    .run();
}
