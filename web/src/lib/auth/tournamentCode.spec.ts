import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  generateTournamentCode,
  generateUniqueCode,
  isValidTournamentCode,
} from './tournamentCode';

const BULK_GENERATION_SAMPLE_SIZE = 10_000;
const EXPECTED_CODE_LENGTH = 6;
const DISALLOWED_CHARACTER_PATTERN = /[0O1ILa-z]/u;

describe('generateTournamentCode', () => {
  it('creates six-character uppercase codes without ambiguous characters', () => {
    for (let sampleIndex = 0; sampleIndex < BULK_GENERATION_SAMPLE_SIZE; sampleIndex += 1) {
      const code = generateTournamentCode();

      expect(code).toHaveLength(EXPECTED_CODE_LENGTH);
      expect(DISALLOWED_CHARACTER_PATTERN.test(code)).toBe(false);
      expect(isValidTournamentCode(code)).toBe(true);
    }
  });
});

describe('isValidTournamentCode', () => {
  it('returns false when ambiguous characters are present', () => {
    const invalidCodes = ['ABC0DE', 'ABCODE', 'ABC1DE', 'ABCIDE', 'ABCLDE'];

    for (const invalidCode of invalidCodes) {
      expect(isValidTournamentCode(invalidCode)).toBe(false);
    }
  });

  it('rejects lowercase and non-six-character values', () => {
    expect(isValidTournamentCode('abc234')).toBe(false);
    expect(isValidTournamentCode('ABC23')).toBe(false);
    expect(isValidTournamentCode('ABC2345')).toBe(false);
  });

  it('accepts a valid six-character code', () => {
    expect(isValidTournamentCode('ABCD23')).toBe(true);
  });
});

describe('generateUniqueCode', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retries until a code is not in the existing set', () => {
    const byteSequenceQueue = [
      new Uint8Array([0, 0, 0, 0, 0, 0]),
      new Uint8Array([1, 1, 1, 1, 1, 1]),
    ];

    const getRandomValuesSpy = vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(((
      typedArray: Uint8Array
    ): Uint8Array => {
      const nextBytes = byteSequenceQueue.shift();

      if (!nextBytes) {
        throw new Error('Test byte sequence queue is exhausted.');
      }

      typedArray.set(nextBytes);
      return typedArray;
    }) as typeof crypto.getRandomValues);

    const existingCodes = new Set<string>(['AAAAAA']);
    const uniqueCode = generateUniqueCode(existingCodes);

    expect(uniqueCode).toBe('BBBBBB');
    expect(getRandomValuesSpy).toHaveBeenCalledTimes(2);
  });
});
