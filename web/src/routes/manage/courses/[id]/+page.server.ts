import { requireRole } from '$lib/auth/guards';
import type { Course, Hole, Tee } from '$lib/db/types';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const HOLE_COUNT = 18;
const MIN_STROKE_INDEX = 1;
const MAX_STROKE_INDEX = 18;

type CourseApiResponse = {
  course: Course;
  tees: Tee[];
  holes: Hole[];
};

type HoleInput = {
  holeNumber: number;
  par: number;
  strokeIndex: number;
};

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

type JsonObject = Record<string, unknown>;

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
  const value = formData.get(fieldName);

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing ${fieldName}.`);
  }

  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`Invalid ${fieldName}.`);
  }
}

function asObject(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Payload entry must be an object.');
  }

  return value as JsonObject;
}

function parseHoleInputs(value: unknown): HoleInput[] {
  if (!Array.isArray(value)) {
    throw new Error('Holes must be an array.');
  }

  if (value.length !== HOLE_COUNT) {
    throw new Error(`Exactly ${HOLE_COUNT} holes are required.`);
  }

  const seenHoleNumbers = new Set<number>();
  const seenStrokeIndexes = new Set<number>();

  const parsed = value.map((entry, index) => {
    const hole = asObject(entry);
    const holeNumber = readRequiredNumber(hole.holeNumber, `Hole ${index + 1} number`, {
      integer: true,
      min: 1,
    });
    const par = readRequiredNumber(hole.par, `Hole ${holeNumber} par`, {
      integer: true,
      min: 1,
    });
    const strokeIndex = readRequiredNumber(hole.strokeIndex, `Hole ${holeNumber} stroke index`, {
      integer: true,
      min: 1,
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

  return parsed.sort((left, right) => left.holeNumber - right.holeNumber);
}

function toHoleGrid(tees: Tee[], holes: Hole[]): HoleInput[] {
  const firstTeeId = tees[0]?.id;

  if (!firstTeeId) {
    return Array.from({ length: HOLE_COUNT }, (_, index) => ({
      holeNumber: index + 1,
      par: 4,
      strokeIndex: index + 1,
    }));
  }

  const byHoleNumber = new Map<number, Hole>();

  for (const hole of holes) {
    if (hole.tee_id === firstTeeId) {
      byHoleNumber.set(hole.hole_number, hole);
    }
  }

  return Array.from({ length: HOLE_COUNT }, (_, index) => {
    const holeNumber = index + 1;
    const existing = byHoleNumber.get(holeNumber);

    return {
      holeNumber,
      par: existing?.par ?? 4,
      strokeIndex: existing?.stroke_index ?? holeNumber,
    };
  });
}

function splitFormatUnavailable(tees: Tee[]): boolean {
  return tees.some(
    (tee) =>
      tee.cr9f === null ||
      tee.slope9f === null ||
      tee.par9f === null ||
      tee.cr9b === null ||
      tee.slope9b === null ||
      tee.par9b === null
  );
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

async function loadCourse(
  event: Parameters<PageServerLoad>[0],
  courseId: string
): Promise<CourseApiResponse> {
  const response = await event.fetch(`/api/courses/${encodeURIComponent(courseId)}`);

  if (response.status === 404) {
    throw error(404, 'Course not found.');
  }

  if (!response.ok) {
    throw error(response.status, await readApiErrorMessage(response, 'Could not load course.'));
  }

  return (await response.json()) as CourseApiResponse;
}

export const load: PageServerLoad = async (event) => {
  requireRole(event.locals, 'commissioner');
  const payload = await loadCourse(event, event.params.id);

  return {
    course: payload.course,
    tees: payload.tees,
    holes: toHoleGrid(payload.tees, payload.holes),
    splitFormatUnavailable: splitFormatUnavailable(payload.tees),
  };
};

export const actions: Actions = {
  updateCourse: async (event) => {
    requireRole(event.locals, 'commissioner');

    try {
      const formData = await event.request.formData();
      const name = readRequiredString(formData.get('name'), 'Course name');
      const location = readOptionalString(formData.get('location'));
      const response = await event.fetch(`/api/courses/${encodeURIComponent(event.params.id)}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name, location }),
      });

      if (!response.ok) {
        return fail(response.status >= 500 ? 500 : 400, {
          error: await readApiErrorMessage(response, 'Could not update course details.'),
        });
      }

      return {
        success: 'Course details updated.',
      };
    } catch (cause) {
      return fail(400, {
        error: cause instanceof Error ? cause.message : 'Could not update course details.',
      });
    }
  },

  addTee: async (event) => {
    requireRole(event.locals, 'commissioner');

    try {
      const formData = await event.request.formData();
      const teePayload: TeePayload = {
        name: readRequiredString(formData.get('name'), 'Tee name'),
        cr18: readRequiredNumber(formData.get('cr18'), 'CR 18', { min: 1 }),
        slope18: readRequiredNumber(formData.get('slope18'), 'Slope 18', {
          integer: true,
          min: 1,
        }),
        par18: readRequiredNumber(formData.get('par18'), 'Par 18', {
          integer: true,
          min: 1,
        }),
        cr9F: readOptionalNumber(formData.get('cr9F'), 'CR 9F', { min: 1 }),
        slope9F: readOptionalNumber(formData.get('slope9F'), 'Slope 9F', {
          integer: true,
          min: 1,
        }),
        par9F: readOptionalNumber(formData.get('par9F'), 'Par 9F', {
          integer: true,
          min: 1,
        }),
        cr9B: readOptionalNumber(formData.get('cr9B'), 'CR 9B', { min: 1 }),
        slope9B: readOptionalNumber(formData.get('slope9B'), 'Slope 9B', {
          integer: true,
          min: 1,
        }),
        par9B: readOptionalNumber(formData.get('par9B'), 'Par 9B', {
          integer: true,
          min: 1,
        }),
      };
      const response = await event.fetch(
        `/api/courses/${encodeURIComponent(event.params.id)}/tees`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify(teePayload),
        }
      );

      if (!response.ok) {
        return fail(response.status >= 500 ? 500 : 400, {
          error: await readApiErrorMessage(response, 'Could not add tee.'),
        });
      }

      return {
        success: 'Tee added.',
      };
    } catch (cause) {
      return fail(400, {
        error: cause instanceof Error ? cause.message : 'Could not add tee.',
      });
    }
  },

  updateTee: async (event) => {
    requireRole(event.locals, 'commissioner');

    try {
      const formData = await event.request.formData();
      const teeId = readRequiredString(formData.get('teeId'), 'Tee ID');
      const payload = {
        cr18: readRequiredNumber(formData.get('cr18'), 'CR 18', { min: 1 }),
        slope18: readRequiredNumber(formData.get('slope18'), 'Slope 18', {
          integer: true,
          min: 1,
        }),
        par18: readRequiredNumber(formData.get('par18'), 'Par 18', { integer: true, min: 1 }),
        cr9F: readOptionalNumber(formData.get('cr9F'), 'CR 9F', { min: 1 }),
        slope9F: readOptionalNumber(formData.get('slope9F'), 'Slope 9F', {
          integer: true,
          min: 1,
        }),
        par9F: readOptionalNumber(formData.get('par9F'), 'Par 9F', {
          integer: true,
          min: 1,
        }),
        cr9B: readOptionalNumber(formData.get('cr9B'), 'CR 9B', { min: 1 }),
        slope9B: readOptionalNumber(formData.get('slope9B'), 'Slope 9B', {
          integer: true,
          min: 1,
        }),
        par9B: readOptionalNumber(formData.get('par9B'), 'Par 9B', {
          integer: true,
          min: 1,
        }),
      };
      const response = await event.fetch(
        `/api/courses/${encodeURIComponent(event.params.id)}/tees/${encodeURIComponent(teeId)}`,
        {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        return fail(response.status >= 500 ? 500 : 400, {
          error: await readApiErrorMessage(response, 'Could not update tee.'),
        });
      }

      return {
        success: 'Tee updated.',
      };
    } catch (cause) {
      return fail(400, {
        error: cause instanceof Error ? cause.message : 'Could not update tee.',
      });
    }
  },

  updateHoles: async (event) => {
    requireRole(event.locals, 'commissioner');

    try {
      const formData = await event.request.formData();
      const holes = parseHoleInputs(parseJsonField(formData, 'holesJson'));
      const response = await event.fetch(
        `/api/courses/${encodeURIComponent(event.params.id)}/holes`,
        {
          method: 'PUT',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({ holes }),
        }
      );

      if (!response.ok) {
        return fail(response.status >= 500 ? 500 : 400, {
          error: await readApiErrorMessage(response, 'Could not update holes.'),
        });
      }

      return {
        success: 'Holes updated.',
      };
    } catch (cause) {
      return fail(400, {
        error: cause instanceof Error ? cause.message : 'Could not update holes.',
      });
    }
  },

  deleteTee: async (event) => {
    requireRole(event.locals, 'commissioner');

    try {
      const formData = await event.request.formData();
      const teeId = readRequiredString(formData.get('teeId'), 'Tee ID');
      const response = await event.fetch(
        `/api/courses/${encodeURIComponent(event.params.id)}/tees/${encodeURIComponent(teeId)}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        return fail(response.status >= 500 ? 500 : 400, {
          error: await readApiErrorMessage(response, 'Could not delete tee.'),
        });
      }

      return {
        success: 'Tee deleted.',
      };
    } catch (cause) {
      return fail(400, {
        error: cause instanceof Error ? cause.message : 'Could not delete tee.',
      });
    }
  },
};
