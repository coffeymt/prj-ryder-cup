import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { createCommissionerCookie } from '$lib/auth/cookies';
import { consumeMagicLink } from '$lib/auth/magicLink';
import { getCommissionerById } from '$lib/db/commissioners';
import { error, redirect } from '@sveltejs/kit';
import type { RequestEvent, RequestHandler } from '@sveltejs/kit';

const COMMISSIONER_COOKIE_NAME = 'rc_commissioner';
const COMMISSIONER_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const INVALID_LINK_REDIRECT = '/manage/login?error=invalid_link';

function getDb(event: RequestEvent): D1Database {
  const db = event.platform?.env?.DB;

  if (!db) {
    throw error(500, 'Database binding is not configured.');
  }

  return db;
}

function getAuthConfig(): { magicLinkKey: string; cookieSigningKey: string } {
  const missingKeys: string[] = [];

  if (!env.MAGIC_LINK_KEY) {
    missingKeys.push('MAGIC_LINK_KEY');
  }

  if (!env.COOKIE_SIGNING_KEY) {
    missingKeys.push('COOKIE_SIGNING_KEY');
  }

  if (missingKeys.length > 0) {
    throw error(500, `Missing environment variables: ${missingKeys.join(', ')}`);
  }

  return {
    magicLinkKey: env.MAGIC_LINK_KEY,
    cookieSigningKey: env.COOKIE_SIGNING_KEY,
  };
}

export const GET: RequestHandler = async (event) => {
  const token = event.url.searchParams.get('token');

  if (!token) {
    throw redirect(302, INVALID_LINK_REDIRECT);
  }

  const db = getDb(event);
  const { magicLinkKey, cookieSigningKey } = getAuthConfig();

  const consumedIdentity = await consumeMagicLink(db, token, magicLinkKey);

  if (!consumedIdentity) {
    throw redirect(302, INVALID_LINK_REDIRECT);
  }

  const commissioner = await getCommissionerById(db, consumedIdentity.commissionerId);

  if (!commissioner) {
    throw redirect(302, INVALID_LINK_REDIRECT);
  }

  const cookieValue = await createCommissionerCookie(
    {
      tournamentId: commissioner.tournament_id,
      userId: commissioner.id,
    },
    cookieSigningKey
  );

  event.cookies.set(COMMISSIONER_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: COMMISSIONER_COOKIE_MAX_AGE_SECONDS,
    secure: !dev,
  });

  throw redirect(302, '/manage');
};
