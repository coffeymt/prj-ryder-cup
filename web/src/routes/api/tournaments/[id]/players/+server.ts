import {
  createPlayer,
  createPlayerTournament,
  getPlayerWithTournament,
  listPlayersByTournament,
} from '$lib/db/players';
import { getTeamById, updateTeam } from '$lib/db/teams';
import { getTournamentById } from '$lib/db/tournaments';
import { getCommissionerById } from '$lib/db/commissioners';
import { requireRole, requireSameTournament } from '$lib/auth/guards';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type PlayerCreateBody = {
  displayName?: unknown;
  handicapIndex?: unknown;
  teamId?: unknown;
  email?: unknown;
  isCaptain?: unknown;
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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
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

async function parseBody(request: Request): Promise<PlayerCreateBody> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON body.');
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw error(400, 'Request body must be an object.');
  }

  return body as PlayerCreateBody;
}

export const GET: RequestHandler = async (event) => {
  const db = getDatabase(event);
  const tournamentId = event.params.id;

  await assertTournamentReadAccess(event, db, tournamentId);

  const players = await listPlayersByTournament(db, tournamentId);

  return json({ players });
};

export const POST: RequestHandler = async (event) => {
  const db = getDatabase(event);
  const tournamentId = event.params.id;

  await assertCommissionerTournamentOwnership(event, db, tournamentId);

  const body = await parseBody(event.request);

  if (!isNonEmptyString(body.displayName)) {
    throw error(400, '`displayName` is required.');
  }

  if (!isFiniteNumber(body.handicapIndex)) {
    throw error(400, '`handicapIndex` must be a finite number.');
  }

  const teamId =
    body.teamId === undefined || body.teamId === null
      ? null
      : typeof body.teamId === 'string'
        ? body.teamId
        : (() => {
            throw error(400, '`teamId` must be a string when provided.');
          })();

  if (teamId) {
    const team = await getTeamById(db, teamId);

    if (!team || team.tournament_id !== tournamentId) {
      throw error(400, 'Provided `teamId` does not belong to this tournament.');
    }
  }

  if (body.email !== undefined) {
    if (!isNonEmptyString(body.email) || !isValidEmail(body.email.trim())) {
      throw error(400, '`email` must be a valid email address when provided.');
    }
  }

  if (body.isCaptain !== undefined && typeof body.isCaptain !== 'boolean') {
    throw error(400, '`isCaptain` must be a boolean when provided.');
  }

  if (body.isCaptain === true && !teamId) {
    throw error(400, '`teamId` is required when `isCaptain` is true.');
  }

  const player = await createPlayer(db, {
    name: body.displayName.trim(),
    handicap_index: body.handicapIndex,
    email: isNonEmptyString(body.email) ? (body.email as string).trim() : null,
  });

  await createPlayerTournament(db, {
    player_id: player.id,
    tournament_id: tournamentId,
    team_id: teamId,
  });

  if (body.isCaptain === true && teamId) {
    await updateTeam(db, teamId, { captain_player_id: player.id });
  }

  const playerWithTournament = await getPlayerWithTournament(db, player.id, tournamentId);

  return json({ player: playerWithTournament }, { status: 201 });
};
