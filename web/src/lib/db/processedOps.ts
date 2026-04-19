import type { ProcessedOp } from './types';

const PROCESSED_OP_COLUMNS = `
  op_id,
  endpoint,
  processed_at
`;

function nowIso(): string {
  return new Date().toISOString();
}

function toStoredOpId(opId: string, matchId?: string): string {
  return matchId ? `${matchId}:${opId}` : opId;
}

export async function claimOp(db: D1Database, opId: string, matchId?: string): Promise<boolean> {
  const processedAt = nowIso();
  const storedOpId = toStoredOpId(opId, matchId);
  const claimStatement = matchId
    ? db
        .prepare(
          `
            INSERT OR IGNORE INTO processed_ops (op_id, match_id, endpoint, processed_at)
            VALUES (?1, ?2, ?3, ?4)
          `
        )
        .bind(storedOpId, matchId, '', processedAt)
    : db
        .prepare(
          `
            INSERT OR IGNORE INTO processed_ops (op_id, endpoint, processed_at)
            VALUES (?1, ?2, ?3)
          `
        )
        .bind(storedOpId, '', processedAt);

  const [claimResult] = await db.batch([claimStatement]);
  return claimResult.meta.changes === 1;
}

export async function isOpProcessed(
  db: D1Database,
  opId: string,
  matchId?: string
): Promise<boolean> {
  const storedOpId = toStoredOpId(opId, matchId);
  const row = await db
    .prepare(
      `
        SELECT op_id
        FROM processed_ops
        WHERE op_id = ?1
          ${matchId ? 'AND match_id = ?2' : ''}
        LIMIT 1
      `
    )
    .bind(...(matchId ? [storedOpId, matchId] : [storedOpId]))
    .first<{ op_id: string }>();

  return row !== null;
}

export async function markOpProcessed(
  db: D1Database,
  opId: string,
  responseBody: string,
  matchId?: string
): Promise<void> {
  const processedAt = nowIso();
  const storedOpId = toStoredOpId(opId, matchId);

  if (matchId) {
    await db
      .prepare(
        `
          INSERT INTO processed_ops (op_id, match_id, endpoint, processed_at)
          VALUES (?1, ?2, ?3, ?4)
          ON CONFLICT(op_id) DO UPDATE SET
            endpoint = excluded.endpoint,
            processed_at = excluded.processed_at
        `
      )
      .bind(storedOpId, matchId, responseBody, processedAt)
      .run();

    return;
  }

  await db
    .prepare(
      `
        INSERT INTO processed_ops (op_id, endpoint, processed_at)
        VALUES (?1, ?2, ?3)
        ON CONFLICT(op_id) DO UPDATE SET
          endpoint = excluded.endpoint,
          processed_at = excluded.processed_at
      `
    )
    .bind(storedOpId, responseBody, processedAt)
    .run();
}

export async function getProcessedOp(
  db: D1Database,
  opId: string,
  matchId?: string
): Promise<ProcessedOp | null> {
  const storedOpId = toStoredOpId(opId, matchId);
  const row = await db
    .prepare(
      `
        SELECT ${PROCESSED_OP_COLUMNS}
        FROM processed_ops
        WHERE op_id = ?1
          ${matchId ? 'AND match_id = ?2' : ''}
        LIMIT 1
      `
    )
    .bind(...(matchId ? [storedOpId, matchId] : [storedOpId]))
    .first<ProcessedOp>();

  return row;
}
