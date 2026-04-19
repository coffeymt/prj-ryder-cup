import { requireRole } from '$lib/auth/guards';
import { listMatchesByTournament } from '$lib/db/matches';
import { listPlayersByTournament } from '$lib/db/players';
import { listRoundsByTournament, listSegmentsByRound } from '$lib/db/rounds';
import { getTeamById, listTeamsByTournament } from '$lib/db/teams';
import { getTournamentById } from '$lib/db/tournaments';
import type { Match, MatchFormat, MatchResultStatus, RoundSegment } from '$lib/db/types';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

type ActionPanel = 'editScore' | 'forceClose' | 'pointsAdjust';
type ToastKind = 'success' | 'error';

type ToastPayload = {
  id: string;
  kind: ToastKind;
  message: string;
};

type MatchResultRow = {
  match_id: string | number;
  segment_id: string | number;
  status: MatchResultStatus;
  side_a_points: number | null;
  side_b_points: number | null;
  computed_at: string;
};

type MatchSidePlayerRow = {
  match_id: string | number;
  side_label: 'A' | 'B';
  team_id: string | number;
  team_name: string;
  player_id: string | number | null;
  player_name: string | null;
};

type MatchContextRow = {
  id: string | number;
  round_id: string | number;
  match_number: number;
  format_override: MatchFormat | null;
};

type ParsedMatchPlayer = {
  id: string;
  name: string;
  sideLabel: 'A' | 'B';
  teamId: string;
  teamName: string;
};

type ParsedMatch = {
  id: string;
  roundId: string;
  roundNumber: number;
  matchNumber: number;
  label: string;
  status: MatchResultStatus;
  pointsAtStake: number;
  sideAPoints: number | null;
  sideBPoints: number | null;
  sideATeamName: string;
  sideBTeamName: string;
  players: ParsedMatchPlayer[];
};

function getDb(platform: App.Platform | undefined): D1Database {
  const db = platform?.env.DB;

  if (!db) {
    throw error(500, 'Database binding is not configured.');
  }

  return db;
}

function createToast(kind: ToastKind, message: string): ToastPayload {
  return {
    id: crypto.randomUUID(),
    kind,
    message,
  };
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

function parseReason(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length >= 5 ? trimmed : null;
}

function parseIntegerInRange(
  value: FormDataEntryValue | null,
  minimum: number,
  maximum: number
): number | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    return null;
  }

  return parsed;
}

function parseNonNegativeNumber(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function parseFiniteNumber(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function parseOptionalInteger(value: FormDataEntryValue | null): number | null | 'invalid' {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 15) {
    return 'invalid';
  }

  return parsed;
}

function toActionFailureStatus(status: number): number {
  return status >= 400 && status < 600 ? status : 500;
}

async function parseApiErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: unknown; error?: unknown };

    if (typeof payload.message === 'string' && payload.message.trim().length > 0) {
      return payload.message;
    }

    if (typeof payload.error === 'string' && payload.error.trim().length > 0) {
      return payload.error;
    }
  } catch {
    // Fall through to fallback message.
  }

  return response.statusText || 'Request failed.';
}

async function loadLatestMatchResults(
  db: D1Database,
  tournamentId: string
): Promise<Map<string, MatchResultRow>> {
  const result = await db
    .prepare(
      `
        SELECT
          mr.match_id,
          mr.segment_id,
          mr.status,
          mr.side_a_points,
          mr.side_b_points,
          mr.computed_at
        FROM match_results mr
        INNER JOIN matches m ON m.id = mr.match_id
        INNER JOIN rounds r ON r.id = m.round_id
        WHERE r.tournament_id = ?1
        ORDER BY mr.computed_at DESC, mr.id DESC
      `
    )
    .bind(tournamentId)
    .all<MatchResultRow>();

  const latestByMatch = new Map<string, MatchResultRow>();

  for (const row of result.results) {
    const matchId = String(row.match_id);
    if (latestByMatch.has(matchId)) {
      continue;
    }

    latestByMatch.set(matchId, {
      ...row,
      match_id: matchId,
      segment_id: String(row.segment_id),
    });
  }

  return latestByMatch;
}

async function loadSidePlayers(
  db: D1Database,
  tournamentId: string
): Promise<
  Map<string, { sideATeamName: string; sideBTeamName: string; players: ParsedMatchPlayer[] }>
> {
  const result = await db
    .prepare(
      `
        SELECT
          ms.match_id,
          ms.side_label,
          ms.team_id,
          t.name AS team_name,
          p.id AS player_id,
          p.name AS player_name
        FROM match_sides ms
        INNER JOIN teams t ON t.id = ms.team_id
        INNER JOIN matches m ON m.id = ms.match_id
        INNER JOIN rounds r ON r.id = m.round_id
        LEFT JOIN match_side_players msp ON msp.match_side_id = ms.id
        LEFT JOIN players p ON p.id = msp.player_id
        WHERE r.tournament_id = ?1
        ORDER BY r.round_number ASC, m.match_number ASC, ms.side_label ASC, p.name ASC
      `
    )
    .bind(tournamentId)
    .all<MatchSidePlayerRow>();

  const byMatch = new Map<
    string,
    { sideATeamName: string; sideBTeamName: string; players: ParsedMatchPlayer[] }
  >();
  const seenPlayerKeys = new Set<string>();

  for (const row of result.results) {
    const matchId = String(row.match_id);
    const entry = byMatch.get(matchId) ?? {
      sideATeamName: '',
      sideBTeamName: '',
      players: [],
    };

    if (row.side_label === 'A' && !entry.sideATeamName) {
      entry.sideATeamName = row.team_name;
    }

    if (row.side_label === 'B' && !entry.sideBTeamName) {
      entry.sideBTeamName = row.team_name;
    }

    if (row.player_id !== null && row.player_name) {
      const playerId = String(row.player_id);
      const playerKey = `${matchId}:${playerId}`;

      if (!seenPlayerKeys.has(playerKey)) {
        entry.players.push({
          id: playerId,
          name: row.player_name,
          sideLabel: row.side_label,
          teamId: String(row.team_id),
          teamName: row.team_name,
        });

        seenPlayerKeys.add(playerKey);
      }
    }

    byMatch.set(matchId, entry);
  }

  return byMatch;
}

function resolvePointsAtStake(
  match: Pick<Match, 'format_override'>,
  segments: RoundSegment[],
  latestResult: MatchResultRow | null
): number | null {
  if (latestResult) {
    const matchingSegment = segments.find(
      (segment) => segment.id === String(latestResult.segment_id)
    );
    if (matchingSegment) {
      return matchingSegment.points_available;
    }
  }

  if (match.format_override) {
    const matchingFormat = segments.filter((segment) => segment.format === match.format_override);
    if (matchingFormat.length === 1) {
      return matchingFormat[0].points_available;
    }
  }

  if (segments.length === 1) {
    return segments[0].points_available;
  }

  const overall = segments.find(
    (segment) => segment.segment_type === 'OVERALL' || segment.segment_type === 'FULL18'
  );
  return overall ? overall.points_available : null;
}

function toMatchLabel(
  roundNumber: number,
  matchNumber: number,
  sideAName: string,
  sideBName: string
): string {
  const sideSummary =
    sideAName.length > 0 && sideBName.length > 0 ? ` (${sideAName} vs ${sideBName})` : '';
  return `Round ${roundNumber} - Match ${matchNumber}${sideSummary}`;
}

async function getMatchContext(
  db: D1Database,
  tournamentId: string,
  matchId: string
): Promise<MatchContextRow | null> {
  const row = await db
    .prepare(
      `
        SELECT
          m.id,
          m.round_id,
          m.match_number,
          m.format_override
        FROM matches m
        INNER JOIN rounds r ON r.id = m.round_id
        WHERE m.id = ?1
          AND r.tournament_id = ?2
        LIMIT 1
      `
    )
    .bind(matchId, tournamentId)
    .first<MatchContextRow>();

  if (!row) {
    return null;
  }

  return {
    ...row,
    id: String(row.id),
    round_id: String(row.round_id),
  };
}

async function isPlayerInMatch(
  db: D1Database,
  matchId: string,
  playerId: string
): Promise<boolean> {
  const row = await db
    .prepare(
      `
        SELECT msp.player_id
        FROM match_side_players msp
        INNER JOIN match_sides ms ON ms.id = msp.match_side_id
        WHERE ms.match_id = ?1
          AND msp.player_id = ?2
        LIMIT 1
      `
    )
    .bind(matchId, playerId)
    .first<{ player_id: string | number }>();

  return row !== null;
}

function createFailure(
  panel: ActionPanel,
  errors: Record<string, string>,
  status = 400
): ReturnType<typeof fail> {
  const toastMessage = errors.form ?? 'Please fix the highlighted fields.';

  return fail(status, {
    panel,
    errors,
    toast: createToast('error', toastMessage),
  });
}

export const load: PageServerLoad = async (event) => {
  const { db, tournamentId } = await requireOwnedTournament(event);

  const [tournament, rounds, matches, teams, players, latestResultByMatch, sidePlayersByMatch] =
    await Promise.all([
      getTournamentById(db, tournamentId),
      listRoundsByTournament(db, tournamentId),
      listMatchesByTournament(db, tournamentId),
      listTeamsByTournament(db, tournamentId),
      listPlayersByTournament(db, tournamentId),
      loadLatestMatchResults(db, tournamentId),
      loadSidePlayers(db, tournamentId),
    ]);

  if (!tournament) {
    throw error(404, 'Tournament not found.');
  }

  const segmentsByRound = new Map<string, RoundSegment[]>();

  for (const round of rounds) {
    segmentsByRound.set(round.id, await listSegmentsByRound(db, round.id));
  }

  const roundById = new Map(rounds.map((round) => [round.id, round]));

  const parsedMatches: ParsedMatch[] = matches
    .map((match) => {
      const round = roundById.get(match.round_id);

      if (!round) {
        return null;
      }

      const latestResult = latestResultByMatch.get(match.id) ?? null;
      const segments = segmentsByRound.get(match.round_id) ?? [];
      const pointsAtStake = resolvePointsAtStake(match, segments, latestResult) ?? 0;
      const sides = sidePlayersByMatch.get(match.id) ?? {
        sideATeamName: '',
        sideBTeamName: '',
        players: [],
      };

      return {
        id: match.id,
        roundId: match.round_id,
        roundNumber: round.round_number,
        matchNumber: match.match_number,
        label: toMatchLabel(
          round.round_number,
          match.match_number,
          sides.sideATeamName,
          sides.sideBTeamName
        ),
        status: latestResult?.status ?? 'PENDING',
        pointsAtStake,
        sideAPoints: latestResult?.side_a_points ?? null,
        sideBPoints: latestResult?.side_b_points ?? null,
        sideATeamName: sides.sideATeamName,
        sideBTeamName: sides.sideBTeamName,
        players: sides.players,
      };
    })
    .filter((match): match is ParsedMatch => match !== null)
    .sort((left, right) => {
      if (left.roundNumber !== right.roundNumber) {
        return left.roundNumber - right.roundNumber;
      }

      return left.matchNumber - right.matchNumber;
    });

  return {
    tournament,
    rounds,
    matches: parsedMatches,
    teams,
    players,
  };
};

export const actions: Actions = {
  editScore: async (event) => {
    const { db, tournamentId } = await requireOwnedTournament(event);
    const formData = await event.request.formData();
    const errors: Record<string, string> = {};

    const matchId =
      typeof formData.get('matchId') === 'string' ? String(formData.get('matchId')).trim() : '';
    const playerId =
      typeof formData.get('playerId') === 'string' ? String(formData.get('playerId')).trim() : '';
    const holeNumber = parseIntegerInRange(formData.get('holeNumber'), 1, 18);
    const grossStrokes = parseOptionalInteger(formData.get('grossStrokes'));
    const conceded = formData.get('conceded') !== null;
    const pickedUp = formData.get('pickedUp') !== null;
    const reason = parseReason(formData.get('reason'));

    if (!matchId) {
      errors.matchId = 'Select a match.';
    }

    if (!playerId) {
      errors.playerId = 'Select a player.';
    }

    if (holeNumber === null) {
      errors.holeNumber = 'Hole number must be an integer from 1 to 18.';
    }

    if (grossStrokes === 'invalid') {
      errors.grossStrokes = 'Gross strokes must be an integer between 1 and 15.';
    }

    if (conceded && pickedUp) {
      errors.flags = 'Conceded and picked up cannot both be selected.';
    }

    if ((conceded || pickedUp) && grossStrokes !== null) {
      errors.grossStrokes = 'Leave gross strokes blank when conceded or picked up is selected.';
    }

    if (!conceded && !pickedUp && grossStrokes === null) {
      errors.grossStrokes =
        'Gross strokes are required when neither conceded nor picked up is selected.';
    }

    if (!reason) {
      errors.reason = 'Reason is required and must be at least 5 characters.';
    }

    if (Object.keys(errors).length > 0) {
      return createFailure('editScore', errors);
    }

    const matchContext = await getMatchContext(db, tournamentId, matchId);
    if (!matchContext) {
      return createFailure('editScore', {
        matchId: 'Selected match was not found in this tournament.',
      });
    }

    const playerBelongsToMatch = await isPlayerInMatch(db, matchId, playerId);
    if (!playerBelongsToMatch) {
      return createFailure('editScore', {
        playerId: 'Selected player is not assigned to this match.',
      });
    }

    const response = await event.fetch(`/api/matches/${encodeURIComponent(matchId)}/override`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        action: 'edit_score',
        playerId,
        holeNumber,
        grossStrokes,
        conceded,
        pickedUp,
        reason,
      }),
    });

    if (!response.ok) {
      const errorMessage = await parseApiErrorMessage(response);
      return createFailure(
        'editScore',
        { form: errorMessage },
        toActionFailureStatus(response.status)
      );
    }

    return {
      panel: 'editScore',
      toast: createToast('success', 'Hole score override saved.'),
    };
  },

  forceClose: async (event) => {
    const { db, tournamentId } = await requireOwnedTournament(event);
    const formData = await event.request.formData();
    const errors: Record<string, string> = {};

    const matchId =
      typeof formData.get('matchId') === 'string' ? String(formData.get('matchId')).trim() : '';
    const sideAPoints = parseNonNegativeNumber(formData.get('sideAPoints'));
    const sideBPoints = parseNonNegativeNumber(formData.get('sideBPoints'));
    const reason = parseReason(formData.get('reason'));

    if (!matchId) {
      errors.matchId = 'Select a match.';
    }

    if (sideAPoints === null) {
      errors.sideAPoints = 'Side A points must be a non-negative number.';
    }

    if (sideBPoints === null) {
      errors.sideBPoints = 'Side B points must be a non-negative number.';
    }

    if (!reason) {
      errors.reason = 'Reason is required and must be at least 5 characters.';
    }

    if (Object.keys(errors).length > 0) {
      return createFailure('forceClose', errors);
    }

    const matchContext = await getMatchContext(db, tournamentId, matchId);
    if (!matchContext) {
      return createFailure('forceClose', {
        matchId: 'Selected match was not found in this tournament.',
      });
    }

    const latestResultByMatch = await loadLatestMatchResults(db, tournamentId);
    const latestResult = latestResultByMatch.get(matchId) ?? null;

    if (latestResult?.status === 'FINAL') {
      return createFailure('forceClose', {
        matchId: 'This match is already final and cannot be force-closed again.',
      });
    }

    const segments = await listSegmentsByRound(db, String(matchContext.round_id));
    const pointsAtStake = resolvePointsAtStake(
      { format_override: matchContext.format_override },
      segments,
      latestResult
    );

    if (pointsAtStake !== null) {
      const total = sideAPoints + sideBPoints;
      if (Math.abs(total - pointsAtStake) > 1e-9) {
        errors.pointsTotal = `Side A + Side B must equal points at stake (${pointsAtStake}).`;
      }
    }

    if (Object.keys(errors).length > 0) {
      return createFailure('forceClose', errors);
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
      const errorMessage = await parseApiErrorMessage(response);
      return createFailure(
        'forceClose',
        { form: errorMessage },
        toActionFailureStatus(response.status)
      );
    }

    return {
      panel: 'forceClose',
      toast: createToast('success', 'Match was force-closed successfully.'),
    };
  },

  pointsAdjust: async (event) => {
    const { db, tournamentId } = await requireOwnedTournament(event);
    const formData = await event.request.formData();
    const errors: Record<string, string> = {};

    const teamId =
      typeof formData.get('teamId') === 'string' ? String(formData.get('teamId')).trim() : '';
    const delta = parseFiniteNumber(formData.get('delta'));
    const reason = parseReason(formData.get('reason'));

    if (!teamId) {
      errors.teamId = 'Select a team.';
    }

    if (delta === null) {
      errors.delta = 'Delta must be a valid number (positive or negative).';
    }

    if (!reason) {
      errors.reason = 'Reason is required and must be at least 5 characters.';
    }

    if (Object.keys(errors).length > 0) {
      return createFailure('pointsAdjust', errors);
    }

    const team = await getTeamById(db, teamId);
    if (!team || team.tournament_id !== tournamentId) {
      return createFailure('pointsAdjust', {
        teamId: 'Selected team is not part of this tournament.',
      });
    }

    const response = await event.fetch(
      `/api/tournaments/${encodeURIComponent(tournamentId)}/points-adjust`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          teamId,
          delta,
          reason,
        }),
      }
    );

    if (!response.ok) {
      const errorMessage = await parseApiErrorMessage(response);
      return createFailure(
        'pointsAdjust',
        { form: errorMessage },
        toActionFailureStatus(response.status)
      );
    }

    return {
      panel: 'pointsAdjust',
      toast: createToast('success', 'Manual point adjustment recorded.'),
    };
  },
};
