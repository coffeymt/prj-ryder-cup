import type {
  Match,
  MatchHoleResult,
  MatchResult,
  MatchResultStatus,
  MatchSide,
  MatchSidePlayer,
} from './types';

type CreateMatchInput = Omit<Match, 'id' | 'created_at'> & Partial<Pick<Match, 'created_at'>>;
type CreateMatchSideInput = Omit<MatchSide, 'id' | 'created_at'> &
  Partial<Pick<MatchSide, 'created_at'>>;
type UpsertMatchHoleResultInput = Omit<MatchHoleResult, 'id' | 'computed_at'> &
  Partial<Pick<MatchHoleResult, 'computed_at'>>;
type UpdateMatchResultInput = Partial<
  Pick<
    MatchResult,
    | 'segment_id'
    | 'side_a_holes_won'
    | 'side_b_holes_won'
    | 'halves'
    | 'close_notation'
    | 'side_a_points'
    | 'side_b_points'
  >
>;

const MATCH_COLUMNS = `
  id,
  round_id,
  match_number,
  format_override,
  tee_time,
  created_at
`;

const MATCH_SIDE_COLUMNS = `
  id,
  match_id,
  team_id,
  side_label,
  created_at
`;

const MATCH_SIDE_PLAYER_COLUMNS = `
  id,
  match_side_id,
  player_id,
  created_at
`;

const MATCH_HOLE_RESULT_COLUMNS = `
  id,
  match_id,
  segment_id,
  hole_number,
  result,
  side_a_net,
  side_b_net,
  computed_at
`;

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeMatch(row: Match | null): Match | null {
  if (!row) {
    return null;
  }

  return {
    ...row,
    id: String(row.id),
    round_id: String(row.round_id),
  };
}

function normalizeMatchSide(row: MatchSide | null): MatchSide | null {
  if (!row) {
    return null;
  }

  return {
    ...row,
    id: String(row.id),
    match_id: String(row.match_id),
    team_id: String(row.team_id),
  };
}

export async function createMatch(db: D1Database, data: CreateMatchInput): Promise<Match> {
  const createdAt = data.created_at ?? nowIso();

  const result = await db
    .prepare(
      `
        INSERT INTO matches (round_id, match_number, format_override, tee_time, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5)
      `
    )
    .bind(data.round_id, data.match_number, data.format_override, data.tee_time ?? null, createdAt)
    .run();

  const newId = String(result.meta.last_row_id);
  const created = await getMatchById(db, newId);

  if (!created) {
    throw new Error(`Failed to create match with last_row_id ${newId}.`);
  }

  return created;
}

export async function getMatchById(db: D1Database, id: string): Promise<Match | null> {
  const row = await db
    .prepare(
      `
        SELECT ${MATCH_COLUMNS}
        FROM matches
        WHERE id = ?1
        LIMIT 1
      `
    )
    .bind(id)
    .first<Match>();

  return normalizeMatch(row);
}

export async function listMatchesByRound(db: D1Database, roundId: string): Promise<Match[]> {
  const result = await db
    .prepare(
      `
        SELECT ${MATCH_COLUMNS}
        FROM matches
        WHERE round_id = ?1
        ORDER BY match_number ASC
      `
    )
    .bind(roundId)
    .all<Match>();

  return result.results.map((row) => ({
    ...row,
    id: String(row.id),
    round_id: String(row.round_id),
  }));
}

export async function listMatchesByTournament(
  db: D1Database,
  tournamentId: string
): Promise<Match[]> {
  const result = await db
    .prepare(
      `
        SELECT m.id, m.round_id, m.match_number, m.format_override, m.tee_time, m.created_at
        FROM matches m
        INNER JOIN rounds r ON r.id = m.round_id
        WHERE r.tournament_id = ?1
        ORDER BY r.round_number ASC, m.match_number ASC
      `
    )
    .bind(tournamentId)
    .all<Match>();

  return result.results.map((row) => ({
    ...row,
    id: String(row.id),
    round_id: String(row.round_id),
  }));
}

export async function updateMatchStatus(
  db: D1Database,
  id: string,
  status: MatchResultStatus,
  result?: UpdateMatchResultInput
): Promise<void> {
  const computedAt = nowIso();

  if (!result?.segment_id) {
    await db
      .prepare(
        `
          UPDATE match_results
          SET status = ?1, computed_at = ?2
          WHERE match_id = ?3
        `
      )
      .bind(status, computedAt, id)
      .run();

    return;
  }

  await db
    .prepare(
      `
        INSERT INTO match_results (
          match_id,
          segment_id,
          status,
          side_a_holes_won,
          side_b_holes_won,
          halves,
          close_notation,
          side_a_points,
          side_b_points,
          computed_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
        ON CONFLICT(match_id, segment_id) DO UPDATE SET
          status = excluded.status,
          side_a_holes_won = excluded.side_a_holes_won,
          side_b_holes_won = excluded.side_b_holes_won,
          halves = excluded.halves,
          close_notation = excluded.close_notation,
          side_a_points = excluded.side_a_points,
          side_b_points = excluded.side_b_points,
          computed_at = excluded.computed_at
      `
    )
    .bind(
      id,
      result.segment_id,
      status,
      result.side_a_holes_won ?? 0,
      result.side_b_holes_won ?? 0,
      result.halves ?? 0,
      result.close_notation ?? null,
      result.side_a_points ?? 0,
      result.side_b_points ?? 0,
      computedAt
    )
    .run();
}

export async function createMatchSide(
  db: D1Database,
  data: CreateMatchSideInput
): Promise<MatchSide> {
  const createdAt = data.created_at ?? nowIso();

  const result = await db
    .prepare(
      `
        INSERT INTO match_sides (match_id, team_id, side_label, created_at)
        VALUES (?1, ?2, ?3, ?4)
      `
    )
    .bind(data.match_id, data.team_id, data.side_label, createdAt)
    .run();

  const newId = String(result.meta.last_row_id);
  const row = await db
    .prepare(
      `
        SELECT ${MATCH_SIDE_COLUMNS}
        FROM match_sides
        WHERE id = ?1
        LIMIT 1
      `
    )
    .bind(newId)
    .first<MatchSide>();

  const created = normalizeMatchSide(row);

  if (!created) {
    throw new Error(`Failed to create match side with last_row_id ${newId}.`);
  }

  return created;
}

export async function listSidesByMatch(db: D1Database, matchId: string): Promise<MatchSide[]> {
  const result = await db
    .prepare(
      `
        SELECT ${MATCH_SIDE_COLUMNS}
        FROM match_sides
        WHERE match_id = ?1
        ORDER BY side_label ASC
      `
    )
    .bind(matchId)
    .all<MatchSide>();

  return result.results.map((row) => ({
    ...row,
    id: String(row.id),
    match_id: String(row.match_id),
    team_id: String(row.team_id),
  }));
}

export async function addPlayerToSide(
  db: D1Database,
  matchSideId: string,
  playerId: string
): Promise<void> {
  await db
    .prepare(
      `
        INSERT OR IGNORE INTO match_side_players (match_side_id, player_id, created_at)
        VALUES (?1, ?2, ?3)
      `
    )
    .bind(matchSideId, playerId, nowIso())
    .run();
}

export async function listPlayersBySide(
  db: D1Database,
  matchSideId: string
): Promise<MatchSidePlayer[]> {
  const result = await db
    .prepare(
      `
        SELECT ${MATCH_SIDE_PLAYER_COLUMNS}
        FROM match_side_players
        WHERE match_side_id = ?1
        ORDER BY created_at ASC
      `
    )
    .bind(matchSideId)
    .all<MatchSidePlayer>();

  return result.results.map((row) => ({
    ...row,
    id: String(row.id),
    match_side_id: String(row.match_side_id),
    player_id: String(row.player_id),
  }));
}

export async function upsertMatchHoleResult(
  db: D1Database,
  data: UpsertMatchHoleResultInput
): Promise<void> {
  const computedAt = data.computed_at ?? nowIso();

  await db
    .prepare(
      `
        INSERT INTO match_hole_results (
          match_id,
          segment_id,
          hole_number,
          result,
          side_a_net,
          side_b_net,
          computed_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        ON CONFLICT(match_id, hole_number) DO UPDATE SET
          segment_id = excluded.segment_id,
          result = excluded.result,
          side_a_net = excluded.side_a_net,
          side_b_net = excluded.side_b_net,
          computed_at = excluded.computed_at
      `
    )
    .bind(
      data.match_id,
      data.segment_id,
      data.hole_number,
      data.result,
      data.side_a_net,
      data.side_b_net,
      computedAt
    )
    .run();
}

export async function listHoleResultsByMatch(
  db: D1Database,
  matchId: string
): Promise<MatchHoleResult[]> {
  const result = await db
    .prepare(
      `
        SELECT ${MATCH_HOLE_RESULT_COLUMNS}
        FROM match_hole_results
        WHERE match_id = ?1
        ORDER BY hole_number ASC
      `
    )
    .bind(matchId)
    .all<MatchHoleResult>();

  return result.results.map((row) => ({
    ...row,
    id: String(row.id),
    match_id: String(row.match_id),
    segment_id: String(row.segment_id),
  }));
}

export async function updateMatchTeeTime(
  db: D1Database,
  matchId: string,
  teeTime: string | null
): Promise<void> {
  await db
    .prepare(
      `
        UPDATE matches
        SET tee_time = ?1
        WHERE id = ?2
      `
    )
    .bind(teeTime, matchId)
    .run();
}
