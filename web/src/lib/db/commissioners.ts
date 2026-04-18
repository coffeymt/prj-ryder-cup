import type { Commissioner } from './types';

type CreateCommissionerInput = Omit<Commissioner, 'created_at'> &
  Partial<Pick<Commissioner, 'created_at'>>;

const COMMISSIONER_COLUMNS = `
  id,
  tournament_id,
  email,
  role,
  created_at
`;

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeCommissioner(row: Commissioner | null): Commissioner | null {
  if (!row) {
    return null;
  }

  return {
    ...row,
    id: String(row.id),
    tournament_id: String(row.tournament_id)
  };
}

export async function createCommissioner(
  db: D1Database,
  data: CreateCommissionerInput
): Promise<Commissioner> {
  const createdAt = data.created_at ?? nowIso();

  await db
    .prepare(
      `
        INSERT INTO commissioners (id, tournament_id, email, role, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5)
      `
    )
    .bind(data.id, data.tournament_id, data.email, data.role, createdAt)
    .run();

  const created = await getCommissionerById(db, data.id);

  if (!created) {
    throw new Error(`Failed to create commissioner ${data.id}.`);
  }

  return created;
}

export async function getCommissionerByEmail(
  db: D1Database,
  email: string
): Promise<Commissioner | null> {
  const row = await db
    .prepare(
      `
        SELECT ${COMMISSIONER_COLUMNS}
        FROM commissioners
        WHERE email = ?1
        ORDER BY created_at DESC
        LIMIT 1
      `
    )
    .bind(email)
    .first<Commissioner>();

  return normalizeCommissioner(row);
}

export async function getCommissionerById(db: D1Database, id: string): Promise<Commissioner | null> {
  const row = await db
    .prepare(
      `
        SELECT ${COMMISSIONER_COLUMNS}
        FROM commissioners
        WHERE id = ?1
        LIMIT 1
      `
    )
    .bind(id)
    .first<Commissioner>();

  return normalizeCommissioner(row);
}
