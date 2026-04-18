import { requireRole, requireSameTournament } from '$lib/auth/guards';
import { listCourses } from '$lib/db/courses';
import { listRoundsByTournament, listSegmentsByRound } from '$lib/db/rounds';
import { getTournamentById } from '$lib/db/tournaments';
import type { MatchFormat, RoundSegment, SegmentType } from '$lib/db/types';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

type RoundStatus = 'draft' | 'inProgress' | 'complete';

const STATUS_VALUES = new Set<RoundStatus>(['draft', 'inProgress', 'complete']);

const FORMAT_LABELS: Record<MatchFormat, string> = {
  SCRAMBLE: 'Scramble',
  PINEHURST: 'Pinehurst',
  SHAMBLE: 'Shamble',
  FOURBALL: 'Four-Ball',
  SINGLES: 'Singles'
};

function getDb(platform: App.Platform | undefined): D1Database {
  const db = platform?.env.DB;

  if (!db) {
    throw error(500, 'Database binding is not configured.');
  }

  return db;
}

function parseRoundNotes(notes: string | null): { name: string | null; status: RoundStatus } {
  if (!notes) {
    return { name: null, status: 'draft' };
  }

  try {
    const parsed = JSON.parse(notes) as { name?: unknown; status?: unknown };
    const name =
      typeof parsed.name === 'string' && parsed.name.trim().length > 0 ? parsed.name.trim() : null;
    const status =
      typeof parsed.status === 'string' && STATUS_VALUES.has(parsed.status as RoundStatus)
        ? (parsed.status as RoundStatus)
        : 'draft';

    return { name, status };
  } catch {
    return { name: notes, status: 'draft' };
  }
}

function segmentLabel(segmentType: SegmentType): string {
  if (segmentType === 'F9') {
    return 'F9';
  }

  if (segmentType === 'B9') {
    return 'B9';
  }

  return '18';
}

function formatSummary(segments: RoundSegment[]): string {
  if (segments.length === 0) {
    return 'No formats configured';
  }

  return segments
    .map((segment) => `${segmentLabel(segment.segment_type)} ${FORMAT_LABELS[segment.format]}`)
    .join(' + ');
}

function pointsTarget(pointsToWin: number): number {
  return Number((pointsToWin * 2 - 1).toFixed(1));
}

export const load: PageServerLoad = async (event) => {
  requireRole(event.locals, 'commissioner');
  requireSameTournament(event.locals, event.params.id);

  const db = getDb(event.platform);
  const [tournament, rounds, courses] = await Promise.all([
    getTournamentById(db, event.params.id),
    listRoundsByTournament(db, event.params.id),
    listCourses(db)
  ]);

  if (!tournament) {
    throw error(404, 'Tournament not found.');
  }

  const courseNameById = new Map(courses.map((course) => [course.id, course.name] as const));
  const roundsWithSegments = await Promise.all(
    rounds.map(async (round) => {
      const segments = await listSegmentsByRound(db, round.id);
      const metadata = parseRoundNotes(round.notes);
      const roundPoints = segments.reduce((sum, segment) => sum + segment.points_available, 0);

      return {
        id: round.id,
        roundNumber: round.round_number,
        name: metadata.name ?? `Round ${round.round_number}`,
        scheduledAt: round.scheduled_at,
        status: metadata.status,
        courseName: courseNameById.get(round.course_id) ?? 'Unknown course',
        formatSummary: formatSummary(segments),
        points: roundPoints,
        segments
      };
    })
  );

  const configuredPoints = roundsWithSegments.reduce((sum, round) => sum + round.points, 0);

  return {
    tournament,
    rounds: roundsWithSegments,
    configuredPoints,
    targetPoints: pointsTarget(tournament.points_to_win)
  };
};
