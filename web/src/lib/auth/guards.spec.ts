import { describe, expect, it } from 'vitest';
import { requireRole, requireSameTournament } from './guards';

function createLocals(role: App.Locals['role'], tournamentId = 'tournament-1'): App.Locals {
  return {
    role,
    tournamentId,
    playerId: role === 'player' ? 'player-1' : null,
    userId: role === 'commissioner' ? 'user-1' : null,
  };
}

function expectForbidden(fn: () => void): void {
  try {
    fn();
    throw new Error('Expected function to throw 403.');
  } catch (caught) {
    expect(caught).toMatchObject({ status: 403 });
  }
}

describe('requireRole', () => {
  it('passes when the role matches', () => {
    expect(() => requireRole(createLocals('commissioner'), 'commissioner')).not.toThrow();
  });

  it('throws 403 when the role does not match', () => {
    expectForbidden(() => requireRole(createLocals('player'), 'commissioner'));
  });

  it('passes when one of multiple allowed roles matches', () => {
    expect(() => requireRole(createLocals('commissioner'), 'commissioner', 'player')).not.toThrow();
    expect(() => requireRole(createLocals('player'), 'commissioner', 'player')).not.toThrow();
  });
});

describe('requireSameTournament', () => {
  it('passes when the tournament IDs match', () => {
    expect(() => requireSameTournament(createLocals('spectator', 'tournament-9'), 'tournament-9')).not.toThrow();
  });

  it('throws 403 when the tournament IDs differ', () => {
    expectForbidden(() => requireSameTournament(createLocals('spectator', 'tournament-9'), 'tournament-11'));
  });
});
