import { requireRole, requireSameTournament } from '$lib/auth/guards';
import { listHolesByCourse, listTeesByCourse } from '$lib/db/courses';
import { writeAuditEntry } from '$lib/db/auditLog';
import { listHoleScoresByMatch, upsertHoleScore } from '$lib/db/holeScores';
import {
  getMatchById,
  listHoleResultsByMatch,
  listPlayersBySide,
  listSidesByMatch,
  updateMatchStatus,
  upsertMatchHoleResult,
} from '$lib/db/matches';
import { getPlayerWithTournament } from '$lib/db/players';
import { claimOp, getProcessedOp, markOpProcessed } from '$lib/db/processedOps';
import { getRoundById, listSegmentsByRound } from '$lib/db/rounds';
import { getTournamentById } from '$lib/db/tournaments';
import type {
  HoleScore,
  MatchHoleResult,
  MatchSide,
  MatchSidePlayer,
  PlayerWithTournament,
  RoundSegment,
  SideLabel,
  Tournament,
} from '$lib/db/types';
import { computeFourBallResults } from '$lib/engine/formats/fourBall';
import { computePinehurstResults } from '$lib/engine/formats/pinehurst';
import { computeScrambleResults } from '$lib/engine/formats/scramble';
import { computeShambleResults } from '$lib/engine/formats/shamble';
import { computeSinglesResults } from '$lib/engine/formats/singles';
import { computeMatchState } from '$lib/engine/matchState';
import type {
  Allowance,
  HoleResult as EngineHoleResult,
  HoleScoreInput,
  MatchState,
  PlayerHandicapInput,
  TeeData,
  TournamentAllowances,
} from '$lib/engine/types';
import { error, json, type RequestEvent, type RequestHandler } from '@sveltejs/kit';

type ConcedeHoleRequestBody = {
  side: SideLabel;
  playerId?: string;
};

type ConcedeHoleResponseBody = {
  holeNumber: number;
  side: SideLabel;
  matchState: string;
  matchClosed: boolean;
  closeNotation: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/u;

function getDb(event: RequestEvent): D1Database {
  const db = event.platform?.env?.DB;

  if (!db) {
    throw error(500, 'Database binding is not configured.');
  }

  return db;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidIdempotencyKey(value: string): boolean {
  return UUID_PATTERN.test(value) || ULID_PATTERN.test(value);
}

function parseHoleParam(value: string | undefined): {
  holeNumber: number | null;
  message: string | null;
} {
  if (!value) {
    return { holeNumber: null, message: 'hole route parameter is required.' };
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 18) {
    return {
      holeNumber: null,
      message: 'hole route parameter must be an integer between 1 and 18.',
    };
  }

  return { holeNumber: parsed, message: null };
}

function parseConcedeBody(value: unknown): {
  body: ConcedeHoleRequestBody | null;
  message: string | null;
} {
  if (!isRecord(value)) {
    return { body: null, message: 'Request body must be a JSON object.' };
  }

  const side = value.side;
  const playerId = value.playerId;

  if (side !== 'A' && side !== 'B') {
    return { body: null, message: "side must be either 'A' or 'B'." };
  }

  if (playerId !== undefined && (typeof playerId !== 'string' || playerId.trim().length === 0)) {
    return { body: null, message: 'playerId must be a non-empty string when provided.' };
  }

  return {
    body: {
      side,
      playerId: typeof playerId === 'string' ? playerId.trim() : undefined,
    },
    message: null,
  };
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

function getMatchSidesByLabel(sides: MatchSide[]): { sideA: MatchSide; sideB: MatchSide } {
  const sideA = sides.find((side) => side.side_label === 'A');
  const sideB = sides.find((side) => side.side_label === 'B');

  if (!sideA || !sideB) {
    throw error(500, 'Match sides are not configured correctly.');
  }

  return { sideA, sideB };
}

function asTeeData(
  teeId: number,
  teeRow: Awaited<ReturnType<typeof listTeesByCourse>>[number],
  holes: Awaited<ReturnType<typeof listHolesByCourse>>
): TeeData {
  return {
    id: teeId,
    name: teeRow.name,
    cr18: teeRow.cr18 as TeeData['cr18'],
    slope18: teeRow.slope18 as TeeData['slope18'],
    par18: teeRow.par18 as TeeData['par18'],
    cr9f: teeRow.cr9f as TeeData['cr9f'],
    slope9f: teeRow.slope9f as TeeData['slope9f'],
    par9f: teeRow.par9f as TeeData['par9f'],
    cr9b: teeRow.cr9b as TeeData['cr9b'],
    slope9b: teeRow.slope9b as TeeData['slope9b'],
    par9b: teeRow.par9b as TeeData['par9b'],
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

function toEngineHoleScore(
  row: HoleScore,
  sideIdMap: Map<string, number>,
  playerIdMap: Map<string, number>
): HoleScoreInput | null {
  const mappedSideId = sideIdMap.get(row.match_side_id);
  if (mappedSideId === undefined) {
    return null;
  }

  const mappedPlayerId = row.player_id === null ? null : (playerIdMap.get(row.player_id) ?? null);

  return {
    holeNumber: row.hole_number,
    playerId: mappedPlayerId,
    matchSideId: mappedSideId,
    grossStrokes: row.gross_strokes,
    isConceded: row.is_conceded === 1,
    isPickedUp: row.is_picked_up === 1,
    opId: row.op_id,
  };
}

function toEngineHoleResult(row: MatchHoleResult): EngineHoleResult {
  return {
    holeNumber: row.hole_number,
    result: row.result,
    sideANet: row.side_a_net,
    sideBNet: row.side_b_net,
  };
}

function buildOverallHoleResults(rows: MatchHoleResult[], totalHoles: number): EngineHoleResult[] {
  const byHole = new Map<number, EngineHoleResult>();

  for (const row of rows) {
    byHole.set(row.hole_number, toEngineHoleResult(row));
  }

  const normalized: EngineHoleResult[] = [];

  for (let holeNumber = 1; holeNumber <= totalHoles; holeNumber += 1) {
    normalized.push(
      byHole.get(holeNumber) ?? {
        holeNumber,
        result: 'PENDING',
        sideANet: null,
        sideBNet: null,
      }
    );
  }

  return normalized;
}

async function loadPlayersForSide(
  db: D1Database,
  sidePlayers: MatchSidePlayer[],
  tournamentId: string
): Promise<PlayerWithTournament[]> {
  const loaded = await Promise.all(
    sidePlayers.map((sidePlayer) => getPlayerWithTournament(db, sidePlayer.player_id, tournamentId))
  );
  const players: PlayerWithTournament[] = [];

  for (const player of loaded) {
    if (!player) {
      throw error(500, 'Match side references a missing player.');
    }

    players.push(player);
  }

  return players;
}

function toPlayerHandicapInput(
  players: PlayerWithTournament[],
  engineSideId: number,
  playerIdMap: Map<string, number>
): PlayerHandicapInput[] {
  return players.map((player) => {
    const enginePlayerId = playerIdMap.get(player.id);

    if (enginePlayerId === undefined) {
      throw error(500, 'Could not resolve numeric player ID for engine input.');
    }

    return {
      playerId: enginePlayerId,
      sideId: engineSideId,
      handicapIndex: player.effective_handicap as PlayerHandicapInput['handicapIndex'],
    };
  });
}

function computeSegmentState(
  segment: RoundSegment,
  allowance: Allowance,
  tee: TeeData,
  sideAEngineId: number,
  sideBEngineId: number,
  sideAPlayers: PlayerHandicapInput[],
  sideBPlayers: PlayerHandicapInput[],
  sideAHoleScores: HoleScoreInput[],
  sideBHoleScores: HoleScoreInput[]
): MatchState {
  const segmentType = segment.segment_type;

  switch (segment.format) {
    case 'SCRAMBLE':
      if (allowance.type !== 'blended') {
        throw error(500, 'SCRAMBLE allowance must be blended.');
      }

      return computeScrambleResults(
        {
          sideId: sideAEngineId,
          players: sideAPlayers,
          holeScores: sideAHoleScores,
        },
        {
          sideId: sideBEngineId,
          players: sideBPlayers,
          holeScores: sideBHoleScores,
        },
        tee,
        segmentType,
        allowance,
        segment.points_available
      );
    case 'PINEHURST':
      if (allowance.type !== 'blended') {
        throw error(500, 'PINEHURST allowance must be blended.');
      }

      return computePinehurstResults(
        {
          sideId: sideAEngineId,
          players: sideAPlayers,
          holeScores: sideAHoleScores,
        },
        {
          sideId: sideBEngineId,
          players: sideBPlayers,
          holeScores: sideBHoleScores,
        },
        tee,
        segmentType,
        allowance,
        segment.points_available
      );
    case 'SHAMBLE':
      if (allowance.type !== 'perPlayer') {
        throw error(500, 'SHAMBLE allowance must be per-player.');
      }

      return computeShambleResults(
        {
          sideId: sideAEngineId,
          players: sideAPlayers,
          holeScores: sideAHoleScores,
        },
        {
          sideId: sideBEngineId,
          players: sideBPlayers,
          holeScores: sideBHoleScores,
        },
        tee,
        segmentType,
        allowance,
        segment.points_available
      );
    case 'FOURBALL':
      if (allowance.type !== 'perPlayer') {
        throw error(500, 'FOURBALL allowance must be per-player.');
      }

      return computeFourBallResults(
        {
          sideId: sideAEngineId,
          players: sideAPlayers,
          holeScores: sideAHoleScores,
        },
        {
          sideId: sideBEngineId,
          players: sideBPlayers,
          holeScores: sideBHoleScores,
        },
        tee,
        segmentType,
        allowance,
        segment.points_available
      );
    case 'SINGLES':
      if (allowance.type !== 'perPlayer') {
        throw error(500, 'SINGLES allowance must be per-player.');
      }

      if (sideAPlayers.length !== 1 || sideBPlayers.length !== 1) {
        throw error(500, 'SINGLES format requires exactly one player per side.');
      }

      return computeSinglesResults(
        {
          sideId: sideAEngineId,
          player: sideAPlayers[0],
          holeScores: sideAHoleScores,
        },
        {
          sideId: sideBEngineId,
          player: sideBPlayers[0],
          holeScores: sideBHoleScores,
        },
        tee,
        segmentType,
        allowance,
        segment.points_available
      );
    default: {
      const exhaustiveFormat: never = segment.format;
      throw error(500, `Unsupported segment format ${String(exhaustiveFormat)}.`);
    }
  }
}

function formatMatchState(state: MatchState, sideLabelByEngineId: Map<number, SideLabel>): string {
  if (state.leadingSideId === null) {
    return state.summary;
  }

  if (state.summary === 'AS' || state.summary === 'DORMIE' || state.summary === 'HALVED') {
    return state.summary;
  }

  const sideLabel = sideLabelByEngineId.get(state.leadingSideId);
  if (!sideLabel) {
    return state.summary;
  }

  return `${sideLabel} ${state.summary}`;
}

export const POST: RequestHandler = async (event) => {
  requireRole(event.locals, 'player', 'commissioner');

  const db = getDb(event);
  const matchId = event.params.matchId;

  if (!matchId) {
    return json({ message: 'matchId route parameter is required.' }, { status: 400 });
  }

  const idempotencyKeyHeader = event.request.headers.get('Idempotency-Key');
  if (!idempotencyKeyHeader) {
    return json({ message: 'Idempotency-Key header is required.' }, { status: 400 });
  }

  const opId = idempotencyKeyHeader.trim();
  if (!isValidIdempotencyKey(opId)) {
    return json({ message: 'Idempotency-Key must be a valid UUID or ULID.' }, { status: 400 });
  }

  const holeParam = parseHoleParam(event.params.hole);
  if (holeParam.holeNumber === null) {
    return json({ message: holeParam.message ?? 'Invalid hole route parameter.' }, { status: 400 });
  }

  const holeNumber = holeParam.holeNumber;

  let rawBody: unknown;
  try {
    rawBody = await event.request.json();
  } catch {
    return json({ message: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const parsedBody = parseConcedeBody(rawBody);
  if (!parsedBody.body) {
    return json({ message: parsedBody.message ?? 'Invalid request body.' }, { status: 400 });
  }

  const requestBody = parsedBody.body;
  const match = await getMatchById(db, matchId);
  if (!match) {
    return json({ message: 'Match not found.' }, { status: 404 });
  }

  const round = await getRoundById(db, match.round_id);
  if (!round) {
    throw error(500, 'Match references a missing round.');
  }

  requireSameTournament(event.locals, round.tournament_id);

  const sides = await listSidesByMatch(db, match.id);
  const { sideA, sideB } = getMatchSidesByLabel(sides);
  const concedingSide = requestBody.side === 'A' ? sideA : sideB;
  const sidePlayersBySideId = new Map<string, MatchSidePlayer[]>();

  await Promise.all(
    sides.map(async (side) => {
      const sidePlayers = await listPlayersBySide(db, side.id);
      sidePlayersBySideId.set(side.id, sidePlayers);
    })
  );

  const playerToSideLabel = new Map<string, SideLabel>();
  for (const side of sides) {
    const sidePlayers = sidePlayersBySideId.get(side.id) ?? [];
    for (const sidePlayer of sidePlayers) {
      playerToSideLabel.set(sidePlayer.player_id, side.side_label);
    }
  }

  let concessionPlayerId: string | null;
  let actorPlayerId: string | null = event.locals.playerId;

  if (event.locals.role === 'player') {
    if (requestBody.playerId !== undefined) {
      return json(
        { message: 'playerId override is only allowed for commissioners.' },
        { status: 403 }
      );
    }

    const actingPlayerId = event.locals.playerId;
    if (!actingPlayerId || !playerToSideLabel.has(actingPlayerId)) {
      return json({ message: 'Player not in match.' }, { status: 403 });
    }

    if (playerToSideLabel.get(actingPlayerId) !== requestBody.side) {
      return json({ message: 'Players can only concede for their own side.' }, { status: 403 });
    }

    concessionPlayerId = actingPlayerId;
    actorPlayerId = actingPlayerId;
  } else {
    if (requestBody.playerId !== undefined) {
      const overrideSide = playerToSideLabel.get(requestBody.playerId);
      if (!overrideSide) {
        return json(
          { message: 'playerId override must reference a player in this match.' },
          { status: 400 }
        );
      }

      if (overrideSide !== requestBody.side) {
        return json(
          { message: 'playerId override must be on the conceded side.' },
          { status: 400 }
        );
      }

      concessionPlayerId = requestBody.playerId;
      actorPlayerId = requestBody.playerId;
    } else {
      const concedingSidePlayers = sidePlayersBySideId.get(concedingSide.id) ?? [];
      concessionPlayerId = concedingSidePlayers[0]?.player_id ?? null;
    }
  }

  if (!concessionPlayerId) {
    throw error(500, 'Conceding side has no players configured.');
  }

  const opClaimed = await claimOp(db, opId, matchId);
  if (!opClaimed) {
    const processed = await getProcessedOp(db, opId, matchId);

    if (processed?.endpoint) {
      try {
        return json(JSON.parse(processed.endpoint));
      } catch {
        throw error(500, 'Stored idempotent response is invalid JSON.');
      }
    }

    return json({ message: 'Op in flight, retry shortly' }, { status: 409 });
  }

  await upsertHoleScore(db, {
    match_id: match.id,
    hole_number: holeNumber,
    player_id: concessionPlayerId,
    match_side_id: concedingSide.id,
    gross_strokes: null,
    is_conceded: 1,
    is_picked_up: 0,
    entered_by_player_id: event.locals.role === 'player' ? event.locals.playerId : null,
    op_id: opId,
  });

  await writeAuditEntry(db, {
    tournament_id: round.tournament_id,
    actor_player_id: actorPlayerId,
    actor_email: event.locals.userId,
    action: 'CONCEDE_HOLE',
    entity_type: 'match',
    entity_id: match.id,
    old_value: null,
    new_value: JSON.stringify({
      holeNumber,
      side: requestBody.side,
      matchId: match.id,
    }),
  });

  const [
    allHoleScores,
    segments,
    tournament,
    teesByCourse,
    holesByCourse,
    sideAPlayers,
    sideBPlayers,
  ] = await Promise.all([
    listHoleScoresByMatch(db, match.id),
    listSegmentsByRound(db, round.id),
    getTournamentById(db, round.tournament_id),
    listTeesByCourse(db, round.course_id),
    listHolesByCourse(db, round.course_id),
    loadPlayersForSide(db, sidePlayersBySideId.get(sideA.id) ?? [], round.tournament_id),
    loadPlayersForSide(db, sidePlayersBySideId.get(sideB.id) ?? [], round.tournament_id),
  ]);

  if (!tournament) {
    throw error(500, 'Round references a missing tournament.');
  }

  const segmentForHole = resolveSegmentForHole(segments, holeNumber);
  if (!segmentForHole) {
    return json({ message: 'No round segment is configured for this hole.' }, { status: 400 });
  }

  const segment = {
    ...segmentForHole,
    format: match.format_override ?? segmentForHole.format,
  };

  const tee = teesByCourse.find((candidateTee) => candidateTee.id === round.tee_id);
  if (!tee) {
    throw error(500, 'Round references a missing tee.');
  }

  const teeHoles = holesByCourse.filter((hole) => hole.tee_id === round.tee_id);
  if (teeHoles.length === 0) {
    throw error(500, 'No hole metadata exists for the configured tee.');
  }

  const sideIdMap = new Map<string, number>([
    [sideA.id, 1],
    [sideB.id, 2],
  ]);
  const sideLabelByEngineId = new Map<number, SideLabel>([
    [1, 'A'],
    [2, 'B'],
  ]);

  const playerIdMap = new Map<string, number>();
  const playersInOrder = [...sideAPlayers, ...sideBPlayers];
  for (let index = 0; index < playersInOrder.length; index += 1) {
    playerIdMap.set(playersInOrder[index].id, index + 1);
  }

  const engineScores = allHoleScores
    .map((row) => toEngineHoleScore(row, sideIdMap, playerIdMap))
    .filter((row): row is HoleScoreInput => row !== null);

  const sideAEngineId = sideIdMap.get(sideA.id)!;
  const sideBEngineId = sideIdMap.get(sideB.id)!;
  const sideAHandicapInputs = toPlayerHandicapInput(sideAPlayers, sideAEngineId, playerIdMap);
  const sideBHandicapInputs = toPlayerHandicapInput(sideBPlayers, sideBEngineId, playerIdMap);
  const allowance = resolveAllowance(
    segment.format,
    normalizeTournamentAllowances(tournament),
    segment.allowance_override
  );
  const teeData = asTeeData(1, tee, teeHoles);

  const segmentState = computeSegmentState(
    segment,
    allowance,
    teeData,
    sideAEngineId,
    sideBEngineId,
    sideAHandicapInputs,
    sideBHandicapInputs,
    engineScores.filter((row) => row.matchSideId === sideAEngineId),
    engineScores.filter((row) => row.matchSideId === sideBEngineId)
  );

  const computedHoleResult = segmentState.holeResults.find(
    (holeResult) => holeResult.holeNumber === holeNumber
  );
  if (!computedHoleResult) {
    throw error(500, 'Hole result was not computed for the conceded hole.');
  }

  await upsertMatchHoleResult(db, {
    match_id: match.id,
    segment_id: segment.id,
    hole_number: holeNumber,
    result: computedHoleResult.result,
    side_a_net: computedHoleResult.sideANet,
    side_b_net: computedHoleResult.sideBNet,
  });

  const allHoleResults = await listHoleResultsByMatch(db, match.id);
  const totalHoles = Math.max(1, ...segments.map((roundSegment) => roundSegment.hole_end));
  const totalPointsAvailable = segments.reduce(
    (sum, roundSegment) => sum + roundSegment.points_available,
    0
  );
  const overallState = computeMatchState(
    buildOverallHoleResults(allHoleResults, totalHoles),
    totalHoles,
    totalPointsAvailable,
    sideAEngineId,
    sideBEngineId
  );

  const matchClosed = overallState.status === 'CLOSED' || overallState.status === 'FINAL';
  if (matchClosed) {
    await updateMatchStatus(db, match.id, 'FINAL', {
      segment_id: segment.id,
      side_a_holes_won: overallState.sideA.holesWon,
      side_b_holes_won: overallState.sideB.holesWon,
      halves: overallState.sideA.holesSplit,
      close_notation: overallState.closeNotation,
      side_a_points: overallState.sideA.pointsEarned,
      side_b_points: overallState.sideB.pointsEarned,
    });
  }

  const responseBody: ConcedeHoleResponseBody = {
    holeNumber,
    side: requestBody.side,
    matchState: formatMatchState(overallState, sideLabelByEngineId),
    matchClosed,
    closeNotation: overallState.closeNotation,
  };

  await markOpProcessed(db, opId, JSON.stringify(responseBody), matchId);

  return json(responseBody);
};
