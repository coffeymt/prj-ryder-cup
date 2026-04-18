import Dexie, { type Table } from 'dexie';

export interface OutboxEntry {
  id?: number;
  opId: string;
  endpoint: string;
  method: string;
  body: string;
  createdAt: number;
  attempts: number;
  lastAttemptAt: number | null;
  status: 'pending' | 'failed' | 'synced';
}

export class RyderCupOutboxDB extends Dexie {
  outbox!: Table<OutboxEntry, number>;

  constructor() {
    super('RyderCupOutbox');

    this.version(1).stores({
      outbox: '++id, opId, status, createdAt'
    });
  }
}

export const db: RyderCupOutboxDB | null =
  typeof window !== 'undefined' ? new RyderCupOutboxDB() : null;
