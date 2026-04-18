import { writable, type Writable } from 'svelte/store';
import { enqueue, getPendingCount } from './queue';
import { syncOutbox } from './sync';

type SubmitScoreResult = 'online' | 'queued';

async function getResponseErrorMessage(response: Response): Promise<string> {
  const fallbackMessage = 'Could not save scores for this hole.';
  const body = (await response.json().catch(() => null)) as { message?: string } | null;

  return body?.message ?? fallbackMessage;
}

export function useOutbox() {
  const pendingCount: Writable<number> = writable(0);

  async function refreshCount(): Promise<void> {
    const count = await getPendingCount();
    pendingCount.set(count);
  }

  async function submitScore(endpoint: string, body: object): Promise<SubmitScoreResult> {
    const opId = crypto.randomUUID();
    let outcome: SubmitScoreResult = 'online';
    const requestBody = JSON.stringify(body);

    try {
      let response: Response;

      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'Idempotency-Key': opId
          },
          body: requestBody
        });
      } catch {
        await enqueue({
          opId,
          endpoint,
          method: 'POST',
          body: requestBody
        });
        outcome = 'queued';
        return outcome;
      }

      if (!response.ok) {
        throw new Error(await getResponseErrorMessage(response));
      }

      await syncOutbox();
      return outcome;
    } finally {
      await refreshCount();
    }
  }

  if (typeof window !== 'undefined') {
    void refreshCount();
  }

  return {
    pendingCount,
    submitScore,
    refreshCount
  };
}

export const outbox = useOutbox();
