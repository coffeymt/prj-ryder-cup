import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const CODE_PATTERN = /^[A-Z0-9]{6}$/u;
const PLAYER_COOKIE_NAME = 'rc_player';
const PLAYER_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const JOIN_ERROR_MESSAGE = 'Could not join. Try again.';

type RosterPlayer = {
  id: string;
  displayName: string;
  teamId: string | null;
  teamName: string | null;
  teamColor: string | null;
  isCaptain: boolean;
};

type RosterApiResponse = {
  tournament: {
    id: string;
    name: string;
  };
  roster: RosterPlayer[];
};

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function isRosterPlayer(value: unknown): value is RosterPlayer {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const player = value as Partial<RosterPlayer>;

  return (
    typeof player.id === 'string' &&
    typeof player.displayName === 'string' &&
    (typeof player.teamId === 'string' || player.teamId === null) &&
    (typeof player.teamName === 'string' || player.teamName === null) &&
    (typeof player.teamColor === 'string' || player.teamColor === null) &&
    typeof player.isCaptain === 'boolean'
  );
}

function isRosterApiResponse(value: unknown): value is RosterApiResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Partial<RosterApiResponse>;
  const tournament = payload.tournament as { id?: unknown; name?: unknown } | undefined;

  if (!tournament || typeof tournament.id !== 'string' || typeof tournament.name !== 'string') {
    return false;
  }

  if (!Array.isArray(payload.roster)) {
    return false;
  }

  return payload.roster.every(isRosterPlayer);
}

function parsePlayerCookie(setCookieHeader: string | null): { token: string; maxAge: number } | null {
  if (!setCookieHeader) {
    return null;
  }

  const tokenMatch = setCookieHeader.match(/(?:^|,\s*)rc_player=([^;,\s]+)/u);

  if (!tokenMatch?.[1]) {
    return null;
  }

  const maxAgeMatch = setCookieHeader.match(/Max-Age=(\d+)/iu);
  const maxAge = maxAgeMatch ? Number.parseInt(maxAgeMatch[1], 10) : PLAYER_COOKIE_MAX_AGE_SECONDS;

  return {
    token: tokenMatch[1],
    maxAge: Number.isFinite(maxAge) ? maxAge : PLAYER_COOKIE_MAX_AGE_SECONDS,
  };
}

export const load: PageServerLoad = async (event) => {
  if (event.locals.role === 'commissioner') {
    throw redirect(302, '/manage');
  }

  const tournamentCode = normalizeCode(event.params.code);

  if (!CODE_PATTERN.test(tournamentCode)) {
    throw redirect(302, '/join?error=not_found');
  }

  const rosterResponse = await event.fetch(`/api/join/${encodeURIComponent(tournamentCode)}/roster`);

  if (rosterResponse.status === 404) {
    throw redirect(302, '/join?error=not_found');
  }

  if (!rosterResponse.ok) {
    throw error(500, 'Could not load tournament roster.');
  }

  const rosterPayload = (await rosterResponse.json()) as unknown;

  if (!isRosterApiResponse(rosterPayload)) {
    throw error(500, 'Roster response is invalid.');
  }

  const selectedPlayerId =
    event.locals.role === 'player' && event.locals.tournamentId === rosterPayload.tournament.id
      ? event.locals.playerId
      : null;

  return {
    code: tournamentCode,
    tournamentName: rosterPayload.tournament.name,
    roster: rosterPayload.roster,
    selectedPlayerId,
    publicTickerRequiresCode: true,
  };
};

export const actions: Actions = {
  default: async (event) => {
    const tournamentCode = normalizeCode(event.params.code);

    if (!CODE_PATTERN.test(tournamentCode)) {
      throw redirect(303, '/join?error=not_found');
    }

    const formData = await event.request.formData();
    const rawPlayerId = formData.get('playerId');

    if (typeof rawPlayerId !== 'string' || rawPlayerId.trim().length === 0) {
      return fail(400, {
        joinError: JOIN_ERROR_MESSAGE,
      });
    }

    const playerId = rawPlayerId.trim();
    const response = await event.fetch(`/api/join/${encodeURIComponent(tournamentCode)}/select-player`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ playerId }),
    });

    if (!response.ok) {
      return fail(response.status >= 500 ? 500 : 400, {
        joinError: JOIN_ERROR_MESSAGE,
      });
    }

    const cookie = parsePlayerCookie(response.headers.get('set-cookie'));

    if (!cookie) {
      return fail(500, {
        joinError: JOIN_ERROR_MESSAGE,
      });
    }

    event.cookies.set(PLAYER_COOKIE_NAME, cookie.token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: cookie.maxAge,
      secure: event.url.protocol === 'https:',
    });

    throw redirect(303, `/t/${encodeURIComponent(tournamentCode)}`);
  },
};
