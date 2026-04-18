import { requireRole, requireSameTournament } from '$lib/auth/guards';
import { writeAuditEntry } from '$lib/db/auditLog';
import { getHoleScore } from '$lib/db/holeScores';
import { getMatchById, updateMatchStatus } from '$lib/db/matches';
import { getRoundById, listSegmentsByRound } from '$lib/db/rounds';
import type { Match, MatchResultStatus, RoundSegment } from '$lib/db/types';
import { error, json, type RequestEvent, type RequestHandler } from '@sveltejs/kit';
import { POST as postHoleScore } from '../holes/+server';

type EditScoreBody = {
  action: 'edit_score';
  playerId: string;
  holeNumber: number;
  grossStrokes: number | null;
  conceded: boolean;
  pickedUp: boolean;
  reason: string;
};

type ForceCloseBody = {
  action: 'force_close';
  sideAPoints: number;
  sideBPoints: number;
  reason: string;
};

type MatchResultRow = {
  id: string;
  match_id: string;
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

function getDb(event: RequestEvent): D1Database {
  const db = event.platform?.env?.DB;
  if (!db) {
    throw error(500, 'Database binding is not configured.');
  }

  return db;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseReason(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length >= 5 ? normalized : null;
}

function parseEditScoreBody(
  payload: Record<string, unknown>,
  reason: string
): { body: EditScoreBody | null; message: string | null } {
  const playerId = payload.playerId;
  const holeNumber = payload.holeNumber;
  const grossStrokes = payload.grossStrokes;
  const conceded = payload.conceded;
  const pickedUp = payload.pickedUp;

  if (typeof playerId !== 'string' || playerId.trim().length === 0) {
    return { body: null, message: 'playerId must be a non-empty string.' };
  }

  if (!Number.isInteger(holeNumber) || holeNumber < 1 || holeNumber > 18) {
    return { body: null, message: 'holeNumber must be an integer between 1 and 18.' };
  }

  if (typeof conceded !== 'boolean') {
    return { body: null, message: 'conceded must be a boolean.' };
  }

  if (typeof pickedUp !== 'boolean') {
    return { body: null, message: 'pickedUp must be a boolean.' };
  }

  if (conceded && pickedUp) {
    return { body: null, message: 'conceded and pickedUp cannot both be true.' };
  }

  if (grossStrokes !== null && (!Number.isInteger(grossStrokes) || grossStrokes < 1 || grossStrokes > 15)) {
    return { body: null, message: 'grossStrokes must be an integer between 1 and 15 or null.' };
  }

  if (conceded || pickedUp) {
    if (grossStrokes !== null) {
      return { body: null, message: 'grossStrokes must be null when conceded or pickedUp is true.' };
    }
  } else if (grossStrokes === null) {
    return {
      body: null,
      message: 'grossStrokes is required when conceded and pickedUp are both false.'
    };
  }

  return {
    body: {
      action: 'edit_score',
      playerId: playerId.trim(),
      holeNumber,
      grossStrokes,
      conceded,
      pickedUp,
      reason
    },
    message: null
  };
}

function parseForceCloseBody(
  payload: Record<string, unknown>,
  reason: string
): { body: ForceCloseBody | null; message: string | null } {
  const sideAPoints = payload.sideAPoints;
  const sideBPoints = payload.sideBPoints;

  if (typeof sideAPoints !== 'number' || !Number.isFinite(sideAPoints) || sideAPoints < 0) {
    return { body: null, message: 'sideAPoints must be a non-negative number.' };
  }

  if (typeof sideBPoints !== 'number' || !Number.isFinite(sideBPoints) || sideBPoints < 0) {
    return { body: null, message: 'sideBPoints must be a non-negative number.' };
  }

  return {
    body: {
      action: 'force_close',
      sideAPoints,
      sideBPoints,
      reason
    },
    message: null
  };
}

async function getLatestMatchResult(db: D1Database, matchId: string): Promise<MatchResultRow | null> {
  const row = await db
    .prepare(
      `
        SELECT
          id,
          match_id,
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
        LIMIT 1
      `
    )
    .bind(matchId)
    .first<MatchResultRow>();

  return row
    ? {
        ...row,
        id: String(row.id),
        match_id: String(row.match_id),
        segment_id: String(row.segment_id)
      }
    : null;
}

function resolvePointsSegment(
  match: Match,
  segments: RoundSegment[],
  latestResult: MatchResultRow | null
): RoundSegment | null {
  if (latestResult) {
    const fromResult = segments.find((segment) => segment.id === latestResult.segment_id);
    if (fromResult) {
      return fromResult;
    }
  }

  if (match.format_override) {
    const matchingFormat = segments.filter((segment) => segment.format === match.format_override);
    if (matchingFormat.length === 1) {
      return matchingFormat[0];
    }
  }

  if (segments.length === 1) {
    return segments[0];
  }

  const overall = segments.find(
    (segment) => segment.segment_type === 'OVERALL' || segment.segment_type === 'FULL18'
  );
  return overall ?? null;
}

function isPointsTotalValid(expected: number, sideAPoints: number, sideBPoints: number): boolean {
  const epsilon = 1e-9;
  return Math.abs(sideAPoints + sideBPoints - expected) <= epsilon;
}

export const POST: RequestHandler = async (event) => {
  requireRole(event.locals, 'commissioner');

  const userId = event.locals.userId;
  if (!userId) {
    throw error(401, 'Unauthorized');
  }

  const db = getDb(event);
  const matchId = event.params.matchId;
  if (!matchId) {
    return json({ message: 'matchId route parameter is required.' }, { status: 400 });
  }

  let rawBody: unknown;
  try {
    rawBody = await event.request.json();
  } catch {
    return json({ message: 'Request body must be valid JSON.' }, { status: 400 });
  }

  if (!isRecord(rawBody)) {
    return json({ message: 'Request body must be a JSON object.' }, { status: 400 });
  }

  const reason = parseReason(rawBody.reason);
  if (!reason) {
    return json({ message: 'reason is required and must be at least 5 characters.' }, { status: 400 });
  }

  const action = rawBody.action;
  if (action !== 'edit_score' && action !== 'force_close') {
    return json({ message: 'Unknown action.' }, { status: 400 });
  }

  const match = await getMatchById(db, matchId);
  if (!match) {
    return json({ message: 'Match not found.' }, { status: 404 });
  }

  const round = await getRoundById(db, match.round_id);
  if (!round) {
    throw error(500, 'Match references a missing round.');
  }

  requireSameTournament(event.locals, round.tournament_id);

  if (action === 'edit_score') {
    const parsed = parseEditScoreBody(rawBody, reason);
    if (!parsed.body) {
      return json({ message: parsed.message ?? 'Invalid request body.' }, { status: 400 });
    }

    const beforeScore = await getHoleScore(db, match.id, parsed.body.playerId, parsed.body.holeNumber);
    const delegatedRequest = new Request(event.request.url, {
      method: 'POST',
      headers: new Headers({
        'content-type': 'application/json',
        'Idempotency-Key': crypto.randomUUID()
      }),
      body: JSON.stringify({
        playerId: parsed.body.playerId,
        holeNumber: parsed.body.holeNumber,
        grossStrokes: parsed.body.grossStrokes,
        conceded: parsed.body.conceded,
        pickedUp: parsed.body.pickedUp
      })
    });

    const delegatedResponse = await postHoleScore({
      ...event,
      request: delegatedRequest
    } as RequestEvent);

    const delegatedPayload: unknown = await delegatedResponse.json();

    if (!delegatedResponse.ok) {
      return json(delegatedPayload, { status: delegatedResponse.status });
    }

    const afterScore = isRecord(delegatedPayload) ? delegatedPayload.holeScore : null;

    await writeAuditEntry(db, {
      id: crypto.randomUUID(),
      tournament_id: round.tournament_id,
      actor_player_id: null,
      actor_email: userId,
      action: 'OVERRIDE_SCORE',
      entity_type: 'match',
      entity_id: match.id,
      old_value: beforeScore ? JSON.stringify(beforeScore) : null,
      new_value: JSON.stringify({
        score: afterScore,
        reason: parsed.body.reason
      })
    });

    return json(delegatedPayload);
  }

  const parsed = parseForceCloseBody(rawBody, reason);
  if (!parsed.body) {
    return json({ message: parsed.message ?? 'Invalid request body.' }, { status: 400 });
  }

  const segments = await listSegmentsByRound(db, round.id);
  if (segments.length === 0) {
    throw error(500, 'Round has no segments configured.');
  }

  const beforeResult = await getLatestMatchResult(db, match.id);
  const pointsSegment = resolvePointsSegment(match, segments, beforeResult);
  if (!pointsSegment) {
    throw error(500, 'Unable to determine points-at-stake segment for this match.');
  }

  if (!isPointsTotalValid(pointsSegment.points_available, parsed.body.sideAPoints, parsed.body.sideBPoints)) {
    return json(
      {
        message: `sideAPoints + sideBPoints must equal points at stake (${pointsSegment.points_available}).`
      },
      { status: 400 }
    );
  }

  await updateMatchStatus(db, match.id, 'FINAL', {
    segment_id: pointsSegment.id,
    side_a_holes_won: 0,
    side_b_holes_won: 0,
    halves: 0,
    close_notation: 'OVERRIDE',
    side_a_points: parsed.body.sideAPoints,
    side_b_points: parsed.body.sideBPoints
  });

  const matchResult = await getLatestMatchResult(db, match.id);
  if (!matchResult) {
    throw error(500, 'Forced match result could not be loaded.');
  }

  await writeAuditEntry(db, {
    id: crypto.randomUUID(),
    tournament_id: round.tournament_id,
    actor_player_id: null,
    actor_email: userId,
    action: 'FORCE_CLOSE',
    entity_type: 'match',
    entity_id: match.id,
    old_value: beforeResult ? JSON.stringify(beforeResult) : null,
    new_value: JSON.stringify({
      sideAPoints: parsed.body.sideAPoints,
      sideBPoints: parsed.body.sideBPoints,
      pointsAtStake: pointsSegment.points_available,
      closeNotation: 'OVERRIDE',
      reason: parsed.body.reason
    })
  });

  return json({
    matchResult
  });
};
