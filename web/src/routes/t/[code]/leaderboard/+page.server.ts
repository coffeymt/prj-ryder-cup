import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { MatchFormat, SegmentType } from '$lib/db/types';

type RoundRow = {
  id: string | number;
  round_number: number;
  scheduled_at: string;
  course_name: string | null;
};

type SegmentRow = {
  round_id: string | number;
  segment_type: SegmentType;
  format: MatchFormat;
};

type MatchRow = {
  id: string | number;
  round_id: string | number;
  match_number: number;
  tee_time: string | null;
  format_override: MatchFormat | null;
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
  team_name: string;
  team_color: string;
  player_name: string | null;
};

type TeamPointsRow = {
  team_id: string | number;
  total_points: number | null;
};

type RoundPointsRow = {
  round_id: string | number;
  team_id: string | number;
  round_points: number | null;
};

function getDb(platform: App.Platform | undefined): D1Database {
  const db = platform?.env.DB;

  if (!db) {
    throw error(500, 'Database binding is not configured.');
  }

  return db;
}

function hasTournamentCookie(locals: App.Locals, tournamentId: string): boolean {
  if (locals.role === 'anonymous') {
    return false;
  }

  return locals.tournamentId === tournamentId;
}

const FORMAT_LABELS: Record<MatchFormat, string> = {
  SCRAMBLE: 'Scramble',
  PINEHURST: 'Pinehurst',
  SHAMBLE: 'Shamble',
  FOURBALL: 'Fourball',
  SINGLES: 'Singles',
};

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

function toSegmentLabel(segmentType: SegmentType | null): string {
  if (segmentType === 'F9' || segmentType === 'B9') {
    return segmentType;
  }

  return '18';
}

function toRoundStatus(
  matchStatuses: Array<'PENDING' | 'IN_PROGRESS' | 'FINAL'>
): 'Not Started' | 'In Progress' | 'Final' {
  if (matchStatuses.length === 0) {
    return 'Not Started';
  }

  if (matchStatuses.every((s) => s === 'FINAL')) {
    return 'Final';
  }

  if (matchStatuses.some((s) => s !== 'PENDING')) {
    return 'In Progress';
  }

  return 'Not Started';
}

export const load: PageServerLoad = async (event) => {
  const { tournament, allTeams } = await event.parent();

  const publicTickerEnabled = tournament.public_ticker_enabled === 1;

  if (!publicTickerEnabled && !hasTournamentCookie(event.locals, tournament.id)) {
    throw redirect(307, `/join/${encodeURIComponent(tournament.code)}`);
  }

  const db = getDb(event.platform);

  const [roundResult, segmentResult, matchResult, sidePlayerResult, teamPointsResult, roundPointsResult] =
    await Promise.all([
      db
        .prepare(
          `
          SELECT r.id, r.round_number, r.scheduled_at, c.name AS course_name
          FROM rounds r
          LEFT JOIN courses c ON c.id = r.course_id
          WHERE r.tournament_id = ?1
          ORDER BY r.round_number ASC
        `
        )
        .bind(tournament.id)
        .all<RoundRow>(),

      db
        .prepare(
          `
          SELECT rs.round_id, rs.segment_type, rs.format
          FROM round_segments rs
          INNER JOIN rounds r ON r.id = rs.round_id
          WHERE r.tournament_id = ?1
          ORDER BY r.round_number ASC, rs.hole_start ASC, rs.id ASC
        `
        )
        .bind(tournament.id)
        .all<SegmentRow>(),

      db
        .prepare(
          `
          WITH ranked_results AS (
            SELECT
              mr.match_id,
              mr.status,
              mr.close_notation,
              mr.side_a_points,
              mr.side_b_points,
              mr.side_a_holes_won,
              mr.side_b_holes_won,
              mr.segment_id,
              ROW_NUMBER() OVER (
                PARTITION BY mr.match_id
                ORDER BY mr.computed_at DESC, mr.id DESC
              ) AS rank_index
            FROM match_results mr
          )
          SELECT
            m.id,
            m.round_id,
            m.match_number,
            m.tee_time,
            m.format_override,
            rr.status AS result_status,
            rr.close_notation,
            rr.side_a_points,
            rr.side_b_points,
            rr.side_a_holes_won,
            rr.side_b_holes_won,
            rs.segment_type,
            rs.format AS segment_format
          FROM matches m
          INNER JOIN rounds r ON r.id = m.round_id
          LEFT JOIN ranked_results rr ON rr.match_id = m.id AND rr.rank_index = 1
          LEFT JOIN round_segments rs ON rs.id = rr.segment_id
          WHERE r.tournament_id = ?1
          ORDER BY r.round_number ASC, m.match_number ASC
        `
        )
        .bind(tournament.id)
        .all<MatchRow>(),

      db
        .prepare(
          `
          SELECT
            ms.match_id,
            ms.side_label,
            t.id AS team_id,
            t.name AS team_name,
            t.color AS team_color,
            p.name AS player_name
          FROM match_sides ms
          INNER JOIN matches m ON m.id = ms.match_id
          INNER JOIN rounds r ON r.id = m.round_id
          INNER JOIN teams t ON t.id = ms.team_id
          LEFT JOIN match_side_players msp ON msp.match_side_id = ms.id
          LEFT JOIN players p ON p.id = msp.player_id
          WHERE r.tournament_id = ?1
          ORDER BY r.round_number ASC, m.match_number ASC, ms.side_label ASC, msp.created_at ASC, p.name ASC
        `
        )
        .bind(tournament.id)
        .all<SidePlayerRow>(),

      db
        .prepare(
          `
          SELECT
            ms.team_id,
            SUM(
              CASE WHEN ms.side_label = 'A' THEN mr.side_a_points ELSE mr.side_b_points END
            ) AS total_points
          FROM match_results mr
          INNER JOIN matches m ON m.id = mr.match_id
          INNER JOIN rounds r ON r.id = m.round_id
          INNER JOIN match_sides ms ON ms.match_id = m.id
          WHERE r.tournament_id = ?1 AND mr.status = 'FINAL'
          GROUP BY ms.team_id
        `
        )
        .bind(tournament.id)
        .all<TeamPointsRow>(),

      db
        .prepare(
          `
          SELECT
            r.id AS round_id,
            ms.team_id,
            SUM(
              CASE WHEN ms.side_label = 'A' THEN mr.side_a_points ELSE mr.side_b_points END
            ) AS round_points
          FROM match_results mr
          INNER JOIN matches m ON m.id = mr.match_id
          INNER JOIN rounds r ON r.id = m.round_id
          INNER JOIN match_sides ms ON ms.match_id = m.id
          WHERE r.tournament_id = ?1 AND mr.status = 'FINAL'
          GROUP BY r.id, ms.team_id
        `
        )
        .bind(tournament.id)
        .all<RoundPointsRow>(),
    ]);

  // Build first segment per round for fallback format/segment lookup
  const firstSegmentByRound = new Map<string, SegmentRow>();

  for (const seg of segmentResult.results) {
    const roundId = String(seg.round_id);

    if (!firstSegmentByRound.has(roundId)) {
      firstSegmentByRound.set(roundId, seg);
    }
  }

  // Build side-players map keyed by match ID
  type SideData = { teamId: string; teamName: string; teamColor: string; playerNames: string[] };
  const sidesByMatch = new Map<string, { A: SideData; B: SideData }>();

  for (const row of sidePlayerResult.results) {
    const matchId = String(row.match_id);

    if (!sidesByMatch.has(matchId)) {
      sidesByMatch.set(matchId, {
        A: { teamId: '', teamName: '', teamColor: '', playerNames: [] },
        B: { teamId: '', teamName: '', teamColor: '', playerNames: [] },
      });
    }

    const sides = sidesByMatch.get(matchId)!;
    const side = sides[row.side_label];

    if (!side.teamId) {
      side.teamId = String(row.team_id);
      side.teamName = row.team_name;
      side.teamColor = row.team_color;
    }

    if (row.player_name && !side.playerNames.includes(row.player_name)) {
      side.playerNames.push(row.player_name);
    }
  }

  // Build round points lookup: roundId -> teamId -> points
  const roundPointsMap = new Map<string, Map<string, number>>();

  for (const row of roundPointsResult.results) {
    const roundId = String(row.round_id);
    const teamId = String(row.team_id);

    if (!roundPointsMap.has(roundId)) {
      roundPointsMap.set(roundId, new Map());
    }

    roundPointsMap.get(roundId)!.set(teamId, Number(row.round_points ?? 0));
  }

  // Build total team points
  const totalPointsByTeam = new Map(
    teamPointsResult.results.map((row) => [String(row.team_id), Number(row.total_points ?? 0)])
  );

  // Group matches by round
  const matchesByRound = new Map<string, MatchRow[]>();

  for (const match of matchResult.results) {
    const roundId = String(match.round_id);

    if (!matchesByRound.has(roundId)) {
      matchesByRound.set(roundId, []);
    }

    matchesByRound.get(roundId)!.push(match);
  }

  // Assemble rounds
  const rounds = roundResult.results.map((round) => {
    const roundId = String(round.id);
    const roundMatches = matchesByRound.get(roundId) ?? [];
    const roundPointsForRound = roundPointsMap.get(roundId) ?? new Map<string, number>();

    const teamPoints: Record<string, number> = {};

    for (const team of allTeams) {
      teamPoints[team.id] = roundPointsForRound.get(team.id) ?? 0;
    }

    const matchStatuses = roundMatches.map(
      (m) => (m.result_status ?? 'PENDING') as 'PENDING' | 'IN_PROGRESS' | 'FINAL'
    );

    const matches = roundMatches.map((match) => {
      const matchId = String(match.id);
      const sides = sidesByMatch.get(matchId) ?? {
        A: { teamId: '', teamName: '', teamColor: '', playerNames: [] },
        B: { teamId: '', teamName: '', teamColor: '', playerNames: [] },
      };
      const fallbackSeg = firstSegmentByRound.get(roundId);
      const formatCode =
        match.format_override ?? match.segment_format ?? fallbackSeg?.format ?? 'SINGLES';
      const segmentType = match.segment_type ?? fallbackSeg?.segment_type ?? null;

      return {
        id: matchId,
        matchNumber: match.match_number,
        format: FORMAT_LABELS[formatCode],
        segment: toSegmentLabel(segmentType),
        status: (match.result_status ?? 'PENDING') as 'PENDING' | 'IN_PROGRESS' | 'FINAL',
        matchState: toMatchState(match.side_a_holes_won, match.side_b_holes_won),
        closeNotation: match.close_notation ?? null,
        teeTime: match.tee_time ?? null,
        sideA: {
          teamId: sides.A.teamId,
          teamName: sides.A.teamName,
          teamColor: sides.A.teamColor,
          playerNames: sides.A.playerNames,
          points: Number(match.side_a_points ?? 0),
        },
        sideB: {
          teamId: sides.B.teamId,
          teamName: sides.B.teamName,
          teamColor: sides.B.teamColor,
          playerNames: sides.B.playerNames,
          points: Number(match.side_b_points ?? 0),
        },
      };
    });

    return {
      id: roundId,
      roundNumber: round.round_number,
      name: round.course_name ?? `Round ${round.round_number}`,
      scheduledAt: round.scheduled_at,
      status: toRoundStatus(matchStatuses),
      teamPoints,
      matches,
    };
  });

  const teams = allTeams.map((team) => ({
    id: team.id,
    name: team.name,
    color: team.color,
    totalPoints: totalPointsByTeam.get(team.id) ?? 0,
  }));

  return {
    teams,
    rounds,
    pointsToWin: tournament.points_to_win,
  };
};
