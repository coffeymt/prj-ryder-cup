import { describe, expect, it } from 'vitest';

import { computeTournamentTally, type PointOverride } from './pointTally';
import type { Segment, SubMatchResult, TournamentPointTally } from './types';

const TEAM_A_ID = 101;
const TEAM_B_ID = 202;

function createSubMatchResult(
  matchId: number,
  pointsAvailable: number,
  sideAPoints: number,
  sideBPoints: number,
  segment: Segment = 'OVERALL'
): SubMatchResult {
  return {
    matchId,
    segmentId: matchId,
    segment,
    pointsAvailable,
    sideAPoints,
    sideBPoints,
    closeNotation: null,
  };
}

function createThirtyPointHalvedResults(): SubMatchResult[] {
  return Array.from({ length: 12 }, (_, index) =>
    createSubMatchResult(index + 1, 2.5, 1.25, 1.25, index % 2 === 0 ? 'F9' : 'B9')
  );
}

function createThirtyPointTeamAWinsAllResults(): SubMatchResult[] {
  return Array.from({ length: 12 }, (_, index) =>
    createSubMatchResult(index + 1, 2.5, 2.5, 0, index % 2 === 0 ? 'F9' : 'B9')
  );
}

function expectedTotalPoints(
  subMatchResults: SubMatchResult[],
  overrides: PointOverride[] = []
): number {
  const subMatchTotal = subMatchResults.reduce((sum, result) => sum + result.pointsAvailable, 0);
  const overrideDelta = overrides.reduce((sum, override) => sum + override.deltaPoints, 0);
  return subMatchTotal + overrideDelta;
}

function expectPointConservation(
  tally: TournamentPointTally,
  subMatchResults: SubMatchResult[],
  overrides: PointOverride[] = []
): void {
  expect(tally.teamATotal + tally.teamBTotal).toBeCloseTo(
    expectedTotalPoints(subMatchResults, overrides)
  );
}

describe('computeTournamentTally', () => {
  it('1) all halved: 30 points total yields 15-15 and AS', () => {
    const subMatchResults = createThirtyPointHalvedResults();
    const tally = computeTournamentTally(subMatchResults, TEAM_A_ID, TEAM_B_ID, 15.5);

    expect(tally.teamATotal).toBe(15);
    expect(tally.teamBTotal).toBe(15);
    expect(tally.leader).toBe('AS');
    expectPointConservation(tally, subMatchResults);
  });

  it('2) team A wins all: 30 points total yields 30-0 and A leads', () => {
    const subMatchResults = createThirtyPointTeamAWinsAllResults();
    const tally = computeTournamentTally(subMatchResults, TEAM_A_ID, TEAM_B_ID, 15.5);

    expect(tally.teamATotal).toBe(30);
    expect(tally.teamBTotal).toBe(0);
    expect(tally.leader).toBe('A');
    expectPointConservation(tally, subMatchResults);
  });

  it('3) mixed with halves: realistic scenario yields 16.5-13.5', () => {
    const subMatchResults: SubMatchResult[] = [
      createSubMatchResult(1, 1, 1, 0, 'F9'),
      createSubMatchResult(2, 1, 0.5, 0.5, 'B9'),
      createSubMatchResult(3, 1, 1, 0, 'F9'),
      createSubMatchResult(4, 1, 1, 0, 'OVERALL'),
      ...Array.from({ length: 26 }, (_, index) =>
        createSubMatchResult(
          index + 5,
          1,
          0.5,
          0.5,
          index % 3 === 0 ? 'F9' : index % 3 === 1 ? 'B9' : 'OVERALL'
        )
      ),
    ];

    const tally = computeTournamentTally(subMatchResults, TEAM_A_ID, TEAM_B_ID, 15.5);

    expect(tally.teamATotal).toBe(16.5);
    expect(tally.teamBTotal).toBe(13.5);
    expect(tally.leader).toBe('A');
    expectPointConservation(tally, subMatchResults);
  });

  it('4) commissioner override can cross points-to-win threshold', () => {
    const subMatchResults = createThirtyPointHalvedResults();
    const overrides: PointOverride[] = [
      { teamId: TEAM_A_ID, deltaPoints: 0.5, reason: 'Weather-adjusted ruling' },
    ];
    const tally = computeTournamentTally(subMatchResults, TEAM_A_ID, TEAM_B_ID, 15.5, overrides);

    expect(tally.teamATotal).toBe(15.5);
    expect(tally.teamBTotal).toBe(15);
    expect(tally.leader).toBe('A');
    expect(tally.teamATotal).toBeGreaterThanOrEqual(tally.pointsToWin);
    expectPointConservation(tally, subMatchResults, overrides);
  });

  it('5) negative override deducts points and supports negative totals when needed', () => {
    const subMatchResults = createThirtyPointHalvedResults();
    const deduction: PointOverride[] = [
      { teamId: TEAM_B_ID, deltaPoints: -1, reason: 'Voided round adjustment' },
    ];
    const tally = computeTournamentTally(subMatchResults, TEAM_A_ID, TEAM_B_ID, 15.5, deduction);

    expect(tally.teamATotal).toBe(15);
    expect(tally.teamBTotal).toBe(14);
    expect(tally.leader).toBe('A');
    expectPointConservation(tally, subMatchResults, deduction);

    const negativeTotals = computeTournamentTally(subMatchResults, TEAM_A_ID, TEAM_B_ID, 15.5, [
      { teamId: TEAM_B_ID, deltaPoints: -20, reason: 'Extreme penalty' },
    ]);
    expect(negativeTotals.teamATotal).toBe(15);
    expect(negativeTotals.teamBTotal).toBe(-5);
    expectPointConservation(negativeTotals, subMatchResults, [
      { teamId: TEAM_B_ID, deltaPoints: -20, reason: 'Extreme penalty' },
    ]);
  });

  it('6) empty sub-match list returns 0-0 and AS', () => {
    const subMatchResults: SubMatchResult[] = [];
    const tally = computeTournamentTally(subMatchResults, TEAM_A_ID, TEAM_B_ID, 15.5);

    expect(tally.teamATotal).toBe(0);
    expect(tally.teamBTotal).toBe(0);
    expect(tally.leader).toBe('AS');
    expectPointConservation(tally, subMatchResults);
  });

  it('7) echoes pointsToWin from input', () => {
    const pointsToWin = 15.5;
    const tally = computeTournamentTally(
      createThirtyPointHalvedResults(),
      TEAM_A_ID,
      TEAM_B_ID,
      pointsToWin
    );

    expect(tally.pointsToWin).toBe(pointsToWin);
  });
});
