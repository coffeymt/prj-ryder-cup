import { redirect, error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getTournamentByCode } from '$lib/db/tournaments';
import { getPlayerById } from '$lib/db/players';
import { getTeamById, listTeamsByTournament } from '$lib/db/teams';
import type { Player, Team, Tournament } from '$lib/db/types';

function getDatabaseBinding(platform: App.Platform | undefined): D1Database {
  const db = platform?.env.DB;

  if (!db) {
    throw error(500, 'Database binding is not configured.');
  }

  return db;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function redirectToJoinWithCode(code: string): never {
  throw redirect(302, `/join/${encodeURIComponent(code)}`);
}

function redirectToJoinRoot(): never {
  throw redirect(302, '/join');
}

function isLiveTickerPath(pathname: string, code: string): boolean {
  return pathname === `/t/${encodeURIComponent(code)}/live`;
}

async function loadCurrentPlayer(
  db: D1Database,
  locals: App.Locals,
  tournament: Tournament
): Promise<Player | null> {
  if (locals.role !== 'player') {
    return null;
  }

  if (!locals.playerId || locals.tournamentId !== tournament.id) {
    redirectToJoinRoot();
  }

  const player = await getPlayerById(db, locals.playerId);

  if (!player || player.tournament_id !== tournament.id) {
    redirectToJoinWithCode(tournament.code);
  }

  return player;
}

async function loadCurrentTeam(db: D1Database, player: Player | null): Promise<Team | null> {
  if (!player?.team_id) {
    return null;
  }

  return getTeamById(db, player.team_id);
}

export const load: LayoutServerLoad = async (event) => {
  if (event.locals.role === 'commissioner') {
    throw redirect(302, '/manage');
  }

  const db = getDatabaseBinding(event.platform);
  const code = normalizeCode(event.params.code);
  const tournament = await getTournamentByCode(db, code);

  if (!tournament) {
    throw error(404, 'Tournament not found.');
  }

  const liveTickerPath = isLiveTickerPath(event.url.pathname, tournament.code);

  if (event.locals.role === 'anonymous' && !liveTickerPath) {
    redirectToJoinWithCode(tournament.code);
  }

  const [player, allTeams] = await Promise.all([
    loadCurrentPlayer(db, event.locals, tournament),
    listTeamsByTournament(db, tournament.id),
  ]);
  const team = await loadCurrentTeam(db, player);

  return {
    tournament,
    player,
    team,
    allTeams,
  };
};
