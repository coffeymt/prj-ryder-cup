import { requireRole, requireSameTournament } from '$lib/auth/guards';
import { listHolesByCourse, listTeesByCourse } from '$lib/db/courses';
import { listHoleScoresByMatch } from '$lib/db/holeScores';
import {
  getMatchById,
  listHoleResultsByMatch,
  listPlayersBySide,
  listSidesByMatch,
} from '$lib/db/matches';
import { getPlayerWithTournament } from '$lib/db/players';
import { getRoundById, listSegmentsByRound } from '$lib/db/rounds';
import type { MatchFormat, MatchHoleResult, RoundSegment, Team, Tournament } from '$lib/db/types';
import { computePerPlayerHandicaps, computeTeamHandicaps } from '$lib/engine/allowances';
import { computeMatchState } from '$lib/engine/matchState';
import type {
  Allowance,
  PlayerHandicapInput,
  TeeData,
  TournamentAllowances,
} from '$lib/engine/types';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

type SideWithPlayers = {
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

type HoleScoreSnapshot = {
  grossStrokes: number | null;
  conceded: boolean;
  pickedUp: boolean;
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

function toInt(value: string | undefined, label: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw error(400, `${label} must be an integer.`);
  }

  return parsed;
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

function segmentLabel(segmentType: RoundSegment['segment_type']): string {
  if (segmentType === 'F9') {
    return 'F9';
  }

  if (segmentType === 'B9') {
    return 'B9';
  }

  return '18';
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

  const result: Array<{
    holeNumber: number;
    result: MatchHoleResult['result'];
    sideANet: number | null;
    sideBNet: number | null;
  }> = [];

  for (let holeNumber = 1; holeNumber <= totalHoles; holeNumber += 1) {
    const row = byHole.get(holeNumber);

    result.push({
      holeNumber,
      result: row?.result ?? 'PENDING',
      sideANet: row?.side_a_net ?? null,
      sideBNet: row?.side_b_net ?? null,
    });
  }

  return result;
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

function normalizeTournamentAllowances(tournament: Tournament): TournamentAllowances {
  return {
    scramble: {
      type: 'blended',
      lowPct: tournament.allowance_scramble_low,
      highPct: tournament.allowance_scramble_high,
    },
    pinehurst: {
      type: 'blended',
      lowPct: tournament.allowance_pinehurst_low,
      highPct: tournament.allowance_pinehurst_high,
    },
    shamble: {
      type: 'perPlayer',
      pct: tournament.allowance_shamble,
    },
    fourBall: {
      type: 'perPlayer',
      pct: tournament.allowance_fourball,
    },
    singles: {
      type: 'perPlayer',
      pct: tournament.allowance_singles,
    },
  };
}

function resolveAllowance(
  format: RoundSegment['format'],
  tournamentAllowances: TournamentAllowances,
  override: number | null
): Allowance {
  const defaultAllowance: Allowance =
    format === 'SCRAMBLE'
      ? tournamentAllowances.scramble
      : format === 'PINEHURST'
        ? tournamentAllowances.pinehurst
        : format === 'SHAMBLE'
          ? tournamentAllowances.shamble
          : format === 'FOURBALL'
            ? tournamentAllowances.fourBall
            : tournamentAllowances.singles;

  if (override === null) {
    return defaultAllowance;
  }

  if (defaultAllowance.type === 'blended') {
    return {
      type: 'blended',
      lowPct: override,
      highPct: override,
    };
  }

  return {
    type: 'perPlayer',
    pct: override,
  };
}

function asTeeData(
  tee: Awaited<ReturnType<typeof listTeesByCourse>>[number],
  holes: Awaited<ReturnType<typeof listHolesByCourse>>
): TeeData {
  return {
    id: Number(tee.id),
    name: tee.name,
    cr18: tee.cr18 as TeeData['cr18'],
    slope18: tee.slope18 as TeeData['slope18'],
    par18: tee.par18 as TeeData['par18'],
    cr9f: tee.cr9f as TeeData['cr9f'],
    slope9f: tee.slope9f as TeeData['slope9f'],
    par9f: tee.par9f as TeeData['par9f'],
    cr9b: tee.cr9b as TeeData['cr9b'],
    slope9b: tee.slope9b as TeeData['slope9b'],
    par9b: tee.par9b as TeeData['par9b'],
    holes: holes
      .slice()
      .sort((left, right) => left.hole_number - right.hole_number)
      .map((hole) => ({
        holeNumber: hole.hole_number,
        par: hole.par as TeeData['holes'][number]['par'],
        strokeIndex: hole.stroke_index as TeeData['holes'][number]['strokeIndex'],
        yardage: hole.yardage ?? undefined,
      })),
  };
}

async function loadSideWithPlayers(
  db: D1Database,
  side: Awaited<ReturnType<typeof listSidesByMatch>>[number],
  allTeams: Team[],
  tournamentId: string
): Promise<SideWithPlayers> {
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

function latestScoreForPlayer(
  holeScores: Awaited<ReturnType<typeof listHoleScoresByMatch>>,
  holeNumber: number,
  playerId: string
): HoleScoreSnapshot | null {
  const matching = holeScores
    .filter((score) => score.hole_number === holeNumber && score.player_id === playerId)
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at));

  const latest = matching[0];

  if (!latest) {
    return null;
  }

  return {
    grossStrokes: latest.gross_strokes,
    conceded: latest.is_conceded === 1,
    pickedUp: latest.is_picked_up === 1,
  };
}

function resolveFormatChangeAtTurn(
  holeNumber: number,
  segments: RoundSegment[],
  formatOverride: MatchFormat | null
): boolean {
  if (holeNumber !== 10) {
    return false;
  }

  const front = segments.find((segment) => segment.segment_type === 'F9');
  const back = segments.find((segment) => segment.segment_type === 'B9');

  if (!front || !back) {
    return false;
  }

  const frontFormat = formatOverride ?? front.format;
  const backFormat = formatOverride ?? back.format;

  return frontFormat !== backFormat;
}

export const load: PageServerLoad = async (event) => {
  requireRole(event.locals, 'player', 'commissioner');

  const parentData = await event.parent();
  const db = getDb(event.platform);
  const matchId = event.params.matchId;
  const holeNumber = toInt(event.params.n, 'Hole number');

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

  const [segments, sides, holeScores, holeResults, teesByCourse, holesByCourse] = await Promise.all(
    [
      listSegmentsByRound(db, round.id),
      listSidesByMatch(db, match.id),
      listHoleScoresByMatch(db, match.id),
      listHoleResultsByMatch(db, match.id),
      listTeesByCourse(db, round.course_id),
      listHolesByCourse(db, round.course_id),
    ]
  );

  if (segments.length === 0) {
    throw error(500, 'Round has no segments configured.');
  }

  const totalHoles = Math.max(1, ...segments.map((segment) => segment.hole_end));
  if (holeNumber < 1 || holeNumber > totalHoles) {
    throw error(404, 'Hole is not available for this match.');
  }

  const segmentForHole = resolveSegmentForHole(segments, holeNumber);
  if (!segmentForHole) {
    throw error(500, 'Could not determine segment for this hole.');
  }

  const tee = teesByCourse.find((candidate) => candidate.id === round.tee_id);
  if (!tee) {
    throw error(500, 'Round references a missing tee.');
  }

  const teeHoles = holesByCourse.filter((hole) => hole.tee_id === round.tee_id);
  const hole = teeHoles.find((candidateHole) => candidateHole.hole_number === holeNumber);

  if (!hole) {
    throw error(500, 'Hole metadata is missing for the selected tee.');
  }

  const teeData = asTeeData(tee, teeHoles);
  const loadedSides = await Promise.all(
    sides.map((side) => loadSideWithPlayers(db, side, parentData.allTeams, round.tournament_id))
  );
  const sideA = loadedSides.find((side) => side.sideLabel === 'A');
  const sideB = loadedSides.find((side) => side.sideLabel === 'B');

  if (!sideA || !sideB) {
    throw error(500, 'Match sides are not configured correctly.');
  }

  const totalPoints = segments.reduce((sum, segment) => sum + segment.points_available, 0);
  const matchState = computeMatchState(
    toOverallHoleResults(holeResults, totalHoles),
    totalHoles,
    totalPoints,
    1,
    2
  );
  const matchStateLabel = toMatchStateLabel(matchState, sideA.teamName, sideB.teamName);

  const effectiveFormat = match.format_override ?? segmentForHole.format;
  const allowance = resolveAllowance(
    effectiveFormat,
    normalizeTournamentAllowances(parentData.tournament),
    segmentForHole.allowance_override
  );
  const isTeamEntryMode = effectiveFormat === 'SCRAMBLE' || effectiveFormat === 'PINEHURST';

  const holePlayers: Array<{
    id: string;
    player: {
      id: string;
      name: string;
      teamName: string;
      teamColor: string;
      courseHandicap: number | null;
    };
    sideLabel: 'A' | 'B';
    submitPlayerId: string;
    strokesOnHole: number;
    currentScore: HoleScoreSnapshot | null;
    isTeamEntry: boolean;
    teammateNames: string[];
  }> = [];

  if (isTeamEntryMode) {
    if (allowance.type !== 'blended') {
      throw error(500, 'Team-entry format requires blended allowances.');
    }

    const sideAInputs: PlayerHandicapInput[] = sideA.players.map((player, index) => ({
      playerId: index + 1,
      sideId: 1,
      handicapIndex: player.handicapIndex as PlayerHandicapInput['handicapIndex'],
    }));
    const sideBInputs: PlayerHandicapInput[] = sideB.players.map((player, index) => ({
      playerId: sideA.players.length + index + 1,
      sideId: 2,
      handicapIndex: player.handicapIndex as PlayerHandicapInput['handicapIndex'],
    }));

    const teamHandicaps = computeTeamHandicaps(
      [
        { sideId: 1, players: sideAInputs },
        { sideId: 2, players: sideBInputs },
      ],
      teeData,
      segmentForHole.segment_type,
      allowance
    );

    const sideAHandicap = teamHandicaps.find((entry) => entry.sideId === 1);
    const sideBHandicap = teamHandicaps.find((entry) => entry.sideId === 2);

    if (
      !sideAHandicap ||
      !sideBHandicap ||
      sideA.players.length === 0 ||
      sideB.players.length === 0
    ) {
      throw error(500, 'Unable to compute team handicap data for this hole.');
    }

    holePlayers.push({
      id: `team-${sideA.id}`,
      player: {
        id: sideA.players[0].id,
        name: sideA.teamName,
        teamName: sideA.teamName,
        teamColor: sideA.teamColor,
        courseHandicap: Number(sideAHandicap.teamCourseHandicap),
      },
      sideLabel: 'A',
      submitPlayerId: sideA.players[0].id,
      strokesOnHole: Number(sideAHandicap.strokeMap[holeNumber] ?? 0),
      currentScore: latestScoreForPlayer(holeScores, holeNumber, sideA.players[0].id),
      isTeamEntry: true,
      teammateNames: sideA.players.map((player) => player.name),
    });

    holePlayers.push({
      id: `team-${sideB.id}`,
      player: {
        id: sideB.players[0].id,
        name: sideB.teamName,
        teamName: sideB.teamName,
        teamColor: sideB.teamColor,
        courseHandicap: Number(sideBHandicap.teamCourseHandicap),
      },
      sideLabel: 'B',
      submitPlayerId: sideB.players[0].id,
      strokesOnHole: Number(sideBHandicap.strokeMap[holeNumber] ?? 0),
      currentScore: latestScoreForPlayer(holeScores, holeNumber, sideB.players[0].id),
      isTeamEntry: true,
      teammateNames: sideB.players.map((player) => player.name),
    });
  } else {
    if (allowance.type !== 'perPlayer') {
      throw error(500, 'Per-player format requires per-player allowance.');
    }

    const playerInputs: Array<{
      sideLabel: 'A' | 'B';
      player: SideWithPlayers['players'][number];
      input: PlayerHandicapInput;
    }> = [];

    let enginePlayerId = 1;

    for (const side of [sideA, sideB]) {
      const engineSideId = side.sideLabel === 'A' ? 1 : 2;

      for (const player of side.players) {
        playerInputs.push({
          sideLabel: side.sideLabel,
          player,
          input: {
            playerId: enginePlayerId,
            sideId: engineSideId,
            handicapIndex: player.handicapIndex as PlayerHandicapInput['handicapIndex'],
          },
        });
        enginePlayerId += 1;
      }
    }

    const perPlayer = computePerPlayerHandicaps(
      playerInputs.map((entry) => entry.input),
      teeData,
      segmentForHole.segment_type,
      allowance
    );

    const handicapsByEngineId = new Map(perPlayer.map((entry) => [entry.playerId, entry]));

    for (const entry of playerInputs) {
      const handicap = handicapsByEngineId.get(entry.input.playerId);

      if (!handicap) {
        throw error(500, 'Could not load player handicap data for this hole.');
      }

      const team = entry.sideLabel === 'A' ? sideA : sideB;

      holePlayers.push({
        id: entry.player.id,
        player: {
          id: entry.player.id,
          name: entry.player.name,
          teamName: team.teamName,
          teamColor: team.teamColor,
          courseHandicap: Number(handicap.courseHandicap),
        },
        sideLabel: entry.sideLabel,
        submitPlayerId: entry.player.id,
        strokesOnHole: Number(handicap.strokeMap[holeNumber] ?? 0),
        currentScore: latestScoreForPlayer(holeScores, holeNumber, entry.player.id),
        isTeamEntry: false,
        teammateNames: [entry.player.name],
      });
    }
  }

  return {
    match: {
      id: match.id,
      totalHoles,
      teamAName: sideA.teamName,
      teamBName: sideB.teamName,
      teamAColor: sideA.teamColor,
      teamBColor: sideB.teamColor,
    },
    holeNumber,
    par: hole.par,
    strokeIndex: hole.stroke_index,
    players: holePlayers,
    segmentFormat: FORMAT_LABELS[effectiveFormat],
    segmentLabel: `${segmentLabel(segmentForHole.segment_type)} — ${FORMAT_LABELS[effectiveFormat]}`,
    matchState: matchStateLabel,
    isFormatChangeHole: resolveFormatChangeAtTurn(holeNumber, segments, match.format_override),
    isTeamEntryMode,
  };
};
