import { describe, expect, it } from 'vitest';
import { signCookie, verifyCookie, type CookiePayload } from './cookies';

const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder();

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function encodeUtf8Base64Url(value: string): string {
  return encodeBase64Url(UTF8_ENCODER.encode(value));
}

function decodeUtf8Base64Url(value: string): string {
  return UTF8_DECODER.decode(decodeBase64Url(value));
}

function tamperSignature(token: string): string {
  const decodedToken = decodeUtf8Base64Url(token);
  const [payloadSegment, signatureSegment] = decodedToken.split('.');
  const signature = decodeBase64Url(signatureSegment);

  signature[0] ^= 0x01;

  const tampered = `${payloadSegment}.${encodeBase64Url(signature)}`;

  return encodeUtf8Base64Url(tampered);
}

describe('cookie signing helpers', () => {
  const signingKey = 'test-cookie-signing-key';

  it('round-trips a signed token to the original payload', async () => {
    const payload: CookiePayload = {
      tournamentId: 'tournament-001',
      playerId: 'player-007',
      role: 'player',
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const token = await signCookie(payload, signingKey);
    const verified = await verifyCookie(token, signingKey);

    expect(verified).toEqual(payload);
  });

  it('returns null when token signature is tampered', async () => {
    const payload: CookiePayload = {
      tournamentId: 'tournament-001',
      userId: 'user-123',
      role: 'commissioner',
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const token = await signCookie(payload, signingKey);
    const tamperedToken = tamperSignature(token);
    const verified = await verifyCookie(tamperedToken, signingKey);

    expect(verified).toBeNull();
  });

  it('returns null when token is expired', async () => {
    const payload: CookiePayload = {
      tournamentId: 'tournament-001',
      role: 'spectator',
      exp: Math.floor(Date.now() / 1000) - 10,
    };
    const token = await signCookie(payload, signingKey);
    const verified = await verifyCookie(token, signingKey);

    expect(verified).toBeNull();
  });

  it('accepts token when exp is in the future', async () => {
    const payload: CookiePayload = {
      tournamentId: 'tournament-001',
      userId: 'spectator-abc',
      role: 'spectator',
      exp: Math.floor(Date.now() / 1000) + 120,
    };
    const token = await signCookie(payload, signingKey);
    const verified = await verifyCookie(token, signingKey);

    expect(verified).toEqual(payload);
  });

  it('returns null when verified with the wrong key', async () => {
    const payload: CookiePayload = {
      tournamentId: 'tournament-001',
      playerId: 'player-007',
      role: 'player',
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const token = await signCookie(payload, signingKey);
    const verified = await verifyCookie(token, 'different-signing-key');

    expect(verified).toBeNull();
  });
});
