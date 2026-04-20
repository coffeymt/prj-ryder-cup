import { requireRole } from '$lib/auth/guards';
import { getCourseById } from '$lib/db/courses';
import type { Tee } from '$lib/db/types';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type JsonObject = Record<string, unknown>;

const TEE_COLUMNS = `
  id,
  course_id,
  name,
  color_hex,
  cr18,
  slope18,
  par18,
  cr9f,
  slope9f,
  par9f,
  cr9b,
  slope9b,
  par9b,
  created_at
`;

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

function getFirstDefined(source: JsonObject, keys: string[]): unknown {
  for (const key of keys) {
    if (key in source) {
      return source[key];
    }
  }

  return undefined;
}

function hasAnyKey(source: JsonObject, keys: string[]): boolean {
  return keys.some((key) => key in source);
}

function readRequiredNumber(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw error(400, `${fieldName} must be a finite number.`);
  }

  return value;
}

function readRequiredInteger(value: unknown, fieldName: string): number {
  const parsed = readRequiredNumber(value, fieldName);

  if (!Number.isInteger(parsed)) {
    throw error(400, `${fieldName} must be an integer.`);
  }

  return parsed;
}

function readOptionalNullableNumber(value: unknown, fieldName: string): number | null {
  if (value === null) {
    return null;
  }

  return readRequiredNumber(value, fieldName);
}

function readOptionalNullableInteger(value: unknown, fieldName: string): number | null {
  if (value === null) {
    return null;
  }

  return readRequiredInteger(value, fieldName);
}

function normalizeTee(row: Tee | null): Tee | null {
  if (!row) {
    return null;
  }

  return {
    ...row,
    id: String(row.id),
    course_id: String(row.course_id),
  };
}

async function getTeeByCourseAndId(
  db: D1Database,
  courseId: string,
  teeId: string
): Promise<Tee | null> {
  const row = await db
    .prepare(
      `
        SELECT ${TEE_COLUMNS}
        FROM tees
        WHERE id = ?1 AND course_id = ?2
        LIMIT 1
      `
    )
    .bind(teeId, courseId)
    .first<Tee>();

  return normalizeTee(row);
}

export const PATCH: RequestHandler = async ({ locals, platform, params, request }) => {
  requireRole(locals, 'commissioner');
  const db = getDb(platform);
  const course = await getCourseById(db, params.id);

  if (!course) {
    throw error(404, 'Course not found.');
  }

  const existingTee = await getTeeByCourseAndId(db, params.id, params.teeId);

  if (!existingTee) {
    throw error(404, 'Tee not found for this course.');
  }

  const body = await readBodyObject(request);
  const updates: Array<[string, number | null]> = [];

  if ('cr18' in body) {
    updates.push(['cr18', readRequiredNumber(body.cr18, 'cr18')]);
  }

  if ('slope18' in body) {
    updates.push(['slope18', readRequiredInteger(body.slope18, 'slope18')]);
  }

  if ('par18' in body) {
    updates.push(['par18', readRequiredInteger(body.par18, 'par18')]);
  }

  if (hasAnyKey(body, ['cr9F', 'cr9f'])) {
    updates.push([
      'cr9f',
      readOptionalNullableNumber(getFirstDefined(body, ['cr9F', 'cr9f']), 'cr9F'),
    ]);
  }

  if (hasAnyKey(body, ['slope9F', 'slope9f'])) {
    updates.push([
      'slope9f',
      readOptionalNullableInteger(getFirstDefined(body, ['slope9F', 'slope9f']), 'slope9F'),
    ]);
  }

  if (hasAnyKey(body, ['par9F', 'par9f'])) {
    updates.push([
      'par9f',
      readOptionalNullableInteger(getFirstDefined(body, ['par9F', 'par9f']), 'par9F'),
    ]);
  }

  if (hasAnyKey(body, ['cr9B', 'cr9b'])) {
    updates.push([
      'cr9b',
      readOptionalNullableNumber(getFirstDefined(body, ['cr9B', 'cr9b']), 'cr9B'),
    ]);
  }

  if (hasAnyKey(body, ['slope9B', 'slope9b'])) {
    updates.push([
      'slope9b',
      readOptionalNullableInteger(getFirstDefined(body, ['slope9B', 'slope9b']), 'slope9B'),
    ]);
  }

  if (hasAnyKey(body, ['par9B', 'par9b'])) {
    updates.push([
      'par9b',
      readOptionalNullableInteger(getFirstDefined(body, ['par9B', 'par9b']), 'par9B'),
    ]);
  }

  if (updates.length === 0) {
    return json({ tee: existingTee });
  }

  const setSql = updates.map(([column], index) => `${column} = ?${index + 1}`).join(', ');
  const values = updates.map(([, value]) => value);

  try {
    await db
      .prepare(
        `
          UPDATE tees
          SET ${setSql}
          WHERE id = ?${updates.length + 1} AND course_id = ?${updates.length + 2}
        `
      )
      .bind(...values, params.teeId, params.id)
      .run();
  } catch (cause) {
    if (cause instanceof Error && cause.message.includes('CHECK constraint failed')) {
      throw error(400, 'Tee values violate schema constraints.');
    }

    throw error(500, 'Failed to update tee.');
  }

  const updatedTee = await getTeeByCourseAndId(db, params.id, params.teeId);

  if (!updatedTee) {
    throw error(500, 'Tee was updated but could not be loaded.');
  }

  return json({ tee: updatedTee });
};

export const DELETE: RequestHandler = async ({ locals, platform, params }) => {
  requireRole(locals, 'commissioner');
  const db = getDb(platform);
  const course = await getCourseById(db, params.id);

  if (!course) {
    throw error(404, 'Course not found.');
  }

  const existingTee = await getTeeByCourseAndId(db, params.id, params.teeId);

  if (!existingTee) {
    throw error(404, 'Tee not found for this course.');
  }

  try {
    await db
      .prepare(`DELETE FROM tees WHERE id = ?1 AND course_id = ?2`)
      .bind(params.teeId, params.id)
      .run();
  } catch (cause) {
    if (cause instanceof Error && cause.message.includes('FOREIGN KEY constraint failed')) {
      throw error(409, 'Tee cannot be deleted because it is referenced by other records.');
    }

    throw error(500, 'Failed to delete tee.');
  }

  return json({ deleted: true });
};
