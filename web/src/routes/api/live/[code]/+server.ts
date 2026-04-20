import { requireSameTournament } from '$lib/auth/guards';
import { getTournamentByCode } from '$lib/db/tournaments';
import { listTeamsByTournament } from '$lib/db/teams';
import type { MatchFormat, SegmentType, Tournament } from '$lib/db/types';
import { error, json, type RequestHandler } from '@sveltejs/kit';

type LiveTournamentStatus = 'active' | 'complete';
type LiveRoundStatus = 'pending' | 'in_progress' | 'complete';
type LiveMatchStatus = 'pending' | 'in_progress' | 'closed';

type LiveSide = {
  teamId: string;
  playerNames: string[];
  points: number;
};

type LiveMatch = {
  id: string;
  segment: SegmentType;
  format: string;
  sideA: LiveSide;
  sideB: LiveSide;
  status: LiveMatchStatus;
  closeNotation: string | null;
  matchState: string;
  teeTime: string | null;
};

type LiveRound = {
  id: string;
  name: string;
  date: string;
  status: LiveRoundStatus;
  matches: LiveMatch[];
};

type LiveTeam = {
  id: string;
  name: string;
  color: string;
  totalPoints: number;
};

export type LiveSnapshot = {
  tournament: {
    id: string;
    name: string;
    pointsToWin: number;
    status: LiveTournamentStatus;
  };
  teams: LiveTeam[];
  rounds: LiveRound[];
  lastUpdated: string;
};

type TeamPointRow = {
  team_id: string | number;
  total_points: number | null;
};

type RoundRow = {
  id: string | number;
  round_number: number;
  course_name: string | null;
  scheduled_at: string;
};

type SegmentRow = {
  id: string | number;
  round_id: string | number;
  segment_type: SegmentType;
  format: MatchFormat;
  hole_start: number;
};

type MatchRow = {
  match_id: string | number;
  round_id: string | number;
  match_number: number;
  format_override: MatchFormat | null;
  tee_time: string | null;
  result_status: 'PENDING' | 'IN_PROGRESS' | 'FINAL' | null;
  close_notation: string | null;
  side_a_points: number | null;
  side_b_points: number | null;
  side_a_holes_won: number | null;
  side_b_holes_won: number | null;
  segment_type: SegmentType | null;
  segment_format: MatchFormat | null;
};

type SidePlayerRow = {
  match_id: string | number;
  side_label: 'A' | 'B';
  team_id: string | number;
  player_name: string | null;
};

type LastUpdatedRow = {
  last_updated: string | null;
};

type MutableSide = {
  teamId: string;
  playerNames: string[];
};

const FORMAT_LABELS: Record<MatchFormat, string> = {
  SCRAMBLE: 'Scramble',
  PINEHURST: 'Pinehurst',
  SHAMBLE: 'Shamble',
  FOURBALL: 'Fourball',
  SINGLES: 'Singles',
};

function getDb(platform: App.Platform | undefined): D1Database {
  const db = platform?.env.DB;

  if (!db) {
    throw error(500, 'Database binding is not configured.');
  }

  return db;
}

function normalizeTournamentCode(code: string): string {
  const normalized = code.trim().toUpperCase();

  if (normalized.length === 0) {
    throw error(400, 'Tournament code is required.');
  }

  return normalized;
}

function assertLiveReadAccess(locals: App.Locals, tournament: Tournament): void {
  if (tournament.public_ticker_enabled === 1) {
    return;
  }

  if (locals.role === 'anonymous') {
    throw error(403, 'Forbidden');
  }

  requireSameTournament(locals, tournament.id);
}

function toLiveMatchStatus(status: MatchRow['result_status']): LiveMatchStatus {
  if (status === 'FINAL') {
    return 'closed';
  }

  if (status === 'IN_PROGRESS') {
    return 'in_progress';
  }

  return 'pending';
}

function toMatchState(sideAHolesWon: number | null, sideBHolesWon: number | null): string {
  if (sideAHolesWon === null || sideBHolesWon === null) {
    return 'AS';
  }

  const margin = Number(sideAHolesWon) - Number(sideBHolesWon);

  if (margin === 0) {
    return 'AS';
  }

  const leader = margin > 0 ? 'A' : 'B';
  return `${leader} ${Math.abs(margin)} UP`;
}

function computeRoundStatus(matches: LiveMatch[]): LiveRoundStatus {
  if (matches.length === 0) {
    return 'pending';
  }

  if (matches.every((match) => match.status === 'closed')) {
    return 'complete';
  }

  if (matches.some((match) => match.status !== 'pending')) {
    return 'in_progress';
  }

  return 'pending';
}

function computeTournamentStatus(rounds: LiveRound[]): LiveTournamentStatus {
  if (rounds.length > 0 && rounds.every((round) => round.status === 'complete')) {
    return 'complete';
  }

  return 'active';
}

function createMutableSide(): MutableSide {
  return { teamId: '', playerNames: [] };
}

async function loadTeamPointTotals(
  db: D1Database,
  tournamentId: string
): Promise<Map<string, number>> {
  const result = await db
    .prepare(
      `
        SELECT
          ms.team_id AS team_id,
          SUM(
            CASE
              WHEN ms.side_label = 'A' THEN mr.side_a_points
              ELSE mr.side_b_points
            END
          ) AS total_points
        FROM match_results mr
        INNER JOIN matches m ON m.id = mr.match_id
        INNER JOIN rounds r ON r.id = m.round_id
        INNER JOIN match_sides ms ON ms.match_id = m.id
        WHERE r.tournament_id = ?1
          AND mr.status = 'FINAL'
        GROUP BY ms.team_id
      `
    )
    .bind(tournamentId)
    .all<TeamPointRow>();

  return new Map(result.results.map((row) => [String(row.team_id), Number(row.total_points ?? 0)]));
}

async function loadRounds(db: D1Database, tournamentId: string): Promise<RoundRow[]> {
  const result = await db
    .prepare(
      `
        SELECT
          r.id,
          r.round_number,
          c.name AS course_name,
          r.scheduled_at
        FROM rounds r
        LEFT JOIN courses c ON c.id = r.course_id
        WHERE r.tournament_id = ?1
        ORDER BY r.round_number ASC
      `
    )
    .bind(tournamentId)
    .all<RoundRow>();

  return result.results;
}

async function loadSegments(db: D1Database, tournamentId: string): Promise<SegmentRow[]> {
  const result = await db
    .prepare(
      `
        SELECT
          rs.id,
          rs.round_id,
          rs.segment_type,
          rs.format,
          rs.hole_start
        FROM round_segments rs
        INNER JOIN rounds r ON r.id = rs.round_id
        WHERE r.tournament_id = ?1
        ORDER BY r.round_number ASC, rs.hole_start ASC, rs.id ASC
      `
    )
    .bind(tournamentId)
    .all<SegmentRow>();

  return result.results;
}

async function loadMatches(db: D1Database, tournamentId: string): Promise<MatchRow[]> {
  const result = await db
    .prepare(
      `
        WITH latest_results AS (
          SELECT
            *,
            ROW_NUMBER() OVER (PARTITION BY match_id ORDER BY computed_at DESC) AS rn
          FROM match_results
        )
        SELECT
          m.id AS match_id,
          m.round_id,
          m.match_number,
          m.format_override,
          m.tee_time,
          lr.status AS result_status,
          lr.close_notation,
          lr.side_a_points,
          lr.side_b_points,
          lr.side_a_holes_won,
          lr.side_b_holes_won,
          rs.segment_type,
          rs.format AS segment_format
        FROM matches m
        INNER JOIN rounds r ON r.id = m.round_id
        LEFT JOIN latest_results lr ON lr.match_id = m.id AND lr.rn = 1
        LEFT JOIN round_segments rs ON rs.id = lr.segment_id
        WHERE r.tournament_id = ?1
        ORDER BY r.round_number ASC, m.match_number ASC
      `
    )
    .bind(tournamentId)
    .all<MatchRow>();

  return result.results;
}

async function loadSidePlayers(db: D1Database, tournamentId: string): Promise<SidePlayerRow[]> {
  const result = await db
    .prepare(
      `
        SELECT
          ms.match_id,
          ms.side_label,
          ms.team_id,
          p.name AS player_name
        FROM match_sides ms
        INNER JOIN matches m ON m.id = ms.match_id
        INNER JOIN rounds r ON r.id = m.round_id
        LEFT JOIN match_side_players msp ON msp.match_side_id = ms.id
        LEFT JOIN players p ON p.id = msp.player_id
        WHERE r.tournament_id = ?1
        ORDER BY m.match_number ASC, ms.side_label ASC, msp.created_at ASC, p.name ASC
      `
    )
    .bind(tournamentId)
    .all<SidePlayerRow>();

  return result.results;
}

async function loadLastUpdated(db: D1Database, tournamentId: string): Promise<string | null> {
  const row = await db
    .prepare(
      `
        SELECT MAX(hs.updated_at) AS last_updated
        FROM hole_scores hs
        INNER JOIN matches m ON m.id = hs.match_id
        INNER JOIN rounds r ON r.id = m.round_id
        WHERE r.tournament_id = ?1
      `
    )
    .bind(tournamentId)
    .first<LastUpdatedRow>();

  return row?.last_updated ?? null;
}

function buildSidesByMatch(rows: SidePlayerRow[]): Map<string, { A: MutableSide; B: MutableSide }> {
  const sidesByMatch = new Map<string, { A: MutableSide; B: MutableSide }>();

  for (const row of rows) {
    const matchId = String(row.match_id);
    const existing = sidesByMatch.get(matchId) ?? {
      A: createMutableSide(),
      B: createMutableSide(),
    };
    const side = row.side_label === 'A' ? existing.A : existing.B;

    if (!side.teamId) {
      side.teamId = String(row.team_id);
    }

    if (row.player_name && !side.playerNames.includes(row.player_name)) {
      side.playerNames.push(row.player_name);
    }

    sidesByMatch.set(matchId, existing);
  }

  return sidesByMatch;
}

function buildFirstSegmentByRound(rows: SegmentRow[]): Map<string, SegmentRow> {
  const firstSegmentByRound = new Map<string, SegmentRow>();

  for (const row of rows) {
    const roundId = String(row.round_id);

    if (!firstSegmentByRound.has(roundId)) {
      firstSegmentByRound.set(roundId, row);
    }
  }

  return firstSegmentByRound;
}

async function buildLiveSnapshot(db: D1Database, tournament: Tournament): Promise<LiveSnapshot> {
  const [
    teams,
    teamPointTotals,
    roundsData,
    segmentsData,
    matchesData,
    sidePlayerData,
    lastUpdated,
  ] = await Promise.all([
    listTeamsByTournament(db, tournament.id),
    loadTeamPointTotals(db, tournament.id),
    loadRounds(db, tournament.id),
    loadSegments(db, tournament.id),
    loadMatches(db, tournament.id),
    loadSidePlayers(db, tournament.id),
    loadLastUpdated(db, tournament.id),
  ]);

  const teamsPayload: LiveTeam[] = teams.map((team) => ({
    id: team.id,
    name: team.name,
    color: team.color,
    totalPoints: teamPointTotals.get(team.id) ?? 0,
  }));

  const rounds: LiveRound[] = roundsData.map((round) => ({
    id: String(round.id),
    name: round.course_name ?? `Round ${round.round_number}`,
    date: round.scheduled_at,
    status: 'pending',
    matches: [],
  }));

  const roundsById = new Map(rounds.map((round) => [round.id, round]));
  const sidesByMatch = buildSidesByMatch(sidePlayerData);
  const firstSegmentByRound = buildFirstSegmentByRound(segmentsData);

  for (const matchRow of matchesData) {
    const matchId = String(matchRow.match_id);
    const roundId = String(matchRow.round_id);
    const round = roundsById.get(roundId);

    if (!round) {
      continue;
    }

    const fallbackSegment = firstSegmentByRound.get(roundId);
    const segment = matchRow.segment_type ?? fallbackSegment?.segment_type ?? 'FULL18';
    const formatCode =
      matchRow.format_override ?? matchRow.segment_format ?? fallbackSegment?.format ?? 'SINGLES';
    const sides = sidesByMatch.get(matchId) ?? { A: createMutableSide(), B: createMutableSide() };
    const sideAPoints = Number(matchRow.side_a_points ?? 0);
    const sideBPoints = Number(matchRow.side_b_points ?? 0);

    round.matches.push({
      id: matchId,
      segment,
      format: FORMAT_LABELS[formatCode],
      sideA: {
        teamId: sides.A.teamId,
        playerNames: sides.A.playerNames,
        points: sideAPoints,
      },
      sideB: {
        teamId: sides.B.teamId,
        playerNames: sides.B.playerNames,
        points: sideBPoints,
      },
      status: toLiveMatchStatus(matchRow.result_status),
      closeNotation: matchRow.close_notation,
      matchState: toMatchState(matchRow.side_a_holes_won, matchRow.side_b_holes_won),
      teeTime: matchRow.tee_time ?? null,
    });
  }

  for (const round of rounds) {
    round.status = computeRoundStatus(round.matches);
  }

  return {
    tournament: {
      id: tournament.id,
      name: tournament.name,
      pointsToWin: tournament.points_to_win,
      status: computeTournamentStatus(rounds),
    },
    teams: teamsPayload,
    rounds,
    lastUpdated: lastUpdated ?? tournament.updated_at,
  };
}

export async function _getLiveSnapshot(
  platform: App.Platform | undefined,
  locals: App.Locals,
  code: string
): Promise<LiveSnapshot> {
  const db = getDb(platform);
  const tournamentCode = normalizeTournamentCode(code);
  const tournament = await getTournamentByCode(db, tournamentCode);

  if (!tournament) {
    throw error(404, 'Tournament not found.');
  }

  assertLiveReadAccess(locals, tournament);
  return buildLiveSnapshot(db, tournament);
}

export const GET: RequestHandler = async ({ platform, locals, params }) => {
  const snapshot = await _getLiveSnapshot(platform, locals, params.code);
  return json(snapshot);
};
