import { createTeam, listTeamsByTournament } from '$lib/db/teams';
import { getTournamentById } from '$lib/db/tournaments';
import { getCommissionerById } from '$lib/db/commissioners';
import { requireRole, requireSameTournament } from '$lib/auth/guards';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type TeamCreateBody = {
  name?: unknown;
  color?: unknown;
};

function getDatabase(event: Parameters<RequestHandler>[0]): D1Database {
  const db = event.platform?.env?.DB;

  if (!db) {
    throw error(500, 'Database binding unavailable.');
  }

  return db;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidHexColor(value: string): boolean {
  return /^#[\dA-Fa-f]{6}$/u.test(value);
}

async function assertTournamentReadAccess(
  event: Parameters<RequestHandler>[0],
  db: D1Database,
  tournamentId: string
): Promise<void> {
  requireRole(event.locals, 'commissioner', 'player');
  requireSameTournament(event.locals, tournamentId);

  const tournament = await getTournamentById(db, tournamentId);

  if (!tournament) {
    throw error(404, 'Tournament not found.');
  }
}

async function assertCommissionerTournamentOwnership(
  event: Parameters<RequestHandler>[0],
  db: D1Database,
  tournamentId: string
): Promise<void> {
  requireRole(event.locals, 'commissioner');
  requireSameTournament(event.locals, tournamentId);

  const userId = event.locals.userId;

  if (!userId) {
    throw error(403, 'Forbidden');
  }

  const row = await db
    .prepare(
      `
        SELECT *
        FROM tournaments
        WHERE id = ?1
        LIMIT 1
      `
    )
    .bind(tournamentId)
    .first<Record<string, unknown>>();

  if (!row) {
    throw error(404, 'Tournament not found.');
  }

  const commissionerUserId =
    typeof row.commissioner_user_id === 'string' ? row.commissioner_user_id : null;

  if (commissionerUserId !== null) {
    if (commissionerUserId !== userId) {
      throw error(403, 'Forbidden');
    }

    return;
  }

  if (typeof row.commissioner_email === 'string' && row.commissioner_email === userId) {
    return;
  }

  const commissioner = await getCommissionerById(db, userId);

  if (!commissioner || commissioner.tournament_id !== tournamentId) {
    throw error(403, 'Forbidden');
  }
}

async function parseBody(request: Request): Promise<TeamCreateBody> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON body.');
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw error(400, 'Request body must be an object.');
  }

  return body as TeamCreateBody;
}

export const GET: RequestHandler = async (event) => {
  const db = getDatabase(event);
  const tournamentId = event.params.id;

  await assertTournamentReadAccess(event, db, tournamentId);

  const teams = await listTeamsByTournament(db, tournamentId);

  return json({ teams });
};

export const POST: RequestHandler = async (event) => {
  const db = getDatabase(event);
  const tournamentId = event.params.id;

  await assertCommissionerTournamentOwnership(event, db, tournamentId);

  const body = await parseBody(event.request);

  if (!isNonEmptyString(body.name)) {
    throw error(400, '`name` is required.');
  }

  if (!isNonEmptyString(body.color) || !isValidHexColor(body.color)) {
    throw error(400, '`color` must be a valid hex color like #0055AA.');
  }

  const team = await createTeam(db, {
    tournament_id: tournamentId,
    name: body.name.trim(),
    color: body.color,
    captain_player_id: null,
  });

  return json({ team }, { status: 201 });
};
