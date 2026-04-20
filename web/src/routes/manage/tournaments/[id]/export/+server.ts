import { requireRole } from '$lib/auth/guards';
import { escapeCSV, toCSVRow } from '$lib/csv';
import { getTournamentById } from '$lib/db/tournaments';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// ---------------------------------------------------------------------------
// Local types for JOIN query results
// ---------------------------------------------------------------------------

interface MatchExportRow {
  round_number: number;
  scheduled_at: string;
  match_id: string;
  match_number: number;
  format_override: string | null;
  segment_type: string | null;
  segment_format: string | null;
  status: string | null;
  close_notation: string | null;
  side_a_points: number;
  side_b_points: number;
}

interface SideRow {
  match_id: string;
  side_id: string;
  side_label: string;
  team_name: string;
}

interface SidePlayerRow {
  match_side_id: string;
  player_name: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDb(event: Parameters<RequestHandler>[0]): D1Database {
  const db = event.platform?.env?.DB;

  if (!db) {
    throw error(500, 'Database binding is not configured.');
  }

  return db;
}

/**
 * Sanitizes a string so it is safe to embed in a Content-Disposition filename.
 * Replaces characters that are not alphanumeric, hyphen, underscore, or space
 * with a hyphen, then collapses repeated hyphens.
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\-_ ]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

// ---------------------------------------------------------------------------
// GET /manage/tournaments/[id]/export
// ---------------------------------------------------------------------------

export const GET: RequestHandler = async (event) => {
  requireRole(event.locals, 'commissioner');

  const db = getDb(event);
  const tournamentId = event.params.id;

  const tournament = await getTournamentById(db, tournamentId);

  if (!tournament) {
    throw error(404, 'Tournament not found.');
  }

  // ------------------------------------------------------------------
  // Fetch all data with three efficient JOIN queries (no N+1)
  // ------------------------------------------------------------------

  const [matchRowsResult, sidesResult, sidePlayersResult] = await Promise.all([
    // All matches with their results and segment info
    db
      .prepare(
        `
          SELECT
            r.round_number,
            r.scheduled_at,
            m.id AS match_id,
            m.match_number,
            m.format_override,
            rs.segment_type,
            rs.format AS segment_format,
            mr.status,
            mr.close_notation,
            COALESCE(mr.side_a_points, 0) AS side_a_points,
            COALESCE(mr.side_b_points, 0) AS side_b_points
          FROM rounds r
          INNER JOIN matches m ON m.round_id = r.id
          LEFT JOIN match_results mr ON mr.match_id = m.id
          LEFT JOIN round_segments rs ON rs.id = mr.segment_id
          WHERE r.tournament_id = ?1
          ORDER BY r.round_number ASC, m.match_number ASC
        `
      )
      .bind(tournamentId)
      .all<MatchExportRow>(),

    // All match sides with team names
    db
      .prepare(
        `
          SELECT
            ms.match_id,
            ms.id AS side_id,
            ms.side_label,
            t.name AS team_name
          FROM match_sides ms
          INNER JOIN matches m ON m.id = ms.match_id
          INNER JOIN rounds r ON r.id = m.round_id
          INNER JOIN teams t ON t.id = ms.team_id
          WHERE r.tournament_id = ?1
        `
      )
      .bind(tournamentId)
      .all<SideRow>(),

    // All match side players with player names
    db
      .prepare(
        `
          SELECT
            msp.match_side_id,
            p.name AS player_name
          FROM match_side_players msp
          INNER JOIN match_sides ms ON ms.id = msp.match_side_id
          INNER JOIN matches m ON m.id = ms.match_id
          INNER JOIN rounds r ON r.id = m.round_id
          INNER JOIN players p ON p.id = msp.player_id
          WHERE r.tournament_id = ?1
          ORDER BY msp.created_at ASC
        `
      )
      .bind(tournamentId)
      .all<SidePlayerRow>(),
  ]);

  // ------------------------------------------------------------------
  // Build lookup maps for O(1) access when iterating match rows
  // ------------------------------------------------------------------

  const sidesByMatchId = new Map<string, { A: SideRow | null; B: SideRow | null }>();

  for (const side of sidesResult.results) {
    if (!sidesByMatchId.has(side.match_id)) {
      sidesByMatchId.set(side.match_id, { A: null, B: null });
    }

    const entry = sidesByMatchId.get(side.match_id)!;

    if (side.side_label === 'A') {
      entry.A = side;
    } else if (side.side_label === 'B') {
      entry.B = side;
    }
  }

  const playersBySideId = new Map<string, string[]>();

  for (const sp of sidePlayersResult.results) {
    if (!playersBySideId.has(sp.match_side_id)) {
      playersBySideId.set(sp.match_side_id, []);
    }

    playersBySideId.get(sp.match_side_id)!.push(sp.player_name);
  }

  // ------------------------------------------------------------------
  // Build CSV rows
  // ------------------------------------------------------------------

  const header = toCSVRow([
    'Round',
    'Date',
    'Match #',
    'Format',
    'Segment',
    'Team A',
    'Team A Players',
    'Team B',
    'Team B Players',
    'Status',
    'Match State',
    'Team A Points',
    'Team B Points',
  ]);

  let totalTeamAPoints = 0;
  let totalTeamBPoints = 0;
  const dataRows: string[] = [];

  for (const match of matchRowsResult.results) {
    const sides = sidesByMatchId.get(match.match_id);
    const sideA = sides?.A ?? null;
    const sideB = sides?.B ?? null;

    const teamAPlayers = sideA ? (playersBySideId.get(sideA.side_id) ?? []).join(' / ') : '';
    const teamBPlayers = sideB ? (playersBySideId.get(sideB.side_id) ?? []).join(' / ') : '';

    const format = match.format_override ?? match.segment_format ?? '';
    const segment = match.segment_type ?? '';
    const status = match.status ?? 'PENDING';
    const matchState = match.close_notation ?? '';

    // side_a_points and side_b_points are COALESCE'd to 0 in SQL, but
    // D1 may return them as null if the row is absent; guard with ?? 0.
    const sideAPoints = match.side_a_points ?? 0;
    const sideBPoints = match.side_b_points ?? 0;

    totalTeamAPoints += sideAPoints;
    totalTeamBPoints += sideBPoints;

    dataRows.push(
      toCSVRow([
        `Round ${match.round_number}`,
        match.scheduled_at?.split('T')[0] ?? '',
        match.match_number,
        format,
        segment,
        sideA?.team_name ?? '',
        teamAPlayers,
        sideB?.team_name ?? '',
        teamBPlayers,
        status,
        matchState,
        sideAPoints,
        sideBPoints,
      ])
    );
  }

  // Totals row — columns 1-11 empty, then team A and B totals
  const totalsRow = toCSVRow([
    'TOTALS',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    totalTeamAPoints,
    totalTeamBPoints,
  ]);

  const csvContent = header + dataRows.join('') + totalsRow;

  // ------------------------------------------------------------------
  // Return response
  // ------------------------------------------------------------------

  const filename = `${sanitizeFilename(tournament.name)}-results.csv`;

  return new Response(csvContent, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
};
