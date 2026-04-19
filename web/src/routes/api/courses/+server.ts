import { requireRole } from '$lib/auth/guards';
import { getCourseById, listCourses, listHolesByCourse, listTeesByCourse } from '$lib/db/courses';
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

type HoleInput = {
  holeNumber: number;
  par: number;
  strokeIndex: number;
};

const MIN_HOLE_NUMBER = 1;
const MAX_HOLE_NUMBER = 18;
const MIN_STROKE_INDEX = 1;
const MAX_STROKE_INDEX = 18;

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

function asObject(value: unknown, message: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw error(400, message);
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

function readOptionalNullableString(source: JsonObject, fieldName: string): string | null {
  const value = source[fieldName];

  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw error(400, `${fieldName} must be a string or null.`);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

function getFirstDefined(source: JsonObject, keys: string[]): unknown {
  for (const key of keys) {
    if (key in source) {
      return source[key];
    }
  }

  return undefined;
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

function parseTeeInput(value: unknown, index: number): TeeCreateInput {
  const tee = asObject(value, `tees[${index}] must be an object.`);

  return {
    name: readRequiredString(tee, 'name'),
    colorHex: readOptionalColorHex(tee),
    cr18: readRequiredNumber(tee, 'cr18'),
    slope18: readRequiredInteger(tee, 'slope18'),
    par18: readRequiredInteger(tee, 'par18'),
    cr9f: readOptionalNullableNumber(getFirstDefined(tee, ['cr9F', 'cr9f']), 'cr9F'),
    slope9f: readOptionalNullableInteger(getFirstDefined(tee, ['slope9F', 'slope9f']), 'slope9F'),
    par9f: readOptionalNullableInteger(getFirstDefined(tee, ['par9F', 'par9f']), 'par9F'),
    cr9b: readOptionalNullableNumber(getFirstDefined(tee, ['cr9B', 'cr9b']), 'cr9B'),
    slope9b: readOptionalNullableInteger(getFirstDefined(tee, ['slope9B', 'slope9b']), 'slope9B'),
    par9b: readOptionalNullableInteger(getFirstDefined(tee, ['par9B', 'par9b']), 'par9B'),
  };
}

function parseHoleInput(value: unknown, index: number): HoleInput {
  const hole = asObject(value, `holes[${index}] must be an object.`);
  const holeNumber = readRequiredInteger(hole, 'holeNumber');
  const par = readRequiredInteger(hole, 'par');
  const strokeIndex = readRequiredInteger(hole, 'strokeIndex');

  if (holeNumber < MIN_HOLE_NUMBER || holeNumber > MAX_HOLE_NUMBER) {
    throw error(
      400,
      `holes[${index}].holeNumber must be between ${MIN_HOLE_NUMBER} and ${MAX_HOLE_NUMBER}.`
    );
  }

  if (strokeIndex < MIN_STROKE_INDEX || strokeIndex > MAX_STROKE_INDEX) {
    throw error(
      400,
      `holes[${index}].strokeIndex must be between ${MIN_STROKE_INDEX} and ${MAX_STROKE_INDEX}.`
    );
  }

  if (par <= 0) {
    throw error(400, `holes[${index}].par must be greater than 0.`);
  }

  return { holeNumber, par, strokeIndex };
}

function ensureUniqueHoleNumbersAndStrokeIndexes(holes: HoleInput[]): void {
  const seenHoleNumbers = new Set<number>();
  const seenStrokeIndexes = new Set<number>();

  for (const hole of holes) {
    if (seenHoleNumbers.has(hole.holeNumber)) {
      throw error(400, `Duplicate holeNumber ${hole.holeNumber} in request body.`);
    }

    if (seenStrokeIndexes.has(hole.strokeIndex)) {
      throw error(400, `Duplicate strokeIndex ${hole.strokeIndex} in request body.`);
    }

    seenHoleNumbers.add(hole.holeNumber);
    seenStrokeIndexes.add(hole.strokeIndex);
  }
}

function parseTees(value: unknown): TeeCreateInput[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw error(400, 'tees must be an array.');
  }

  return value.map((tee, index) => parseTeeInput(tee, index));
}

function parseHoles(value: unknown): HoleInput[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw error(400, 'holes must be an array.');
  }

  const holes = value.map((hole, index) => parseHoleInput(hole, index));
  ensureUniqueHoleNumbersAndStrokeIndexes(holes);

  return holes;
}

function throwDatabaseError(cause: unknown): never {
  if (cause instanceof Error) {
    if (cause.message.includes('UNIQUE constraint failed')) {
      throw error(409, 'Course data conflicts with existing records.');
    }

    if (cause.message.includes('CHECK constraint failed')) {
      throw error(400, 'Course data violates schema constraints.');
    }
  }

  throw error(500, 'Course operation failed.');
}

export const GET: RequestHandler = async ({ locals, platform }) => {
  requireAuthenticated(locals);
  const db = getDb(platform);
  const courses = await listCourses(db);

  return json({ courses });
};

export const POST: RequestHandler = async ({ locals, platform, request }) => {
  requireRole(locals, 'commissioner');
  const db = getDb(platform);
  const body = await readBodyObject(request);
  const name = readRequiredString(body, 'name');
  const location = readOptionalNullableString(body, 'location');
  const tees = parseTees(body.tees);
  const holes = parseHoles(body.holes);

  if (holes.length > 0 && tees.length === 0) {
    throw error(400, 'At least one tee is required when holes are provided.');
  }

  const courseId = generateRowId();
  const timestamp = new Date().toISOString();
  const teeIds = tees.map(() => generateRowId());
  const statements: D1PreparedStatement[] = [];

  statements.push(
    db
      .prepare(
        `
        INSERT INTO courses (id, name, location, is_seed, created_at, updated_at)
        VALUES (?1, ?2, ?3, 0, ?4, ?5)
      `
      )
      .bind(courseId, name, location, timestamp, timestamp)
  );

  tees.forEach((tee, index) => {
    const teeId = teeIds[index];

    statements.push(
      db
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
          courseId,
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
    );
  });

  for (const teeId of teeIds) {
    for (const hole of holes) {
      statements.push(
        db
          .prepare(
            `
            INSERT INTO holes (id, tee_id, hole_number, par, yardage, stroke_index, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
          `
          )
          .bind(
            generateRowId(),
            teeId,
            hole.holeNumber,
            hole.par,
            null,
            hole.strokeIndex,
            timestamp
          )
      );
    }
  }

  try {
    await db.batch(statements);
  } catch (cause) {
    throwDatabaseError(cause);
  }

  const course = await getCourseById(db, String(courseId));

  if (!course) {
    throw error(500, 'Course was created but could not be loaded.');
  }

  const createdTees = await listTeesByCourse(db, String(courseId));
  const createdHoles = await listHolesByCourse(db, String(courseId));

  return json(
    {
      course,
      tees: createdTees,
      holes: createdHoles,
    },
    { status: 201 }
  );
};
