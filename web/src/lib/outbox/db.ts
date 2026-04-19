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

const DB_NAME = 'GolfOutbox';
const LEGACY_DB_NAME = 'RyderCupOutbox';
const MIGRATION_FLAG_KEY = 'golf_outbox_migrated';
const OUTBOX_DB_STORES = {
  outbox: '++id, opId, status, createdAt',
};

export class GolfOutboxDB extends Dexie {
  outbox!: Table<OutboxEntry, number>;

  constructor() {
    super(DB_NAME);

    this.version(1).stores(OUTBOX_DB_STORES);
  }
}

export const db: GolfOutboxDB | null = typeof window !== 'undefined' ? new GolfOutboxDB() : null;

function createLegacyOutboxDb(): Dexie {
  const legacyDb = new Dexie(LEGACY_DB_NAME);
  legacyDb.version(1).stores({
    outbox: '++id, opId, status, createdAt',
  });
  return legacyDb;
}

async function legacyOutboxExists(): Promise<boolean> {
  if (typeof indexedDB === 'undefined') {
    return false;
  }

  const idbWithDatabases = indexedDB as IDBFactory & {
    databases?: () => Promise<Array<{ name?: string }>>;
  };

  if (typeof idbWithDatabases.databases === 'function') {
    try {
      const databases = await idbWithDatabases.databases();
      return databases.some((database) => database.name === LEGACY_DB_NAME);
    } catch {
      // Fall back to an IndexedDB probe when browsers expose but do not support databases().
    }
  }

  return await new Promise<boolean>((resolve) => {
    const req = indexedDB.open(LEGACY_DB_NAME);
    let exists = true;

    req.onupgradeneeded = () => {
      exists = false;
      req.transaction?.abort();
    };

    req.onsuccess = () => {
      req.result.close();

      if (!exists) {
        indexedDB.deleteDatabase(LEGACY_DB_NAME);
      }

      resolve(exists);
    };

    req.onerror = () => resolve(false);
    req.onblocked = () => resolve(false);
  });
}

export async function migrateLegacyOutbox(): Promise<void> {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    if (localStorage.getItem(MIGRATION_FLAG_KEY) === '1') {
      return;
    }

    if (!db) {
      localStorage.setItem(MIGRATION_FLAG_KEY, '1');
      return;
    }

    const hasLegacyOutbox = await legacyOutboxExists();

    if (!hasLegacyOutbox) {
      localStorage.setItem(MIGRATION_FLAG_KEY, '1');
      return;
    }

    const legacyDb = createLegacyOutboxDb();
    const storeNames = Object.keys(OUTBOX_DB_STORES);

    try {
      await legacyDb.open();
      const legacyRowsByStore = await Promise.all(
        storeNames.map(
          async (storeName) => [storeName, await legacyDb.table(storeName).toArray()] as const
        )
      );

      await db.transaction(
        'rw',
        ...storeNames.map((storeName) => db.table(storeName)),
        async () => {
          for (const [storeName, rows] of legacyRowsByStore) {
            if (rows.length === 0) {
              continue;
            }

            const rowsWithoutLegacyIds = rows.map((row) => {
              if (row && typeof row === 'object' && 'id' in row) {
                const rowWithoutLegacyId = { ...(row as Record<string, unknown>) };
                delete rowWithoutLegacyId.id;
                return rowWithoutLegacyId;
              }

              return row;
            });

            await db.table(storeName).bulkAdd(rowsWithoutLegacyIds);
          }
        }
      );
    } finally {
      legacyDb.close();
    }

    await Dexie.delete(LEGACY_DB_NAME);
    localStorage.setItem(MIGRATION_FLAG_KEY, '1');
  } catch (err) {
    console.warn('[golf-migration] legacy outbox migration failed; leaving legacy DB intact', err);
  }
}

if (typeof window !== 'undefined') {
  void migrateLegacyOutbox();
}
