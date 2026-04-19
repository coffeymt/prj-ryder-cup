import { requireRole } from '$lib/auth/guards';
import { listPlayersByTournament } from '$lib/db/players';
import { listRoundsByTournament } from '$lib/db/rounds';
import { listTeamsByTournament } from '$lib/db/teams';
import { getTournamentById } from '$lib/db/tournaments';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const tournamentId = event.params.id;

  requireRole(event.locals, 'commissioner');

  const db = event.platform?.env?.DB;

  if (!db) {
    throw error(500, 'Database binding is not configured.');
  }

  const [tournament, teams, players, rounds] = await Promise.all([
    getTournamentById(db, tournamentId),
    listTeamsByTournament(db, tournamentId),
    listPlayersByTournament(db, tournamentId),
    listRoundsByTournament(db, tournamentId)
  ]);

  if (!tournament) {
    throw error(404, 'Tournament not found.');
  }

  return {
    tournament,
    teams,
    players,
    rounds
  };
};
