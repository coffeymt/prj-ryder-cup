import { error, json, type RequestHandler } from '@sveltejs/kit';
import { requireRole, requireSameTournament } from '$lib/auth/guards';
import {
  addPlayerToSide,
  createMatch,
  createMatchSide,
  listMatchesByRound,
  listPlayersBySide,
  listSidesByMatch,
  updateMatchStatus,
} from '$lib/db/matches';
import { getPlayerById } from '$lib/db/players';
import { getRoundById, listSegmentsByRound } from '$lib/db/rounds';
import { getTeamById } from '$lib/db/teams';
import { getTournamentById } from '$lib/db/tournaments';
import type {
  Match,
  MatchFormat,
  MatchResultStatus,
  Round,
  RoundSegment,
  SegmentType,
} from '$lib/db/types';

type ApiSegment = 'F9' | 'B9' | '18';
type ApiFormat = 'Scramble' | 'Pinehurst' | 'Shamble' | 'FourBall' | 'Singles';
type SideInput = { teamId: string; playerIds: string[] };

type MatchResultRow = {
  segment_id: string;
  status: MatchResultStatus;
  side_a_points: number;
  side_b_points: number;
};

const API_SEGMENTS: readonly ApiSegment[] = ['F9', 'B9', '18'];

const DB_FORMAT_TO_API: Record<MatchFormat, ApiFormat> = {
  SCRAMBLE: 'Scramble',
  PINEHURST: 'Pinehurst',
  SHAMBLE: 'Shamble',
  FOURBALL: 'FourBall',
  SINGLES: 'Singles',
};

function getDb(platform: App.Platform | undefined): D1Database {
  const db = platform?.env.DB;

  if (!db) {
    throw error(500, 'Database binding is unavailable.');
  }

  return db;
}

async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw error(400, 'Request body must be valid JSON.');
  }
}

function expectObject(value: unknown, fieldName: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw error(400, `${fieldName} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function expectString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw error(400, `${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}

function expectPositiveNumber(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw error(400, `${fieldName} must be a positive number.`);
  }

  return value;
}

function parseApiSegment(value: unknown): ApiSegment {
  const segment = expectString(value, 'segment');

  if (!API_SEGMENTS.includes(segment as ApiSegment)) {
    throw error(400, 'segment must be one of F9, B9, 18.');
  }

  return segment as ApiSegment;
}

function toApiSegment(segmentType: SegmentType): ApiSegment {
  if (segmentType === 'F9' || segmentType === 'B9') {
    return segmentType;
  }

  return '18';
}

function parseSide(value: unknown, fieldName: 'sideA' | 'sideB'): SideInput {
  const sideObject = expectObject(value, fieldName);
  const teamId = expectString(sideObject.teamId, `${fieldName}.teamId`);

  if (!Array.isArray(sideObject.playerIds) || sideObject.playerIds.length === 0) {
    throw error(400, `${fieldName}.playerIds must be a non-empty array.`);
  }

  const playerIds = sideObject.playerIds.map((playerId, index) =>
    expectString(playerId, `${fieldName}.playerIds[${index}]`)
  );

  const playerSet = new Set(playerIds);

  if (playerSet.size !== playerIds.length) {
    throw error(400, `${fieldName}.playerIds cannot include duplicates.`);
  }

  return { teamId, playerIds };
}

function parseMatchesPayload(value: unknown): Array<{
  segment: ApiSegment;
  pointsAtStake: number;
  sideA: SideInput;
  sideB: SideInput;
}> {
  const body = expectObject(value, 'body');

  if (!Array.isArray(body.matches) || body.matches.length === 0) {
    throw error(400, 'matches must be a non-empty array.');
  }

  return body.matches.map((matchEntry, index) => {
    const row = expectObject(matchEntry, `matches[${index}]`);
    const sideA = parseSide(row.sideA, 'sideA');
    const sideB = parseSide(row.sideB, 'sideB');
    const sideAPlayerIds = new Set(sideA.playerIds);

    for (const playerId of sideB.playerIds) {
      if (sideAPlayerIds.has(playerId)) {
        throw error(400, `matches[${index}] contains a player on both sides.`);
      }
    }

    return {
      segment: parseApiSegment(row.segment),
      pointsAtStake: expectPositiveNumber(row.pointsAtStake, `matches[${index}].pointsAtStake`),
      sideA,
      sideB,
    };
  });
}

async function requireTournament(db: D1Database, tournamentId: string): Promise<void> {
  const tournament = await getTournamentById(db, tournamentId);

  if (!tournament) {
    throw error(404, 'Tournament not found.');
  }
}

async function requireRoundInTournament(
  db: D1Database,
  tournamentId: string,
  roundId: string
): Promise<Round> {
  const round = await getRoundById(db, roundId);

  if (!round || round.tournament_id !== tournamentId) {
    throw error(404, 'Round not found.');
  }

  return round;
}

function buildSegmentMaps(segments: RoundSegment[]): {
  byApiSegment: Map<ApiSegment, RoundSegment>;
  byId: Map<string, RoundSegment>;
} {
  const byApiSegment = new Map<ApiSegment, RoundSegment>();
  const byId = new Map<string, RoundSegment>();

  for (const segment of segments) {
    const apiSegment = toApiSegment(segment.segment_type);
    byId.set(segment.id, segment);

    if (!byApiSegment.has(apiSegment)) {
      byApiSegment.set(apiSegment, segment);
    }
  }

  return { byApiSegment, byId };
}

async function validateTeamAndPlayers(
  db: D1Database,
  tournamentId: string,
  side: SideInput,
  fieldName: 'sideA' | 'sideB'
): Promise<void> {
  const team = await getTeamById(db, side.teamId);

  if (!team || team.tournament_id !== tournamentId) {
    throw error(400, `${fieldName}.teamId is invalid for this tournament.`);
  }

  for (const playerId of side.playerIds) {
    const player = await getPlayerById(db, playerId);

    if (!player || player.tournament_id !== tournamentId) {
      throw error(400, `${fieldName}.playerIds contains an invalid player.`);
    }

    if (player.team_id !== side.teamId) {
      throw error(400, `${fieldName}.playerIds must belong to ${fieldName}.teamId.`);
    }
  }
}

async function getMatchResultRow(db: D1Database, matchId: string): Promise<MatchResultRow | null> {
  return (
    (await db
      .prepare(
        `
          SELECT segment_id, status, side_a_points, side_b_points
          FROM match_results
          WHERE match_id = ?1
          ORDER BY computed_at DESC
          LIMIT 1
        `
      )
      .bind(matchId)
      .first<MatchResultRow>()) ?? null
  );
}

async function getMatchResponse(
  db: D1Database,
  match: Match,
  segmentById: Map<string, RoundSegment>,
  explicitPointsAtStake?: number
): Promise<{
  id: string;
  roundId: string;
  matchNumber: number;
  segment: ApiSegment | null;
  format: ApiFormat | null;
  status: MatchResultStatus;
  pointsAtStake: number | null;
  sides: Array<{
    id: string;
    teamId: string;
    sideLabel: 'A' | 'B';
    players: Array<{ id: string; name: string; teamId: string | null; handicapIndex: number }>;
  }>;
}> {
  const sides = await listSidesByMatch(db, match.id);
  const sidePayloads = await Promise.all(
    sides.map(async (side) => {
      const sidePlayers = await listPlayersBySide(db, side.id);
      const players = await Promise.all(
        sidePlayers.map(async (sidePlayer) => {
          const player = await getPlayerById(db, sidePlayer.player_id);

          if (!player) {
            throw error(404, `Player ${sidePlayer.player_id} not found.`);
          }

          return {
            id: player.id,
            name: player.name,
            teamId: player.team_id,
            handicapIndex: player.handicap_index,
          };
        })
      );

      return {
        id: side.id,
        teamId: side.team_id,
        sideLabel: side.side_label,
        players,
      };
    })
  );

  const resultRow = await getMatchResultRow(db, match.id);
  const mappedSegment = resultRow ? (segmentById.get(resultRow.segment_id) ?? null) : null;

  return {
    id: match.id,
    roundId: match.round_id,
    matchNumber: match.match_number,
    segment: mappedSegment ? toApiSegment(mappedSegment.segment_type) : null,
    format: match.format_override ? DB_FORMAT_TO_API[match.format_override] : null,
    status: resultRow?.status ?? 'PENDING',
    pointsAtStake: explicitPointsAtStake ?? mappedSegment?.points_available ?? null,
    sides: sidePayloads,
  };
}

export const POST: RequestHandler = async ({ params, request, locals, platform }) => {
  requireRole(locals, 'commissioner');
  requireSameTournament(locals, params.id);

  const db = getDb(platform);
  await requireTournament(db, params.id);
  await requireRoundInTournament(db, params.id, params.roundId);

  const requestedMatches = parseMatchesPayload(await parseJsonBody(request));
  const segments = await listSegmentsByRound(db, params.roundId);
  const { byApiSegment, byId } = buildSegmentMaps(segments);

  if (segments.length === 0) {
    throw error(400, 'Round must have segments before creating matches.');
  }

  for (const requestedMatch of requestedMatches) {
    const segment = byApiSegment.get(requestedMatch.segment);

    if (!segment) {
      throw error(400, `Segment ${requestedMatch.segment} is not configured for this round.`);
    }
  }

  const existingMatches = await listMatchesByRound(db, params.roundId);
  let nextMatchNumber =
    existingMatches.reduce((highestMatch, match) => Math.max(highestMatch, match.match_number), 0) +
    1;

  const createdMatches: Match[] = [];
  const requestedPoints = new Map<string, number>();

  for (const requestedMatch of requestedMatches) {
    await validateTeamAndPlayers(db, params.id, requestedMatch.sideA, 'sideA');
    await validateTeamAndPlayers(db, params.id, requestedMatch.sideB, 'sideB');

    const segment = byApiSegment.get(requestedMatch.segment);

    if (!segment) {
      throw error(400, `Segment ${requestedMatch.segment} is not configured for this round.`);
    }

    const createdMatch = await createMatch(db, {
      id: crypto.randomUUID(),
      round_id: params.roundId,
      match_number: nextMatchNumber,
      format_override: segment.format,
    });

    nextMatchNumber += 1;

    const createdSideA = await createMatchSide(db, {
      id: crypto.randomUUID(),
      match_id: createdMatch.id,
      team_id: requestedMatch.sideA.teamId,
      side_label: 'A',
    });

    const createdSideB = await createMatchSide(db, {
      id: crypto.randomUUID(),
      match_id: createdMatch.id,
      team_id: requestedMatch.sideB.teamId,
      side_label: 'B',
    });

    for (const playerId of requestedMatch.sideA.playerIds) {
      await addPlayerToSide(db, createdSideA.id, playerId);
    }

    for (const playerId of requestedMatch.sideB.playerIds) {
      await addPlayerToSide(db, createdSideB.id, playerId);
    }

    await updateMatchStatus(db, createdMatch.id, 'PENDING', { segment_id: segment.id });
    createdMatches.push(createdMatch);
    requestedPoints.set(createdMatch.id, requestedMatch.pointsAtStake);
  }

  const payload = await Promise.all(
    createdMatches.map((match) => getMatchResponse(db, match, byId, requestedPoints.get(match.id)))
  );

  return json({ matches: payload }, { status: 201 });
};

export const GET: RequestHandler = async ({ params, locals, platform }) => {
  requireRole(locals, 'commissioner', 'player');
  requireSameTournament(locals, params.id);

  const db = getDb(platform);
  await requireTournament(db, params.id);
  await requireRoundInTournament(db, params.id, params.roundId);

  const segments = await listSegmentsByRound(db, params.roundId);
  const { byId } = buildSegmentMaps(segments);
  const matches = await listMatchesByRound(db, params.roundId);
  const payload = await Promise.all(matches.map((match) => getMatchResponse(db, match, byId)));

  return json({ matches: payload });
};
