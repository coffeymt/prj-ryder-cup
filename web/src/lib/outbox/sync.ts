import { db, type OutboxEntry } from './db';
import { getPendingCount, getPendingEntries, markFailed, markSynced } from './queue';

const INITIAL_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 30_000;

function isClientError(status: number): boolean {
  return status >= 400 && status < 500;
}

async function recordRetryAttempt(entry: OutboxEntry): Promise<void> {
  if (!db || entry.id === undefined) {
    return;
  }

  await db.outbox.update(entry.id, {
    attempts: entry.attempts + 1,
    lastAttemptAt: Date.now()
  });
}

async function syncEntry(entry: OutboxEntry): Promise<'synced' | 'failed' | 'pending'> {
  if (entry.id === undefined) {
    return 'pending';
  }

  try {
    const response = await fetch(entry.endpoint, {
      method: entry.method,
      headers: {
        'content-type': 'application/json',
        'Idempotency-Key': entry.opId
      },
      body: entry.body
    });

    if (response.ok) {
      await markSynced(entry.id);
      return 'synced';
    }

    if (isClientError(response.status)) {
      await markFailed(entry.id);
      return 'failed';
    }

    await recordRetryAttempt(entry);
    return 'pending';
  } catch {
    await recordRetryAttempt(entry);
    return 'pending';
  }
}

export async function syncOutbox(): Promise<{ synced: number; failed: number }> {
  const pendingEntries = (await getPendingEntries()).slice().sort((left, right) => left.createdAt - right.createdAt);

  let synced = 0;
  let failed = 0;

  for (const entry of pendingEntries) {
    const outcome = await syncEntry(entry);

    if (outcome === 'synced') {
      synced += 1;
      continue;
    }

    if (outcome === 'failed') {
      failed += 1;
    }
  }

  return { synced, failed };
}

export function startSyncListener(): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  let disposed = false;
  let syncInFlight = false;
  let retryDelayMs = INITIAL_RETRY_DELAY_MS;
  let retryTimeout: ReturnType<typeof setTimeout> | null = null;

  const clearRetryTimeout = (): void => {
    if (retryTimeout === null) {
      return;
    }

    clearTimeout(retryTimeout);
    retryTimeout = null;
  };

  const scheduleRetry = (): void => {
    if (disposed || !navigator.onLine) {
      return;
    }

    clearRetryTimeout();

    const delayMs = retryDelayMs;
    retryDelayMs = Math.min(MAX_RETRY_DELAY_MS, retryDelayMs * 2);
    retryTimeout = setTimeout(() => {
      retryTimeout = null;
      void runSync();
    }, delayMs);
  };

  const runSync = async (): Promise<void> => {
    if (disposed || syncInFlight || !navigator.onLine) {
      return;
    }

    syncInFlight = true;

    try {
      await syncOutbox();
      const pendingCount = await getPendingCount();

      if (pendingCount > 0) {
        scheduleRetry();
      } else {
        retryDelayMs = INITIAL_RETRY_DELAY_MS;
        clearRetryTimeout();
      }
    } finally {
      syncInFlight = false;
    }
  };

  const handleOnline = (): void => {
    retryDelayMs = INITIAL_RETRY_DELAY_MS;
    clearRetryTimeout();
    void runSync();
  };

  const handleOffline = (): void => {
    clearRetryTimeout();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  if (navigator.onLine) {
    void runSync();
  }

  return () => {
    disposed = true;
    clearRetryTimeout();
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
