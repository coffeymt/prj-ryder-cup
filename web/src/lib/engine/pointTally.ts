import type { SubMatchResult, TournamentPointTally } from './types';

export interface PointOverride {
  teamId: number;
  deltaPoints: number;
  reason: string;
}

export function computeTournamentTally(
  subMatchResults: SubMatchResult[],
  teamAId: number,
  teamBId: number,
  pointsToWin: number,
  overrides: PointOverride[] = []
): TournamentPointTally {
  // Two-team tournament assumption: each sub-match is Team A side vs Team B side.
  // That means sideAPoints always roll up to Team A and sideBPoints to Team B.
  let teamATotal = subMatchResults.reduce((sum, result) => sum + result.sideAPoints, 0);
  let teamBTotal = subMatchResults.reduce((sum, result) => sum + result.sideBPoints, 0);

  for (const override of overrides) {
    if (override.teamId === teamAId) {
      teamATotal += override.deltaPoints;
      continue;
    }

    if (override.teamId === teamBId) {
      teamBTotal += override.deltaPoints;
    }
  }

  const leader =
    teamATotal > teamBTotal
      ? 'A'
      : teamATotal < teamBTotal
        ? 'B'
        : 'AS';

  return {
    teamAId,
    teamBId,
    teamATotal,
    teamBTotal,
    pointsToWin,
    leader,
    subMatchResults: subMatchResults.slice()
  };
}
