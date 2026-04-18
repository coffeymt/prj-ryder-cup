import { requireRole } from '$lib/auth/guards';
import { listAuditByTournament } from '$lib/db/auditLog';
import { listPlayersByTournament } from '$lib/db/players';
import { getTournamentById } from '$lib/db/tournaments';
import type { AuditLog } from '$lib/db/types';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

type ParsedAuditEntry = {
  id: string;
  createdAt: string;
  action: string;
  actionLabel: string;
  actor: string;
  details: string;
  reason: string | null;
};

const ACTION_LABELS: Record<string, string> = {
  OVERRIDE_SCORE: 'Edit Hole Score',
  FORCE_CLOSE: 'Force Close Match',
  POINTS_ADJUST: 'Manual Points Adjustment'
};

function getDb(platform: App.Platform | undefined): D1Database {
  const db = platform?.env.DB;

  if (!db) {
    throw error(500, 'Database binding is not configured.');
  }

  return db;
}

async function requireOwnedTournament(
  event: Parameters<PageServerLoad>[0]
): Promise<{ db: D1Database; tournamentId: string; userId: string }> {
  try {
    requireRole(event.locals, 'commissioner');
  } catch {
    throw redirect(302, '/manage/login');
  }

  const userId = event.locals.userId;

  if (!userId) {
    throw redirect(302, '/manage/login');
  }

  const tournamentId = event.params.id;

  if (!tournamentId) {
    throw error(400, 'Tournament id is required.');
  }

  const db = getDb(event.platform);
  const tournament = await getTournamentById(db, tournamentId);

  if (!tournament) {
    throw error(404, 'Tournament not found.');
  }

  if (tournament.commissioner_email !== userId) {
    throw error(403, 'Forbidden');
  }

  return { db, tournamentId, userId };
}

function toActionLabel(action: string): string {
  if (ACTION_LABELS[action]) {
    return ACTION_LABELS[action];
  }

  return action
    .toLowerCase()
    .split('_')
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function parseJsonObject(raw: string | null): Record<string, unknown> | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

function formatDetailValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value === null) {
    return 'null';
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function extractReason(payload: Record<string, unknown> | null): string | null {
  if (!payload) {
    return null;
  }

  const reason = payload.reason;
  return typeof reason === 'string' && reason.trim().length > 0 ? reason : null;
}

function extractDetails(entry: AuditLog, payload: Record<string, unknown> | null): string {
  if (payload) {
    const detailPairs = Object.entries(payload).filter(([key]) => key !== 'reason');

    if (detailPairs.length > 0) {
      return detailPairs.map(([key, value]) => `${key}: ${formatDetailValue(value)}`).join(' | ');
    }
  }

  if (entry.new_value) {
    return entry.new_value;
  }

  if (entry.old_value) {
    return `Previous: ${entry.old_value}`;
  }

  return `${entry.entity_type} ${entry.entity_id}`;
}

function resolveActor(entry: AuditLog, playerNamesById: Map<string, string>): string {
  if (entry.actor_player_id) {
    return playerNamesById.get(entry.actor_player_id) ?? `Player ${entry.actor_player_id}`;
  }

  if (entry.actor_email) {
    return `Commissioner (${entry.actor_email})`;
  }

  return 'System';
}

export const load: PageServerLoad = async (event) => {
  const { db, tournamentId } = await requireOwnedTournament(event);

  const [tournament, entries, players] = await Promise.all([
    getTournamentById(db, tournamentId),
    listAuditByTournament(db, tournamentId),
    listPlayersByTournament(db, tournamentId)
  ]);

  if (!tournament) {
    throw error(404, 'Tournament not found.');
  }

  const playerNamesById = new Map(players.map((player) => [player.id, player.name]));
  const parsedEntries: ParsedAuditEntry[] = entries.map((entry) => {
    const payload = parseJsonObject(entry.new_value);

    return {
      id: entry.id,
      createdAt: entry.created_at,
      action: entry.action,
      actionLabel: toActionLabel(entry.action),
      actor: resolveActor(entry, playerNamesById),
      details: extractDetails(entry, payload),
      reason: extractReason(payload)
    };
  });

  const actionOptions = Array.from(
    new Map(parsedEntries.map((entry) => [entry.action, entry.actionLabel])).entries()
  )
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label));

  return {
    tournament,
    entries: parsedEntries,
    actionOptions
  };
};
