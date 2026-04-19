import { requireRole, requireSameTournament } from '$lib/auth/guards';
import { listPlayersByTournament } from '$lib/db/players';
import { listTeamsByTournament } from '$lib/db/teams';
import { getTournamentById } from '$lib/db/tournaments';
import { error, fail, type RequestEvent } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

type TeamFormValues = {
  name: string;
  color: string;
  captainPlayerId: string;
};

const HEX_COLOR_PATTERN = /^#[\dA-Fa-f]{6}$/u;

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

function normalizeColor(value: FormDataEntryValue | null): string {
  const normalized = normalizeString(value);
  return normalized.toUpperCase();
}

function isValidHexColor(value: string): boolean {
  return HEX_COLOR_PATTERN.test(value);
}

function toActionFailureStatus(responseStatus: number): number {
  return responseStatus >= 400 && responseStatus < 600 ? responseStatus : 500;
}

function requireCommissionerAccess(event: RequestEvent, tournamentId: string): void {
  requireRole(event.locals, 'commissioner');
  requireSameTournament(event.locals, tournamentId);
}

async function parseApiErrorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);

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
  createTeam: async (event) => {
    const tournamentId = event.params.id;
    requireCommissionerAccess(event, tournamentId);

    const formData = await event.request.formData();
    const name = normalizeString(formData.get('name'));
    const color = normalizeColor(formData.get('color'));
    const values: TeamFormValues = {
      name,
      color,
      captainPlayerId: '',
    };

    if (!name) {
      return fail(400, {
        action: 'createTeam',
        error: 'Team name is required.',
        values,
      });
    }

    if (!isValidHexColor(color)) {
      return fail(400, {
        action: 'createTeam',
        error: 'Team color must be a valid hex value like #0055AA.',
        values,
      });
    }

    const response = await event.fetch(
      `/api/tournaments/${encodeURIComponent(tournamentId)}/teams`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name,
          color,
        }),
      }
    );

    if (!response.ok) {
      return fail(toActionFailureStatus(response.status), {
        action: 'createTeam',
        error: await parseApiErrorMessage(response),
        values,
      });
    }

    return {
      action: 'createTeam',
      success: 'Team created.',
    };
  },

  updateTeam: async (event) => {
    const tournamentId = event.params.id;
    requireCommissionerAccess(event, tournamentId);

    const formData = await event.request.formData();
    const teamId = normalizeString(formData.get('teamId'));
    const name = normalizeString(formData.get('name'));
    const color = normalizeColor(formData.get('color'));
    const captainPlayerIdRaw = normalizeString(formData.get('captainPlayerId'));
    const values: TeamFormValues = {
      name,
      color,
      captainPlayerId: captainPlayerIdRaw,
    };

    if (!teamId) {
      return fail(400, {
        action: 'updateTeam',
        teamId,
        error: 'Team id is required.',
        values,
      });
    }

    if (!name) {
      return fail(400, {
        action: 'updateTeam',
        teamId,
        error: 'Team name is required.',
        values,
      });
    }

    if (!isValidHexColor(color)) {
      return fail(400, {
        action: 'updateTeam',
        teamId,
        error: 'Team color must be a valid hex value like #0055AA.',
        values,
      });
    }

    const captainPlayerId = captainPlayerIdRaw.length > 0 ? captainPlayerIdRaw : null;
    const response = await event.fetch(
      `/api/tournaments/${encodeURIComponent(tournamentId)}/teams/${encodeURIComponent(teamId)}`,
      {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name,
          color,
          captain_player_id: captainPlayerId,
        }),
      }
    );

    if (!response.ok) {
      return fail(toActionFailureStatus(response.status), {
        action: 'updateTeam',
        teamId,
        error: await parseApiErrorMessage(response),
        values,
      });
    }

    return {
      action: 'updateTeam',
      teamId,
      success: 'Team updated.',
    };
  },

  deleteTeam: async (event) => {
    const tournamentId = event.params.id;
    requireCommissionerAccess(event, tournamentId);

    const formData = await event.request.formData();
    const teamId = normalizeString(formData.get('teamId'));

    if (!teamId) {
      return fail(400, {
        action: 'deleteTeam',
        teamId,
        error: 'Team id is required.',
      });
    }

    const response = await event.fetch(
      `/api/tournaments/${encodeURIComponent(tournamentId)}/teams/${encodeURIComponent(teamId)}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      return fail(toActionFailureStatus(response.status), {
        action: 'deleteTeam',
        teamId,
        error: await parseApiErrorMessage(response),
      });
    }

    return {
      action: 'deleteTeam',
      teamId,
      success: 'Team deleted.',
    };
  },
};
