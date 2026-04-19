import { error, json, type RequestHandler } from '@sveltejs/kit';
import { requireRole, requireSameTournament } from '$lib/auth/guards';
import { getRoundById, listSegmentsByRound, updateRound } from '$lib/db/rounds';
import { getTournamentById } from '$lib/db/tournaments';
import type { MatchFormat, Round, RoundSegment } from '$lib/db/types';

type ApiSegment = 'F9' | 'B9' | '18';
type ApiFormat = 'Scramble' | 'Pinehurst' | 'Shamble' | 'FourBall' | 'Singles';
type RoundStatus = 'draft' | 'inProgress' | 'complete';
type ApiAllowanceConfig = { lowPct: number; highPct: number } | { perPlayerPct: number };

const ROUND_STATUSES: readonly RoundStatus[] = ['draft', 'inProgress', 'complete'];

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

function normalizeDateTime(value: unknown, fieldName: string): string {
  const rawDateTime = expectString(value, fieldName);
  const parsed = Date.parse(rawDateTime);

  if (Number.isNaN(parsed)) {
    throw error(400, `${fieldName} must be a valid date-time string.`);
  }

  return new Date(parsed).toISOString();
}

function parseRoundStatus(value: unknown): RoundStatus {
  const status = expectString(value, 'status');

  if (!ROUND_STATUSES.includes(status as RoundStatus)) {
    throw error(400, 'status must be one of draft, inProgress, complete.');
  }

  return status as RoundStatus;
}

function toApiSegment(segmentType: RoundSegment['segment_type']): ApiSegment {
  if (segmentType === 'F9' || segmentType === 'B9') {
    return segmentType;
  }

  return '18';
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
  order: number
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
    allowanceConfig: mapAllowanceConfigFromSegment(segment),
    pointsAtStake: segment.points_available,
    order,
  };
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

async function getRoundPayload(
  db: D1Database,
  round: Round
): Promise<{
  id: string;
  tournamentId: string;
  roundNumber: number;
  courseId: string;
  teeId: string;
  name: string | null;
  dateTime: string;
  status: RoundStatus;
  segments: Array<{
    id: string;
    roundId: string;
    segment: ApiSegment;
    format: ApiFormat;
    allowanceConfig: ApiAllowanceConfig | null;
    pointsAtStake: number;
    order: number;
  }>;
}> {
  const segments = await listSegmentsByRound(db, round.id);

  return {
    ...mapRoundResponse(round),
    segments: segments.map((segment, index) => mapSegmentResponse(segment, index + 1)),
  };
}

export const GET: RequestHandler = async ({ params, locals, platform }) => {
  requireRole(locals, 'commissioner', 'player');
  requireSameTournament(locals, params.id);

  const db = getDb(platform);
  await requireTournament(db, params.id);
  const round = await requireRoundInTournament(db, params.id, params.roundId);

  return json(await getRoundPayload(db, round));
};

export const PATCH: RequestHandler = async ({ params, request, locals, platform }) => {
  requireRole(locals, 'commissioner');
  requireSameTournament(locals, params.id);

  const db = getDb(platform);
  await requireTournament(db, params.id);

  const round = await requireRoundInTournament(db, params.id, params.roundId);
  const payload = expectObject(await parseJsonBody(request), 'body');
  const metadata = parseRoundNotes(round.notes);

  let hasChanges = false;
  let nextName = metadata.name;
  let nextStatus = metadata.status;
  let nextDateTime = round.scheduled_at;

  if (payload.name !== undefined) {
    hasChanges = true;

    if (payload.name === null) {
      nextName = null;
    } else {
      nextName = expectString(payload.name, 'name');
    }
  }

  if (payload.status !== undefined) {
    hasChanges = true;
    nextStatus = parseRoundStatus(payload.status);
  }

  if (payload.dateTime !== undefined) {
    hasChanges = true;
    nextDateTime = normalizeDateTime(payload.dateTime, 'dateTime');
  }

  if (!hasChanges) {
    throw error(400, 'At least one of name, dateTime, or status must be provided.');
  }

  const updatedRound = await updateRound(db, round.id, {
    scheduled_at: nextDateTime,
    notes: buildRoundNotes(nextName, nextStatus),
  });

  if (!updatedRound) {
    throw error(500, 'Failed to update round.');
  }

  return json(await getRoundPayload(db, updatedRound));
};
