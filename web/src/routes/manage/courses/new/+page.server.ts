import { requireRole } from '$lib/auth/guards';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

const MAX_TEES = 5;
const HOLE_COUNT = 18;
const MIN_STROKE_INDEX = 1;
const MAX_STROKE_INDEX = 18;

type TeePayload = {
  name: string;
  cr18: number;
  slope18: number;
  par18: number;
  cr9F: number | null;
  slope9F: number | null;
  par9F: number | null;
  cr9B: number | null;
  slope9B: number | null;
  par9B: number | null;
};

type HolePayload = {
  holeNumber: number;
  par: number;
  strokeIndex: number;
};

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Course submission payload is invalid.');
  }

  return value as JsonObject;
}

function readRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${fieldName} is required.`);
  }

  return value.trim();
}

function readOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readRequiredNumber(
  value: unknown,
  fieldName: string,
  options: { integer?: boolean; min?: number } = {}
): number {
  let parsed: number;

  if (typeof value === 'number') {
    parsed = value;
  } else if (typeof value === 'string' && value.trim().length > 0) {
    parsed = Number(value.trim());
  } else {
    throw new Error(`${fieldName} is required.`);
  }

  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be a valid number.`);
  }

  if (options.integer && !Number.isInteger(parsed)) {
    throw new Error(`${fieldName} must be an integer.`);
  }

  if (options.min !== undefined && parsed < options.min) {
    throw new Error(`${fieldName} must be at least ${options.min}.`);
  }

  return parsed;
}

function readOptionalNumber(
  value: unknown,
  fieldName: string,
  options: { integer?: boolean; min?: number } = {}
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string' && value.trim().length === 0) {
    return null;
  }

  return readRequiredNumber(value, fieldName, options);
}

function parseJsonField(formData: FormData, fieldName: string): unknown {
  const rawValue = formData.get(fieldName);

  if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
    throw new Error(`Missing ${fieldName}.`);
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    throw new Error(`Invalid ${fieldName}.`);
  }
}

function parseTees(value: unknown): TeePayload[] {
  if (!Array.isArray(value)) {
    throw new Error('Tee data must be an array.');
  }

  if (value.length === 0) {
    throw new Error('At least one tee is required.');
  }

  if (value.length > MAX_TEES) {
    throw new Error(`You can add up to ${MAX_TEES} tees.`);
  }

  return value.map((entry, index) => {
    const tee = asObject(entry);
    const teeName = readRequiredString(tee.name, `Tee ${index + 1} name`);

    return {
      name: teeName,
      cr18: readRequiredNumber(tee.cr18, `Tee ${index + 1} CR 18`, { min: 1 }),
      slope18: readRequiredNumber(tee.slope18, `Tee ${index + 1} Slope 18`, {
        integer: true,
        min: 1,
      }),
      par18: readRequiredNumber(tee.par18, `Tee ${index + 1} Par 18`, {
        integer: true,
        min: 1,
      }),
      cr9F: readOptionalNumber(tee.cr9F ?? tee.cr9f, `Tee ${index + 1} CR 9F`, { min: 1 }),
      slope9F: readOptionalNumber(tee.slope9F ?? tee.slope9f, `Tee ${index + 1} Slope 9F`, {
        integer: true,
        min: 1,
      }),
      par9F: readOptionalNumber(tee.par9F ?? tee.par9f, `Tee ${index + 1} Par 9F`, {
        integer: true,
        min: 1,
      }),
      cr9B: readOptionalNumber(tee.cr9B ?? tee.cr9b, `Tee ${index + 1} CR 9B`, { min: 1 }),
      slope9B: readOptionalNumber(tee.slope9B ?? tee.slope9b, `Tee ${index + 1} Slope 9B`, {
        integer: true,
        min: 1,
      }),
      par9B: readOptionalNumber(tee.par9B ?? tee.par9b, `Tee ${index + 1} Par 9B`, {
        integer: true,
        min: 1,
      }),
    };
  });
}

function parseHoles(value: unknown): HolePayload[] {
  if (!Array.isArray(value)) {
    throw new Error('Hole data must be an array.');
  }

  if (value.length !== HOLE_COUNT) {
    throw new Error(`Exactly ${HOLE_COUNT} holes are required.`);
  }

  const seenHoleNumbers = new Set<number>();
  const seenStrokeIndexes = new Set<number>();

  const parsedHoles = value.map((entry, index) => {
    const hole = asObject(entry);
    const holeNumber = readRequiredNumber(hole.holeNumber, `Hole ${index + 1} number`, {
      integer: true,
      min: 1,
    });
    const par = readRequiredNumber(hole.par, `Hole ${holeNumber} par`, { integer: true, min: 1 });
    const strokeIndex = readRequiredNumber(hole.strokeIndex, `Hole ${holeNumber} stroke index`, {
      integer: true,
      min: MIN_STROKE_INDEX,
    });

    if (holeNumber > HOLE_COUNT) {
      throw new Error(`Hole number ${holeNumber} must be between 1 and ${HOLE_COUNT}.`);
    }

    if (![3, 4, 5].includes(par)) {
      throw new Error(`Hole ${holeNumber} par must be 3, 4, or 5.`);
    }

    if (strokeIndex < MIN_STROKE_INDEX || strokeIndex > MAX_STROKE_INDEX) {
      throw new Error(
        `Hole ${holeNumber} stroke index must be between ${MIN_STROKE_INDEX} and ${MAX_STROKE_INDEX}.`
      );
    }

    if (seenHoleNumbers.has(holeNumber)) {
      throw new Error(`Hole number ${holeNumber} is duplicated.`);
    }

    if (seenStrokeIndexes.has(strokeIndex)) {
      throw new Error(`Stroke index ${strokeIndex} is duplicated.`);
    }

    seenHoleNumbers.add(holeNumber);
    seenStrokeIndexes.add(strokeIndex);

    return {
      holeNumber,
      par,
      strokeIndex,
    };
  });

  return parsedHoles.sort((left, right) => left.holeNumber - right.holeNumber);
}

async function readApiErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    try {
      const payload = (await response.json()) as Record<string, unknown>;
      const message = payload.message ?? payload.error;

      if (typeof message === 'string' && message.trim().length > 0) {
        return message;
      }
    } catch {
      return fallbackMessage;
    }
  }

  try {
    const text = (await response.text()).trim();
    return text.length > 0 ? text : fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

export const actions: Actions = {
  default: async (event) => {
    requireRole(event.locals, 'commissioner');

    const formData = await event.request.formData();
    let name: string;
    let location: string | null;
    let tees: TeePayload[];
    let holes: HolePayload[];

    try {
      name = readRequiredString(formData.get('name'), 'Course name');
      location = readOptionalString(formData.get('location'));
      tees = parseTees(parseJsonField(formData, 'teesJson'));
      holes = parseHoles(parseJsonField(formData, 'holesJson'));
    } catch (cause) {
      return fail(400, {
        error: cause instanceof Error ? cause.message : 'Could not create course.',
      });
    }

    const response = await event.fetch('/api/courses', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name,
        location,
        tees,
        holes,
      }),
    });

    if (!response.ok) {
      return fail(response.status >= 500 ? 500 : 400, {
        error: await readApiErrorMessage(response, 'Could not create course.'),
      });
    }

    const payload = (await response.json()) as {
      course?: { id?: string | number };
    };
    const createdCourseId = payload.course?.id;

    if (createdCourseId === undefined || createdCourseId === null) {
      return fail(500, {
        error: 'Course was created but could not be loaded.',
      });
    }

    throw redirect(303, `/manage/courses/${String(createdCourseId)}`);
  },
};
