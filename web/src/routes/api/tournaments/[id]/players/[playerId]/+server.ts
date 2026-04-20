import {
  getPlayerWithTournament,
  updatePlayer,
  updatePlayerTournament,
  deletePlayerTournament,
} from '$lib/db/players';
import { getTeamById, updateTeam } from '$lib/db/teams';
import { getCommissionerById } from '$lib/db/commissioners';
import { requireRole, requireSameTournament } from '$lib/auth/guards';
import { error, json } from '@sveltejs/kit';
import type { Player, PlayerTournament, PlayerWithTournament } from '$lib/db/types';
import type { RequestHandler } from './$types';

type PlayerPatchBody = {
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

async function parseBody(request: Request): Promise<PlayerPatchBody> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON body.');
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw error(400, 'Request body must be an object.');
  }

  return body as PlayerPatchBody;
}

async function getScopedPlayerOrThrow(
  db: D1Database,
  tournamentId: string,
  playerId: string
): Promise<PlayerWithTournament> {
  const player = await getPlayerWithTournament(db, playerId, tournamentId);

  if (!player) {
    throw error(404, 'Player not found.');
  }

  return player;
}

export const PATCH: RequestHandler = async (event) => {
  const db = getDatabase(event);
  const tournamentId = event.params.id;
  const playerId = event.params.playerId;

  await assertCommissionerTournamentOwnership(event, db, tournamentId);

  const currentPlayer = await getScopedPlayerOrThrow(db, tournamentId, playerId);
  const body = await parseBody(event.request);
  const playerUpdates: Partial<Player> = {};
  const ptUpdates: Partial<PlayerTournament> = {};

  if (body.displayName !== undefined) {
    if (!isNonEmptyString(body.displayName)) {
      throw error(400, '`displayName` must be a non-empty string.');
    }

    playerUpdates.name = body.displayName.trim();
  }

  if (body.handicapIndex !== undefined) {
    if (!isFiniteNumber(body.handicapIndex)) {
      throw error(400, '`handicapIndex` must be a finite number.');
    }

    playerUpdates.handicap_index = body.handicapIndex;
  }

  if (body.email !== undefined) {
    if (!isNonEmptyString(body.email) || !isValidEmail(body.email.trim())) {
      throw error(400, '`email` must be a valid email address when provided.');
    }
  }

  let nextTeamId = currentPlayer.team_id;

  if (body.teamId !== undefined) {
    if (body.teamId !== null && typeof body.teamId !== 'string') {
      throw error(400, '`teamId` must be a string or null.');
    }

    if (typeof body.teamId === 'string') {
      const team = await getTeamById(db, body.teamId);

      if (!team || team.tournament_id !== tournamentId) {
        throw error(400, 'Provided `teamId` does not belong to this tournament.');
      }
    }

    nextTeamId = body.teamId;
    ptUpdates.team_id = body.teamId;
  }

  if (body.isCaptain !== undefined && typeof body.isCaptain !== 'boolean') {
    throw error(400, '`isCaptain` must be a boolean when provided.');
  }

  if (body.isCaptain === true && !nextTeamId) {
    throw error(400, '`teamId` is required when `isCaptain` is true.');
  }

  if (
    body.teamId !== undefined &&
    currentPlayer.team_id !== nextTeamId &&
    body.isCaptain !== true
  ) {
    await db
      .prepare(
        `
          UPDATE teams
          SET captain_player_id = NULL
          WHERE tournament_id = ?1 AND captain_player_id = ?2
        `
      )
      .bind(tournamentId, playerId)
      .run();
  }

  await updatePlayer(db, playerId, playerUpdates);
  await updatePlayerTournament(db, currentPlayer.player_tournament_id, ptUpdates);

  if (body.isCaptain === true && nextTeamId) {
    await db
      .prepare(
        `
          UPDATE teams
          SET captain_player_id = NULL
          WHERE tournament_id = ?1 AND captain_player_id = ?2 AND id <> ?3
        `
      )
      .bind(tournamentId, playerId, nextTeamId)
      .run();
    await updateTeam(db, nextTeamId, { captain_player_id: playerId });
  } else if (body.isCaptain === false) {
    await db
      .prepare(
        `
          UPDATE teams
          SET captain_player_id = NULL
          WHERE tournament_id = ?1 AND captain_player_id = ?2
        `
      )
      .bind(tournamentId, playerId)
      .run();
  }

  const refreshed = await getPlayerWithTournament(db, playerId, tournamentId);

  if (!refreshed) {
    throw error(404, 'Player not found.');
  }

  return json({ player: refreshed });
};

export const DELETE: RequestHandler = async (event) => {
  const db = getDatabase(event);
  const tournamentId = event.params.id;
  const playerId = event.params.playerId;

  await assertCommissionerTournamentOwnership(event, db, tournamentId);
  const player = await getScopedPlayerOrThrow(db, tournamentId, playerId);

  await db
    .prepare(
      `
        UPDATE teams
        SET captain_player_id = NULL
        WHERE tournament_id = ?1 AND captain_player_id = ?2
      `
    )
    .bind(tournamentId, playerId)
    .run();
  await deletePlayerTournament(db, player.player_tournament_id);

  return new Response(null, { status: 204 });
};
