import { getTournamentById } from '$lib/db/tournaments';
import type { PageServerLoad } from './$types';

type LandingPrimaryAction =
  | { type: 'join' }
  | { type: 'continue'; tournamentCode: string; tournamentName: string }
  | { type: 'manage' };

function getDatabaseBinding(platform: App.Platform | undefined): D1Database {
  const db = platform?.env.DB;

  if (!db) {
    throw new Error('Database binding is not configured.');
  }

  return db;
}

export const load: PageServerLoad = async (event) => {
  const isCommissioner = event.locals.role === 'commissioner';

  if (isCommissioner) {
    return {
      isCommissioner,
      primaryAction: {
        type: 'manage',
      } satisfies LandingPrimaryAction,
    };
  }

  if (event.locals.role !== 'player' || !event.locals.tournamentId) {
    return {
      isCommissioner,
      primaryAction: {
        type: 'join',
      } satisfies LandingPrimaryAction,
    };
  }

  const db = getDatabaseBinding(event.platform);
  const tournament = await getTournamentById(db, event.locals.tournamentId);

  if (!tournament) {
    return {
      isCommissioner,
      primaryAction: {
        type: 'join',
      } satisfies LandingPrimaryAction,
    };
  }

  return {
    isCommissioner,
    primaryAction: {
      type: 'continue',
      tournamentCode: tournament.code,
      tournamentName: tournament.name,
    } satisfies LandingPrimaryAction,
  };
};
