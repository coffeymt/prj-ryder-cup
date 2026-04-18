import { getTournamentByCode } from '$lib/db/tournaments';
import { listPlayersByTournament } from '$lib/db/players';
import { listTeamsByTournament } from '$lib/db/teams';
import { error, json, type RequestHandler } from '@sveltejs/kit';

type RosterPlayer = {
  id: string;
  displayName: string;
  teamId: string | null;
  teamName: string | null;
  teamColor: string | null;
  isCaptain: boolean;
};

function getDatabaseBinding(platform: App.Platform | undefined): D1Database {
  const db = platform?.env.DB;

  if (!db) {
    throw error(500, 'Database binding is not configured.');
  }

  return db;
}

export const GET: RequestHandler = async ({ params, platform }) => {
  const db = getDatabaseBinding(platform);
  const tournamentCode = params.code;
  const tournament = await getTournamentByCode(db, tournamentCode);

  if (!tournament) {
    return json({ error: 'Tournament not found' }, { status: 404 });
  }

  const [players, teams] = await Promise.all([
    listPlayersByTournament(db, tournament.id),
    listTeamsByTournament(db, tournament.id),
  ]);
  const teamsById = new Map(teams.map((team) => [team.id, team]));

  const roster: RosterPlayer[] = players.map((player) => {
    const team = player.team_id ? teamsById.get(player.team_id) ?? null : null;

    return {
      id: player.id,
      displayName: player.name,
      teamId: team?.id ?? null,
      teamName: team?.name ?? null,
      teamColor: team?.color ?? null,
      isCaptain: team?.captain_player_id === player.id,
    };
  });

  return json({
    tournament: {
      id: tournament.id,
      name: tournament.name,
    },
    roster,
  });
};
