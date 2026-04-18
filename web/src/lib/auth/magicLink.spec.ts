import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  consumeMagicLink,
  generateMagicLinkToken,
  issueMagicLink,
  type MagicLinkRecord,
} from './magicLink';

type MagicLinkInsertValues = [string, string, string, string];
type MagicLinkUpdateValues = [string, number];

function cloneRecord(record: MagicLinkRecord): MagicLinkRecord {
  return { ...record };
}

function createD1Result<T = Record<string, unknown>>(): D1Result<T> {
  return {
    success: true,
    meta: {} as D1Meta & Record<string, unknown>,
    results: [],
  };
}

class MockD1Statement {
  private values: unknown[] = [];

  constructor(
    private readonly db: MockD1Database,
    private readonly normalizedQuery: string
  ) {}

  bind(...values: unknown[]): MockD1Statement {
    this.values = values;

    return this;
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    if (this.normalizedQuery.includes('from magic_link_tokens where token_hash = ?1')) {
      const tokenHash = this.values[0];

      if (typeof tokenHash !== 'string') {
        throw new Error('Expected token hash string bind value.');
      }

      const record = this.db.getRecordByTokenHash(tokenHash);

      return record ? (cloneRecord(record) as T) : null;
    }

    throw new Error(`Unsupported first() query: ${this.normalizedQuery}`);
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    if (this.normalizedQuery.startsWith('insert into magic_link_tokens')) {
      const [commissionerId, tokenHash, email, expiresAt] = this.values as MagicLinkInsertValues;
      this.db.insert({
        commissioner_id: commissionerId,
        token_hash: tokenHash,
        email,
        expires_at: expiresAt,
        consumed_at: null,
      });

      return createD1Result<T>();
    }

    if (this.normalizedQuery.startsWith('update magic_link_tokens set consumed_at = ?1')) {
      const [consumedAt, id] = this.values as MagicLinkUpdateValues;
      this.db.consumeById(id, consumedAt);

      return createD1Result<T>();
    }

    throw new Error(`Unsupported run() query: ${this.normalizedQuery}`);
  }
}

class MockD1Database {
  private rows: MagicLinkRecord[] = [];
  private nextId = 1;

  prepare(query: string): D1PreparedStatement {
    const normalizedQuery = query.replace(/\s+/g, ' ').trim().toLowerCase();

    return new MockD1Statement(this, normalizedQuery) as unknown as D1PreparedStatement;
  }

  insert(row: Omit<MagicLinkRecord, 'id' | 'created_at'>): void {
    this.rows.push({
      id: this.nextId,
      created_at: new Date(Date.now()).toISOString(),
      ...row,
    });
    this.nextId += 1;
  }

  consumeById(id: number, consumedAt: string): void {
    const row = this.rows.find((item) => item.id === id);

    if (!row || row.consumed_at !== null) {
      return;
    }

    row.consumed_at = consumedAt;
  }

  getRecordByTokenHash(tokenHash: string): MagicLinkRecord | null {
    const row = this.rows.find((item) => item.token_hash === tokenHash);

    return row ? cloneRecord(row) : null;
  }

  getRows(): MagicLinkRecord[] {
    return this.rows.map((row) => cloneRecord(row));
  }
}

function toD1Database(mockDb: MockD1Database): D1Database {
  return mockDb as unknown as D1Database;
}

describe('magic-link token lifecycle', () => {
  const magicLinkKey = 'test-magic-link-key';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('generates a 64-char token and distinct SHA-256 hash', async () => {
    const { token, tokenHash } = await generateMagicLinkToken();

    expect(token).toMatch(/^[a-f0-9]{64}$/u);
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(tokenHash).not.toBe(token);
  });

  it('consumes a valid unused token and marks it consumed', async () => {
    const db = new MockD1Database();
    const { token } = await issueMagicLink(
      toD1Database(db),
      'commissioner@example.com',
      'commissioner-001',
      magicLinkKey
    );
    const consumed = await consumeMagicLink(toD1Database(db), token, magicLinkKey);
    const [storedRecord] = db.getRows();

    expect(consumed).toEqual({
      commissionerId: 'commissioner-001',
      email: 'commissioner@example.com',
    });
    expect(storedRecord.consumed_at).not.toBeNull();
  });

  it('returns null for an already-consumed token outside replay window', async () => {
    const db = new MockD1Database();
    const { token } = await issueMagicLink(
      toD1Database(db),
      'commissioner@example.com',
      'commissioner-001',
      magicLinkKey
    );
    const firstConsume = await consumeMagicLink(toD1Database(db), token, magicLinkKey);

    expect(firstConsume).toEqual({
      commissionerId: 'commissioner-001',
      email: 'commissioner@example.com',
    });

    vi.setSystemTime(new Date('2026-01-01T12:01:01.000Z'));

    const secondConsume = await consumeMagicLink(toD1Database(db), token, magicLinkKey);

    expect(secondConsume).toBeNull();
  });

  it('returns null for an expired token', async () => {
    const db = new MockD1Database();
    const { token } = await issueMagicLink(
      toD1Database(db),
      'commissioner@example.com',
      'commissioner-001',
      magicLinkKey
    );

    vi.setSystemTime(new Date('2026-01-01T12:16:00.000Z'));

    const consumed = await consumeMagicLink(toD1Database(db), token, magicLinkKey);

    expect(consumed).toBeNull();
  });

  it('returns null for a non-existent token hash', async () => {
    const issuingDb = new MockD1Database();
    const consumingDb = new MockD1Database();
    const { token } = await issueMagicLink(
      toD1Database(issuingDb),
      'commissioner@example.com',
      'commissioner-001',
      magicLinkKey
    );
    const consumed = await consumeMagicLink(toD1Database(consumingDb), token, magicLinkKey);

    expect(consumed).toBeNull();
  });

  it('returns same identity when replayed within 60-second idempotency window', async () => {
    const db = new MockD1Database();
    const { token } = await issueMagicLink(
      toD1Database(db),
      'commissioner@example.com',
      'commissioner-001',
      magicLinkKey
    );
    const firstConsume = await consumeMagicLink(toD1Database(db), token, magicLinkKey);

    vi.setSystemTime(new Date('2026-01-01T12:00:30.000Z'));

    const replayConsume = await consumeMagicLink(toD1Database(db), token, magicLinkKey);

    expect(firstConsume).toEqual({
      commissionerId: 'commissioner-001',
      email: 'commissioner@example.com',
    });
    expect(replayConsume).toEqual(firstConsume);
  });
});
