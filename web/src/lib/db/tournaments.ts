import type { Tournament } from './types';

type CreateTournamentInput = Omit<Tournament, 'created_at' | 'updated_at'> &
  Partial<Pick<Tournament, 'created_at' | 'updated_at'>>;

const TOURNAMENT_COLUMNS = `
  id,
  code,
  name,
  start_date,
  end_date,
  points_to_win,
  commissioner_email,
  public_ticker_enabled,
  allowance_scramble_low,
  allowance_scramble_high,
  allowance_pinehurst_low,
  allowance_pinehurst_high,
  allowance_shamble,
  allowance_fourball,
  allowance_singles,
  status,
  created_at,
  updated_at
`;

const TOURNAMENT_UPDATABLE_FIELDS = [
  'code',
  'name',
  'start_date',
  'end_date',
  'points_to_win',
  'commissioner_email',
  'public_ticker_enabled',
  'allowance_scramble_low',
  'allowance_scramble_high',
  'allowance_pinehurst_low',
  'allowance_pinehurst_high',
  'allowance_shamble',
  'allowance_fourball',
  'allowance_singles',
  'status',
] as const;

const TOURNAMENT_UPDATABLE_FIELD_SET = new Set<string>(TOURNAMENT_UPDATABLE_FIELDS);

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeTournament(row: Tournament | null): Tournament | null {
  if (!row) {
    return null;
  }

  return {
    ...row,
    id: String(row.id),
  };
}

export async function createTournament(
  db: D1Database,
  data: CreateTournamentInput
): Promise<Tournament> {
  const createdAt = data.created_at ?? nowIso();
  const updatedAt = data.updated_at ?? createdAt;

  await db
    .prepare(
      `
        INSERT INTO tournaments (
          id,
          code,
          name,
          start_date,
          end_date,
          points_to_win,
          commissioner_email,
          public_ticker_enabled,
          allowance_scramble_low,
          allowance_scramble_high,
          allowance_pinehurst_low,
          allowance_pinehurst_high,
          allowance_shamble,
          allowance_fourball,
          allowance_singles,
          created_at,
          updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)
      `
    )
    .bind(
      data.id,
      data.code,
      data.name,
      data.start_date,
      data.end_date,
      data.points_to_win,
      data.commissioner_email,
      data.public_ticker_enabled,
      data.allowance_scramble_low,
      data.allowance_scramble_high,
      data.allowance_pinehurst_low,
      data.allowance_pinehurst_high,
      data.allowance_shamble,
      data.allowance_fourball,
      data.allowance_singles,
      createdAt,
      updatedAt
    )
    .run();

  const created = await getTournamentById(db, data.id);

  if (!created) {
    throw new Error(`Failed to create tournament ${data.id}.`);
  }

  return created;
}

export async function getTournamentById(db: D1Database, id: string): Promise<Tournament | null> {
  const row = await db
    .prepare(
      `
        SELECT ${TOURNAMENT_COLUMNS}
        FROM tournaments
        WHERE id = ?1
        LIMIT 1
      `
    )
    .bind(id)
    .first<Tournament>();

  return normalizeTournament(row);
}

export async function getTournamentByCode(
  db: D1Database,
  code: string
): Promise<Tournament | null> {
  const row = await db
    .prepare(
      `
        SELECT ${TOURNAMENT_COLUMNS}
        FROM tournaments
        WHERE code = ?1
        LIMIT 1
      `
    )
    .bind(code)
    .first<Tournament>();

  return normalizeTournament(row);
}

export async function listTournamentsByCommissioner(
  db: D1Database,
  commissionerId: string
): Promise<Tournament[]> {
  const result = await db
    .prepare(
      `
        SELECT ${TOURNAMENT_COLUMNS}
        FROM tournaments
        WHERE commissioner_email = ?1
          OR commissioner_email = (
            SELECT email
            FROM commissioners
            WHERE CAST(id AS TEXT) = ?1
            LIMIT 1
          )
          OR id IN (
            SELECT tournament_id
            FROM commissioners
            WHERE CAST(id AS TEXT) = ?1
              AND tournament_id IS NOT NULL
          )
        ORDER BY created_at DESC
      `
    )
    .bind(commissionerId)
    .all<Tournament>();

  return result.results.map((row) => ({ ...row, id: String(row.id) }));
}

export async function updateTournament(
  db: D1Database,
  id: string,
  data: Partial<Tournament>
): Promise<Tournament | null> {
  const assignments = Object.entries(data).filter(
    ([field, value]) => TOURNAMENT_UPDATABLE_FIELD_SET.has(field) && value !== undefined
  );

  if (assignments.length === 0) {
    return getTournamentById(db, id);
  }

  const updatedAt = nowIso();
  const setSql = assignments.map(([field], index) => `${field} = ?${index + 1}`).join(', ');
  const values = assignments.map(([, value]) => value);

  await db
    .prepare(
      `
        UPDATE tournaments
        SET ${setSql}, updated_at = ?${assignments.length + 1}
        WHERE id = ?${assignments.length + 2}
      `
    )
    .bind(...values, updatedAt, id)
    .run();

  return getTournamentById(db, id);
}

export async function updateTournamentCode(
  db: D1Database,
  id: string,
  code: string
): Promise<void> {
  await db
    .prepare(
      `
        UPDATE tournaments
        SET code = ?1, updated_at = ?2
        WHERE id = ?3
      `
    )
    .bind(code, nowIso(), id)
    .run();
}
