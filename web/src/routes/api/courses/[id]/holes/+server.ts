import { requireRole } from '$lib/auth/guards';
import { getCourseById, listHolesByCourse, listTeesByCourse } from '$lib/db/courses';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type JsonObject = Record<string, unknown>;

type HoleInput = {
  holeNumber: number;
  par: number;
  strokeIndex: number;
};

const MIN_HOLE_NUMBER = 1;
const MAX_HOLE_NUMBER = 18;
const MIN_STROKE_INDEX = 1;
const MAX_STROKE_INDEX = 18;
const EXPECTED_HOLE_COUNT = 18;

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

function readRequiredInteger(source: JsonObject, fieldName: string): number {
  const value = source[fieldName];

  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw error(400, `${fieldName} must be an integer.`);
  }

  return value;
}

function parseHoleInput(value: unknown, index: number): HoleInput {
  const hole = asObject(value, `holes[${index}] must be an object.`);
  const holeNumber = readRequiredInteger(hole, 'holeNumber');
  const par = readRequiredInteger(hole, 'par');
  const strokeIndex = readRequiredInteger(hole, 'strokeIndex');

  if (holeNumber < MIN_HOLE_NUMBER || holeNumber > MAX_HOLE_NUMBER) {
    throw error(400, `holes[${index}].holeNumber must be between ${MIN_HOLE_NUMBER} and ${MAX_HOLE_NUMBER}.`);
  }

  if (par <= 0) {
    throw error(400, `holes[${index}].par must be greater than 0.`);
  }

  if (strokeIndex < MIN_STROKE_INDEX || strokeIndex > MAX_STROKE_INDEX) {
    throw error(
      400,
      `holes[${index}].strokeIndex must be between ${MIN_STROKE_INDEX} and ${MAX_STROKE_INDEX}.`
    );
  }

  return { holeNumber, par, strokeIndex };
}

function parseAndValidateHoles(source: JsonObject): HoleInput[] {
  const rawHoles = source.holes;

  if (!Array.isArray(rawHoles)) {
    throw error(400, 'holes must be an array.');
  }

  if (rawHoles.length !== EXPECTED_HOLE_COUNT) {
    throw error(400, `holes must contain exactly ${EXPECTED_HOLE_COUNT} entries.`);
  }

  const holes = rawHoles.map((hole, index) => parseHoleInput(hole, index));
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

  return holes.sort((a, b) => a.holeNumber - b.holeNumber);
}

export const GET: RequestHandler = async ({ locals, platform, params }) => {
  requireAuthenticated(locals);
  const db = getDb(platform);
  const course = await getCourseById(db, params.id);

  if (!course) {
    throw error(404, 'Course not found.');
  }

  const holes = await listHolesByCourse(db, params.id);
  return json({ holes });
};

export const PUT: RequestHandler = async ({ locals, platform, params, request }) => {
  requireRole(locals, 'commissioner');
  const db = getDb(platform);
  const course = await getCourseById(db, params.id);

  if (!course) {
    throw error(404, 'Course not found.');
  }

  const tees = await listTeesByCourse(db, params.id);

  if (tees.length === 0) {
    throw error(400, 'At least one tee is required before upserting holes.');
  }

  const body = await readBodyObject(request);
  const holes = parseAndValidateHoles(body);
  const timestamp = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];

  statements.push(
    db.prepare(
      `
        DELETE FROM holes
        WHERE tee_id IN (
          SELECT id
          FROM tees
          WHERE course_id = ?1
        )
      `
    ).bind(params.id)
  );

  for (const tee of tees) {
    for (const hole of holes) {
      statements.push(
        db.prepare(
          `
            INSERT INTO holes (id, tee_id, hole_number, par, yardage, stroke_index, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
          `
        ).bind(generateRowId(), tee.id, hole.holeNumber, hole.par, null, hole.strokeIndex, timestamp)
      );
    }
  }

  try {
    await db.batch(statements);
  } catch (cause) {
    if (cause instanceof Error) {
      if (cause.message.includes('UNIQUE constraint failed')) {
        throw error(409, 'Hole data conflicts with existing records.');
      }

      if (cause.message.includes('CHECK constraint failed')) {
        throw error(400, 'Hole data violates schema constraints.');
      }
    }

    throw error(500, 'Failed to upsert holes.');
  }

  const upsertedHoles = await listHolesByCourse(db, params.id);
  return json({ holes: upsertedHoles });
};
