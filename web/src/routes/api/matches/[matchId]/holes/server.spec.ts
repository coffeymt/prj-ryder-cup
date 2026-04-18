import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import type {
  HoleScore,
  Match,
  MatchHoleResult,
  MatchSide,
  MatchSidePlayer,
  Player,
  Round,
  RoundSegment,
  Tee,
  Tournament
} from '$lib/db/types';
import type { MatchState } from '$lib/engine/types';

vi.mock('$lib/auth/guards', () => ({
  requireRole: vi.fn(),
  requireSameTournament: vi.fn()
}));

vi.mock('$lib/db/holeScores', () => ({
  listHoleScoresByMatch: vi.fn(),
  upsertHoleScore: vi.fn()
}));

vi.mock('$lib/db/matches', () => ({
  getMatchById: vi.fn(),
  listHoleResultsByMatch: vi.fn(),
  listPlayersBySide: vi.fn(),
  listSidesByMatch: vi.fn(),
  updateMatchStatus: vi.fn(),
  upsertMatchHoleResult: vi.fn()
}));

vi.mock('$lib/db/players', () => ({
  getPlayerById: vi.fn()
}));

vi.mock('$lib/db/processedOps', () => ({
  claimOp: vi.fn(),
  getProcessedOp: vi.fn(),
  markOpProcessed: vi.fn()
}));

vi.mock('$lib/db/rounds', () => ({
  getRoundById: vi.fn(),
  listSegmentsByRound: vi.fn()
}));

vi.mock('$lib/db/tournaments', () => ({
  getTournamentById: vi.fn()
}));

vi.mock('$lib/db/courses', () => ({
  listHolesByCourse: vi.fn(),
  listTeesByCourse: vi.fn()
}));

vi.mock('$lib/engine/formats/singles', () => ({
  computeSinglesResults: vi.fn()
}));

vi.mock('$lib/engine/matchState', () => ({
  computeMatchState: vi.fn()
}));

import { POST } from './+server';
import { requireRole, requireSameTournament } from '$lib/auth/guards';
import { listHoleScoresByMatch, upsertHoleScore } from '$lib/db/holeScores';
import {
  getMatchById,
  listHoleResultsByMatch,
  listPlayersBySide,
  listSidesByMatch,
  updateMatchStatus,
  upsertMatchHoleResult
} from '$lib/db/matches';
import { getPlayerById } from '$lib/db/players';
import { claimOp, getProcessedOp, markOpProcessed } from '$lib/db/processedOps';
import { getRoundById, listSegmentsByRound } from '$lib/db/rounds';
import { getTournamentById } from '$lib/db/tournaments';
import { listHolesByCourse, listTeesByCourse } from '$lib/db/courses';
import { computeSinglesResults } from '$lib/engine/formats/singles';
import { computeMatchState } from '$lib/engine/matchState';

const FIXTURE_MATCH: Match = {
  id: 'match-1',
  round_id: 'round-1',
  match_number: 1,
  format_override: null,
  created_at: '2026-04-17T00:00:00.000Z'
};

const FIXTURE_ROUND: Round = {
  id: 'round-1',
  tournament_id: 'tournament-1',
  round_number: 1,
  course_id: 'course-1',
  tee_id: 'tee-1',
  scheduled_at: '2026-04-17T00:00:00.000Z',
  notes: null,
  created_at: '2026-04-17T00:00:00.000Z'
};

const FIXTURE_SEGMENT: RoundSegment = {
  id: 'segment-1',
  round_id: 'round-1',
  segment_type: 'FULL18',
  hole_start: 1,
  hole_end: 18,
  format: 'SINGLES',
  points_available: 1,
  allowance_override: null,
  created_at: '2026-04-17T00:00:00.000Z'
};

const FIXTURE_TOURNAMENT: Tournament = {
  id: 'tournament-1',
  code: 'ABC123',
  name: 'Ryder Cup',
  start_date: '2026-04-17',
  end_date: '2026-04-20',
  points_to_win: 15.5,
  commissioner_email: 'owner@example.com',
  public_ticker_enabled: 0,
  allowance_scramble_low: 0.35,
  allowance_scramble_high: 0.15,
  allowance_pinehurst_low: 0.6,
  allowance_pinehurst_high: 0.4,
  allowance_shamble: 0.85,
  allowance_fourball: 1,
  allowance_singles: 1,
  created_at: '2026-04-17T00:00:00.000Z',
  updated_at: '2026-04-17T00:00:00.000Z'
};

const FIXTURE_TEE: Tee = {
  id: 'tee-1',
  course_id: 'course-1',
  name: 'Blue',
  color_hex: '#0000FF',
  cr18: 72.4,
  slope18: 132,
  par18: 72,
  cr9f: 36.2,
  slope9f: 131,
  par9f: 36,
  cr9b: 36.2,
  slope9b: 133,
  par9b: 36,
  created_at: '2026-04-17T00:00:00.000Z'
};

const FIXTURE_SIDES: MatchSide[] = [
  {
    id: 'side-a',
    match_id: 'match-1',
    team_id: 'team-a',
    side_label: 'A',
    created_at: '2026-04-17T00:00:00.000Z'
  },
  {
    id: 'side-b',
    match_id: 'match-1',
    team_id: 'team-b',
    side_label: 'B',
    created_at: '2026-04-17T00:00:00.000Z'
  }
];

const FIXTURE_SIDE_A_PLAYERS: MatchSidePlayer[] = [
  {
    id: 'side-a-player-1',
    match_side_id: 'side-a',
    player_id: 'player-a',
    created_at: '2026-04-17T00:00:00.000Z'
  }
];

const FIXTURE_SIDE_B_PLAYERS: MatchSidePlayer[] = [
  {
    id: 'side-b-player-1',
    match_side_id: 'side-b',
    player_id: 'player-b',
    created_at: '2026-04-17T00:00:00.000Z'
  }
];

const FIXTURE_PLAYERS_BY_ID: Record<string, Player> = {
  'player-a': {
    id: 'player-a',
    tournament_id: 'tournament-1',
    team_id: 'team-a',
    name: 'Player A',
    handicap_index: 8.1,
    created_at: '2026-04-17T00:00:00.000Z'
  },
  'player-b': {
    id: 'player-b',
    tournament_id: 'tournament-1',
    team_id: 'team-b',
    name: 'Player B',
    handicap_index: 12.3,
    created_at: '2026-04-17T00:00:00.000Z'
  }
};

const FIXTURE_HOLE_SCORE: HoleScore = {
  id: 'score-1',
  match_id: 'match-1',
  hole_number: 1,
  player_id: 'player-a',
  match_side_id: 'side-a',
  gross_strokes: 4,
  is_conceded: 0,
  is_picked_up: 0,
  entered_by_player_id: 'player-a',
  entered_at: '2026-04-17T00:00:00.000Z',
  op_id: '01J8XW6BV6H5CVJ6S2B2D1FB8W',
  updated_at: '2026-04-17T00:00:00.000Z'
};

const FIXTURE_HOLE_RESULT: MatchHoleResult = {
  id: 'hole-result-1',
  match_id: 'match-1',
  segment_id: 'segment-1',
  hole_number: 1,
  result: 'A_WINS',
  side_a_net: 4,
  side_b_net: 5,
  computed_at: '2026-04-17T00:00:00.000Z'
};

const FIXTURE_SEGMENT_MATCH_STATE: MatchState = {
  status: 'IN_PROGRESS',
  holesPlayed: 1,
  holesRemaining: 17,
  leadingSideId: 1,
  holesUp: 1,
  summary: '1 UP',
  closeNotation: null,
  sideA: { sideId: 1, holesWon: 1, holesSplit: 0, pointsEarned: 1 },
  sideB: { sideId: 2, holesWon: 0, holesSplit: 0, pointsEarned: 0 },
  holeResults: [{ holeNumber: 1, result: 'A_WINS', sideANet: 4, sideBNet: 5 }]
};

const FIXTURE_OVERALL_MATCH_STATE: MatchState = {
  status: 'IN_PROGRESS',
  holesPlayed: 1,
  holesRemaining: 17,
  leadingSideId: 1,
  holesUp: 2,
  summary: '2 UP',
  closeNotation: null,
  sideA: { sideId: 1, holesWon: 2, holesSplit: 0, pointsEarned: 1 },
  sideB: { sideId: 2, holesWon: 0, holesSplit: 0, pointsEarned: 0 },
  holeResults: [{ holeNumber: 1, result: 'A_WINS', sideANet: 4, sideBNet: 5 }]
};

const FIXTURE_HOLES = Array.from({ length: 18 }, (_, index) => ({
  id: `hole-${index + 1}`,
  tee_id: 'tee-1',
  hole_number: index + 1,
  par: 4,
  yardage: 400,
  stroke_index: index + 1,
  created_at: '2026-04-17T00:00:00.000Z'
}));

function createRequestEvent(options?: {
  idempotencyKey?: string;
  body?: Record<string, unknown>;
  locals?: Partial<App.Locals>;
}): RequestEvent {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (options?.idempotencyKey) {
    headers.set('Idempotency-Key', options.idempotencyKey);
  }

  return {
    request: new Request('https://example.test/api/matches/match-1/holes', {
      method: 'POST',
      headers,
      body: JSON.stringify(
        options?.body ?? {
          playerId: 'player-a',
          holeNumber: 1,
          grossStrokes: 4,
          conceded: false,
          pickedUp: false
        }
      )
    }),
    params: { matchId: 'match-1' },
    locals: {
      role: 'player',
      tournamentId: 'tournament-1',
      playerId: 'player-a',
      userId: null,
      ...(options?.locals ?? {})
    },
    platform: {
      env: { DB: {} as D1Database }
    } as App.Platform,
    url: new URL('https://example.test/api/matches/match-1/holes')
  } as unknown as RequestEvent;
}

const mockedRequireRole = vi.mocked(requireRole);
const mockedRequireSameTournament = vi.mocked(requireSameTournament);
const mockedGetMatchById = vi.mocked(getMatchById);
const mockedGetRoundById = vi.mocked(getRoundById);
const mockedListSegmentsByRound = vi.mocked(listSegmentsByRound);
const mockedGetTournamentById = vi.mocked(getTournamentById);
const mockedListTeesByCourse = vi.mocked(listTeesByCourse);
const mockedListHolesByCourse = vi.mocked(listHolesByCourse);
const mockedListSidesByMatch = vi.mocked(listSidesByMatch);
const mockedListPlayersBySide = vi.mocked(listPlayersBySide);
const mockedGetPlayerById = vi.mocked(getPlayerById);
const mockedListHoleScoresByMatch = vi.mocked(listHoleScoresByMatch);
const mockedUpsertHoleScore = vi.mocked(upsertHoleScore);
const mockedComputeSinglesResults = vi.mocked(computeSinglesResults);
const mockedUpsertMatchHoleResult = vi.mocked(upsertMatchHoleResult);
const mockedListHoleResultsByMatch = vi.mocked(listHoleResultsByMatch);
const mockedComputeMatchState = vi.mocked(computeMatchState);
const mockedUpdateMatchStatus = vi.mocked(updateMatchStatus);
const mockedClaimOp = vi.mocked(claimOp);
const mockedGetProcessedOp = vi.mocked(getProcessedOp);
const mockedMarkOpProcessed = vi.mocked(markOpProcessed);

beforeEach(() => {
  vi.clearAllMocks();

  mockedRequireRole.mockImplementation(() => undefined);
  mockedRequireSameTournament.mockImplementation(() => undefined);
  mockedClaimOp.mockResolvedValue(true);
  mockedGetProcessedOp.mockResolvedValue(null);
  mockedGetMatchById.mockResolvedValue(FIXTURE_MATCH);
  mockedGetRoundById.mockResolvedValue(FIXTURE_ROUND);
  mockedListSegmentsByRound.mockResolvedValue([FIXTURE_SEGMENT]);
  mockedGetTournamentById.mockResolvedValue(FIXTURE_TOURNAMENT);
  mockedListTeesByCourse.mockResolvedValue([FIXTURE_TEE]);
  mockedListHolesByCourse.mockResolvedValue(FIXTURE_HOLES);
  mockedListSidesByMatch.mockResolvedValue(FIXTURE_SIDES);
  mockedListPlayersBySide.mockImplementation(async (_db, sideId) =>
    sideId === 'side-a' ? FIXTURE_SIDE_A_PLAYERS : FIXTURE_SIDE_B_PLAYERS
  );
  mockedGetPlayerById.mockImplementation(async (_db, playerId) => FIXTURE_PLAYERS_BY_ID[playerId] ?? null);
  mockedUpsertHoleScore.mockResolvedValue(FIXTURE_HOLE_SCORE);
  mockedListHoleScoresByMatch.mockResolvedValue([FIXTURE_HOLE_SCORE]);
  mockedComputeSinglesResults.mockReturnValue(FIXTURE_SEGMENT_MATCH_STATE);
  mockedUpsertMatchHoleResult.mockResolvedValue(undefined);
  mockedListHoleResultsByMatch.mockResolvedValue([FIXTURE_HOLE_RESULT]);
  mockedComputeMatchState.mockReturnValue(FIXTURE_OVERALL_MATCH_STATE);
  mockedUpdateMatchStatus.mockResolvedValue(undefined);
  mockedMarkOpProcessed.mockResolvedValue(undefined);
});

describe('POST /api/matches/:matchId/holes', () => {
  it('returns cached response on duplicate idempotency key and writes once', async () => {
    const idempotencyKey = '01J8XW6BV6H5CVJ6S2B2D1FB8W';
    const firstResponse = await POST(createRequestEvent({ idempotencyKey }));
    const firstBody = await firstResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(mockedUpsertHoleScore).toHaveBeenCalledTimes(1);
    expect(mockedMarkOpProcessed).toHaveBeenCalledTimes(1);

    mockedClaimOp.mockResolvedValueOnce(false);
    mockedGetProcessedOp.mockResolvedValueOnce({
      op_id: idempotencyKey,
      endpoint: JSON.stringify(firstBody),
      processed_at: '2026-04-17T00:00:00.000Z'
    });

    const secondResponse = await POST(createRequestEvent({ idempotencyKey }));
    const secondBody = await secondResponse.json();

    expect(secondResponse.status).toBe(200);
    expect(secondBody).toEqual(firstBody);
    expect(mockedUpsertHoleScore).toHaveBeenCalledTimes(1);
    expect(mockedMarkOpProcessed).toHaveBeenCalledTimes(1);
  });

  it('returns the expected response shape for a valid write', async () => {
    const response = await POST(
      createRequestEvent({
        idempotencyKey: '26f36795-2db8-4dfe-96b0-86dbdb41f2ea'
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      holeScore: {
        id: 'score-1',
        match_id: 'match-1',
        hole_number: 1
      },
      holeResult: {
        id: 'hole-result-1',
        match_id: 'match-1',
        hole_number: 1,
        result: 'A_WINS'
      },
      matchState: 'A 2 UP',
      matchClosed: false,
      closeNotation: null
    });
  });

  it('returns 400 when idempotency key header is missing', async () => {
    const response = await POST(createRequestEvent());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ message: 'Idempotency-Key header is required.' });
    expect(mockedClaimOp).not.toHaveBeenCalled();
    expect(mockedUpsertHoleScore).not.toHaveBeenCalled();
  });
});
