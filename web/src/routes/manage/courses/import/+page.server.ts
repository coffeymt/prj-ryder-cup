import { requireRole } from '$lib/auth/guards';
import { parseCsvToCourseData } from '$lib/courseImport';
import { importFullCourse } from '$lib/db/courses';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const MAX_FILE_SIZE = 1_048_576; // 1 MB

function getDb(platform: App.Platform | undefined): D1Database {
  const db = platform?.env.DB;
  if (!db) throw error(500, 'Database binding is unavailable.');
  return db;
}

export const load: PageServerLoad = async ({ locals }) => {
  requireRole(locals, 'commissioner');
  return {};
};

export const actions: Actions = {
  default: async ({ request, locals, platform }) => {
    requireRole(locals, 'commissioner');
    const db = getDb(platform);
    const formData = await request.formData();
    const file = formData.get('csv');

    if (!(file instanceof File)) {
      return fail(400, { error: 'CSV file is required.' });
    }

    if (file.size > MAX_FILE_SIZE) {
      return fail(400, { error: 'File must not exceed 1 MB.' });
    }

    const text = await file.text();
    const parseResult = parseCsvToCourseData(text);

    if (!parseResult.ok) {
      return fail(400, { errors: parseResult.errors });
    }

    let course;
    try {
      course = await importFullCourse(db, parseResult.courseData);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Import failed.';
      return fail(500, { error: message });
    }

    throw redirect(303, `/manage/courses/${course.id}`);
  },
};
