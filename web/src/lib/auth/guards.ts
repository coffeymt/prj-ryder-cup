import { error } from '@sveltejs/kit';

export function requireRole(locals: App.Locals, ...roles: Array<App.Locals['role']>): void {
  if (roles.includes(locals.role)) {
    return;
  }

  throw error(403, 'Forbidden');
}

export function requireSameTournament(locals: App.Locals, tournamentId: string): void {
  if (locals.tournamentId === tournamentId) {
    return;
  }

  throw error(403, 'Forbidden');
}
