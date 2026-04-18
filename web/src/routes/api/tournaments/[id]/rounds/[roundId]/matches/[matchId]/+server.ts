import { error, json, type RequestHandler } from '@sveltejs/kit';
import { requireRole, requireSameTournament } from '$lib/auth/guards';
import {
  getMatchById,
  listHoleResultsByMatch,
  listPlayersBySide,
  listSidesByMatch,
  updateMatchStatus,
} from '$lib/db/matches';
import { getPlayerById } from '$lib/db/players';
import { getRoundById, listSegmentsByRound } from '$lib/db/rounds';
import { getTournamentById } from '$lib/db/tournaments';
import type {
  MatchFormat,
  MatchResultStatus,
  MatchSide,
  Round,
  RoundSegment,
  SegmentType,
} from '$lib/db/types';

type ApiSegment = 'F9' | 'B9' | '18';
type ApiFormat = 'Scramble' | 'Pinehurst' | 'Shamble' | 'FourBall' | 'Singles';

type MatchResultRow = {
  id: string;
  segment_id: string;
  status: MatchResultStatus;
  side_a_holes_won: number;
  side_b_holes_won: number;
  halves: number;
  close_notation: string | null;
  side_a_points: number;
  side_b_points: number;
  computed_at: string;
};

const API_SEGMENTS: readonly ApiSegment[] = ['F9', 'B9', '18'];

const DB_FORMAT_TO_API: Record<MatchFormat, ApiFormat> = {
  SCRAMBLE: 'Scramble',
  PINEHURST: 'Pinehurst',
  SHAMBLE: 'Shamble',
  FOURBALL: 'FourBall',
  SINGLES: 'Singles',
};

const PATCH_STATUS_MAP: Record<string, MatchResultStatus> = {
  pending: 'PENDING',
  inprogress: 'IN_PROGRESS',
  final: 'FINAL',
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  FINAL: 'FINAL',
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

function parseApiSegment(value: unknown): ApiSegment {
  const segment = expectString(value, 'segment');

  if (!API_SEGMENTS.includes(segment as ApiSegment)) {
    throw error(400, 'segment must be one of F9, B9, 18.');
  }

  return segment as ApiSegment;
}

function parsePatchStatus(value: unknown): MatchResultStatus {
  const rawStatus = expectString(value, 'status');
  const normalized = PATCH_STATUS_MAP[rawStatus];

  if (!normalized) {
    throw error(400, 'status must be one of pending, inProgress, final.');
  }

  return normalized;
}

function toApiSegment(segmentType: SegmentType): ApiSegment {
  if (segmentType === 'F9' || segmentType === 'B9') {
    return segmentType;
  }

  return '18';
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

async function requireMatchInRound(
  db: D1Database,
  roundId: string,
  matchId: string
): Promise<{
  id: string;
  round_id: string;
  match_number: number;
  format_override: MatchFormat | null;
  created_at: string;
}> {
  const match = await getMatchById(db, matchId);

  if (!match || match.round_id !== roundId) {
    throw error(404, 'Match not found.');
  }

  return match;
}

async function listMatchResults(db: D1Database, matchId: string): Promise<MatchResultRow[]> {
  const results = await db
    .prepare(
      `
        SELECT
          id,
          segment_id,
          status,
          side_a_holes_won,
          side_b_holes_won,
          halves,
          close_notation,
          side_a_points,
          side_b_points,
          computed_at
        FROM match_results
        WHERE match_id = ?1
        ORDER BY computed_at DESC
      `
    )
    .bind(matchId)
    .all<MatchResultRow>();

  return results.results.map((result) => ({
    ...result,
    id: String(result.id),
    segment_id: String(result.segment_id),
  }));
}

async function getMatchSidePayload(
  db: D1Database,
  side: MatchSide
): Promise<{
  id: string;
  teamId: string;
  sideLabel: 'A' | 'B';
  players: Array<{ id: string; name: string; teamId: string | null; handicapIndex: number }>;
}> {
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
}

async function buildMatchDetailPayload(
  db: D1Database,
  match: { id: string; round_id: string; match_number: number; format_override: MatchFormat | null },
  segmentById: Map<string, RoundSegment>
): Promise<{
  id: string;
  roundId: string;
  matchNumber: number;
  format: ApiFormat | null;
  status: MatchResultStatus;
  segment: ApiSegment | null;
  sides: Array<{
    id: string;
    teamId: string;
    sideLabel: 'A' | 'B';
    players: Array<{ id: string; name: string; teamId: string | null; handicapIndex: number }>;
  }>;
  results: Array<{
    id: string;
    segment: ApiSegment | null;
    status: MatchResultStatus;
    sideAHolesWon: number;
    sideBHolesWon: number;
    halves: number;
    closeNotation: string | null;
    sideAPoints: number;
    sideBPoints: number;
    computedAt: string;
  }>;
  holeResults: Array<{
    id: string;
    segment: ApiSegment | null;
    holeNumber: number;
    result: 'A_WINS' | 'B_WINS' | 'HALVED' | 'PENDING';
    sideANet: number | null;
    sideBNet: number | null;
    computedAt: string;
  }>;
}> {
  const sides = await listSidesByMatch(db, match.id);
  const sidePayloads = await Promise.all(sides.map((side) => getMatchSidePayload(db, side)));
  const matchResults = await listMatchResults(db, match.id);
  const latestResult = matchResults[0] ?? null;
  const holeResults = await listHoleResultsByMatch(db, match.id);

  return {
    id: match.id,
    roundId: match.round_id,
    matchNumber: match.match_number,
    format: match.format_override ? DB_FORMAT_TO_API[match.format_override] : null,
    status: latestResult?.status ?? 'PENDING',
    segment: latestResult ? toApiSegment(segmentById.get(latestResult.segment_id)?.segment_type ?? 'OVERALL') : null,
    sides: sidePayloads,
    results: matchResults.map((result) => ({
      id: result.id,
      segment: toApiSegment(segmentById.get(result.segment_id)?.segment_type ?? 'OVERALL'),
      status: result.status,
      sideAHolesWon: result.side_a_holes_won,
      sideBHolesWon: result.side_b_holes_won,
      halves: result.halves,
      closeNotation: result.close_notation,
      sideAPoints: result.side_a_points,
      sideBPoints: result.side_b_points,
      computedAt: result.computed_at,
    })),
    holeResults: holeResults.map((holeResult) => ({
      id: holeResult.id,
      segment: toApiSegment(segmentById.get(holeResult.segment_id)?.segment_type ?? 'OVERALL'),
      holeNumber: holeResult.hole_number,
      result: holeResult.result,
      sideANet: holeResult.side_a_net,
      sideBNet: holeResult.side_b_net,
      computedAt: holeResult.computed_at,
    })),
  };
}

export const GET: RequestHandler = async ({ params, locals, platform }) => {
  requireRole(locals, 'commissioner', 'player');
  requireSameTournament(locals, params.id);

  const db = getDb(platform);
  await requireTournament(db, params.id);
  await requireRoundInTournament(db, params.id, params.roundId);

  const segments = await listSegmentsByRound(db, params.roundId);
  const { byId } = buildSegmentMaps(segments);
  const match = await requireMatchInRound(db, params.roundId, params.matchId);

  return json(await buildMatchDetailPayload(db, match, byId));
};

export const PATCH: RequestHandler = async ({ params, request, locals, platform }) => {
  requireRole(locals, 'commissioner');
  requireSameTournament(locals, params.id);

  const db = getDb(platform);
  await requireTournament(db, params.id);
  await requireRoundInTournament(db, params.id, params.roundId);

  const segments = await listSegmentsByRound(db, params.roundId);
  const { byApiSegment, byId } = buildSegmentMaps(segments);
  const match = await requireMatchInRound(db, params.roundId, params.matchId);
  const payload = expectObject(await parseJsonBody(request), 'body');
  const status = parsePatchStatus(payload.status);

  const existingResultRows = await listMatchResults(db, match.id);
  const latestResult = existingResultRows[0] ?? null;

  let segmentId: string | null = latestResult?.segment_id ?? null;

  if (payload.segment !== undefined) {
    const apiSegment = parseApiSegment(payload.segment);
    const segment = byApiSegment.get(apiSegment);

    if (!segment) {
      throw error(400, `Segment ${apiSegment} is not configured for this round.`);
    }

    segmentId = segment.id;
  }

  if (!segmentId && segments.length === 1) {
    segmentId = segments[0].id;
  }

  if (!segmentId) {
    throw error(400, 'Unable to determine match segment. Provide segment in the request body.');
  }

  await updateMatchStatus(db, match.id, status, { segment_id: segmentId });

  return json(await buildMatchDetailPayload(db, match, byId));
};
