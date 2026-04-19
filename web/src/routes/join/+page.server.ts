import { getTournamentById } from '$lib/db/tournaments';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const CODE_PATTERN = /^[A-Z0-9]{6}$/u;
const CODE_FORMAT_ERROR = 'Enter a valid 6-character event code.';

function getDatabaseBinding(platform: App.Platform | undefined): D1Database {
  const db = platform?.env.DB;

  if (!db) {
    throw new Error('Database binding is not configured.');
  }

  return db;
}

function normalizeCode(rawCode: FormDataEntryValue | null): string {
  if (typeof rawCode !== 'string') {
    return '';
  }

  return rawCode.trim().toUpperCase();
}

export const load: PageServerLoad = async (event) => {
  if (event.locals.role === 'player' && event.locals.tournamentId) {
    const db = getDatabaseBinding(event.platform);
    const tournament = await getTournamentById(db, event.locals.tournamentId);

    if (tournament) {
      throw redirect(302, `/t/${encodeURIComponent(tournament.code)}`);
    }
  }

  const queryError = event.url.searchParams.get('error');

  return {
    queryError:
      queryError === 'not_found'
        ? 'Tournament not found. Check the event code and try again.'
        : null,
  };
};

export const actions: Actions = {
  default: async ({ request }) => {
    const formData = await request.formData();
    const normalizedCode = normalizeCode(formData.get('code')).slice(0, 6);

    if (!CODE_PATTERN.test(normalizedCode)) {
      return fail(400, {
        code: normalizedCode,
        codeError: CODE_FORMAT_ERROR,
      });
    }

    throw redirect(303, `/join/${normalizedCode}`);
  },
};
