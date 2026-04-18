import { requireRole } from '$lib/auth/guards';
import { getTournamentById } from '$lib/db/tournaments';
import type { Tournament } from '$lib/db/types';
import { error, fail, redirect } from '@sveltejs/kit';
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
    usgaPercent: 75
  },
  {
    key: 'allowanceFourball',
    label: 'Four-Ball allowance',
    defaultPercent: 100,
    usgaPercent: 90
  },
  {
    key: 'allowanceScrambleLow',
    label: 'Scramble low allowance',
    defaultPercent: 35,
    usgaPercent: 35
  },
  {
    key: 'allowanceScrambleHigh',
    label: 'Scramble high allowance',
    defaultPercent: 15,
    usgaPercent: 15
  },
  {
    key: 'allowancePinehurstLow',
    label: 'Pinehurst low allowance',
    defaultPercent: 60,
    usgaPercent: 60
  },
  {
    key: 'allowancePinehurstHigh',
    label: 'Pinehurst high allowance',
    defaultPercent: 40,
    usgaPercent: 40
  },
  {
    key: 'allowanceSingles',
    label: 'Singles allowance',
    defaultPercent: 100,
    usgaPercent: 100
  }
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

function getDb(event: Parameters<PageServerLoad>[0]): D1Database {
  const db = event.platform?.env?.DB;

  if (!db) {
    throw error(500, 'Database binding is not configured.');
  }

  return db;
}

function ratioToPercentString(value: number): string {
  const percentage = Number((value * 100).toFixed(2));
  return Number.isInteger(percentage) ? String(percentage) : String(percentage);
}

function toFormValues(tournament: Tournament): TournamentFormValues {
  return {
    name: tournament.name,
    startDate: tournament.start_date,
    endDate: tournament.end_date,
    pointsToWin: String(tournament.points_to_win),
    spectatorAccess: tournament.public_ticker_enabled === 1 ? 'public' : 'requireCode',
    allowanceShamble: ratioToPercentString(tournament.allowance_shamble),
    allowanceFourball: ratioToPercentString(tournament.allowance_fourball),
    allowanceScrambleLow: ratioToPercentString(tournament.allowance_scramble_low),
    allowanceScrambleHigh: ratioToPercentString(tournament.allowance_scramble_high),
    allowancePinehurstLow: ratioToPercentString(tournament.allowance_pinehurst_low),
    allowancePinehurstHigh: ratioToPercentString(tournament.allowance_pinehurst_high),
    allowanceSingles: ratioToPercentString(tournament.allowance_singles)
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

function readValues(formData: FormData, defaults: TournamentFormValues): TournamentFormValues {
  const values: TournamentFormValues = {
    ...defaults,
    name: typeof formData.get('name') === 'string' ? String(formData.get('name')).trim() : defaults.name,
    startDate:
      typeof formData.get('startDate') === 'string'
        ? String(formData.get('startDate')).trim()
        : defaults.startDate,
    endDate:
      typeof formData.get('endDate') === 'string' ? String(formData.get('endDate')).trim() : defaults.endDate,
    pointsToWin:
      typeof formData.get('pointsToWin') === 'string'
        ? String(formData.get('pointsToWin')).trim()
        : defaults.pointsToWin,
    spectatorAccess:
      formData.get('spectatorAccess') === 'public' || formData.get('spectatorAccess') === 'requireCode'
        ? (formData.get('spectatorAccess') as SpectatorAccess)
        : defaults.spectatorAccess
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

  const parsedPointsToWin = parseBoundedNumber(values.pointsToWin, MIN_POINTS_TO_WIN, Number.POSITIVE_INFINITY);

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

  if (Object.keys(errors).length > 0 || parsedStartDate === null || parsedEndDate === null || parsedPointsToWin === null) {
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
      ...parsedAllowances
    }
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

async function requireOwnedTournament(
  event: Parameters<PageServerLoad>[0]
): Promise<{ tournament: Tournament; tournamentId: string }> {
  try {
    requireRole(event.locals, 'commissioner');
  } catch {
    throw redirect(302, '/manage/login');
  }

  if (!event.locals.userId) {
    throw redirect(302, '/manage/login');
  }

  const tournamentId = event.params.id;

  if (!tournamentId) {
    throw error(400, 'Tournament id is required.');
  }

  const tournament = await getTournamentById(getDb(event), tournamentId);

  if (!tournament) {
    throw error(404, 'Tournament not found.');
  }

  if (tournament.commissioner_email !== event.locals.userId) {
    throw error(403, 'Forbidden');
  }

  return { tournament, tournamentId };
}

export const load: PageServerLoad = async (event) => {
  const { tournament } = await requireOwnedTournament(event);

  return {
    allowanceFields: ALLOWANCE_FIELDS,
    tournament: toFormValues(tournament),
    eventCode: tournament.code
  };
};

export const actions: Actions = {
  save: async (event) => {
    const { tournament, tournamentId } = await requireOwnedTournament(event);
    const defaults = toFormValues(tournament);
    const values = readValues(await event.request.formData(), defaults);
    const validationResult = validateValues(values);

    if (!validationResult.parsed) {
      return fail(400, {
        action: 'save',
        values,
        eventCode: tournament.code,
        errors: validationResult.errors
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
      allowanceSingles: parsedValues.allowanceSingles / 100
    };

    let response: Response;

    try {
      response = await event.fetch(`/api/tournaments/${tournamentId}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
    } catch {
      return fail(500, {
        action: 'save',
        values,
        eventCode: tournament.code,
        errors: {
          form: 'Could not save tournament settings. Please try again.'
        }
      });
    }

    if (!response.ok) {
      const apiError = await readApiErrorMessage(response, 'Could not save tournament settings. Please try again.');

      return fail(response.status, {
        action: 'save',
        values,
        eventCode: tournament.code,
        errors: {
          form: apiError
        }
      });
    }

    const payload = (await response.json()) as { code?: unknown };
    const eventCode = typeof payload.code === 'string' ? payload.code : tournament.code;

    return {
      action: 'save',
      values,
      eventCode,
      success: 'Tournament settings saved.'
    };
  },

  regenerate: async (event) => {
    const { tournament, tournamentId } = await requireOwnedTournament(event);
    const values = toFormValues(tournament);

    let response: Response;

    try {
      response = await event.fetch(`/api/tournaments/${tournamentId}/regenerate-code`, {
        method: 'POST'
      });
    } catch {
      return fail(500, {
        action: 'regenerate',
        values,
        eventCode: tournament.code,
        errors: {
          form: 'Could not regenerate the event code. Please try again.'
        }
      });
    }

    if (!response.ok) {
      const apiError = await readApiErrorMessage(response, 'Could not regenerate the event code. Please try again.');

      return fail(response.status, {
        action: 'regenerate',
        values,
        eventCode: tournament.code,
        errors: {
          form: apiError
        }
      });
    }

    const payload = (await response.json()) as { code?: unknown };
    const eventCode = typeof payload.code === 'string' ? payload.code : null;

    if (!eventCode) {
      return fail(500, {
        action: 'regenerate',
        values,
        eventCode: tournament.code,
        errors: {
          form: 'Event code regenerated, but no new code was returned.'
        }
      });
    }

    return {
      action: 'regenerate',
      values,
      eventCode,
      success: 'Event code regenerated.'
    };
  },

  archive: async (event) => {
    const { tournament, tournamentId } = await requireOwnedTournament(event);
    const values = toFormValues(tournament);

    let response: Response;

    try {
      response = await event.fetch(`/api/tournaments/${tournamentId}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({ status: 'archived' })
      });
    } catch {
      return fail(500, {
        action: 'archive',
        values,
        eventCode: tournament.code,
        errors: {
          form: 'Could not archive tournament. Please try again.'
        }
      });
    }

    if (!response.ok) {
      const apiError = await readApiErrorMessage(response, 'Could not archive tournament. Please try again.');

      return fail(response.status, {
        action: 'archive',
        values,
        eventCode: tournament.code,
        errors: {
          form: apiError
        }
      });
    }

    return {
      action: 'archive',
      values,
      eventCode: tournament.code,
      success: 'Tournament archived.'
    };
  }
};
