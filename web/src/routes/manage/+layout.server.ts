import { requireRole } from '$lib/auth/guards';
import { listTournamentsByCommissioner } from '$lib/db/tournaments';
import type { Tournament } from '$lib/db/types';
import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

const PUBLIC_MANAGE_ROUTES = new Set(['/manage/login', '/manage/magic-link-sent']);

function byUpdatedAtDesc(left: Tournament, right: Tournament): number {
  const leftTimestamp = Date.parse(left.updated_at);
  const rightTimestamp = Date.parse(right.updated_at);

  if (Number.isNaN(leftTimestamp) || Number.isNaN(rightTimestamp)) {
    return right.updated_at.localeCompare(left.updated_at);
  }

  return rightTimestamp - leftTimestamp;
}

export const load: LayoutServerLoad = async (event) => {
  const routeId = event.route.id ?? '';

  if (PUBLIC_MANAGE_ROUTES.has(routeId)) {
    return {
      tournaments: [],
      currentTournamentId: null
    };
  }

  try {
    requireRole(event.locals, 'commissioner');
  } catch {
    throw redirect(302, '/manage/login');
  }

  const commissionerUserId = event.locals.userId;

  if (!commissionerUserId) {
    throw redirect(302, '/manage/login');
  }

  const db = event.platform?.env?.DB;

  if (!db) {
    throw error(500, 'Database binding is not configured.');
  }

  const tournaments = await listTournamentsByCommissioner(db, commissionerUserId);
  const sortedTournaments = [...tournaments].sort(byUpdatedAtDesc);
  const mostRecentlyUpdatedTournament = sortedTournaments[0] ?? null;
  const currentTournamentId = event.params.id ?? mostRecentlyUpdatedTournament?.id ?? null;

  if (routeId === '/manage' && mostRecentlyUpdatedTournament) {
    throw redirect(303, `/manage/tournaments/${mostRecentlyUpdatedTournament.id}`);
  }

  return {
    tournaments: sortedTournaments,
    currentTournamentId
  };
};
