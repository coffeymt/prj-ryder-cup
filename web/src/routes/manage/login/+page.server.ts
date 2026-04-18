import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

function normalizeEmail(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const email = value.trim().toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : null;
}

function getRawEmail(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.role === 'commissioner') {
    throw redirect(302, '/manage');
  }
};

export const actions: Actions = {
  default: async (event) => {
    if (event.locals.role === 'commissioner') {
      throw redirect(302, '/manage');
    }

    const formData = await event.request.formData();
    const rawEmailValue = formData.get('email');
    const email = normalizeEmail(rawEmailValue);

    if (!email) {
      return fail(400, { error: 'Invalid email', email: getRawEmail(rawEmailValue) });
    }

    try {
      const response = await event.fetch('/api/auth/magic-link/request', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        return fail(500, {
          error: 'Could not send magic link. Try again.',
          email,
        });
      }
    } catch {
      return fail(500, {
        error: 'Could not send magic link. Try again.',
        email,
      });
    }

    throw redirect(303, `/manage/magic-link-sent?email=${encodeURIComponent(email)}`);
  },
};
