const TOKEN_SEPARATOR = '.';
const SECONDS_PER_DAY = 24 * 60 * 60;
const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder();

export type CookiePayload = {
  tournamentId: string;
  playerId?: string;
  userId?: string;
  role: 'commissioner' | 'player' | 'spectator';
  exp: number;
};

type CookiePayloadInput = Omit<CookiePayload, 'exp' | 'role'>;

function assertSigningKey(key: string): string {
  if (!key) {
    throw new Error('Cookie signing key is required.');
  }

  return key;
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

function encodeUtf8Base64Url(value: string): string {
  return encodeBase64Url(UTF8_ENCODER.encode(value));
}

function decodeUtf8Base64Url(value: string): string | null {
  const bytes = decodeBase64Url(value);

  if (!bytes) {
    return null;
  }

  try {
    return UTF8_DECODER.decode(bytes);
  } catch {
    return null;
  }
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

async function createSignature(payloadSegment: string, key: string): Promise<Uint8Array> {
  const cryptoKey = await importHmacKey(key);
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    UTF8_ENCODER.encode(payloadSegment)
  );

  return new Uint8Array(signature);
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;

  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left[index] ^ right[index];
  }

  return mismatch === 0;
}

function isCookieRole(value: unknown): value is CookiePayload['role'] {
  return value === 'commissioner' || value === 'player' || value === 'spectator';
}

function isCookiePayload(value: unknown): value is CookiePayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Partial<CookiePayload>;

  if (typeof payload.tournamentId !== 'string') {
    return false;
  }

  if (payload.playerId !== undefined && typeof payload.playerId !== 'string') {
    return false;
  }

  if (payload.userId !== undefined && typeof payload.userId !== 'string') {
    return false;
  }

  if (!isCookieRole(payload.role)) {
    return false;
  }

  return typeof payload.exp === 'number' && Number.isFinite(payload.exp);
}

function withExpiry(payload: Omit<CookiePayload, 'exp'>, expiryDays: number): CookiePayload {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expirySeconds = Math.max(0, Math.floor(expiryDays * SECONDS_PER_DAY));

  return {
    ...payload,
    exp: nowSeconds + expirySeconds,
  };
}

export async function signCookie(payload: object, key: string): Promise<string> {
  const signingKey = assertSigningKey(key);
  const payloadJson = JSON.stringify(payload);
  const payloadSegment = encodeUtf8Base64Url(payloadJson);
  const signature = await createSignature(payloadSegment, signingKey);
  const signatureSegment = encodeBase64Url(signature);
  const combinedToken = `${payloadSegment}${TOKEN_SEPARATOR}${signatureSegment}`;

  return encodeUtf8Base64Url(combinedToken);
}

export async function verifyCookie(token: string, key: string): Promise<object | null> {
  if (!token || !key) {
    return null;
  }

  const decodedToken = decodeUtf8Base64Url(token);

  if (!decodedToken) {
    return null;
  }

  const separatorIndex = decodedToken.indexOf(TOKEN_SEPARATOR);

  if (separatorIndex <= 0 || separatorIndex !== decodedToken.lastIndexOf(TOKEN_SEPARATOR)) {
    return null;
  }

  const payloadSegment = decodedToken.slice(0, separatorIndex);
  const signatureSegment = decodedToken.slice(separatorIndex + 1);
  const signature = decodeBase64Url(signatureSegment);

  if (!signature) {
    return null;
  }

  const expectedSignature = await createSignature(payloadSegment, key);

  if (!equalBytes(signature, expectedSignature)) {
    return null;
  }

  const payloadJson = decodeUtf8Base64Url(payloadSegment);

  if (!payloadJson) {
    return null;
  }

  try {
    const parsedPayload = JSON.parse(payloadJson) as unknown;

    if (!isCookiePayload(parsedPayload)) {
      return null;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);

    if (parsedPayload.exp <= nowSeconds) {
      return null;
    }

    return parsedPayload;
  } catch {
    return null;
  }
}

export async function createPlayerCookie(
  payload: CookiePayloadInput,
  key: string,
  expiryDays = 30
): Promise<string> {
  const cookiePayload = withExpiry({ ...payload, role: 'player' }, expiryDays);

  return signCookie(cookiePayload, assertSigningKey(key));
}

export async function createCommissionerCookie(
  payload: CookiePayloadInput,
  key: string,
  expiryDays = 7
): Promise<string> {
  const cookiePayload = withExpiry({ ...payload, role: 'commissioner' }, expiryDays);

  return signCookie(cookiePayload, assertSigningKey(key));
}

export async function createSpectatorCookie(
  payload: CookiePayloadInput,
  key: string,
  expiryDays = 7
): Promise<string> {
  const cookiePayload = withExpiry({ ...payload, role: 'spectator' }, expiryDays);

  return signCookie(cookiePayload, assertSigningKey(key));
}
