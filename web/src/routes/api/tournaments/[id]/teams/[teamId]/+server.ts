import { deleteTeam, getTeamById, updateTeam } from '$lib/db/teams';
import { getPlayerById } from '$lib/db/players';
import { getCommissionerById } from '$lib/db/commissioners';
import { requireRole, requireSameTournament } from '$lib/auth/guards';
import { error, json } from '@sveltejs/kit';
import type { Team } from '$lib/db/types';
import type { RequestHandler } from './$types';

type TeamPatchBody = {
  name?: unknown;
  color?: unknown;
  captain_player_id?: unknown;
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

async function getScopedTeamOrThrow(
  db: D1Database,
  tournamentId: string,
  teamId: string
): Promise<Team> {
  const team = await getTeamById(db, teamId);

  if (!team || team.tournament_id !== tournamentId) {
    throw error(404, 'Team not found.');
  }

  return team;
}

async function parseBody(request: Request): Promise<TeamPatchBody> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON body.');
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw error(400, 'Request body must be an object.');
  }

  return body as TeamPatchBody;
}

export const PATCH: RequestHandler = async (event) => {
  const db = getDatabase(event);
  const tournamentId = event.params.id;
  const teamId = event.params.teamId;

  await assertCommissionerTournamentOwnership(event, db, tournamentId);
  await getScopedTeamOrThrow(db, tournamentId, teamId);

  const body = await parseBody(event.request);
  const updates: Partial<Team> = {};

  if (body.name !== undefined) {
    if (!isNonEmptyString(body.name)) {
      throw error(400, '`name` must be a non-empty string.');
    }

    updates.name = body.name.trim();
  }

  if (body.color !== undefined) {
    if (!isNonEmptyString(body.color) || !isValidHexColor(body.color)) {
      throw error(400, '`color` must be a valid hex color like #0055AA.');
    }

    updates.color = body.color;
  }

  if (body.captain_player_id !== undefined) {
    if (body.captain_player_id !== null && typeof body.captain_player_id !== 'string') {
      throw error(400, '`captain_player_id` must be a string or null.');
    }

    if (typeof body.captain_player_id === 'string') {
      const player = await getPlayerById(db, body.captain_player_id);

      if (!player || player.tournament_id !== tournamentId) {
        throw error(400, 'Captain player must belong to the tournament.');
      }

      if (player.team_id !== teamId) {
        throw error(400, 'Captain player must belong to this team.');
      }
    }

    updates.captain_player_id = body.captain_player_id;
  }

  const updated = await updateTeam(db, teamId, updates);

  if (!updated || updated.tournament_id !== tournamentId) {
    throw error(404, 'Team not found.');
  }

  return json({ team: updated });
};

export const DELETE: RequestHandler = async (event) => {
  const db = getDatabase(event);
  const tournamentId = event.params.id;
  const teamId = event.params.teamId;

  await assertCommissionerTournamentOwnership(event, db, tournamentId);
  await getScopedTeamOrThrow(db, tournamentId, teamId);
  await deleteTeam(db, teamId);

  return new Response(null, { status: 204 });
};
