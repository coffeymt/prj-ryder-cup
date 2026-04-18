import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { MatchFormat, MatchResultStatus, SideLabel, Team } from '$lib/db/types';

type RoundRow = {
  id: string | number;
  round_number: number;
  scheduled_at: string;
  course_name: string | null;
};

type SegmentRow = {
  round_id: string | number;
  format: MatchFormat;
  hole_start: number;
};

type MatchRow = {
  id: string | number;
  round_id: string | number;
  match_number: number;
  format_override: MatchFormat | null;
  result_status: MatchResultStatus | null;
  close_notation: string | null;
  side_a_holes_won: number | null;
  side_b_holes_won: number | null;
  holes_entered: number | null;
};

type MatchSidePlayerRow = {
  match_id: string | number;
  side_label: SideLabel;
  team_id: string | number;
  team_name: string;
  team_color: string;
  player_id: string | number | null;
  player_name: string | null;
};

type TeamPointsRow = {
  team_id: string | number;
  total_points: number | null;
};

type MutableRoundStats = {
  totalMatches: number;
  matchesWithScores: number;
  finalMatches: number;
};

type MutableSide = {
  sideLabel: SideLabel;
  teamId: string;
  teamName: string;
  teamColor: string;
  playerIds: string[];
  playerNames: string[];
};

type MutableMatch = {
  id: string;
  roundId: string;
  roundName: string;
  matchNumber: number;
  formatCode: MatchFormat;
  resultStatus: MatchResultStatus;
  closeNotation: string | null;
  sideAHolesWon: number;
  sideBHolesWon: number;
  holesEntered: number;
  playerSide: SideLabel | null;
  sides: Record<SideLabel, MutableSide>;
};

type DashboardRound = {
  id: string;
  roundNumber: number;
  scheduledAt: string;
  dateKey: string;
  name: string;
  formatSummary: string;
  status: 'Not started' | 'In progress' | 'Final';
  totalMatches: number;
};

function getDatabaseBinding(platform: App.Platform | undefined): D1Database {
  const db = platform?.env.DB;

  if (!db) {
    throw error(500, 'Database binding is not configured.');
  }

  return db;
}

const MATCH_FORMAT_LABELS: Record<MatchFormat, string> = {
  SCRAMBLE: 'Scramble',
  PINEHURST: 'Pinehurst',
  SHAMBLE: 'Shamble',
  FOURBALL: 'Four-Ball',
  SINGLES: 'Singles'
};

function toDateKey(value: string): string {
  const directMatch = value.match(/^\d{4}-\d{2}-\d{2}/u);

  if (directMatch?.[0]) {
    return directMatch[0];
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.valueOf())) {
    return '';
  }

  return parsed.toISOString().slice(0, 10);
}

function createEmptySide(sideLabel: SideLabel): MutableSide {
  return {
    sideLabel,
    teamId: '',
    teamName: '',
    teamColor: '',
    playerIds: [],
    playerNames: []
  };
}

function toRoundStatus(stats: MutableRoundStats): DashboardRound['status'] {
  if (stats.totalMatches === 0) {
    return 'Not started';
  }

  if (stats.finalMatches === stats.totalMatches) {
    return 'Final';
  }

  if (stats.matchesWithScores > 0 || stats.finalMatches > 0) {
    return 'In progress';
  }

  return 'Not started';
}

function formatMatchStateLabel(match: MutableMatch): string {
  const margin = match.sideAHolesWon - match.sideBHolesWon;

  if (match.resultStatus === 'FINAL') {
    if (match.closeNotation) {
      return `${match.closeNotation} final`;
    }

    if (margin === 0) {
      return 'Halved final';
    }

    if (!match.playerSide) {
      return `${Math.abs(margin)} UP final`;
    }

    const playerIsLeading =
      (margin > 0 && match.playerSide === 'A') || (margin < 0 && match.playerSide === 'B');

    return `${Math.abs(margin)} ${playerIsLeading ? 'UP' : 'DN'} final`;
  }

  if (match.holesEntered === 0) {
    return 'Not started';
  }

  if (margin === 0) {
    return `AS thru ${match.holesEntered}`;
  }

  if (!match.playerSide) {
    const leadingSide = margin > 0 ? 'A' : 'B';
    return `${leadingSide} ${Math.abs(margin)} UP thru ${match.holesEntered}`;
  }

  const playerIsLeading =
    (margin > 0 && match.playerSide === 'A') || (margin < 0 && match.playerSide === 'B');

  return `${Math.abs(margin)} ${playerIsLeading ? 'UP' : 'DN'} thru ${match.holesEntered}`;
}

function buildTeamTotals(
  allTeams: Team[],
  pointsByTeamId: Map<string, number>
): {
  teamA: { name: string; color: string | null; points: number };
  teamB: { name: string; color: string | null; points: number };
} {
  const firstTeam = allTeams[0] ?? null;
  const secondTeam = allTeams[1] ?? null;

  return {
    teamA: {
      name: firstTeam?.name ?? '',
      color: firstTeam?.color ?? null,
      points: firstTeam ? pointsByTeamId.get(firstTeam.id) ?? 0 : 0
    },
    teamB: {
      name: secondTeam?.name ?? '',
      color: secondTeam?.color ?? null,
      points: secondTeam ? pointsByTeamId.get(secondTeam.id) ?? 0 : 0
    }
  };
}

function resolveTargetRoundDate(rounds: DashboardRound[]): string {
  if (rounds.length === 0) {
    return '';
  }

  const todayDateKey = new Date().toISOString().slice(0, 10);
  const roundsWithDates = rounds.filter((round) => round.dateKey.length > 0);

  if (roundsWithDates.some((round) => round.dateKey === todayDateKey)) {
    return todayDateKey;
  }

  const upcoming = roundsWithDates
    .filter((round) => round.dateKey >= todayDateKey)
    .sort((left, right) => left.dateKey.localeCompare(right.dateKey) || left.roundNumber - right.roundNumber);

  if (upcoming.length > 0) {
    return upcoming[0].dateKey;
  }

  if (roundsWithDates.length > 0) {
    return roundsWithDates[roundsWithDates.length - 1].dateKey;
  }

  return rounds[0].dateKey;
}

export const load: PageServerLoad = async (event) => {
  const { tournament, player, team, allTeams } = await event.parent();
  const db = getDatabaseBinding(event.platform);

  const [roundResult, segmentResult, matchResult, sidePlayerResult, teamPointsResult] = await Promise.all([
    db
      .prepare(
        `
          SELECT
            r.id,
            r.round_number,
            r.scheduled_at,
            c.name AS course_name
          FROM rounds r
          LEFT JOIN courses c ON c.id = r.course_id
          WHERE r.tournament_id = ?1
          ORDER BY r.scheduled_at ASC, r.round_number ASC
        `
      )
      .bind(tournament.id)
      .all<RoundRow>(),
    db
      .prepare(
        `
          SELECT
            rs.round_id,
            rs.format,
            rs.hole_start
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
              mr.side_a_holes_won,
              mr.side_b_holes_won,
              ROW_NUMBER() OVER (
                PARTITION BY mr.match_id
                ORDER BY mr.computed_at DESC, mr.id DESC
              ) AS rank_index
            FROM match_results mr
          ),
          holes_entered AS (
            SELECT
              hs.match_id,
              COUNT(DISTINCT hs.hole_number) AS holes_entered
            FROM hole_scores hs
            GROUP BY hs.match_id
          )
          SELECT
            m.id,
            m.round_id,
            m.match_number,
            m.format_override,
            rr.status AS result_status,
            rr.close_notation,
            rr.side_a_holes_won,
            rr.side_b_holes_won,
            he.holes_entered
          FROM matches m
          INNER JOIN rounds r ON r.id = m.round_id
          LEFT JOIN ranked_results rr ON rr.match_id = m.id AND rr.rank_index = 1
          LEFT JOIN holes_entered he ON he.match_id = m.id
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
            msp.player_id,
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
      .all<MatchSidePlayerRow>(),
    db
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
      .bind(tournament.id)
      .all<TeamPointsRow>()
  ]);

  const rounds = roundResult.results;
  const segments = segmentResult.results;
  const matches = matchResult.results;
  const sidePlayers = sidePlayerResult.results;
  const teamPointRows = teamPointsResult.results;

  const roundFormatsById = new Map<string, MatchFormat[]>();

  for (const segment of segments) {
    const roundId = String(segment.round_id);
    const existingFormats = roundFormatsById.get(roundId) ?? [];

    existingFormats.push(segment.format);
    roundFormatsById.set(roundId, existingFormats);
  }

  const roundStatsById = new Map<string, MutableRoundStats>();

  for (const round of rounds) {
    roundStatsById.set(String(round.id), {
      totalMatches: 0,
      matchesWithScores: 0,
      finalMatches: 0
    });
  }

  const mutableMatchesById = new Map<string, MutableMatch>();

  for (const match of matches) {
    const roundId = String(match.round_id);
    const round = rounds.find((candidate) => String(candidate.id) === roundId);
    const roundFormats = roundFormatsById.get(roundId) ?? [];
    const formatCode = match.format_override ?? roundFormats[0] ?? 'SINGLES';
    const holesEntered = Number(match.holes_entered ?? 0);
    const resultStatus = match.result_status ?? 'PENDING';

    const stats = roundStatsById.get(roundId);

    if (stats) {
      stats.totalMatches += 1;

      if (holesEntered > 0) {
        stats.matchesWithScores += 1;
      }

      if (resultStatus === 'FINAL') {
        stats.finalMatches += 1;
      }
    }

    mutableMatchesById.set(String(match.id), {
      id: String(match.id),
      roundId,
      roundName: round?.course_name ?? `Round ${round?.round_number ?? ''}`.trim(),
      matchNumber: match.match_number,
      formatCode,
      resultStatus,
      closeNotation: match.close_notation ?? null,
      sideAHolesWon: Number(match.side_a_holes_won ?? 0),
      sideBHolesWon: Number(match.side_b_holes_won ?? 0),
      holesEntered,
      playerSide: null,
      sides: {
        A: createEmptySide('A'),
        B: createEmptySide('B')
      }
    });
  }

  for (const row of sidePlayers) {
    const matchId = String(row.match_id);
    const match = mutableMatchesById.get(matchId);

    if (!match) {
      continue;
    }

    const side = match.sides[row.side_label];

    if (!side.teamId) {
      side.teamId = String(row.team_id);
      side.teamName = row.team_name;
      side.teamColor = row.team_color;
    }

    if (row.player_id !== null) {
      const playerId = String(row.player_id);

      if (!side.playerIds.includes(playerId)) {
        side.playerIds.push(playerId);
      }

      if (player?.id === playerId) {
        match.playerSide = row.side_label;
      }
    }

    if (row.player_name && !side.playerNames.includes(row.player_name)) {
      side.playerNames.push(row.player_name);
    }
  }

  const allRounds: DashboardRound[] = rounds.map((round) => {
    const roundId = String(round.id);
    const roundFormats = roundFormatsById.get(roundId) ?? [];
    const uniqueFormatLabels = [...new Set(roundFormats.map((format) => MATCH_FORMAT_LABELS[format]))];
    const stats = roundStatsById.get(roundId) ?? {
      totalMatches: 0,
      matchesWithScores: 0,
      finalMatches: 0
    };

    return {
      id: roundId,
      roundNumber: round.round_number,
      scheduledAt: round.scheduled_at,
      dateKey: toDateKey(round.scheduled_at),
      name: round.course_name ?? `Round ${round.round_number}`,
      formatSummary: uniqueFormatLabels.join(' / ') || 'TBD',
      status: toRoundStatus(stats),
      totalMatches: stats.totalMatches
    };
  });

  const targetDateKey = resolveTargetRoundDate(allRounds);
  const todayRounds =
    targetDateKey.length > 0
      ? allRounds.filter((round) => round.dateKey === targetDateKey)
      : allRounds.slice(0, 1);
  const todayRoundIds = new Set(todayRounds.map((round) => round.id));

  const myMatches = player
    ? [...mutableMatchesById.values()]
        .filter((match) => match.playerSide !== null && todayRoundIds.has(match.roundId))
        .map((match) => ({
          id: match.id,
          roundId: match.roundId,
          roundName: match.roundName,
          matchNumber: match.matchNumber,
          format: MATCH_FORMAT_LABELS[match.formatCode],
          status: match.resultStatus,
          statusLabel: formatMatchStateLabel(match),
          enteredHoles: match.holesEntered,
          sides: [match.sides.A, match.sides.B]
        }))
    : [];

  const pointsByTeamId = new Map(
    teamPointRows.map((row) => [String(row.team_id), Number(row.total_points ?? 0)])
  );
  const teamTotals = buildTeamTotals(allTeams, pointsByTeamId);

  return {
    tournament,
    player,
    team,
    todayRounds,
    myMatches,
    teamTotals,
    allRounds
  };
};
