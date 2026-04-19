import type { RequestHandler } from '@sveltejs/kit';
import { _getLiveSnapshot } from '../+server';

const POLL_INTERVAL_MS = 4000;
const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
} as const;

function serializeSnapshotEvent(payload: unknown): string {
  return `event: snapshot\ndata: ${JSON.stringify(payload)}\n\n`;
}

export const GET: RequestHandler = async (event) => {
  const initialSnapshot = await _getLiveSnapshot(event.platform, event.locals, event.params.code);
  const encoder = new TextEncoder();
  let lastEmittedUpdate = initialSnapshot.lastUpdated;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  let pollInFlight = false;
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;

  const cleanup = (): void => {
    if (closed) {
      return;
    }

    closed = true;

    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }

    event.request.signal.removeEventListener('abort', cleanup);

    if (controllerRef) {
      controllerRef.close();
      controllerRef = null;
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
      controller.enqueue(encoder.encode(serializeSnapshotEvent(initialSnapshot)));

      const pollForUpdates = async (): Promise<void> => {
        if (closed || pollInFlight) {
          return;
        }

        pollInFlight = true;

        try {
          const snapshot = await _getLiveSnapshot(event.platform, event.locals, event.params.code);

          if (snapshot.lastUpdated !== lastEmittedUpdate) {
            lastEmittedUpdate = snapshot.lastUpdated;
            controller.enqueue(encoder.encode(serializeSnapshotEvent(snapshot)));
          }
        } catch {
          cleanup();
        } finally {
          pollInFlight = false;
        }
      };

      intervalId = setInterval(() => {
        void pollForUpdates();
      }, POLL_INTERVAL_MS);

      event.request.signal.addEventListener('abort', cleanup, { once: true });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
};
