import { onMount } from 'svelte';
import { writable, type Writable } from 'svelte/store';

type LiveTournamentStatus = 'active' | 'complete';
type LiveRoundStatus = 'pending' | 'in_progress' | 'complete';
type LiveMatchStatus = 'pending' | 'in_progress' | 'closed';
type SegmentType = 'F9' | 'B9' | 'OVERALL' | 'FULL18';

export type LiveData = {
  tournament: {
    id: string;
    name: string;
    pointsToWin: number;
    status: LiveTournamentStatus;
  };
  teams: Array<{
    id: string;
    name: string;
    color: string;
    totalPoints: number;
  }>;
  rounds: Array<{
    id: string;
    name: string;
    date: string;
    status: LiveRoundStatus;
    matches: Array<{
      id: string;
      segment: SegmentType;
      format: string;
      sideA: {
        teamId: string;
        playerNames: string[];
        points: number;
      };
      sideB: {
        teamId: string;
        playerNames: string[];
        points: number;
      };
      status: LiveMatchStatus;
      closeNotation: string | null;
      matchState: string;
      teeTime: string | null;
    }>;
  }>;
  lastUpdated: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isLiveData(value: unknown): value is LiveData {
  if (!isObject(value)) {
    return false;
  }

  const tournament = value.tournament;
  const teams = value.teams;
  const rounds = value.rounds;

  if (
    !isObject(tournament) ||
    typeof tournament.id !== 'string' ||
    typeof tournament.name !== 'string' ||
    typeof tournament.pointsToWin !== 'number' ||
    (tournament.status !== 'active' && tournament.status !== 'complete')
  ) {
    return false;
  }

  if (!Array.isArray(teams) || !Array.isArray(rounds) || typeof value.lastUpdated !== 'string') {
    return false;
  }

  return true;
}

export function useLiveFeed(
  code: string,
  initialData: LiveData
): { data: Writable<LiveData>; connected: Writable<boolean> } {
  const data = writable<LiveData>(initialData);
  const connected = writable(false);

  onMount(() => {
    if (typeof window === 'undefined') {
      return;
    }

    let disposed = false;
    let source: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let reconnectDelayMs = 3000;
    const maxReconnectDelayMs = 30000;
    const encodedCode = encodeURIComponent(code);

    const clearReconnectTimeout = (): void => {
      if (reconnectTimeout !== null) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
    };

    const clearPollingInterval = (): void => {
      if (pollInterval !== null) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    const closeSource = (): void => {
      if (!source) {
        return;
      }

      source.close();
      source = null;
    };

    const handlePayload = (payload: unknown): void => {
      if (isLiveData(payload)) {
        data.set(payload);
      }
    };

    const pollOnce = async (): Promise<void> => {
      try {
        const response = await fetch(`/api/live/${encodedCode}`);

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as unknown;
        handlePayload(payload);
      } catch {
        // Ignore polling failures; next interval will retry.
      }
    };

    const startPollingFallback = (): void => {
      connected.set(false);
      void pollOnce();
      pollInterval = setInterval(() => {
        void pollOnce();
      }, 5000);
    };

    const scheduleReconnect = (): void => {
      if (disposed) {
        return;
      }

      connected.set(false);
      closeSource();

      if (reconnectTimeout !== null) {
        return;
      }

      const delayMs = reconnectDelayMs;
      reconnectDelayMs = Math.min(maxReconnectDelayMs, reconnectDelayMs * 2);

      reconnectTimeout = setTimeout(() => {
        reconnectTimeout = null;
        connectWithSse();
      }, delayMs);
    };

    const connectWithSse = (): void => {
      if (disposed) {
        return;
      }

      closeSource();
      connected.set(false);

      source = new EventSource(`/api/live/${encodedCode}/sse`);

      source.addEventListener('snapshot', (event) => {
        if (!(event instanceof MessageEvent) || typeof event.data !== 'string') {
          return;
        }

        try {
          const payload = JSON.parse(event.data) as unknown;
          handlePayload(payload);
        } catch {
          // Ignore malformed payloads and keep stream alive.
        }
      });

      source.addEventListener('open', () => {
        connected.set(true);
        reconnectDelayMs = 3000;
      });

      source.addEventListener('error', () => {
        scheduleReconnect();
      });
    };

    if ('EventSource' in window) {
      connectWithSse();
    } else {
      startPollingFallback();
    }

    return () => {
      disposed = true;
      connected.set(false);
      clearReconnectTimeout();
      clearPollingInterval();
      closeSource();
    };
  });

  return { data, connected };
}
