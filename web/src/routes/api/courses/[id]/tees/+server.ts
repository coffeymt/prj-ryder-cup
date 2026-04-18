import { requireRole } from '$lib/auth/guards';
import { getCourseById, listTeesByCourse } from '$lib/db/courses';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type JsonObject = Record<string, unknown>;

type TeeCreateInput = {
  name: string;
  colorHex: string | null;
  cr18: number;
  slope18: number;
  par18: number;
  cr9f: number | null;
  slope9f: number | null;
  par9f: number | null;
  cr9b: number | null;
  slope9b: number | null;
  par9b: number | null;
};

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

function generateRowId(): number {
  const values = new Uint32Array(2);
  crypto.getRandomValues(values);
  const id = values[0] * 1_000_000 + (values[1] % 1_000_000);

  return id > 0 ? id : 1;
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

function readRequiredString(source: JsonObject, fieldName: string): string {
  const value = source[fieldName];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw error(400, `${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}

function readRequiredNumber(source: JsonObject, fieldName: string): number {
  const value = source[fieldName];

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw error(400, `${fieldName} must be a finite number.`);
  }

  return value;
}

function readRequiredInteger(source: JsonObject, fieldName: string): number {
  const value = readRequiredNumber(source, fieldName);

  if (!Number.isInteger(value)) {
    throw error(400, `${fieldName} must be an integer.`);
  }

  return value;
}

function getFirstDefined(source: JsonObject, keys: string[]): unknown {
  for (const key of keys) {
    if (key in source) {
      return source[key];
    }
  }

  return undefined;
}

function readOptionalNullableNumber(value: unknown, fieldName: string): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw error(400, `${fieldName} must be a finite number or null.`);
  }

  return value;
}

function readOptionalNullableInteger(value: unknown, fieldName: string): number | null {
  const parsed = readOptionalNullableNumber(value, fieldName);

  if (parsed === null) {
    return null;
  }

  if (!Number.isInteger(parsed)) {
    throw error(400, `${fieldName} must be an integer or null.`);
  }

  return parsed;
}

function readOptionalColorHex(source: JsonObject): string | null {
  const value = getFirstDefined(source, ['colorHex', 'color_hex']);

  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw error(400, 'colorHex must be a string or null.');
  }

  const trimmed = value.trim();

  if (!/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    throw error(400, 'colorHex must be a 6-digit hex color (for example #1F4E79).');
  }

  return trimmed;
}

function parseTeeInput(body: JsonObject): TeeCreateInput {
  return {
    name: readRequiredString(body, 'name'),
    colorHex: readOptionalColorHex(body),
    cr18: readRequiredNumber(body, 'cr18'),
    slope18: readRequiredInteger(body, 'slope18'),
    par18: readRequiredInteger(body, 'par18'),
    cr9f: readOptionalNullableNumber(getFirstDefined(body, ['cr9F', 'cr9f']), 'cr9F'),
    slope9f: readOptionalNullableInteger(getFirstDefined(body, ['slope9F', 'slope9f']), 'slope9F'),
    par9f: readOptionalNullableInteger(getFirstDefined(body, ['par9F', 'par9f']), 'par9F'),
    cr9b: readOptionalNullableNumber(getFirstDefined(body, ['cr9B', 'cr9b']), 'cr9B'),
    slope9b: readOptionalNullableInteger(getFirstDefined(body, ['slope9B', 'slope9b']), 'slope9B'),
    par9b: readOptionalNullableInteger(getFirstDefined(body, ['par9B', 'par9b']), 'par9B')
  };
}

export const GET: RequestHandler = async ({ locals, platform, params }) => {
  requireAuthenticated(locals);
  const db = getDb(platform);
  const course = await getCourseById(db, params.id);

  if (!course) {
    throw error(404, 'Course not found.');
  }

  const tees = await listTeesByCourse(db, params.id);
  return json({ tees });
};

export const POST: RequestHandler = async ({ locals, platform, params, request }) => {
  requireRole(locals, 'commissioner');
  const db = getDb(platform);
  const course = await getCourseById(db, params.id);

  if (!course) {
    throw error(404, 'Course not found.');
  }

  const body = await readBodyObject(request);
  const tee = parseTeeInput(body);
  const teeId = generateRowId();
  const timestamp = new Date().toISOString();

  try {
    await db
      .prepare(
        `
          INSERT INTO tees (
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
          )
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
        `
      )
      .bind(
        teeId,
        params.id,
        tee.name,
        tee.colorHex,
        tee.cr18,
        tee.slope18,
        tee.par18,
        tee.cr9f,
        tee.slope9f,
        tee.par9f,
        tee.cr9b,
        tee.slope9b,
        tee.par9b,
        timestamp
      )
      .run();
  } catch (cause) {
    if (cause instanceof Error) {
      if (cause.message.includes('UNIQUE constraint failed')) {
        throw error(409, 'A tee with this name already exists for this course.');
      }

      if (cause.message.includes('CHECK constraint failed')) {
        throw error(400, 'Tee values violate schema constraints.');
      }
    }

    throw error(500, 'Failed to create tee.');
  }

  const tees = await listTeesByCourse(db, params.id);
  const createdTee = tees.find((entry) => entry.id === String(teeId));

  if (!createdTee) {
    throw error(500, 'Tee was created but could not be loaded.');
  }

  return json({ tee: createdTee }, { status: 201 });
};
