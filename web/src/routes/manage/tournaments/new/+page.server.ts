import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const NAME_MAX_LENGTH = 100;
const MIN_POINTS_TO_WIN = 0.5;
const MIN_ALLOWANCE_PERCENT = 0;
const MAX_ALLOWANCE_PERCENT = 150;

const ALLOWANCE_FIELDS = [
  {
    key: 'allowanceShamble',
    label: 'Shamble allowance',
    defaultPercent: 85,
    usgaPercent: 75,
  },
  {
    key: 'allowanceFourball',
    label: 'Four-Ball allowance',
    defaultPercent: 100,
    usgaPercent: 90,
  },
  {
    key: 'allowanceScrambleLow',
    label: 'Scramble low allowance',
    defaultPercent: 35,
    usgaPercent: 35,
  },
  {
    key: 'allowanceScrambleHigh',
    label: 'Scramble high allowance',
    defaultPercent: 15,
    usgaPercent: 15,
  },
  {
    key: 'allowancePinehurstLow',
    label: 'Pinehurst low allowance',
    defaultPercent: 60,
    usgaPercent: 60,
  },
  {
    key: 'allowancePinehurstHigh',
    label: 'Pinehurst high allowance',
    defaultPercent: 40,
    usgaPercent: 40,
  },
  {
    key: 'allowanceSingles',
    label: 'Singles allowance',
    defaultPercent: 100,
    usgaPercent: 100,
  },
] as const;

type AllowanceFieldConfig = (typeof ALLOWANCE_FIELDS)[number];
type AllowanceFieldKey = AllowanceFieldConfig['key'];
type SpectatorAccess = 'requireCode' | 'public';

type TournamentFormValues = {
  name: string;
  startDate: string;
  endDate: string;
  pointsToWin: string;
  spectatorAccess: SpectatorAccess;
} & Record<AllowanceFieldKey, string>;

type TournamentFormErrors = Partial<Record<keyof TournamentFormValues, string>> & {
  form?: string;
};

type ParsedTournamentValues = {
  name: string;
  startDate: string;
  endDate: string;
  pointsToWin: number;
  spectatorAccess: SpectatorAccess;
} & Record<AllowanceFieldKey, number>;

const ALLOWANCE_FIELD_KEYS = ALLOWANCE_FIELDS.map((field) => field.key) as AllowanceFieldKey[];

function getDefaultValues(): TournamentFormValues {
  return {
    name: '',
    startDate: '',
    endDate: '',
    pointsToWin: '15.5',
    spectatorAccess: 'requireCode',
    allowanceShamble: '85',
    allowanceFourball: '100',
    allowanceScrambleLow: '35',
    allowanceScrambleHigh: '15',
    allowancePinehurstLow: '60',
    allowancePinehurstHigh: '40',
    allowanceSingles: '100',
  };
}

function parseDateInput(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return null;
  }

  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function parseBoundedNumber(value: string, minimum: number, maximum: number): number | null {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    return null;
  }

  return parsed;
}

function readValues(formData: FormData): TournamentFormValues {
  const defaults = getDefaultValues();

  const values: TournamentFormValues = {
    ...defaults,
    name:
      typeof formData.get('name') === 'string'
        ? String(formData.get('name')).trim()
        : defaults.name,
    startDate:
      typeof formData.get('startDate') === 'string'
        ? String(formData.get('startDate')).trim()
        : defaults.startDate,
    endDate:
      typeof formData.get('endDate') === 'string'
        ? String(formData.get('endDate')).trim()
        : defaults.endDate,
    pointsToWin:
      typeof formData.get('pointsToWin') === 'string'
        ? String(formData.get('pointsToWin')).trim()
        : defaults.pointsToWin,
    spectatorAccess:
      formData.get('spectatorAccess') === 'public' ||
      formData.get('spectatorAccess') === 'requireCode'
        ? (formData.get('spectatorAccess') as SpectatorAccess)
        : defaults.spectatorAccess,
  };

  for (const allowanceField of ALLOWANCE_FIELD_KEYS) {
    const formValue = formData.get(allowanceField);
    values[allowanceField] =
      typeof formValue === 'string' ? formValue.trim() : defaults[allowanceField];
  }

  return values;
}

function validateValues(values: TournamentFormValues): {
  errors: TournamentFormErrors;
  parsed: ParsedTournamentValues | null;
} {
  const errors: TournamentFormErrors = {};

  if (values.name.length === 0) {
    errors.name = 'Tournament name is required.';
  } else if (values.name.length > NAME_MAX_LENGTH) {
    errors.name = `Tournament name must be ${NAME_MAX_LENGTH} characters or fewer.`;
  }

  const parsedStartDate = parseDateInput(values.startDate);

  if (parsedStartDate === null) {
    errors.startDate = 'Start date is required.';
  }

  const parsedEndDate = parseDateInput(values.endDate);

  if (parsedEndDate === null) {
    errors.endDate = 'End date is required.';
  }

  if (parsedStartDate !== null && parsedEndDate !== null && parsedEndDate < parsedStartDate) {
    errors.endDate = 'End date must be on or after the start date.';
  }

  const parsedPointsToWin = parseBoundedNumber(
    values.pointsToWin,
    MIN_POINTS_TO_WIN,
    Number.POSITIVE_INFINITY
  );

  if (parsedPointsToWin === null) {
    errors.pointsToWin = `Points to win must be at least ${MIN_POINTS_TO_WIN}.`;
  }

  const parsedAllowances = {} as Record<AllowanceFieldKey, number>;

  for (const allowanceField of ALLOWANCE_FIELD_KEYS) {
    const parsedValue = parseBoundedNumber(
      values[allowanceField],
      MIN_ALLOWANCE_PERCENT,
      MAX_ALLOWANCE_PERCENT
    );

    if (parsedValue === null) {
      errors[allowanceField] =
        `Allowance must be between ${MIN_ALLOWANCE_PERCENT} and ${MAX_ALLOWANCE_PERCENT}.`;
      continue;
    }

    parsedAllowances[allowanceField] = parsedValue;
  }

  if (
    Object.keys(errors).length > 0 ||
    parsedStartDate === null ||
    parsedEndDate === null ||
    parsedPointsToWin === null
  ) {
    return { errors, parsed: null };
  }

  return {
    errors,
    parsed: {
      name: values.name,
      startDate: values.startDate,
      endDate: values.endDate,
      pointsToWin: parsedPointsToWin,
      spectatorAccess: values.spectatorAccess,
      ...parsedAllowances,
    },
  };
}

async function readApiErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: unknown; message?: unknown };

    if (typeof payload.error === 'string' && payload.error.length > 0) {
      return payload.error;
    }

    if (typeof payload.message === 'string' && payload.message.length > 0) {
      return payload.message;
    }
  } catch {
    // Fall through to fallback message.
  }

  return fallbackMessage;
}

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.role !== 'commissioner' || !locals.userId) {
    throw redirect(302, '/manage/login');
  }

  return {
    allowanceFields: ALLOWANCE_FIELDS,
    defaults: getDefaultValues(),
  };
};

export const actions: Actions = {
  default: async (event) => {
    if (event.locals.role !== 'commissioner' || !event.locals.userId) {
      throw redirect(302, '/manage/login');
    }

    const formData = await event.request.formData();
    const values = readValues(formData);
    const validationResult = validateValues(values);

    if (!validationResult.parsed) {
      return fail(400, {
        values,
        errors: validationResult.errors,
      });
    }

    const parsedValues = validationResult.parsed;
    const requestBody = {
      name: parsedValues.name,
      startDate: parsedValues.startDate,
      endDate: parsedValues.endDate,
      pointsToWin: parsedValues.pointsToWin,
      publicTickerEnabled: parsedValues.spectatorAccess === 'public',
      publicTickerRequiresCode: parsedValues.spectatorAccess !== 'public',
      allowanceShamble: parsedValues.allowanceShamble / 100,
      allowanceFourball: parsedValues.allowanceFourball / 100,
      allowanceScrambleLow: parsedValues.allowanceScrambleLow / 100,
      allowanceScrambleHigh: parsedValues.allowanceScrambleHigh / 100,
      allowancePinehurstLow: parsedValues.allowancePinehurstLow / 100,
      allowancePinehurstHigh: parsedValues.allowancePinehurstHigh / 100,
      allowanceSingles: parsedValues.allowanceSingles / 100,
    };

    let response: Response;

    try {
      response = await event.fetch('/api/tournaments', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
    } catch {
      return fail(500, {
        values,
        errors: {
          form: 'Could not create tournament. Please try again.',
        },
      });
    }

    if (!response.ok) {
      const apiError = await readApiErrorMessage(
        response,
        'Could not create tournament. Please try again.'
      );

      return fail(response.status, {
        values,
        errors: {
          form: apiError,
        },
      });
    }

    const payload = (await response.json()) as { id?: unknown };
    const newTournamentId = typeof payload.id === 'string' ? payload.id : null;

    if (!newTournamentId) {
      return fail(500, {
        values,
        errors: {
          form: 'Tournament created, but no tournament id was returned.',
        },
      });
    }

    throw redirect(303, `/manage/tournaments/${newTournamentId}/teams`);
  },
};
