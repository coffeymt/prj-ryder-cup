import { getTournamentByCode } from '$lib/db/tournaments';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { LiveData } from '$lib/hooks/useLiveFeed';

function getDb(platform: App.Platform | undefined): D1Database {
  const db = platform?.env.DB;

  if (!db) {
    throw error(500, 'Database binding is not configured.');
  }

  return db;
}

function normalizeCode(rawCode: string): string {
  const normalized = rawCode.trim().toUpperCase();

  if (!normalized) {
    throw error(400, 'Tournament code is required.');
  }

  return normalized;
}

function hasTournamentCookie(locals: App.Locals, tournamentId: string): boolean {
  if (locals.role === 'anonymous') {
    return false;
  }

  return locals.tournamentId === tournamentId;
}

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

  return rounds.every(
    (round) => isObject(round) && typeof round.id === 'string' && typeof round.date === 'string'
  );
}

export const load: PageServerLoad = async (event) => {
  const db = getDb(event.platform);
  const code = normalizeCode(event.params.code);
  const tournament = await getTournamentByCode(db, code);

  if (!tournament) {
    throw error(404, 'Tournament not found.');
  }

  const publicTickerEnabled = tournament.public_ticker_enabled === 1;

  if (!publicTickerEnabled && !hasTournamentCookie(event.locals, tournament.id)) {
    throw redirect(307, `/join/${encodeURIComponent(tournament.code)}`);
  }

  const response = await event.fetch(`/api/live/${encodeURIComponent(tournament.code)}`);

  if (!response.ok) {
    throw error(response.status, 'Could not load live ticker data.');
  }

  const payload = (await response.json()) as unknown;

  if (!isLiveData(payload)) {
    throw error(500, 'Live ticker payload is invalid.');
  }

  return {
    initialData: payload,
    code: tournament.code,
    publicTickerEnabled
  };
};
