import { bulkCreatePlayers } from '$lib/db/players';
import { listTeamsByTournament } from '$lib/db/teams';
import { getCommissionerById } from '$lib/db/commissioners';
import { requireRole, requireSameTournament } from '$lib/auth/guards';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type BulkRowInput = {
  displayName?: unknown;
  handicapIndex?: unknown;
  teamId?: unknown;
  email?: unknown;
};

type BulkBody = {
  rows?: unknown;
};

type ValidatedBulkRow = {
  tournament_id: string;
  team_id: string | null;
  name: string;
  handicap_index: number;
};

type RowValidationError = {
  row: number;
  issues: string[];
};

function getDatabase(event: Parameters<RequestHandler>[0]): D1Database {
  const db = event.platform?.env?.DB;

  if (!db) {
    throw error(500, 'Database binding unavailable.');
  }

  return db;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
}

async function assertCommissionerTournamentOwnership(
  event: Parameters<RequestHandler>[0],
  db: D1Database,
  tournamentId: string
): Promise<void> {
  requireRole(event.locals, 'commissioner');
  requireSameTournament(event.locals, tournamentId);

  const userId = event.locals.userId;

  if (!userId) {
    throw error(403, 'Forbidden');
  }

  const row = await db
    .prepare(
      `
        SELECT *
        FROM tournaments
        WHERE id = ?1
        LIMIT 1
      `
    )
    .bind(tournamentId)
    .first<Record<string, unknown>>();

  if (!row) {
    throw error(404, 'Tournament not found.');
  }

  const commissionerUserId =
    typeof row.commissioner_user_id === 'string' ? row.commissioner_user_id : null;

  if (commissionerUserId !== null) {
    if (commissionerUserId !== userId) {
      throw error(403, 'Forbidden');
    }

    return;
  }

  if (typeof row.commissioner_email === 'string' && row.commissioner_email === userId) {
    return;
  }

  const commissioner = await getCommissionerById(db, userId);

  if (!commissioner || commissioner.tournament_id !== tournamentId) {
    throw error(403, 'Forbidden');
  }
}

async function parseBody(request: Request): Promise<BulkBody> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON body.');
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw error(400, 'Request body must be an object.');
  }

  return body as BulkBody;
}

function validateRow(
  row: BulkRowInput,
  rowNumber: number,
  tournamentId: string,
  teamIds: Set<string>
): { validated: ValidatedBulkRow | null; error: RowValidationError | null } {
  const issues: string[] = [];

  if (!isNonEmptyString(row.displayName)) {
    issues.push('`displayName` is required and must be a non-empty string.');
  }

  if (!isFiniteNumber(row.handicapIndex)) {
    issues.push('`handicapIndex` is required and must be a finite number.');
  }

  let teamId: string | null = null;

  if (row.teamId !== undefined && row.teamId !== null) {
    if (typeof row.teamId !== 'string') {
      issues.push('`teamId` must be a string when provided.');
    } else if (!teamIds.has(row.teamId)) {
      issues.push('`teamId` does not belong to the tournament.');
    } else {
      teamId = row.teamId;
    }
  }

  if (row.email !== undefined) {
    if (!isNonEmptyString(row.email) || !isValidEmail(row.email.trim())) {
      issues.push('`email` must be a valid email address when provided.');
    }
  }

  if (issues.length > 0) {
    return {
      validated: null,
      error: {
        row: rowNumber,
        issues
      }
    };
  }

  return {
    validated: {
      tournament_id: tournamentId,
      team_id: teamId,
      name: row.displayName.trim(),
      handicap_index: row.handicapIndex
    },
    error: null
  };
}

export const POST: RequestHandler = async (event) => {
  const db = getDatabase(event);
  const tournamentId = event.params.id;

  await assertCommissionerTournamentOwnership(event, db, tournamentId);

  const body = await parseBody(event.request);

  if (!Array.isArray(body.rows)) {
    throw error(400, '`rows` must be an array.');
  }

  if (body.rows.length === 0) {
    throw error(400, '`rows` must contain at least one player.');
  }

  const teams = await listTeamsByTournament(db, tournamentId);
  const teamIds = new Set(teams.map((team) => team.id));

  const validationErrors: RowValidationError[] = [];
  const validatedRows: ValidatedBulkRow[] = [];

  body.rows.forEach((rawRow, index) => {
    const rowNumber = index + 1;

    if (!rawRow || typeof rawRow !== 'object' || Array.isArray(rawRow)) {
      validationErrors.push({
        row: rowNumber,
        issues: ['Row must be an object.']
      });
      return;
    }

    const { validated, error: validationError } = validateRow(
      rawRow as BulkRowInput,
      rowNumber,
      tournamentId,
      teamIds
    );

    if (validationError) {
      validationErrors.push(validationError);
      return;
    }

    if (validated) {
      validatedRows.push(validated);
    }
  });

  if (validationErrors.length > 0) {
    return json(
      {
        message: 'Validation failed for one or more rows.',
        errors: validationErrors
      },
      { status: 400 }
    );
  }

  const players = await bulkCreatePlayers(db, validatedRows);

  return json({ players }, { status: 201 });
};
