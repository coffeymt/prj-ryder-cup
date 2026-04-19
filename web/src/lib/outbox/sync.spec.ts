import Dexie from 'dexie';
import { IDBKeyRange, indexedDB } from 'fake-indexeddb';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

const queueModule = await import('./queue');
const syncModule = await import('./sync');
const dbModule = await import('./db');

const { enqueue, getPendingEntries } = queueModule;
const { syncOutbox } = syncModule;
const { db } = dbModule;

if (!db) {
  throw new Error('Expected browser-like runtime with IndexedDB for outbox tests.');
}

describe('syncOutbox', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(async () => {
    await db.outbox.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await db.delete();
  });

  it('posts pending entries with idempotency headers and marks 2xx as synced', async () => {
    await db.outbox.bulkAdd([
      {
        opId: '00000000-0000-4000-8000-000000000101',
        endpoint: '/api/matches/match-1/holes',
        method: 'POST',
        body: JSON.stringify({ holeNumber: 2 }),
        createdAt: 2,
        attempts: 0,
        lastAttemptAt: null,
        status: 'pending',
      },
      {
        opId: '00000000-0000-4000-8000-000000000100',
        endpoint: '/api/matches/match-1/holes',
        method: 'POST',
        body: JSON.stringify({ holeNumber: 1 }),
        createdAt: 1,
        attempts: 0,
        lastAttemptAt: null,
        status: 'pending',
      },
    ]);

    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));

    const result = await syncOutbox();

    expect(result).toEqual({ synced: 2, failed: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [firstUrl, firstRequest] = fetchMock.mock.calls[0] ?? [];
    const firstHeaders = new Headers(firstRequest?.headers);

    expect(firstUrl).toBe('/api/matches/match-1/holes');
    expect(firstRequest?.method).toBe('POST');
    expect(firstRequest?.body).toBe(JSON.stringify({ holeNumber: 1 }));
    expect(firstHeaders.get('Idempotency-Key')).toBe('00000000-0000-4000-8000-000000000100');

    const [secondUrl, secondRequest] = fetchMock.mock.calls[1] ?? [];
    const secondHeaders = new Headers(secondRequest?.headers);

    expect(secondUrl).toBe('/api/matches/match-1/holes');
    expect(secondRequest?.method).toBe('POST');
    expect(secondRequest?.body).toBe(JSON.stringify({ holeNumber: 2 }));
    expect(secondHeaders.get('Idempotency-Key')).toBe('00000000-0000-4000-8000-000000000101');

    const pendingEntries = await getPendingEntries();
    expect(pendingEntries).toHaveLength(0);
  });

  it('marks 4xx responses as failed', async () => {
    const id = await enqueue({
      opId: '00000000-0000-4000-8000-000000000102',
      endpoint: '/api/matches/match-2/holes',
      method: 'POST',
      body: JSON.stringify({ holeNumber: 3 }),
    });

    fetchMock.mockResolvedValue(new Response('bad request', { status: 400 }));

    const result = await syncOutbox();

    expect(result).toEqual({ synced: 0, failed: 1 });

    const failedEntry = await db.outbox.get(id);
    expect(failedEntry?.status).toBe('failed');
  });

  it('keeps 5xx responses pending and increments retry metadata', async () => {
    const id = await enqueue({
      opId: '00000000-0000-4000-8000-000000000103',
      endpoint: '/api/matches/match-3/holes',
      method: 'POST',
      body: JSON.stringify({ holeNumber: 4 }),
    });

    fetchMock.mockResolvedValue(new Response('server error', { status: 503 }));

    const result = await syncOutbox();

    expect(result).toEqual({ synced: 0, failed: 0 });

    const pendingEntry = await db.outbox.get(id);
    expect(pendingEntry?.status).toBe('pending');
    expect(pendingEntry?.attempts).toBe(1);
    expect(typeof pendingEntry?.lastAttemptAt).toBe('number');
  });
});
