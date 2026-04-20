import type { AuditLog } from './types';

type WriteAuditEntryInput = Omit<AuditLog, 'id' | 'created_at'> &
  Partial<Pick<AuditLog, 'created_at'>>;

const AUDIT_COLUMNS = `
  id,
  tournament_id,
  actor_player_id,
  actor_email,
  action,
  entity_type,
  entity_id,
  old_value,
  new_value,
  created_at
`;

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeAuditLog(row: AuditLog | null): AuditLog | null {
  if (!row) {
    return null;
  }

  return {
    ...row,
    id: String(row.id),
    tournament_id: String(row.tournament_id),
    actor_player_id: row.actor_player_id === null ? null : String(row.actor_player_id),
  };
}

export async function writeAuditEntry(
  db: D1Database,
  data: WriteAuditEntryInput
): Promise<AuditLog> {
  const createdAt = data.created_at ?? nowIso();

  const result = await db
    .prepare(
      `
        INSERT INTO audit_log (
          tournament_id,
          actor_player_id,
          actor_email,
          action,
          entity_type,
          entity_id,
          old_value,
          new_value,
          created_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
      `
    )
    .bind(
      data.tournament_id,
      data.actor_player_id,
      data.actor_email,
      data.action,
      data.entity_type,
      data.entity_id,
      data.old_value,
      data.new_value,
      createdAt
    )
    .run();

  const insertedId = result.meta.last_row_id;

  const row = await db
    .prepare(
      `
        SELECT ${AUDIT_COLUMNS}
        FROM audit_log
        WHERE id = ?1
        LIMIT 1
      `
    )
    .bind(insertedId)
    .first<AuditLog>();

  const created = normalizeAuditLog(row);

  if (!created) {
    throw new Error(`Failed to write audit entry (last_row_id=${insertedId}).`);
  }

  return created;
}

export async function listAuditByTournament(
  db: D1Database,
  tournamentId: string
): Promise<AuditLog[]> {
  const result = await db
    .prepare(
      `
        SELECT ${AUDIT_COLUMNS}
        FROM audit_log
        WHERE tournament_id = ?1
        ORDER BY created_at DESC
      `
    )
    .bind(tournamentId)
    .all<AuditLog>();

  return result.results.map((row) => ({
    ...row,
    id: String(row.id),
    tournament_id: String(row.tournament_id),
    actor_player_id: row.actor_player_id === null ? null : String(row.actor_player_id),
  }));
}
