import { requireRole } from '$lib/auth/guards';
import { generateUniqueCode } from '$lib/auth/tournamentCode';
import { getTournamentById, updateTournamentCode } from '$lib/db/tournaments';
import { error, json, type RequestHandler } from '@sveltejs/kit';

function getDb(event: Parameters<RequestHandler>[0]): D1Database {
  const db = event.platform?.env?.DB;

  if (!db) {
    throw error(500, 'Database binding is not configured.');
  }

  return db;
}

function requireCommissionerUserId(event: Parameters<RequestHandler>[0]): string {
  requireRole(event.locals, 'commissioner');

  if (!event.locals.userId) {
    throw error(401, 'Unauthorized');
  }

  return event.locals.userId;
}

function requireTournamentId(event: Parameters<RequestHandler>[0]): string {
  const tournamentId = event.params.id;

  if (!tournamentId) {
    throw error(400, 'Tournament id is required.');
  }

  return tournamentId;
}

async function requireTournamentOwnership(
  event: Parameters<RequestHandler>[0],
  db: D1Database,
  tournamentId: string
): Promise<void> {
  const commissionerUserId = requireCommissionerUserId(event);
  const tournament = await getTournamentById(db, tournamentId);

  if (!tournament) {
    throw error(404, 'Tournament not found.');
  }

  if (tournament.commissioner_email !== commissionerUserId) {
    throw error(403, 'Forbidden');
  }
}

async function generateTournamentCode(db: D1Database): Promise<string> {
  const existingCodeRows = await db.prepare('SELECT code FROM tournaments').all<{ code: string }>();
  const existingCodes = new Set(existingCodeRows.results.map((row) => row.code));

  return generateUniqueCode(existingCodes);
}

export const POST: RequestHandler = async (event) => {
  const db = getDb(event);
  const tournamentId = requireTournamentId(event);

  await requireTournamentOwnership(event, db, tournamentId);

  const newCode = await generateTournamentCode(db);
  await updateTournamentCode(db, tournamentId, newCode);

  return json({ code: newCode });
};
