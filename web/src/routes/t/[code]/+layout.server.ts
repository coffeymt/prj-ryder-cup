import { redirect, error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getTournamentByCode } from '$lib/db/tournaments';
import { getPlayerWithTournament } from '$lib/db/players';
import { getTeamById, listTeamsByTournament } from '$lib/db/teams';
import type { PlayerWithTournament, Team, Tournament } from '$lib/db/types';

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
  const prefix = `/t/${encodeURIComponent(code)}`;
  return pathname === `${prefix}/live` || pathname === `${prefix}/leaderboard`;
}

async function loadCurrentPlayer(
  db: D1Database,
  locals: App.Locals,
  tournament: Tournament
): Promise<PlayerWithTournament | null> {
  if (locals.role === 'player') {
    if (!locals.playerId || locals.tournamentId !== tournament.id) {
      redirectToJoinRoot();
    }

    const player = await getPlayerWithTournament(db, locals.playerId, tournament.id);

    if (!player) {
      redirectToJoinWithCode(tournament.code);
    }

    return player;
  }

  if (locals.role === 'commissioner') {
    if (!locals.playerId || locals.playerTournamentId !== tournament.id) {
      return null;
    }

    return getPlayerWithTournament(db, locals.playerId, tournament.id);
  }

  return null;
}

async function loadCurrentTeam(
  db: D1Database,
  player: PlayerWithTournament | null
): Promise<Team | null> {
  if (!player?.team_id) {
    return null;
  }

  return getTeamById(db, player.team_id);
}

export const load: LayoutServerLoad = async (event) => {
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
