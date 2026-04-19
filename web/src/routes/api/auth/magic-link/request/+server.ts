import { dev } from '$app/environment';
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

function getAuthConfig(
  platformEnv: App.Platform['env']
): { magicLinkKey: string; emailApiKey: string; fromEmail: string } {
  const missingKeys: string[] = [];

  if (!platformEnv.MAGIC_LINK_KEY) {
    missingKeys.push('MAGIC_LINK_KEY');
  }

  if (!platformEnv.COOKIE_SIGNING_KEY) {
    missingKeys.push('COOKIE_SIGNING_KEY');
  }

  if (!dev && !platformEnv.EMAIL_API_KEY) {
    missingKeys.push('EMAIL_API_KEY');
  }

  if (!dev && !platformEnv.FROM_EMAIL) {
    missingKeys.push('FROM_EMAIL');
  }

  if (missingKeys.length > 0) {
    throw error(500, `Missing environment variables: ${missingKeys.join(', ')}`);
  }

  return {
    magicLinkKey: platformEnv.MAGIC_LINK_KEY,
    emailApiKey: platformEnv.EMAIL_API_KEY ?? '',
    fromEmail: platformEnv.FROM_EMAIL ?? '',
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
  const platformEnv = event.platform?.env;

  if (!platformEnv) {
    throw error(500, 'Platform environment is not configured.');
  }

  const { magicLinkKey, emailApiKey, fromEmail } = getAuthConfig(platformEnv);

  let commissioner = await getCommissionerByEmail(db, email);

  if (!commissioner) {
    commissioner = await createCommissioner(db, {
      email,
      role: 'OWNER',
    });
  }

  const { token: rawToken, expiresAt } = await issueMagicLink(
    db,
    commissioner.email,
    magicLinkKey
  );
  const magicLinkUrl = `${event.url.origin}/api/auth/magic-link/consume?token=${encodeURIComponent(rawToken)}`;

  if (dev && (!emailApiKey || !fromEmail)) {
    console.log(
      `[dev] MAGIC LINK for ${commissioner.email}: ${magicLinkUrl}  (expires ${expiresAt.toISOString()})`
    );
    return json({ message: 'Magic link sent' });
  }

  try {
    await sendMagicLink({
      to: commissioner.email,
      magicLinkUrl,
      expiresAt,
      emailApiKey,
      fromEmail,
    });
  } catch (sendError) {
    console.error('[magic-link] email send error:', sendError);
    return json({ message: 'Failed to send magic link email.' }, { status: 500 });
  }

  return json({ message: 'Magic link sent' });
};
