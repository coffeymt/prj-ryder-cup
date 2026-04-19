import type { Handle } from '@sveltejs/kit';
import { verifyCookie, type CookiePayload } from '$lib/auth/cookies';

type ResolvedIdentity = Pick<App.Locals, 'role' | 'tournamentId' | 'playerId' | 'userId'>;

type CookieIdentityAttempt = {
  cookieName: 'rc_commissioner' | 'rc_player' | 'rc_spectator';
  expectedRole: CookiePayload['role'];
  signingKey: string | undefined;
};

const ANONYMOUS_IDENTITY: ResolvedIdentity = {
  role: 'anonymous',
  tournamentId: null,
  playerId: null,
  userId: null,
};

function isCookiePayload(value: object): value is CookiePayload {
  const payload = value as Partial<CookiePayload>;

  if (typeof payload.tournamentId !== 'string') {
    return false;
  }

  if (
    payload.role !== 'commissioner' &&
    payload.role !== 'player' &&
    payload.role !== 'spectator'
  ) {
    return false;
  }

  if (payload.playerId !== undefined && typeof payload.playerId !== 'string') {
    return false;
  }

  if (payload.userId !== undefined && typeof payload.userId !== 'string') {
    return false;
  }

  return typeof payload.exp === 'number' && Number.isFinite(payload.exp);
}

async function resolveIdentity(
  cookieValue: string | undefined,
  signingKey: string | undefined,
  expectedRole: CookiePayload['role']
): Promise<ResolvedIdentity | null> {
  if (!cookieValue || !signingKey) {
    return null;
  }

  const verifiedPayload = await verifyCookie(cookieValue, signingKey);

  if (
    !verifiedPayload ||
    !isCookiePayload(verifiedPayload) ||
    verifiedPayload.role !== expectedRole
  ) {
    return null;
  }

  if (expectedRole === 'commissioner' && !verifiedPayload.userId) {
    return null;
  }

  if (expectedRole === 'player' && !verifiedPayload.playerId) {
    return null;
  }

  return {
    role: expectedRole,
    tournamentId: verifiedPayload.tournamentId,
    playerId: expectedRole === 'player' ? (verifiedPayload.playerId ?? null) : null,
    userId: expectedRole === 'commissioner' ? (verifiedPayload.userId ?? null) : null,
  };
}

export const handle: Handle = async ({ event, resolve }) => {
  Object.assign(event.locals, ANONYMOUS_IDENTITY);

  const platformEnv = event.platform?.env;
  const cookieSigningKey = platformEnv?.COOKIE_SIGNING_KEY;
  const spectatorCookieKey = platformEnv?.SPECTATOR_COOKIE_KEY;

  const attempts: CookieIdentityAttempt[] = [
    {
      cookieName: 'rc_commissioner',
      expectedRole: 'commissioner',
      signingKey: cookieSigningKey,
    },
    {
      cookieName: 'rc_player',
      expectedRole: 'player',
      signingKey: cookieSigningKey,
    },
    {
      cookieName: 'rc_spectator',
      expectedRole: 'spectator',
      signingKey: spectatorCookieKey,
    },
  ];

  for (const attempt of attempts) {
    const cookieValue = event.cookies.get(attempt.cookieName);
    const identity = await resolveIdentity(cookieValue, attempt.signingKey, attempt.expectedRole);

    if (!identity) {
      continue;
    }

    Object.assign(event.locals, identity);
    break;
  }

  return resolve(event);
};
