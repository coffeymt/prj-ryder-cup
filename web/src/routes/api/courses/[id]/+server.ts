import { requireRole } from '$lib/auth/guards';
import { getCourseById, listHolesByCourse, listTeesByCourse, updateCourse } from '$lib/db/courses';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type JsonObject = Record<string, unknown>;

function requireAuthenticated(locals: App.Locals): void {
  if (locals.role === 'anonymous') {
    throw error(401, 'Unauthorized');
  }
}

function getDb(platform: App.Platform | undefined): D1Database {
  if (!platform?.env.DB) {
    throw error(500, 'Database binding is unavailable.');
  }

  return platform.env.DB;
}

async function readBodyObject(request: Request): Promise<JsonObject> {
  let value: unknown;

  try {
    value = await request.json();
  } catch {
    throw error(400, 'Request body must be valid JSON.');
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw error(400, 'Request body must be a JSON object.');
  }

  return value as JsonObject;
}

function readOptionalName(source: JsonObject): string | undefined {
  if (!('name' in source)) {
    return undefined;
  }

  const value = source.name;

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw error(400, 'name must be a non-empty string.');
  }

  return value.trim();
}

function readOptionalLocation(source: JsonObject): string | null | undefined {
  if (!('location' in source)) {
    return undefined;
  }

  const value = source.location;

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw error(400, 'location must be a string or null.');
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const GET: RequestHandler = async ({ locals, platform, params }) => {
  requireAuthenticated(locals);
  const db = getDb(platform);
  const course = await getCourseById(db, params.id);

  if (!course) {
    throw error(404, 'Course not found.');
  }

  const [tees, holes] = await Promise.all([
    listTeesByCourse(db, params.id),
    listHolesByCourse(db, params.id),
  ]);

  return json({ course, tees, holes });
};

export const PATCH: RequestHandler = async ({ locals, platform, params, request }) => {
  requireRole(locals, 'commissioner');
  const db = getDb(platform);
  const body = await readBodyObject(request);
  const name = readOptionalName(body);
  const location = readOptionalLocation(body);

  if (name === undefined && location === undefined) {
    throw error(400, 'At least one field (name or location) must be provided.');
  }

  const updatedCourse = await updateCourse(db, params.id, { name, location });

  if (!updatedCourse) {
    throw error(404, 'Course not found.');
  }

  return json({ course: updatedCourse });
};

export const DELETE: RequestHandler = async ({ locals, platform, params }) => {
  requireRole(locals, 'commissioner');
  const db = getDb(platform);
  const existingCourse = await getCourseById(db, params.id);

  if (!existingCourse) {
    throw error(404, 'Course not found.');
  }

  if (existingCourse.is_seed === 1) {
    throw error(403, 'Seed courses cannot be deleted.');
  }

  try {
    await db
      .prepare(
        `
          DELETE FROM courses
          WHERE id = ?1
        `
      )
      .bind(params.id)
      .run();
  } catch (cause) {
    if (cause instanceof Error && cause.message.includes('FOREIGN KEY constraint failed')) {
      throw error(409, 'Course cannot be deleted because it is referenced by other records.');
    }

    throw error(500, 'Failed to delete course.');
  }

  return json({ deleted: true });
};
