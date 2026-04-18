import { db, type OutboxEntry } from './db';

type EnqueueEntry = Omit<
  OutboxEntry,
  'id' | 'attempts' | 'lastAttemptAt' | 'status' | 'createdAt'
>;

export async function enqueue(entry: EnqueueEntry): Promise<number> {
  if (!db) {
    throw new Error('Outbox is only available in the browser runtime.');
  }

  return db.outbox.add({
    ...entry,
    createdAt: Date.now(),
    attempts: 0,
    lastAttemptAt: null,
    status: 'pending'
  });
}

export async function getPendingEntries(): Promise<OutboxEntry[]> {
  if (!db) {
    return [];
  }

  return db.outbox
    .where('status')
    .equals('pending')
    .sortBy('createdAt');
}

export async function markSynced(id: number): Promise<void> {
  if (!db) {
    return;
  }

  await db.outbox.update(id, { status: 'synced' });
}

export async function markFailed(id: number): Promise<void> {
  if (!db) {
    return;
  }

  await db.outbox.update(id, { status: 'failed' });
}

export async function getPendingCount(): Promise<number> {
  if (!db) {
    return 0;
  }

  return db.outbox.where('status').equals('pending').count();
}

export async function clearSynced(): Promise<void> {
  if (!db) {
    return;
  }

  await db.outbox.where('status').equals('synced').delete();
}
