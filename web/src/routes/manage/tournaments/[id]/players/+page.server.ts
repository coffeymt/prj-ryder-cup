import { requireRole, requireSameTournament } from '$lib/auth/guards';
import { listPlayersByTournament } from '$lib/db/players';
import { listTeamsByTournament } from '$lib/db/teams';
import { getTournamentById } from '$lib/db/tournaments';
import { error, fail, type RequestEvent } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

type PlayerFormValues = {
  displayName: string;
  handicapIndex: string;
  teamId: string;
  email: string;
  isCaptain: string;
};

type BulkFormValues = {
  csvText: string;
};

type BulkRowPayload = {
  displayName: string;
  handicapIndex: number;
  email?: string;
};

type BulkRowError = {
  row: number;
  issues: string[];
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

function getDatabaseBinding(platform: App.Platform | undefined): D1Database {
  const db = platform?.env.DB;

  if (!db) {
    throw error(500, 'Database binding is not configured.');
  }

  return db;
}

function normalizeString(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBooleanString(value: FormDataEntryValue | null): string {
  return normalizeString(value).toLowerCase();
}

function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value);
}

function toActionFailureStatus(responseStatus: number): number {
  return responseStatus >= 400 && responseStatus < 600 ? responseStatus : 500;
}

function requireCommissionerAccess(event: RequestEvent, tournamentId: string): void {
  requireRole(event.locals, 'commissioner');
  requireSameTournament(event.locals, tournamentId);
}

async function parseApiErrorMessage(response: Response): Promise<string> {
  let body: unknown = null;

  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const message = (body as Record<string, unknown>).message;
    const errorMessage = (body as Record<string, unknown>).error;

    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }

    if (typeof errorMessage === 'string' && errorMessage.trim().length > 0) {
      return errorMessage;
    }
  }

  return response.statusText || 'Request failed.';
}

async function parseApiBulkErrors(response: Response): Promise<BulkRowError[]> {
  let body: unknown = null;

  try {
    body = await response.json();
  } catch {
    return [];
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return [];
  }

  const errors = (body as Record<string, unknown>).errors;

  if (!Array.isArray(errors)) {
    return [];
  }

  return errors.flatMap((entry): BulkRowError[] => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return [];
    }

    const row = Number((entry as Record<string, unknown>).row);
    const issues = (entry as Record<string, unknown>).issues;

    if (!Number.isInteger(row) || !Array.isArray(issues)) {
      return [];
    }

    const normalizedIssues = issues.filter((issue): issue is string => typeof issue === 'string');

    if (normalizedIssues.length === 0) {
      return [];
    }

    return [
      {
        row,
        issues: normalizedIssues,
      },
    ];
  });
}

function parseBulkCsvRows(csvText: string): { rows: BulkRowPayload[]; errors: BulkRowError[] } {
  const lines = csvText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const rows: BulkRowPayload[] = [];
  const errors: BulkRowError[] = [];

  lines.forEach((line, index) => {
    const rowNumber = index + 1;
    const rawCells = line.split(',').map((cell) => cell.trim());
    const issues: string[] = [];

    if (rawCells.length < 2 || rawCells.length > 3) {
      errors.push({
        row: rowNumber,
        issues: ['Expected format: Name, HandicapIndex, Email(optional).'],
      });
      return;
    }

    const [displayName, handicapRaw, emailRaw = ''] = rawCells;

    if (!displayName) {
      issues.push('Name is required.');
    }

    const handicapIndex = Number(handicapRaw);

    if (handicapRaw.length === 0 || !Number.isFinite(handicapIndex)) {
      issues.push('Handicap index must be a finite number.');
    }

    if (emailRaw.length > 0 && !isValidEmail(emailRaw)) {
      issues.push('Email must be valid when provided.');
    }

    if (issues.length > 0) {
      errors.push({
        row: rowNumber,
        issues,
      });
      return;
    }

    rows.push({
      displayName,
      handicapIndex,
      ...(emailRaw ? { email: emailRaw } : {}),
    });
  });

  return { rows, errors };
}

export const load: PageServerLoad = async (event) => {
  const tournamentId = event.params.id;
  requireCommissionerAccess(event, tournamentId);

  const db = getDatabaseBinding(event.platform);
  const [tournament, teams, players] = await Promise.all([
    getTournamentById(db, tournamentId),
    listTeamsByTournament(db, tournamentId),
    listPlayersByTournament(db, tournamentId),
  ]);

  if (!tournament) {
    throw error(404, 'Tournament not found.');
  }

  return {
    tournament,
    teams,
    players,
  };
};

export const actions: Actions = {
  createPlayer: async (event) => {
    const tournamentId = event.params.id;
    requireCommissionerAccess(event, tournamentId);

    const formData = await event.request.formData();
    const displayName = normalizeString(formData.get('displayName'));
    const handicapIndexRaw = normalizeString(formData.get('handicapIndex'));
    const teamIdRaw = normalizeString(formData.get('teamId'));
    const emailRaw = normalizeString(formData.get('email'));
    const values: PlayerFormValues = {
      displayName,
      handicapIndex: handicapIndexRaw,
      teamId: teamIdRaw,
      email: emailRaw,
      isCaptain: '',
    };

    if (!displayName) {
      return fail(400, {
        action: 'createPlayer',
        error: 'Player name is required.',
        values,
      });
    }

    const handicapIndex = Number(handicapIndexRaw);

    if (handicapIndexRaw.length === 0 || !Number.isFinite(handicapIndex)) {
      return fail(400, {
        action: 'createPlayer',
        error: 'Handicap index must be a finite number.',
        values,
      });
    }

    if (emailRaw.length > 0 && !isValidEmail(emailRaw)) {
      return fail(400, {
        action: 'createPlayer',
        error: 'Email must be valid when provided.',
        values,
      });
    }

    const response = await event.fetch(`/api/tournaments/${encodeURIComponent(tournamentId)}/players`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        displayName,
        handicapIndex,
        teamId: teamIdRaw.length > 0 ? teamIdRaw : null,
        ...(emailRaw.length > 0 ? { email: emailRaw } : {}),
      }),
    });

    if (!response.ok) {
      return fail(toActionFailureStatus(response.status), {
        action: 'createPlayer',
        error: await parseApiErrorMessage(response),
        values,
      });
    }

    return {
      action: 'createPlayer',
      success: 'Player created.',
    };
  },

  bulkImport: async (event) => {
    const tournamentId = event.params.id;
    requireCommissionerAccess(event, tournamentId);

    const formData = await event.request.formData();
    const csvText = normalizeString(formData.get('csvText'));
    const values: BulkFormValues = { csvText };

    if (!csvText) {
      return fail(400, {
        action: 'bulkImport',
        error: 'Paste at least one CSV row to import.',
        values,
      });
    }

    const { rows, errors: parseErrors } = parseBulkCsvRows(csvText);

    if (parseErrors.length > 0) {
      return fail(400, {
        action: 'bulkImport',
        error: 'One or more rows are invalid.',
        bulkErrors: parseErrors,
        values,
      });
    }

    if (rows.length === 0) {
      return fail(400, {
        action: 'bulkImport',
        error: 'No valid rows were found in the pasted CSV.',
        values,
      });
    }

    const response = await event.fetch(
      `/api/tournaments/${encodeURIComponent(tournamentId)}/players/bulk`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ rows }),
      }
    );

    if (!response.ok) {
      const bulkErrors = await parseApiBulkErrors(response.clone());
      return fail(toActionFailureStatus(response.status), {
        action: 'bulkImport',
        error: await parseApiErrorMessage(response),
        bulkErrors,
        values,
      });
    }

    let importedCount = rows.length;

    try {
      const payload = (await response.json()) as { players?: unknown };

      if (Array.isArray(payload.players)) {
        importedCount = payload.players.length;
      }
    } catch {
      importedCount = rows.length;
    }

    return {
      action: 'bulkImport',
      success: `Imported ${importedCount} players.`,
      importedCount,
    };
  },

  updatePlayer: async (event) => {
    const tournamentId = event.params.id;
    requireCommissionerAccess(event, tournamentId);

    const formData = await event.request.formData();
    const playerId = normalizeString(formData.get('playerId'));

    if (!playerId) {
      return fail(400, {
        action: 'updatePlayer',
        playerId,
        error: 'Player id is required.',
      });
    }

    const updates: Record<string, unknown> = {};
    const values: PlayerFormValues = {
      displayName: '',
      handicapIndex: '',
      teamId: '',
      email: '',
      isCaptain: '',
    };

    if (formData.has('displayName')) {
      const displayName = normalizeString(formData.get('displayName'));
      values.displayName = displayName;

      if (!displayName) {
        return fail(400, {
          action: 'updatePlayer',
          playerId,
          error: 'Player name is required when editing.',
          values,
        });
      }

      updates.displayName = displayName;
    }

    if (formData.has('handicapIndex')) {
      const handicapIndexRaw = normalizeString(formData.get('handicapIndex'));
      values.handicapIndex = handicapIndexRaw;
      const handicapIndex = Number(handicapIndexRaw);

      if (handicapIndexRaw.length === 0 || !Number.isFinite(handicapIndex)) {
        return fail(400, {
          action: 'updatePlayer',
          playerId,
          error: 'Handicap index must be a finite number.',
          values,
        });
      }

      updates.handicapIndex = handicapIndex;
    }

    if (formData.has('teamId')) {
      const teamIdRaw = normalizeString(formData.get('teamId'));
      values.teamId = teamIdRaw;
      updates.teamId = teamIdRaw.length > 0 ? teamIdRaw : null;
    }

    if (formData.has('email')) {
      const emailRaw = normalizeString(formData.get('email'));
      values.email = emailRaw;

      if (emailRaw.length > 0 && !isValidEmail(emailRaw)) {
        return fail(400, {
          action: 'updatePlayer',
          playerId,
          error: 'Email must be valid when provided.',
          values,
        });
      }

      if (emailRaw.length > 0) {
        updates.email = emailRaw;
      }
    }

    if (formData.has('isCaptain')) {
      const captainRaw = normalizeBooleanString(formData.get('isCaptain'));
      values.isCaptain = captainRaw;

      if (captainRaw !== 'true' && captainRaw !== 'false') {
        return fail(400, {
          action: 'updatePlayer',
          playerId,
          error: 'Captain value must be true or false.',
          values,
        });
      }

      updates.isCaptain = captainRaw === 'true';
    }

    if (Object.keys(updates).length === 0) {
      return fail(400, {
        action: 'updatePlayer',
        playerId,
        error: 'No changes were submitted.',
      });
    }

    const response = await event.fetch(
      `/api/tournaments/${encodeURIComponent(tournamentId)}/players/${encodeURIComponent(playerId)}`,
      {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(updates),
      }
    );

    if (!response.ok) {
      return fail(toActionFailureStatus(response.status), {
        action: 'updatePlayer',
        playerId,
        error: await parseApiErrorMessage(response),
        values,
      });
    }

    return {
      action: 'updatePlayer',
      playerId,
      success: 'Player updated.',
    };
  },

  deletePlayer: async (event) => {
    const tournamentId = event.params.id;
    requireCommissionerAccess(event, tournamentId);

    const formData = await event.request.formData();
    const playerId = normalizeString(formData.get('playerId'));

    if (!playerId) {
      return fail(400, {
        action: 'deletePlayer',
        playerId,
        error: 'Player id is required.',
      });
    }

    const response = await event.fetch(
      `/api/tournaments/${encodeURIComponent(tournamentId)}/players/${encodeURIComponent(playerId)}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      return fail(toActionFailureStatus(response.status), {
        action: 'deletePlayer',
        playerId,
        error: await parseApiErrorMessage(response),
      });
    }

    return {
      action: 'deletePlayer',
      playerId,
      success: 'Player deleted.',
    };
  },
};
