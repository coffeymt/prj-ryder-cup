const MAGIC_LINK_TOKEN_BYTES = 32;
const MAGIC_LINK_TOKEN_TTL_MS = 15 * 60 * 1000;
const MAGIC_LINK_REPLAY_WINDOW_MS = 60 * 1000;
const TOKEN_SEPARATOR = '.';
const TOKEN_PATTERN = /^[a-f0-9]{64}$/u;
const UTF8_ENCODER = new TextEncoder();

export type MagicLinkRecord = {
  id: number;
  token_hash: string;
  commissioner_email: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
};

function assertMagicLinkKey(magicLinkKey: string): string {
  if (!magicLinkKey) {
    throw new Error('Magic link signing key is required.');
  }

  return magicLinkKey;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function decodeBase64Url(value: string): Uint8Array | null {
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  } catch {
    return null;
  }
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;

  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left[index] ^ right[index];
  }

  return mismatch === 0;
}

function parseSignedToken(token: string): { rawToken: string; signature: Uint8Array } | null {
  const separatorIndex = token.indexOf(TOKEN_SEPARATOR);

  if (separatorIndex <= 0 || separatorIndex !== token.lastIndexOf(TOKEN_SEPARATOR)) {
    return null;
  }

  const rawToken = token.slice(0, separatorIndex);
  const signatureSegment = token.slice(separatorIndex + 1);

  if (!TOKEN_PATTERN.test(rawToken)) {
    return null;
  }

  const signature = decodeBase64Url(signatureSegment);

  if (!signature) {
    return null;
  }

  return { rawToken, signature };
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', UTF8_ENCODER.encode(token));

  return bytesToHex(new Uint8Array(digest));
}

async function importHmacKey(key: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    UTF8_ENCODER.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

async function createSignature(rawToken: string, key: string): Promise<Uint8Array> {
  const cryptoKey = await importHmacKey(key);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, UTF8_ENCODER.encode(rawToken));

  return new Uint8Array(signature);
}

async function signMagicLinkToken(rawToken: string, key: string): Promise<string> {
  const signature = await createSignature(rawToken, key);

  return `${rawToken}${TOKEN_SEPARATOR}${encodeBase64Url(signature)}`;
}

async function verifyMagicLinkToken(token: string, key: string): Promise<string | null> {
  const parsed = parseSignedToken(token);

  if (!parsed) {
    return null;
  }

  const expectedSignature = await createSignature(parsed.rawToken, key);

  if (!timingSafeEqual(parsed.signature, expectedSignature)) {
    return null;
  }

  return parsed.rawToken;
}

function parseTimestamp(timestamp: string): number | null {
  const parsed = Date.parse(timestamp);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function toIdentity(record: MagicLinkRecord): { email: string } {
  return {
    email: record.commissioner_email,
  };
}

function withinReplayWindow(nowMs: number, consumedAt: string): boolean {
  const consumedAtMs = parseTimestamp(consumedAt);

  if (consumedAtMs === null) {
    return false;
  }

  return nowMs - consumedAtMs <= MAGIC_LINK_REPLAY_WINDOW_MS;
}

export async function generateMagicLinkToken(): Promise<{ token: string; tokenHash: string }> {
  const randomBytes = crypto.getRandomValues(new Uint8Array(MAGIC_LINK_TOKEN_BYTES));
  const token = bytesToHex(randomBytes);
  const tokenHash = await hashToken(token);

  return { token, tokenHash };
}

export async function issueMagicLink(
  db: D1Database,
  email: string,
  magicLinkKey: string
): Promise<{ token: string; expiresAt: Date }> {
  const signingKey = assertMagicLinkKey(magicLinkKey);
  const { token: rawToken, tokenHash } = await generateMagicLinkToken();
  const signedToken = await signMagicLinkToken(rawToken, signingKey);
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TOKEN_TTL_MS);

  await db
    .prepare(
      `
        INSERT INTO magic_link_tokens (commissioner_email, token_hash, expires_at)
        VALUES (?1, ?2, ?3)
      `
    )
    .bind(email, tokenHash, expiresAt.toISOString())
    .run();

  return { token: signedToken, expiresAt };
}

export async function consumeMagicLink(
  db: D1Database,
  token: string,
  magicLinkKey: string
): Promise<{ email: string } | null> {
  if (!token || !magicLinkKey) {
    return null;
  }

  const rawToken = await verifyMagicLinkToken(token, magicLinkKey);

  if (!rawToken) {
    return null;
  }

  const tokenHash = await hashToken(rawToken);
  const nowMs = Date.now();
  const tokenRecord = await db
    .prepare(
      `
        SELECT id, token_hash, commissioner_email, expires_at, consumed_at, created_at
        FROM magic_link_tokens
        WHERE token_hash = ?1
        LIMIT 1
      `
    )
    .bind(tokenHash)
    .first<MagicLinkRecord>();

  if (!tokenRecord) {
    return null;
  }

  const expiresAtMs = parseTimestamp(tokenRecord.expires_at);

  if (expiresAtMs === null || expiresAtMs <= nowMs) {
    return null;
  }

  if (tokenRecord.consumed_at) {
    if (withinReplayWindow(nowMs, tokenRecord.consumed_at)) {
      return toIdentity(tokenRecord);
    }

    return null;
  }

  const consumedAt = new Date(nowMs).toISOString();

  await db
    .prepare(
      `
        UPDATE magic_link_tokens
        SET consumed_at = ?1
        WHERE id = ?2 AND consumed_at IS NULL
      `
    )
    .bind(consumedAt, tokenRecord.id)
    .run();

  const refreshedRecord = await db
    .prepare(
      `
        SELECT id, token_hash, commissioner_email, expires_at, consumed_at, created_at
        FROM magic_link_tokens
        WHERE token_hash = ?1
        LIMIT 1
      `
    )
    .bind(tokenHash)
    .first<MagicLinkRecord>();

  if (!refreshedRecord || !refreshedRecord.consumed_at) {
    return null;
  }

  if (!withinReplayWindow(nowMs, refreshedRecord.consumed_at)) {
    return null;
  }

  return toIdentity(refreshedRecord);
}
