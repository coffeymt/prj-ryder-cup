import { error, json, type RequestHandler } from '@sveltejs/kit';
import { requireRole, requireSameTournament } from '$lib/auth/guards';
import {
  createRound,
  createRoundSegment,
  listRoundsByTournament,
  listSegmentsByRound,
} from '$lib/db/rounds';
import { getTournamentById } from '$lib/db/tournaments';
import type { MatchFormat, Round, RoundSegment, SegmentType } from '$lib/db/types';

type ApiSegment = 'F9' | 'B9' | '18';
type ApiFormat = 'Scramble' | 'Pinehurst' | 'Shamble' | 'FourBall' | 'Singles';
type RoundStatus = 'draft' | 'inProgress' | 'complete';

type ApiAllowanceConfig = { lowPct: number; highPct: number } | { perPlayerPct: number };

type ParsedSegmentInput = {
  segment: ApiSegment;
  format: ApiFormat;
  allowanceConfig: ApiAllowanceConfig | null;
  allowanceOverride: number | null;
  pointsAtStake: number;
  order: number;
};

const API_SEGMENTS: readonly ApiSegment[] = ['F9', 'B9', '18'];
const API_FORMATS: readonly ApiFormat[] = [
  'Scramble',
  'Pinehurst',
  'Shamble',
  'FourBall',
  'Singles',
];
const ROUND_STATUSES: readonly RoundStatus[] = ['draft', 'inProgress', 'complete'];

const API_FORMAT_TO_DB: Record<ApiFormat, MatchFormat> = {
  Scramble: 'SCRAMBLE',
  Pinehurst: 'PINEHURST',
  Shamble: 'SHAMBLE',
  FourBall: 'FOURBALL',
  Singles: 'SINGLES',
};

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

function expectPositiveInteger(value: unknown, fieldName: string): number {
  const numericValue = expectPositiveNumber(value, fieldName);

  if (!Number.isInteger(numericValue)) {
    throw error(400, `${fieldName} must be an integer.`);
  }

  return numericValue;
}

function normalizeDateTime(value: unknown, fieldName: string): string {
  const rawDateTime = expectString(value, fieldName);
  const parsed = Date.parse(rawDateTime);

  if (Number.isNaN(parsed)) {
    throw error(400, `${fieldName} must be a valid date-time string.`);
  }

  return new Date(parsed).toISOString();
}

function normalizePercentage(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 150) {
    throw error(400, `${fieldName} must be a number between 0 and 150.`);
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

function parseApiFormat(value: unknown): ApiFormat {
  const format = expectString(value, 'format');

  if (!API_FORMATS.includes(format as ApiFormat)) {
    throw error(400, 'format must be one of Scramble, Pinehurst, Shamble, FourBall, Singles.');
  }

  return format as ApiFormat;
}

function toDbSegmentType(segment: ApiSegment, segmentCount: number): SegmentType {
  if (segment === 'F9' || segment === 'B9') {
    return segment;
  }

  return segmentCount === 1 ? 'FULL18' : 'OVERALL';
}

function toApiSegment(segmentType: SegmentType): ApiSegment {
  if (segmentType === 'F9' || segmentType === 'B9') {
    return segmentType;
  }

  return '18';
}

function segmentHoleRange(segmentType: SegmentType): { holeStart: number; holeEnd: number } {
  if (segmentType === 'F9') {
    return { holeStart: 1, holeEnd: 9 };
  }

  if (segmentType === 'B9') {
    return { holeStart: 10, holeEnd: 18 };
  }

  return { holeStart: 1, holeEnd: 18 };
}

function parseAllowanceConfig(
  value: unknown,
  format: ApiFormat
): { allowanceConfig: ApiAllowanceConfig | null; allowanceOverride: number | null } {
  if (value === undefined || value === null) {
    return { allowanceConfig: null, allowanceOverride: null };
  }

  const config = expectObject(value, 'allowanceConfig');

  if (format === 'Scramble' || format === 'Pinehurst') {
    const lowPct = normalizePercentage(config.lowPct, 'allowanceConfig.lowPct');
    const highPct = normalizePercentage(config.highPct, 'allowanceConfig.highPct');

    return {
      allowanceConfig: { lowPct, highPct },
      allowanceOverride: lowPct === highPct ? lowPct / 100 : null,
    };
  }

  const perPlayerPct = normalizePercentage(config.perPlayerPct, 'allowanceConfig.perPlayerPct');

  return {
    allowanceConfig: { perPlayerPct },
    allowanceOverride: perPlayerPct / 100,
  };
}

function mapAllowanceConfigFromSegment(segment: RoundSegment): ApiAllowanceConfig | null {
  if (segment.allowance_override === null) {
    return null;
  }

  const pct = Number((segment.allowance_override * 100).toFixed(2));

  if (segment.format === 'SCRAMBLE' || segment.format === 'PINEHURST') {
    return { lowPct: pct, highPct: pct };
  }

  return { perPlayerPct: pct };
}

function parseRoundNotes(notes: string | null): { name: string | null; status: RoundStatus } {
  if (!notes) {
    return { name: null, status: 'draft' };
  }

  try {
    const parsed = JSON.parse(notes);

    if (!parsed || typeof parsed !== 'object') {
      return { name: notes, status: 'draft' };
    }

    const payload = parsed as { name?: unknown; status?: unknown };
    const name =
      typeof payload.name === 'string' && payload.name.trim().length > 0 ? payload.name : null;
    const status =
      typeof payload.status === 'string' && ROUND_STATUSES.includes(payload.status as RoundStatus)
        ? (payload.status as RoundStatus)
        : 'draft';

    return { name, status };
  } catch {
    return { name: notes, status: 'draft' };
  }
}

function buildRoundNotes(name: string | null, status: RoundStatus): string {
  const payload: { name?: string; status: RoundStatus } = { status };

  if (name) {
    payload.name = name;
  }

  return JSON.stringify(payload);
}

function mapRoundResponse(round: Round): {
  id: string;
  tournamentId: string;
  roundNumber: number;
  courseId: string;
  teeId: string;
  name: string | null;
  dateTime: string;
  status: RoundStatus;
} {
  const metadata = parseRoundNotes(round.notes);

  return {
    id: round.id,
    tournamentId: round.tournament_id,
    roundNumber: round.round_number,
    courseId: round.course_id,
    teeId: round.tee_id,
    name: metadata.name,
    dateTime: round.scheduled_at,
    status: metadata.status,
  };
}

function mapSegmentResponse(
  segment: RoundSegment,
  order: number,
  allowanceConfig?: ApiAllowanceConfig | null
): {
  id: string;
  roundId: string;
  segment: ApiSegment;
  format: ApiFormat;
  allowanceConfig: ApiAllowanceConfig | null;
  pointsAtStake: number;
  order: number;
} {
  return {
    id: segment.id,
    roundId: segment.round_id,
    segment: toApiSegment(segment.segment_type),
    format: DB_FORMAT_TO_API[segment.format],
    allowanceConfig: allowanceConfig ?? mapAllowanceConfigFromSegment(segment),
    pointsAtStake: segment.points_available,
    order,
  };
}

function parseSegments(value: unknown): ParsedSegmentInput[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw error(400, 'segments must be a non-empty array.');
  }

  const parsedSegments: ParsedSegmentInput[] = value.map((entry, index) => {
    const row = expectObject(entry, `segments[${index}]`);
    const format = parseApiFormat(row.format);
    const parsedAllowance = parseAllowanceConfig(row.allowanceConfig, format);

    return {
      segment: parseApiSegment(row.segment),
      format,
      allowanceConfig: parsedAllowance.allowanceConfig,
      allowanceOverride: parsedAllowance.allowanceOverride,
      pointsAtStake: expectPositiveNumber(row.pointsAtStake, `segments[${index}].pointsAtStake`),
      order: expectPositiveInteger(row.order, `segments[${index}].order`),
    };
  });

  const segmentSet = new Set(parsedSegments.map((segment) => segment.segment));

  if (segmentSet.size !== parsedSegments.length) {
    throw error(400, 'segments cannot contain duplicate segment values.');
  }

  const orderSet = new Set(parsedSegments.map((segment) => segment.order));

  if (orderSet.size !== parsedSegments.length) {
    throw error(400, 'segments cannot contain duplicate order values.');
  }

  return parsedSegments.sort((a, b) => a.order - b.order);
}

async function requireTournament(db: D1Database, tournamentId: string): Promise<void> {
  const tournament = await getTournamentById(db, tournamentId);

  if (!tournament) {
    throw error(404, 'Tournament not found.');
  }
}

export const POST: RequestHandler = async ({ params, request, locals, platform }) => {
  requireRole(locals, 'commissioner');
  requireSameTournament(locals, params.id);

  const db = getDb(platform);
  await requireTournament(db, params.id);

  const payload = expectObject(await parseJsonBody(request), 'body');
  const courseId = expectString(payload.courseId, 'courseId');
  const teeId = expectString(payload.teeId, 'teeId');
  const name = expectString(payload.name, 'name');
  const dateTime = normalizeDateTime(payload.dateTime, 'dateTime');
  const segments = parseSegments(payload.segments);

  const existingRounds = await listRoundsByTournament(db, params.id);
  const nextRoundNumber =
    existingRounds.reduce((highestRound, round) => Math.max(highestRound, round.round_number), 0) +
    1;

  const createdRound = await createRound(db, {
    tournament_id: params.id,
    round_number: nextRoundNumber,
    course_id: courseId,
    tee_id: teeId,
    scheduled_at: dateTime,
    notes: buildRoundNotes(name, 'draft'),
  });

  const createdSegments: Array<{
    id: string;
    roundId: string;
    segment: ApiSegment;
    format: ApiFormat;
    allowanceConfig: ApiAllowanceConfig | null;
    pointsAtStake: number;
    order: number;
  }> = [];

  for (const segment of segments) {
    const dbSegmentType = toDbSegmentType(segment.segment, segments.length);
    const range = segmentHoleRange(dbSegmentType);

    const createdSegment = await createRoundSegment(db, {
      round_id: createdRound.id,
      segment_type: dbSegmentType,
      hole_start: range.holeStart,
      hole_end: range.holeEnd,
      format: API_FORMAT_TO_DB[segment.format],
      points_available: segment.pointsAtStake,
      allowance_override: segment.allowanceOverride,
    });

    createdSegments.push(
      mapSegmentResponse(createdSegment, segment.order, segment.allowanceConfig)
    );
  }

  return json(
    {
      round: mapRoundResponse(createdRound),
      segments: createdSegments,
    },
    { status: 201 }
  );
};

export const GET: RequestHandler = async ({ params, locals, platform }) => {
  requireRole(locals, 'commissioner', 'player');
  requireSameTournament(locals, params.id);

  const db = getDb(platform);
  await requireTournament(db, params.id);

  const rounds = await listRoundsByTournament(db, params.id);
  const roundsWithSegments = await Promise.all(
    rounds.map(async (round) => {
      const segments = await listSegmentsByRound(db, round.id);

      return {
        ...mapRoundResponse(round),
        segments: segments.map((segment, index) => mapSegmentResponse(segment, index + 1)),
      };
    })
  );

  return json({ rounds: roundsWithSegments });
};
