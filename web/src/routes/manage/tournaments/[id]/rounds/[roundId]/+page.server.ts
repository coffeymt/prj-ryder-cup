import { requireRole, requireSameTournament } from '$lib/auth/guards';
import { listCourses, listTeesByCourse } from '$lib/db/courses';
import { getTournamentById } from '$lib/db/tournaments';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

type RoundStatus = 'draft' | 'inProgress' | 'complete';
type MatchStatus = 'PENDING' | 'IN_PROGRESS' | 'FINAL';

type RoundPayload = {
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
    segment: 'F9' | 'B9' | '18';
    format: 'Scramble' | 'Pinehurst' | 'Shamble' | 'FourBall' | 'Singles';
    allowanceConfig: unknown;
    pointsAtStake: number;
    order: number;
  }>;
};

type MatchPayload = {
  id: string;
  roundId: string;
  matchNumber: number;
  segment: 'F9' | 'B9' | '18' | null;
  format: 'Scramble' | 'Pinehurst' | 'Shamble' | 'FourBall' | 'Singles' | null;
  status: MatchStatus;
  pointsAtStake: number | null;
  sides: Array<{
    id: string;
    teamId: string;
    sideLabel: 'A' | 'B';
    players: Array<{ id: string; name: string; teamId: string | null; handicapIndex: number }>;
  }>;
};

type MatchesPayload = {
  matches: MatchPayload[];
};

function getDb(platform: App.Platform | undefined): D1Database {
  const db = platform?.env.DB;

  if (!db) {
    throw error(500, 'Database binding is not configured.');
  }

  return db;
}

function normalizeString(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toActionFailureStatus(status: number): number {
  return status >= 400 && status < 600 ? status : 500;
}

function requireCommissionerAccess(locals: App.Locals, tournamentId: string): void {
  requireRole(locals, 'commissioner');
  requireSameTournament(locals, tournamentId);
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

async function loadRoundData(event: Parameters<PageServerLoad>[0]): Promise<{
  round: RoundPayload;
  matches: MatchPayload[];
}> {
  const roundResponse = await event.fetch(
    `/api/tournaments/${encodeURIComponent(event.params.id)}/rounds/${encodeURIComponent(event.params.roundId)}`
  );

  if (!roundResponse.ok) {
    throw error(roundResponse.status, await parseApiErrorMessage(roundResponse));
  }

  const round = (await roundResponse.json()) as RoundPayload;

  const matchesResponse = await event.fetch(
    `/api/tournaments/${encodeURIComponent(event.params.id)}/rounds/${encodeURIComponent(event.params.roundId)}/matches`
  );

  if (!matchesResponse.ok) {
    throw error(matchesResponse.status, await parseApiErrorMessage(matchesResponse));
  }

  const matchesPayload = (await matchesResponse.json()) as MatchesPayload;

  return {
    round,
    matches: matchesPayload.matches,
  };
}

export const load: PageServerLoad = async (event) => {
  requireCommissionerAccess(event.locals, event.params.id);

  const db = getDb(event.platform);
  const tournament = await getTournamentById(db, event.params.id);

  if (!tournament) {
    throw error(404, 'Tournament not found.');
  }

  const { round, matches } = await loadRoundData(event);
  const courses = await listCourses(db);
  const course = courses.find((entry) => entry.id === round.courseId) ?? null;
  const tees = course ? await listTeesByCourse(db, course.id) : [];
  const tee = tees.find((entry) => entry.id === round.teeId) ?? null;

  return {
    tournament,
    round,
    courseName: course?.name ?? 'Unknown course',
    teeName: tee?.name ?? 'Unknown tee',
    matches,
  };
};

export const actions: Actions = {
  updateRound: async (event) => {
    requireCommissionerAccess(event.locals, event.params.id);

    const formData = await event.request.formData();
    const name = normalizeString(formData.get('name'));
    const dateTime = normalizeString(formData.get('dateTime'));

    if (!name) {
      return fail(400, {
        action: 'updateRound',
        error: 'Round name is required.',
      });
    }

    if (!dateTime || Number.isNaN(Date.parse(dateTime))) {
      return fail(400, {
        action: 'updateRound',
        error: 'Valid round date/time is required.',
      });
    }

    const response = await event.fetch(
      `/api/tournaments/${encodeURIComponent(event.params.id)}/rounds/${encodeURIComponent(event.params.roundId)}`,
      {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name,
          dateTime,
        }),
      }
    );

    if (!response.ok) {
      return fail(toActionFailureStatus(response.status), {
        action: 'updateRound',
        error: await parseApiErrorMessage(response),
      });
    }

    return {
      action: 'updateRound',
      success: 'Round details updated.',
    };
  },

  closeMatch: async (event) => {
    requireCommissionerAccess(event.locals, event.params.id);

    const roundResponse = await event.fetch(
      `/api/tournaments/${encodeURIComponent(event.params.id)}/rounds/${encodeURIComponent(event.params.roundId)}`
    );

    if (!roundResponse.ok) {
      return fail(toActionFailureStatus(roundResponse.status), {
        action: 'closeMatch',
        error: await parseApiErrorMessage(roundResponse),
      });
    }

    const round = (await roundResponse.json()) as RoundPayload;

    if (round.status === 'draft') {
      return fail(400, {
        action: 'closeMatch',
        error: 'Matches can only be force-closed once the round is in progress or complete.',
      });
    }

    const formData = await event.request.formData();
    const matchId = normalizeString(formData.get('matchId'));
    const sideAPoints = Number(normalizeString(formData.get('sideAPoints')));
    const sideBPoints = Number(normalizeString(formData.get('sideBPoints')));
    const reason = normalizeString(formData.get('reason'));

    if (!matchId) {
      return fail(400, {
        action: 'closeMatch',
        error: 'Match id is required.',
      });
    }

    if (!Number.isFinite(sideAPoints) || sideAPoints < 0) {
      return fail(400, {
        action: 'closeMatch',
        matchId,
        error: 'Side A points must be a non-negative number.',
      });
    }

    if (!Number.isFinite(sideBPoints) || sideBPoints < 0) {
      return fail(400, {
        action: 'closeMatch',
        matchId,
        error: 'Side B points must be a non-negative number.',
      });
    }

    if (reason.length < 5) {
      return fail(400, {
        action: 'closeMatch',
        matchId,
        error: 'Reason must be at least 5 characters.',
      });
    }

    const response = await event.fetch(`/api/matches/${encodeURIComponent(matchId)}/override`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        action: 'force_close',
        sideAPoints,
        sideBPoints,
        reason,
      }),
    });

    if (!response.ok) {
      return fail(toActionFailureStatus(response.status), {
        action: 'closeMatch',
        matchId,
        error: await parseApiErrorMessage(response),
      });
    }

    return {
      action: 'closeMatch',
      matchId,
      success: 'Match was manually closed.',
    };
  },
};
