import type { Round, RoundSegment } from './types';

type CreateRoundInput = Omit<Round, 'created_at'> & Partial<Pick<Round, 'created_at'>>;
type CreateRoundSegmentInput = Omit<RoundSegment, 'created_at'> &
  Partial<Pick<RoundSegment, 'created_at'>>;

const ROUND_COLUMNS = `
  id,
  tournament_id,
  round_number,
  course_id,
  tee_id,
  scheduled_at,
  notes,
  created_at
`;

const ROUND_SEGMENT_COLUMNS = `
  id,
  round_id,
  segment_type,
  hole_start,
  hole_end,
  format,
  points_available,
  allowance_override,
  created_at
`;

const ROUND_UPDATABLE_FIELDS = ['round_number', 'course_id', 'tee_id', 'scheduled_at', 'notes'] as const;
const ROUND_UPDATABLE_FIELD_SET = new Set<string>(ROUND_UPDATABLE_FIELDS);

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeRound(row: Round | null): Round | null {
  if (!row) {
    return null;
  }

  return {
    ...row,
    id: String(row.id),
    tournament_id: String(row.tournament_id),
    course_id: String(row.course_id),
    tee_id: String(row.tee_id)
  };
}

function normalizeRoundSegment(row: RoundSegment | null): RoundSegment | null {
  if (!row) {
    return null;
  }

  return {
    ...row,
    id: String(row.id),
    round_id: String(row.round_id)
  };
}

export async function createRound(db: D1Database, data: CreateRoundInput): Promise<Round> {
  const createdAt = data.created_at ?? nowIso();

  await db
    .prepare(
      `
        INSERT INTO rounds (
          id,
          tournament_id,
          round_number,
          course_id,
          tee_id,
          scheduled_at,
          notes,
          created_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
      `
    )
    .bind(
      data.id,
      data.tournament_id,
      data.round_number,
      data.course_id,
      data.tee_id,
      data.scheduled_at,
      data.notes,
      createdAt
    )
    .run();

  const created = await getRoundById(db, data.id);

  if (!created) {
    throw new Error(`Failed to create round ${data.id}.`);
  }

  return created;
}

export async function getRoundById(db: D1Database, id: string): Promise<Round | null> {
  const row = await db
    .prepare(
      `
        SELECT ${ROUND_COLUMNS}
        FROM rounds
        WHERE id = ?1
        LIMIT 1
      `
    )
    .bind(id)
    .first<Round>();

  return normalizeRound(row);
}

export async function listRoundsByTournament(db: D1Database, tournamentId: string): Promise<Round[]> {
  const result = await db
    .prepare(
      `
        SELECT ${ROUND_COLUMNS}
        FROM rounds
        WHERE tournament_id = ?1
        ORDER BY round_number ASC
      `
    )
    .bind(tournamentId)
    .all<Round>();

  return result.results.map((row) => ({
    ...row,
    id: String(row.id),
    tournament_id: String(row.tournament_id),
    course_id: String(row.course_id),
    tee_id: String(row.tee_id)
  }));
}

export async function updateRound(
  db: D1Database,
  id: string,
  data: Partial<Round>
): Promise<Round | null> {
  const assignments = Object.entries(data).filter(
    ([field, value]) => ROUND_UPDATABLE_FIELD_SET.has(field) && value !== undefined
  );

  if (assignments.length === 0) {
    return getRoundById(db, id);
  }

  const setSql = assignments.map(([field], index) => `${field} = ?${index + 1}`).join(', ');
  const values = assignments.map(([, value]) => value);

  await db
    .prepare(
      `
        UPDATE rounds
        SET ${setSql}
        WHERE id = ?${assignments.length + 1}
      `
    )
    .bind(...values, id)
    .run();

  return getRoundById(db, id);
}

export async function createRoundSegment(
  db: D1Database,
  data: CreateRoundSegmentInput
): Promise<RoundSegment> {
  const createdAt = data.created_at ?? nowIso();

  await db
    .prepare(
      `
        INSERT INTO round_segments (
          id,
          round_id,
          segment_type,
          hole_start,
          hole_end,
          format,
          points_available,
          allowance_override,
          created_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
      `
    )
    .bind(
      data.id,
      data.round_id,
      data.segment_type,
      data.hole_start,
      data.hole_end,
      data.format,
      data.points_available,
      data.allowance_override,
      createdAt
    )
    .run();

  const row = await db
    .prepare(
      `
        SELECT ${ROUND_SEGMENT_COLUMNS}
        FROM round_segments
        WHERE id = ?1
        LIMIT 1
      `
    )
    .bind(data.id)
    .first<RoundSegment>();

  const created = normalizeRoundSegment(row);

  if (!created) {
    throw new Error(`Failed to create round segment ${data.id}.`);
  }

  return created;
}

export async function listSegmentsByRound(db: D1Database, roundId: string): Promise<RoundSegment[]> {
  const result = await db
    .prepare(
      `
        SELECT ${ROUND_SEGMENT_COLUMNS}
        FROM round_segments
        WHERE round_id = ?1
        ORDER BY hole_start ASC, created_at ASC
      `
    )
    .bind(roundId)
    .all<RoundSegment>();

  return result.results.map((row) => ({
    ...row,
    id: String(row.id),
    round_id: String(row.round_id)
  }));
}
