import { dev } from '$app/environment';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

const COOKIE_NAMES = ['rc_commissioner', 'rc_player', 'rc_spectator'] as const;

export const POST: RequestHandler = async ({ cookies }) => {
  for (const cookieName of COOKIE_NAMES) {
    cookies.set(cookieName, '', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
      secure: !dev,
    });
  }

  return json({ message: 'Logged out' });
};
