import { requireRole, requireSameTournament } from '$lib/auth/guards';
import { writeAuditEntry } from '$lib/db/auditLog';
import { getTeamById } from '$lib/db/teams';
import { getTournamentById } from '$lib/db/tournaments';
import { error, json, type RequestHandler } from '@sveltejs/kit';

type PointsAdjustBody = {
  teamId: string;
  delta: number;
  reason: string;
};

function getDb(event: Parameters<RequestHandler>[0]): D1Database {
  const db = event.platform?.env?.DB;
  if (!db) {
    throw error(500, 'Database binding is not configured.');
  }

  return db;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseBody(value: unknown): { body: PointsAdjustBody | null; message: string | null } {
  if (!isRecord(value)) {
    return { body: null, message: 'Request body must be a JSON object.' };
  }

  const teamId = value.teamId;
  const delta = value.delta;
  const reason = value.reason;

  if (typeof teamId !== 'string' || teamId.trim().length === 0) {
    return { body: null, message: 'teamId must be a non-empty string.' };
  }

  if (typeof delta !== 'number' || !Number.isFinite(delta)) {
    return { body: null, message: 'delta must be a finite number.' };
  }

  if (typeof reason !== 'string' || reason.trim().length < 5) {
    return { body: null, message: 'reason is required and must be at least 5 characters.' };
  }

  return {
    body: {
      teamId: teamId.trim(),
      delta,
      reason: reason.trim(),
    },
    message: null,
  };
}

export const POST: RequestHandler = async (event) => {
  requireRole(event.locals, 'commissioner');

  const userId = event.locals.userId;
  if (!userId) {
    throw error(401, 'Unauthorized');
  }

  const tournamentId = event.params.id;
  if (!tournamentId) {
    return json({ message: 'Tournament id is required.' }, { status: 400 });
  }

  requireSameTournament(event.locals, tournamentId);

  const db = getDb(event);
  const tournament = await getTournamentById(db, tournamentId);
  if (!tournament) {
    return json({ message: 'Tournament not found.' }, { status: 404 });
  }

  let rawBody: unknown;
  try {
    rawBody = await event.request.json();
  } catch {
    return json({ message: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const parsed = parseBody(rawBody);
  if (!parsed.body) {
    return json({ message: parsed.message ?? 'Invalid request body.' }, { status: 400 });
  }

  const team = await getTeamById(db, parsed.body.teamId);
  if (!team || team.tournament_id !== tournament.id) {
    return json({ message: 'teamId must belong to the current tournament.' }, { status: 400 });
  }

  const auditEntry = await writeAuditEntry(db, {
    id: crypto.randomUUID(),
    tournament_id: tournament.id,
    actor_player_id: null,
    actor_email: userId,
    action: 'POINTS_ADJUST',
    entity_type: 'team',
    entity_id: parsed.body.teamId,
    old_value: null,
    new_value: JSON.stringify({
      teamId: parsed.body.teamId,
      delta: parsed.body.delta,
      reason: parsed.body.reason,
    }),
  });

  return json({
    teamId: parsed.body.teamId,
    delta: parsed.body.delta,
    reason: parsed.body.reason,
    appliedAt: auditEntry.created_at,
  });
};
