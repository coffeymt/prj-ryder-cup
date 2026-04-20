import { requireRole } from '$lib/auth/guards';
import { listCourses, searchCourses } from '$lib/db/courses';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

type TeeCountRow = {
  course_id: string | number;
  tee_count: number | null;
};

function getDb(platform: App.Platform | undefined): D1Database {
  const db = platform?.env.DB;

  if (!db) {
    throw error(500, 'Database binding is unavailable.');
  }

  return db;
}

export const load: PageServerLoad = async ({ locals, platform, url }) => {
  requireRole(locals, 'commissioner');
  const db = getDb(platform);
  const q = url.searchParams.get('q')?.trim() ?? '';
  const courses = q ? await searchCourses(db, q) : await listCourses(db);
  const teeCountResult = await db
    .prepare(
      `
        SELECT
          course_id,
          COUNT(*) AS tee_count
        FROM tees
        GROUP BY course_id
      `
    )
    .all<TeeCountRow>();

  const teeCountByCourseId = new Map<string, number>(
    teeCountResult.results.map((row) => [String(row.course_id), Number(row.tee_count ?? 0)])
  );

  return {
    q,
    courses: courses.map((course) => ({
      ...course,
      teeCount: teeCountByCourseId.get(course.id) ?? 0,
    })),
  };
};
