import { env } from '$env/dynamic/private';
import { sendMagicLink } from '$lib/auth/emailClient';
import { issueMagicLink } from '$lib/auth/magicLink';
import { createCommissioner, getCommissionerByEmail } from '$lib/db/commissioners';
import { error, json } from '@sveltejs/kit';
import type { RequestEvent, RequestHandler } from '@sveltejs/kit';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

function getDb(event: RequestEvent): D1Database {
  const db = event.platform?.env?.DB;

  if (!db) {
    throw error(500, 'Database binding is not configured.');
  }

  return db;
}

function getAuthConfig(): { magicLinkKey: string; emailApiKey: string; fromEmail: string } {
  const missingKeys: string[] = [];

  if (!env.MAGIC_LINK_KEY) {
    missingKeys.push('MAGIC_LINK_KEY');
  }

  if (!env.EMAIL_API_KEY) {
    missingKeys.push('EMAIL_API_KEY');
  }

  if (!env.FROM_EMAIL) {
    missingKeys.push('FROM_EMAIL');
  }

  if (!env.COOKIE_SIGNING_KEY) {
    missingKeys.push('COOKIE_SIGNING_KEY');
  }

  if (missingKeys.length > 0) {
    throw error(500, `Missing environment variables: ${missingKeys.join(', ')}`);
  }

  return {
    magicLinkKey: env.MAGIC_LINK_KEY,
    emailApiKey: env.EMAIL_API_KEY,
    fromEmail: env.FROM_EMAIL,
  };
}

function getEmailFromBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const payload = body as { email?: unknown };

  if (typeof payload.email !== 'string') {
    return null;
  }

  const email = payload.email.trim().toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : null;
}

export const POST: RequestHandler = async (event) => {
  let body: unknown;

  try {
    body = await event.request.json();
  } catch {
    return json({ message: 'Invalid request body' }, { status: 400 });
  }

  const email = getEmailFromBody(body);

  if (!email) {
    return json({ message: 'Invalid email address' }, { status: 400 });
  }

  const db = getDb(event);
  const { magicLinkKey, emailApiKey, fromEmail } = getAuthConfig();

  let commissioner = await getCommissionerByEmail(db, email);

  if (!commissioner) {
    commissioner = await createCommissioner(db, {
      id: crypto.randomUUID(),
      tournament_id: crypto.randomUUID(),
      email,
      role: 'OWNER',
    });
  }

  const { token: rawToken, expiresAt } = await issueMagicLink(
    db,
    commissioner.email,
    commissioner.id,
    magicLinkKey
  );
  const magicLinkUrl = `${event.url.origin}/api/auth/magic-link/consume?token=${encodeURIComponent(rawToken)}`;

  try {
    await sendMagicLink({
      to: commissioner.email,
      magicLinkUrl,
      expiresAt,
      emailApiKey,
      fromEmail,
    });
  } catch (sendError) {
    console.error(sendError);
    return json({ message: 'Failed to send magic link email.' }, { status: 500 });
  }

  return json({ message: 'Magic link sent' });
};
