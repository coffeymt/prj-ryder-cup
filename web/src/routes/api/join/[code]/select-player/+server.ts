import { createPlayerCookie } from '$lib/auth/cookies';
import { getTournamentByCode } from '$lib/db/tournaments';
import { getPlayerById, getPlayerTournament } from '$lib/db/players';
import { error, json, type RequestHandler } from '@sveltejs/kit';

const PLAYER_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type SelectPlayerBody = {
  playerId: string;
};

function getDatabaseBinding(platform: App.Platform | undefined): D1Database {
  const db = platform?.env.DB;

  if (!db) {
    throw error(500, 'Database binding is not configured.');
  }

  return db;
}

function isValidSelectPlayerBody(value: unknown): value is SelectPlayerBody {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const body = value as Partial<SelectPlayerBody>;

  return typeof body.playerId === 'string' && body.playerId.length > 0;
}

function buildPlayerCookieHeader(token: string, protocol: string): string {
  const attributes = [
    `rc_player=${token}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${PLAYER_COOKIE_MAX_AGE_SECONDS}`,
  ];

  if (protocol === 'https:') {
    attributes.push('Secure');
  }

  return attributes.join('; ');
}

export const POST: RequestHandler = async (event) => {
  const db = getDatabaseBinding(event.platform);
  const tournamentCode = event.params.code;
  const tournament = await getTournamentByCode(db, tournamentCode);

  if (!tournament) {
    return json({ error: 'Tournament not found' }, { status: 404 });
  }

  let payload: unknown;

  try {
    payload = await event.request.json();
  } catch {
    return json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!isValidSelectPlayerBody(payload)) {
    return json({ error: 'Invalid request body' }, { status: 400 });
  }

  const player = await getPlayerById(db, payload.playerId);

  if (!player) {
    return json({ error: 'Player not found' }, { status: 404 });
  }

  const playerTournament = await getPlayerTournament(db, player.id, tournament.id);

  if (!playerTournament) {
    return json({ error: 'Player not found' }, { status: 404 });
  }

  const cookieSigningKey = event.platform?.env?.COOKIE_SIGNING_KEY;

  if (!cookieSigningKey) {
    throw error(500, 'Cookie signing key is not configured.');
  }

  const cookieToken = await createPlayerCookie(
    { tournamentId: tournament.id, playerId: player.id },
    cookieSigningKey,
    30
  );

  return json(
    {
      playerId: player.id,
      tournamentId: tournament.id,
      displayName: player.name,
    },
    {
      headers: {
        'Set-Cookie': buildPlayerCookieHeader(cookieToken, event.url.protocol),
      },
    }
  );
};
