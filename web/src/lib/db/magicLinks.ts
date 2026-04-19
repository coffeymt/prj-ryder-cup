import type { MagicLinkToken } from './types';

type CreateMagicLinkTokenInput = Omit<MagicLinkToken, 'consumed_at' | 'created_at'> &
  Partial<Pick<MagicLinkToken, 'consumed_at' | 'created_at'>>;

const MAGIC_LINK_COLUMNS = `
  id,
  token_hash,
  commissioner_email,
  tournament_id,
  expires_at,
  consumed_at,
  created_at
`;

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeMagicLinkToken(row: MagicLinkToken | null): MagicLinkToken | null {
  if (!row) {
    return null;
  }

  return {
    ...row,
    id: String(row.id),
    tournament_id: row.tournament_id === null ? null : String(row.tournament_id),
  };
}

export async function createMagicLinkToken(
  db: D1Database,
  data: CreateMagicLinkTokenInput
): Promise<MagicLinkToken> {
  const createdAt = data.created_at ?? nowIso();

  await db
    .prepare(
      `
        INSERT INTO magic_link_tokens (
          id,
          token_hash,
          commissioner_email,
          tournament_id,
          expires_at,
          consumed_at,
          created_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
      `
    )
    .bind(
      data.id,
      data.token_hash,
      data.commissioner_email,
      data.tournament_id,
      data.expires_at,
      data.consumed_at ?? null,
      createdAt
    )
    .run();

  const created = await db
    .prepare(
      `
        SELECT ${MAGIC_LINK_COLUMNS}
        FROM magic_link_tokens
        WHERE id = ?1
        LIMIT 1
      `
    )
    .bind(data.id)
    .first<MagicLinkToken>();

  const normalized = normalizeMagicLinkToken(created);

  if (!normalized) {
    throw new Error(`Failed to create magic link token ${data.id}.`);
  }

  return normalized;
}

export async function getMagicLinkByHash(
  db: D1Database,
  tokenHash: string
): Promise<MagicLinkToken | null> {
  const row = await db
    .prepare(
      `
        SELECT ${MAGIC_LINK_COLUMNS}
        FROM magic_link_tokens
        WHERE token_hash = ?1
        LIMIT 1
      `
    )
    .bind(tokenHash)
    .first<MagicLinkToken>();

  return normalizeMagicLinkToken(row);
}

export async function markMagicLinkConsumed(
  db: D1Database,
  id: string,
  consumedAt: string
): Promise<void> {
  await db
    .prepare(
      `
        UPDATE magic_link_tokens
        SET consumed_at = ?1
        WHERE id = ?2
      `
    )
    .bind(consumedAt, id)
    .run();
}
