import type { HoleScore } from './types';

type CreateHoleScoreInput = Omit<HoleScore, 'entered_at' | 'updated_at'> &
  Partial<Pick<HoleScore, 'entered_at' | 'updated_at'>>;
type UpsertHoleScoreInput = Omit<HoleScore, 'id' | 'entered_at' | 'updated_at'> &
  Partial<Pick<HoleScore, 'id' | 'entered_at' | 'updated_at'>>;

const HOLE_SCORE_COLUMNS = `
  id,
  match_id,
  hole_number,
  player_id,
  match_side_id,
  gross_strokes,
  is_conceded,
  is_picked_up,
  entered_by_player_id,
  entered_at,
  op_id,
  updated_at
`;

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeHoleScore(row: HoleScore | null): HoleScore | null {
  if (!row) {
    return null;
  }

  return {
    ...row,
    id: String(row.id),
    match_id: String(row.match_id),
    player_id: row.player_id === null ? null : String(row.player_id),
    match_side_id: String(row.match_side_id),
    entered_by_player_id:
      row.entered_by_player_id === null ? null : String(row.entered_by_player_id),
  };
}

export async function createHoleScore(
  db: D1Database,
  data: CreateHoleScoreInput
): Promise<HoleScore> {
  const enteredAt = data.entered_at ?? nowIso();
  const updatedAt = data.updated_at ?? enteredAt;

  await db
    .prepare(
      `
        INSERT INTO hole_scores (
          id,
          match_id,
          hole_number,
          player_id,
          match_side_id,
          gross_strokes,
          is_conceded,
          is_picked_up,
          entered_by_player_id,
          entered_at,
          op_id,
          updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
      `
    )
    .bind(
      data.id,
      data.match_id,
      data.hole_number,
      data.player_id,
      data.match_side_id,
      data.gross_strokes,
      data.is_conceded,
      data.is_picked_up,
      data.entered_by_player_id,
      enteredAt,
      data.op_id,
      updatedAt
    )
    .run();

  const created = await db
    .prepare(
      `
        SELECT ${HOLE_SCORE_COLUMNS}
        FROM hole_scores
        WHERE id = ?1
        LIMIT 1
      `
    )
    .bind(data.id)
    .first<HoleScore>();

  const normalized = normalizeHoleScore(created);

  if (!normalized) {
    throw new Error(`Failed to create hole score ${data.id}.`);
  }

  return normalized;
}

export async function getHoleScore(
  db: D1Database,
  matchId: string,
  playerId: string,
  holeNumber: number
): Promise<HoleScore | null> {
  const row = await db
    .prepare(
      `
        SELECT ${HOLE_SCORE_COLUMNS}
        FROM hole_scores
        WHERE match_id = ?1
          AND player_id = ?2
          AND hole_number = ?3
        ORDER BY updated_at DESC
        LIMIT 1
      `
    )
    .bind(matchId, playerId, holeNumber)
    .first<HoleScore>();

  return normalizeHoleScore(row);
}

export async function listHoleScoresByMatch(db: D1Database, matchId: string): Promise<HoleScore[]> {
  const result = await db
    .prepare(
      `
        SELECT ${HOLE_SCORE_COLUMNS}
        FROM hole_scores
        WHERE match_id = ?1
        ORDER BY hole_number ASC, entered_at ASC
      `
    )
    .bind(matchId)
    .all<HoleScore>();

  return result.results.map((row) => ({
    ...row,
    id: String(row.id),
    match_id: String(row.match_id),
    player_id: row.player_id === null ? null : String(row.player_id),
    match_side_id: String(row.match_side_id),
    entered_by_player_id:
      row.entered_by_player_id === null ? null : String(row.entered_by_player_id),
  }));
}

export async function upsertHoleScore(
  db: D1Database,
  data: UpsertHoleScoreInput
): Promise<HoleScore> {
  const existing = await db
    .prepare(
      `
        SELECT ${HOLE_SCORE_COLUMNS}
        FROM hole_scores
        WHERE match_id = ?1
          AND hole_number = ?2
          AND (
            (player_id = ?3)
            OR (?3 IS NULL AND player_id IS NULL AND match_side_id = ?4)
          )
        ORDER BY updated_at DESC
        LIMIT 1
      `
    )
    .bind(data.match_id, data.hole_number, data.player_id, data.match_side_id)
    .first<HoleScore>();

  const enteredAt = data.entered_at ?? existing?.entered_at ?? nowIso();
  const updatedAt = data.updated_at ?? nowIso();
  const holeScoreId = data.id ?? (existing ? String(existing.id) : crypto.randomUUID());

  if (existing) {
    await db
      .prepare(
        `
          UPDATE hole_scores
          SET
            match_side_id = ?1,
            gross_strokes = ?2,
            is_conceded = ?3,
            is_picked_up = ?4,
            entered_by_player_id = ?5,
            entered_at = ?6,
            op_id = ?7,
            updated_at = ?8
          WHERE id = ?9
        `
      )
      .bind(
        data.match_side_id,
        data.gross_strokes,
        data.is_conceded,
        data.is_picked_up,
        data.entered_by_player_id,
        enteredAt,
        data.op_id,
        updatedAt,
        holeScoreId
      )
      .run();
  } else {
    await db
      .prepare(
        `
          INSERT INTO hole_scores (
            id,
            match_id,
            hole_number,
            player_id,
            match_side_id,
            gross_strokes,
            is_conceded,
            is_picked_up,
            entered_by_player_id,
            entered_at,
            op_id,
            updated_at
          )
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
        `
      )
      .bind(
        holeScoreId,
        data.match_id,
        data.hole_number,
        data.player_id,
        data.match_side_id,
        data.gross_strokes,
        data.is_conceded,
        data.is_picked_up,
        data.entered_by_player_id,
        enteredAt,
        data.op_id,
        updatedAt
      )
      .run();
  }

  const row = await db
    .prepare(
      `
        SELECT ${HOLE_SCORE_COLUMNS}
        FROM hole_scores
        WHERE id = ?1
        LIMIT 1
      `
    )
    .bind(holeScoreId)
    .first<HoleScore>();

  const upserted = normalizeHoleScore(row);

  if (!upserted) {
    throw new Error(`Failed to upsert hole score ${holeScoreId}.`);
  }

  return upserted;
}
