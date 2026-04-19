import Dexie from 'dexie';
import { IDBKeyRange, indexedDB } from 'fake-indexeddb';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

const queueModule = await import('./queue');
const dbModule = await import('./db');

const { enqueue, getPendingCount, getPendingEntries, markFailed, markSynced } = queueModule;
const { db } = dbModule;

if (!db) {
  throw new Error('Expected browser-like runtime with IndexedDB for outbox tests.');
}

describe('outbox queue', () => {
  beforeEach(async () => {
    await db.outbox.clear();
  });

  afterAll(async () => {
    await db.delete();
  });

  it('enqueue adds an entry with pending status', async () => {
    const id = await enqueue({
      opId: '00000000-0000-4000-8000-000000000001',
      endpoint: '/api/matches/match-1/holes',
      method: 'POST',
      body: JSON.stringify({
        playerId: 'player-1',
        holeNumber: 1,
      }),
    });

    const inserted = await db.outbox.get(id);

    expect(inserted).toMatchObject({
      id,
      opId: '00000000-0000-4000-8000-000000000001',
      status: 'pending',
      attempts: 0,
      lastAttemptAt: null,
    });
    expect(typeof inserted?.createdAt).toBe('number');
  });

  it('getPendingEntries returns only pending entries', async () => {
    const pendingId = await enqueue({
      opId: '00000000-0000-4000-8000-000000000002',
      endpoint: '/api/matches/match-1/holes',
      method: 'POST',
      body: JSON.stringify({
        playerId: 'player-2',
        holeNumber: 2,
      }),
    });

    const syncedId = await enqueue({
      opId: '00000000-0000-4000-8000-000000000003',
      endpoint: '/api/matches/match-1/holes',
      method: 'POST',
      body: JSON.stringify({
        playerId: 'player-3',
        holeNumber: 3,
      }),
    });

    const failedId = await enqueue({
      opId: '00000000-0000-4000-8000-000000000004',
      endpoint: '/api/matches/match-1/holes',
      method: 'POST',
      body: JSON.stringify({
        playerId: 'player-4',
        holeNumber: 4,
      }),
    });

    await markSynced(syncedId);
    await markFailed(failedId);

    const pendingEntries = await getPendingEntries();

    expect(pendingEntries).toHaveLength(1);
    expect(pendingEntries[0]?.id).toBe(pendingId);
    expect(pendingEntries[0]?.status).toBe('pending');
  });

  it('markSynced updates status to synced', async () => {
    const id = await enqueue({
      opId: '00000000-0000-4000-8000-000000000005',
      endpoint: '/api/matches/match-2/holes',
      method: 'POST',
      body: JSON.stringify({
        playerId: 'player-5',
        holeNumber: 5,
      }),
    });

    await markSynced(id);

    const updated = await db.outbox.get(id);
    expect(updated?.status).toBe('synced');
  });

  it('markFailed updates status to failed', async () => {
    const id = await enqueue({
      opId: '00000000-0000-4000-8000-000000000006',
      endpoint: '/api/matches/match-3/holes',
      method: 'POST',
      body: JSON.stringify({
        playerId: 'player-6',
        holeNumber: 6,
      }),
    });

    await markFailed(id);

    const updated = await db.outbox.get(id);
    expect(updated?.status).toBe('failed');
  });

  it('getPendingCount returns only pending entry count', async () => {
    const pendingOne = await enqueue({
      opId: '00000000-0000-4000-8000-000000000007',
      endpoint: '/api/matches/match-4/holes',
      method: 'POST',
      body: JSON.stringify({
        playerId: 'player-7',
        holeNumber: 7,
      }),
    });

    const pendingTwo = await enqueue({
      opId: '00000000-0000-4000-8000-000000000008',
      endpoint: '/api/matches/match-4/holes',
      method: 'POST',
      body: JSON.stringify({
        playerId: 'player-8',
        holeNumber: 8,
      }),
    });

    const synced = await enqueue({
      opId: '00000000-0000-4000-8000-000000000009',
      endpoint: '/api/matches/match-4/holes',
      method: 'POST',
      body: JSON.stringify({
        playerId: 'player-9',
        holeNumber: 9,
      }),
    });

    await markSynced(synced);

    const count = await getPendingCount();

    expect(count).toBe(2);
    expect(pendingOne).toBeGreaterThan(0);
    expect(pendingTwo).toBeGreaterThan(0);
  });
});
