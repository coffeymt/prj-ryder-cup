import { requireRole, requireSameTournament } from '$lib/auth/guards';
import { listCourses, listTeesByCourse } from '$lib/db/courses';
import { listPlayersByTournament } from '$lib/db/players';
import { listRoundsByTournament, listSegmentsByRound } from '$lib/db/rounds';
import { listTeamsByTournament } from '$lib/db/teams';
import { getTournamentById } from '$lib/db/tournaments';
import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

type ApiSegment = 'F9' | 'B9' | '18';
type ApiFormat = 'Scramble' | 'Pinehurst' | 'Shamble' | 'FourBall' | 'Singles';

type SegmentFormValue = {
  segment: ApiSegment;
  format: ApiFormat;
  pointsAtStake: number;
  allowanceOverride: number | null;
  order: number;
};

type MatchupFormValue = {
  id: string;
  sideAPlayerIds: string[];
  sideBPlayerIds: string[];
};

type FormValues = {
  roundName: string;
  courseId: string;
  teeId: string;
  dateTime: string;
  segmentsJson: string;
  matchupsJson: string;
};

const SEGMENTS = new Set<ApiSegment>(['F9', 'B9', '18']);
const FORMATS = new Set<ApiFormat>(['Scramble', 'Pinehurst', 'Shamble', 'FourBall', 'Singles']);

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

function toTargetPoints(pointsToWin: number): number {
  return Number((pointsToWin * 2 - 1).toFixed(1));
}

function toActionFailureStatus(status: number): number {
  return status >= 400 && status < 600 ? status : 500;
}

function toSegmentAllowance(
  format: ApiFormat,
  allowanceOverride: number | null
): { allowanceConfig?: unknown } {
  if (allowanceOverride === null) {
    return {};
  }

  if (format === 'Scramble' || format === 'Pinehurst') {
    return {
      allowanceConfig: {
        lowPct: allowanceOverride,
        highPct: allowanceOverride,
      },
    };
  }

  return {
    allowanceConfig: {
      perPlayerPct: allowanceOverride,
    },
  };
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

function parseJsonField<T>(rawValue: string, fieldName: string): T {
  try {
    return JSON.parse(rawValue) as T;
  } catch {
    throw error(400, `${fieldName} is invalid.`);
  }
}

function normalizePlayerIds(playerIds: unknown, fieldName: string): string[] {
  if (!Array.isArray(playerIds)) {
    throw error(400, `${fieldName} must be an array.`);
  }

  const unique = new Set<string>();
  const normalized: string[] = [];

  for (const [index, rawPlayerId] of playerIds.entries()) {
    if (typeof rawPlayerId !== 'string' || rawPlayerId.trim().length === 0) {
      throw error(400, `${fieldName}[${index}] must be a non-empty string.`);
    }

    const playerId = rawPlayerId.trim();

    if (unique.has(playerId)) {
      continue;
    }

    unique.add(playerId);
    normalized.push(playerId);
  }

  if (normalized.length === 0) {
    throw error(400, `${fieldName} must include at least one player.`);
  }

  if (normalized.length > 2) {
    throw error(400, `${fieldName} cannot include more than two players.`);
  }

  return normalized;
}

function parseSegments(rawValue: string): SegmentFormValue[] {
  const segments = parseJsonField<unknown>(rawValue, 'segments');

  if (!Array.isArray(segments) || segments.length === 0) {
    throw error(400, 'At least one segment is required.');
  }

  const parsed = segments.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw error(400, `segments[${index}] must be an object.`);
    }

    const row = entry as Record<string, unknown>;
    const segment = row.segment;
    const format = row.format;
    const pointsAtStake = row.pointsAtStake;
    const allowanceOverride = row.allowanceOverride;
    const order = row.order;

    if (typeof segment !== 'string' || !SEGMENTS.has(segment as ApiSegment)) {
      throw error(400, `segments[${index}].segment is invalid.`);
    }

    if (typeof format !== 'string' || !FORMATS.has(format as ApiFormat)) {
      throw error(400, `segments[${index}].format is invalid.`);
    }

    if (
      typeof pointsAtStake !== 'number' ||
      !Number.isFinite(pointsAtStake) ||
      pointsAtStake <= 0
    ) {
      throw error(400, `segments[${index}].pointsAtStake must be a positive number.`);
    }

    if (typeof order !== 'number' || !Number.isInteger(order) || order <= 0) {
      throw error(400, `segments[${index}].order must be a positive integer.`);
    }

    let normalizedOverride: number | null = null;

    if (allowanceOverride !== null && allowanceOverride !== undefined) {
      if (
        typeof allowanceOverride !== 'number' ||
        !Number.isFinite(allowanceOverride) ||
        allowanceOverride < 0 ||
        allowanceOverride > 150
      ) {
        throw error(400, `segments[${index}].allowanceOverride must be between 0 and 150.`);
      }

      normalizedOverride = allowanceOverride;
    }

    return {
      segment: segment as ApiSegment,
      format: format as ApiFormat,
      pointsAtStake,
      allowanceOverride: normalizedOverride,
      order,
    };
  });

  const uniqueSegments = new Set(parsed.map((segment) => segment.segment));
  const uniqueOrder = new Set(parsed.map((segment) => segment.order));

  if (uniqueSegments.size !== parsed.length || uniqueOrder.size !== parsed.length) {
    throw error(400, 'Segment configuration includes duplicate entries.');
  }

  const sorted = [...parsed].sort((left, right) => left.order - right.order);
  const signature = sorted.map((segment) => segment.segment).join('|');

  if (signature !== '18' && signature !== 'F9|B9' && signature !== 'F9|B9|18') {
    throw error(400, 'Segment shape must be Single 18, Split F9/B9, or F9/B9/Overall.');
  }

  return sorted;
}

function parseMatchups(rawValue: string): MatchupFormValue[] {
  const matchups = parseJsonField<unknown>(rawValue, 'matchups');

  if (!Array.isArray(matchups) || matchups.length === 0) {
    throw error(400, 'Add at least one pairing.');
  }

  const parsed = matchups.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw error(400, `matchups[${index}] must be an object.`);
    }

    const row = entry as Record<string, unknown>;
    const sideAPlayerIds = normalizePlayerIds(
      row.sideAPlayerIds,
      `matchups[${index}].sideAPlayerIds`
    );
    const sideBPlayerIds = normalizePlayerIds(
      row.sideBPlayerIds,
      `matchups[${index}].sideBPlayerIds`
    );
    const sideASet = new Set(sideAPlayerIds);

    for (const playerId of sideBPlayerIds) {
      if (sideASet.has(playerId)) {
        throw error(400, `matchups[${index}] has the same player on both sides.`);
      }
    }

    return {
      id:
        typeof row.id === 'string' && row.id.trim().length > 0
          ? row.id.trim()
          : `matchup-${index + 1}`,
      sideAPlayerIds,
      sideBPlayerIds,
    };
  });

  const playerCounts = new Map<string, number>();

  for (const row of parsed) {
    for (const playerId of [...row.sideAPlayerIds, ...row.sideBPlayerIds]) {
      playerCounts.set(playerId, (playerCounts.get(playerId) ?? 0) + 1);
    }
  }

  for (const [playerId, count] of playerCounts.entries()) {
    if (count > 1) {
      throw error(400, `Player ${playerId} appears in multiple pairings.`);
    }
  }

  return parsed;
}

function teeHasNineHoleRatings(tee: {
  cr9f: number | null;
  slope9f: number | null;
  par9f: number | null;
  cr9b: number | null;
  slope9b: number | null;
  par9b: number | null;
}): boolean {
  return (
    tee.cr9f !== null &&
    tee.slope9f !== null &&
    tee.par9f !== null &&
    tee.cr9b !== null &&
    tee.slope9b !== null &&
    tee.par9b !== null
  );
}

function requireCommissionerAccess(event: RequestEvent): void {
  requireRole(event.locals, 'commissioner');
  requireSameTournament(event.locals, event.params.id);
}

export const load: PageServerLoad = async (event) => {
  requireCommissionerAccess(event);

  const db = getDb(event.platform);
  const [tournament, courses, teams, players, rounds] = await Promise.all([
    getTournamentById(db, event.params.id),
    listCourses(db),
    listTeamsByTournament(db, event.params.id),
    listPlayersByTournament(db, event.params.id),
    listRoundsByTournament(db, event.params.id),
  ]);

  if (!tournament) {
    throw error(404, 'Tournament not found.');
  }

  const coursesWithTees = await Promise.all(
    courses.map(async (course) => ({
      ...course,
      tees: await listTeesByCourse(db, course.id),
    }))
  );

  const allSegments = await Promise.all(rounds.map((round) => listSegmentsByRound(db, round.id)));
  const configuredPoints = allSegments
    .flat()
    .reduce((sum, segment) => sum + segment.points_available, 0);

  const [teamA, teamB] = teams;
  const teamAPlayers = teamA ? players.filter((player) => player.team_id === teamA.id) : [];
  const teamBPlayers = teamB ? players.filter((player) => player.team_id === teamB.id) : [];

  return {
    tournament,
    courses: coursesWithTees,
    teams,
    teamA,
    teamB,
    teamAPlayers,
    teamBPlayers,
    existingConfiguredPoints: configuredPoints,
    targetPoints: toTargetPoints(tournament.points_to_win),
  };
};

export const actions: Actions = {
  default: async (event) => {
    requireCommissionerAccess(event);

    const db = getDb(event.platform);
    const formData = await event.request.formData();
    const values: FormValues = {
      roundName: normalizeString(formData.get('roundName')),
      courseId: normalizeString(formData.get('courseId')),
      teeId: normalizeString(formData.get('teeId')),
      dateTime: normalizeString(formData.get('dateTime')),
      segmentsJson: normalizeString(formData.get('segmentsJson')),
      matchupsJson: normalizeString(formData.get('matchupsJson')),
    };

    if (!values.roundName) {
      return fail(400, { error: 'Round name is required.', values });
    }

    if (!values.courseId) {
      return fail(400, { error: 'Course selection is required.', values });
    }

    if (!values.teeId) {
      return fail(400, { error: 'Tee selection is required.', values });
    }

    if (!values.dateTime) {
      return fail(400, { error: 'Round date/time is required.', values });
    }

    if (Number.isNaN(Date.parse(values.dateTime))) {
      return fail(400, { error: 'Round date/time is invalid.', values });
    }

    if (!values.segmentsJson) {
      return fail(400, { error: 'Segment configuration is required.', values });
    }

    if (!values.matchupsJson) {
      return fail(400, { error: 'At least one matchup is required.', values });
    }

    let segments: SegmentFormValue[];
    let matchups: MatchupFormValue[];

    try {
      segments = parseSegments(values.segmentsJson);
      matchups = parseMatchups(values.matchupsJson);
    } catch (cause) {
      if (cause instanceof Response) {
        return fail(cause.status, { error: cause.statusText, values });
      }

      if (cause instanceof Error) {
        return fail(400, { error: cause.message, values });
      }

      return fail(400, { error: 'Round setup is invalid.', values });
    }

    const [tournament, teams, players, courses] = await Promise.all([
      getTournamentById(db, event.params.id),
      listTeamsByTournament(db, event.params.id),
      listPlayersByTournament(db, event.params.id),
      listCourses(db),
    ]);

    if (!tournament) {
      throw error(404, 'Tournament not found.');
    }

    if (teams.length < 2) {
      return fail(400, {
        error: 'Create two teams before building round matchups.',
        values,
      });
    }

    const [teamA, teamB] = teams;
    const course = courses.find((entry) => entry.id === values.courseId);

    if (!course) {
      return fail(400, { error: 'Selected course was not found.', values });
    }

    const tees = await listTeesByCourse(db, values.courseId);
    const selectedTee = tees.find((tee) => tee.id === values.teeId);

    if (!selectedTee) {
      return fail(400, { error: 'Selected tee was not found for this course.', values });
    }

    if (segments.length > 1 && !teeHasNineHoleRatings(selectedTee)) {
      return fail(400, {
        error:
          'This tee is missing 9-hole ratings. Use a single-18 segment or choose a different tee.',
        values,
      });
    }

    const teamAPlayers = new Set(
      players.filter((player) => player.team_id === teamA.id).map((player) => player.id)
    );
    const teamBPlayers = new Set(
      players.filter((player) => player.team_id === teamB.id).map((player) => player.id)
    );

    for (const [index, matchup] of matchups.entries()) {
      for (const playerId of matchup.sideAPlayerIds) {
        if (!teamAPlayers.has(playerId)) {
          return fail(400, {
            error: `Pairing ${index + 1} includes an invalid Team A player.`,
            values,
          });
        }
      }

      for (const playerId of matchup.sideBPlayerIds) {
        if (!teamBPlayers.has(playerId)) {
          return fail(400, {
            error: `Pairing ${index + 1} includes an invalid Team B player.`,
            values,
          });
        }
      }
    }

    const createRoundResponse = await event.fetch(
      `/api/tournaments/${encodeURIComponent(event.params.id)}/rounds`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: values.roundName,
          courseId: values.courseId,
          teeId: values.teeId,
          dateTime: values.dateTime,
          segments: segments.map((segment) => ({
            segment: segment.segment,
            format: segment.format,
            pointsAtStake: segment.pointsAtStake,
            order: segment.order,
            ...toSegmentAllowance(segment.format, segment.allowanceOverride),
          })),
        }),
      }
    );

    if (!createRoundResponse.ok) {
      return fail(toActionFailureStatus(createRoundResponse.status), {
        error: await parseApiErrorMessage(createRoundResponse),
        values,
      });
    }

    const createdRoundPayload = (await createRoundResponse.json()) as {
      round?: { id?: string };
    };
    const createdRoundId = createdRoundPayload.round?.id;

    if (!createdRoundId) {
      return fail(500, {
        error: 'Round was created, but no round id was returned.',
        values,
      });
    }

    const matchupCount = matchups.length;
    const matchPayload: Array<{
      segment: ApiSegment;
      pointsAtStake: number;
      sideA: { teamId: string; playerIds: string[] };
      sideB: { teamId: string; playerIds: string[] };
    }> = [];

    for (const segment of segments) {
      const pointsPerMatch = Number((segment.pointsAtStake / matchupCount).toFixed(3));

      for (const matchup of matchups) {
        matchPayload.push({
          segment: segment.segment,
          pointsAtStake: pointsPerMatch,
          sideA: {
            teamId: teamA.id,
            playerIds: matchup.sideAPlayerIds,
          },
          sideB: {
            teamId: teamB.id,
            playerIds: matchup.sideBPlayerIds,
          },
        });
      }
    }

    const createMatchesResponse = await event.fetch(
      `/api/tournaments/${encodeURIComponent(event.params.id)}/rounds/${encodeURIComponent(createdRoundId)}/matches`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          matches: matchPayload,
        }),
      }
    );

    if (!createMatchesResponse.ok) {
      return fail(toActionFailureStatus(createMatchesResponse.status), {
        error: `Round was created, but matchups could not be created: ${await parseApiErrorMessage(createMatchesResponse)}.`,
        values,
        createdRoundId,
      });
    }

    throw redirect(303, `/manage/tournaments/${event.params.id}/rounds/${createdRoundId}`);
  },
};
