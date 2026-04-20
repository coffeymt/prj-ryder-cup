import { requireRole, requireSameTournament } from '$lib/auth/guards';
import { listHoleScoresByMatch } from '$lib/db/holeScores';
import {
  getMatchById,
  listHoleResultsByMatch,
  listPlayersBySide,
  listSidesByMatch,
} from '$lib/db/matches';
import { getPlayerWithTournament } from '$lib/db/players';
import { getRoundById, listSegmentsByRound } from '$lib/db/rounds';
import type { MatchFormat, MatchHoleResult, RoundSegment, Team } from '$lib/db/types';
import { computeMatchState } from '$lib/engine/matchState';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

type LoadedSide = {
  id: string;
  sideLabel: 'A' | 'B';
  teamId: string;
  teamName: string;
  teamColor: string;
  players: Array<{
    id: string;
    name: string;
    handicapIndex: number;
  }>;
};

const FORMAT_LABELS: Record<MatchFormat, string> = {
  SCRAMBLE: 'Scramble',
  PINEHURST: 'Pinehurst',
  SHAMBLE: 'Shamble',
  FOURBALL: 'Four-Ball',
  SINGLES: 'Singles',
};

function getDb(platform: App.Platform | undefined): D1Database {
  const db = platform?.env.DB;

  if (!db) {
    throw error(500, 'Database binding is not configured.');
  }

  return db;
}

function segmentLabel(segmentType: RoundSegment['segment_type']): string {
  if (segmentType === 'F9') {
    return 'F9';
  }

  if (segmentType === 'B9') {
    return 'B9';
  }

  return '18';
}

function resolveSegmentForHole(segments: RoundSegment[], holeNumber: number): RoundSegment | null {
  const covering = segments
    .filter((segment) => segment.hole_start <= holeNumber && holeNumber <= segment.hole_end)
    .sort((left, right) => {
      const leftSpan = left.hole_end - left.hole_start;
      const rightSpan = right.hole_end - right.hole_start;

      if (leftSpan !== rightSpan) {
        return leftSpan - rightSpan;
      }

      if (left.segment_type === 'OVERALL' && right.segment_type !== 'OVERALL') {
        return 1;
      }

      if (left.segment_type !== 'OVERALL' && right.segment_type === 'OVERALL') {
        return -1;
      }

      return left.hole_start - right.hole_start;
    });

  return covering[0] ?? null;
}

function toOverallHoleResults(
  rows: MatchHoleResult[],
  totalHoles: number
): Array<{
  holeNumber: number;
  result: MatchHoleResult['result'];
  sideANet: number | null;
  sideBNet: number | null;
}> {
  const byHole = new Map<number, MatchHoleResult>();

  for (const row of rows) {
    byHole.set(row.hole_number, row);
  }

  const results: Array<{
    holeNumber: number;
    result: MatchHoleResult['result'];
    sideANet: number | null;
    sideBNet: number | null;
  }> = [];

  for (let holeNumber = 1; holeNumber <= totalHoles; holeNumber += 1) {
    const row = byHole.get(holeNumber);

    results.push({
      holeNumber,
      result: row?.result ?? 'PENDING',
      sideANet: row?.side_a_net ?? null,
      sideBNet: row?.side_b_net ?? null,
    });
  }

  return results;
}

function toResultLabel(
  result: MatchHoleResult['result'],
  sideAName: string,
  sideBName: string
): string {
  if (result === 'A_WINS') {
    return `${sideAName} won`;
  }

  if (result === 'B_WINS') {
    return `${sideBName} won`;
  }

  if (result === 'HALVED') {
    return 'Halved';
  }

  return 'Pending';
}

function toMatchStateLabel(
  state: ReturnType<typeof computeMatchState>,
  sideAName: string,
  sideBName: string
): string {
  if (state.holesPlayed === 0) {
    return 'Not started';
  }

  if (state.leadingSideId === null) {
    if (state.status === 'FINAL') {
      return 'Match halved';
    }

    return `AS thru ${state.holesPlayed}`;
  }

  const leadingName = state.leadingSideId === 1 ? sideAName : sideBName;

  if (state.status === 'FINAL' || state.status === 'CLOSED') {
    if (state.closeNotation) {
      return `${leadingName} ${state.closeNotation} final`;
    }

    return `${leadingName} ${state.summary} final`;
  }

  return `${leadingName} ${state.summary} thru ${state.holesPlayed}`;
}

function computeCurrentHole(
  totalHoles: number,
  holeResults: MatchHoleResult[],
  holeScores: Array<{ hole_number: number }>
): number {
  if (holeScores.length === 0) {
    return 1;
  }

  const completedHoles = new Set(
    holeResults.filter((result) => result.result !== 'PENDING').map((result) => result.hole_number)
  );

  for (let holeNumber = 1; holeNumber <= totalHoles; holeNumber += 1) {
    if (!completedHoles.has(holeNumber)) {
      return holeNumber;
    }
  }

  return totalHoles;
}

async function loadSidePlayers(
  db: D1Database,
  allTeams: Team[],
  side: Awaited<ReturnType<typeof listSidesByMatch>>[number],
  tournamentId: string
): Promise<LoadedSide> {
  const team = allTeams.find((candidate) => candidate.id === side.team_id);
  if (!team) {
    throw error(500, 'Match side references a missing team.');
  }

  const sidePlayers = await listPlayersBySide(db, side.id);
  const players = await Promise.all(
    sidePlayers.map((sidePlayer) => getPlayerWithTournament(db, sidePlayer.player_id, tournamentId))
  );

  if (players.some((player) => player === null)) {
    throw error(500, 'Match side references a missing player.');
  }

  return {
    id: side.id,
    sideLabel: side.side_label,
    teamId: team.id,
    teamName: team.name,
    teamColor: team.color,
    players: players.map((player) => ({
      id: player!.id,
      name: player!.name,
      handicapIndex: player!.effective_handicap,
    })),
  };
}

export const load: PageServerLoad = async (event) => {
  requireRole(event.locals, 'player', 'commissioner');

  const db = getDb(event.platform);
  const parentData = await event.parent();
  const matchId = event.params.matchId;

  if (!matchId) {
    throw error(400, 'Match ID is required.');
  }

  const match = await getMatchById(db, matchId);
  if (!match) {
    throw error(404, 'Match not found.');
  }

  const round = await getRoundById(db, match.round_id);
  if (!round) {
    throw error(500, 'Match references a missing round.');
  }

  requireSameTournament(event.locals, round.tournament_id);

  const [segments, sides, holeScores, holeResults] = await Promise.all([
    listSegmentsByRound(db, round.id),
    listSidesByMatch(db, match.id),
    listHoleScoresByMatch(db, match.id),
    listHoleResultsByMatch(db, match.id),
  ]);

  if (segments.length === 0) {
    throw error(500, 'Round has no segments configured.');
  }

  const loadedSides = await Promise.all(
    sides.map((side) => loadSidePlayers(db, parentData.allTeams, side, round.tournament_id))
  );
  const sideA = loadedSides.find((side) => side.sideLabel === 'A');
  const sideB = loadedSides.find((side) => side.sideLabel === 'B');

  if (!sideA || !sideB) {
    throw error(500, 'Match sides are not configured correctly.');
  }

  const totalHoles = Math.max(1, ...segments.map((segment) => segment.hole_end));
  const totalPoints = segments.reduce((sum, segment) => sum + segment.points_available, 0);
  const currentHole = computeCurrentHole(totalHoles, holeResults, holeScores);
  const activeSegment = resolveSegmentForHole(segments, currentHole);

  if (!activeSegment) {
    throw error(500, 'Could not determine a segment for the next hole.');
  }

  const overallState = computeMatchState(
    toOverallHoleResults(holeResults, totalHoles),
    totalHoles,
    totalPoints,
    1,
    2
  );

  const activeFormat = match.format_override ?? activeSegment.format;

  return {
    match: {
      id: match.id,
      roundId: match.round_id,
      matchNumber: match.match_number,
      totalHoles,
      formatName: FORMAT_LABELS[activeFormat],
      segmentLabel: `${segmentLabel(activeSegment.segment_type)} — ${FORMAT_LABELS[activeFormat]}`,
    },
    sides: loadedSides,
    players: loadedSides.flatMap((side) =>
      side.players.map((player) => ({
        ...player,
        sideLabel: side.sideLabel,
        teamName: side.teamName,
        teamColor: side.teamColor,
      }))
    ),
    holeScores: holeScores.map((score) => ({
      holeNumber: score.hole_number,
      playerId: score.player_id,
      sideId: score.match_side_id,
      grossStrokes: score.gross_strokes,
      conceded: score.is_conceded === 1,
      pickedUp: score.is_picked_up === 1,
    })),
    completedHoles: holeResults
      .filter((holeResult) => holeResult.result !== 'PENDING')
      .map((holeResult) => ({
        holeNumber: holeResult.hole_number,
        result: holeResult.result,
        resultLabel: toResultLabel(holeResult.result, sideA.teamName, sideB.teamName),
        sideANet: holeResult.side_a_net,
        sideBNet: holeResult.side_b_net,
      })),
    currentHole,
    matchState: toMatchStateLabel(overallState, sideA.teamName, sideB.teamName),
  };
};
