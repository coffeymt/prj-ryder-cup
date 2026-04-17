import { describe, expect, it } from 'vitest';
import { computeMatchState } from './matchState';
import type { HoleResult, HoleResultValue } from './types';

const SIDE_A_ID = 1;
const SIDE_B_ID = 2;
const POINTS_AVAILABLE = 1;

function createHoleResults(sequence: HoleResultValue[]): HoleResult[] {
  return sequence.map((result, index) => {
    if (result === 'A_WINS') {
      return {
        holeNumber: index + 1,
        result,
        sideANet: 4,
        sideBNet: 5,
      };
    }

    if (result === 'B_WINS') {
      return {
        holeNumber: index + 1,
        result,
        sideANet: 5,
        sideBNet: 4,
      };
    }

    if (result === 'HALVED') {
      return {
        holeNumber: index + 1,
        result,
        sideANet: 4,
        sideBNet: 4,
      };
    }

    return {
      holeNumber: index + 1,
      result: 'PENDING',
      sideANet: null,
      sideBNet: null,
    };
  });
}

function expectPointSum(statePointsA: number, statePointsB: number, pointsAvailable: number): void {
  expect(statePointsA + statePointsB).toBe(pointsAvailable);
}

describe('computeMatchState', () => {
  it('1) empty match is pending and all square', () => {
    const state = computeMatchState([], 18, POINTS_AVAILABLE, SIDE_A_ID, SIDE_B_ID);

    expect(state.status).toBe('PENDING');
    expect(state.summary).toBe('AS');
    expect(state.holesUp).toBe(0);
    expect(state.holesPlayed).toBe(0);
    expect(state.holesRemaining).toBe(18);
    expect(state.leadingSideId).toBeNull();
    expectPointSum(state.sideA.pointsEarned, state.sideB.pointsEarned, POINTS_AVAILABLE);
  });

  it('2) all square after 5 holes', () => {
    const sequence: HoleResultValue[] = ['A_WINS', 'B_WINS', 'HALVED', 'A_WINS', 'B_WINS'];
    const state = computeMatchState(
      createHoleResults(sequence),
      18,
      POINTS_AVAILABLE,
      SIDE_A_ID,
      SIDE_B_ID
    );

    expect(state.status).toBe('IN_PROGRESS');
    expect(state.summary).toBe('AS');
    expect(state.holesPlayed).toBe(5);
    expect(state.holesRemaining).toBe(13);
    expect(state.sideA.holesWon).toBe(2);
    expect(state.sideB.holesWon).toBe(2);
    expect(state.sideA.holesSplit).toBe(1);
    expect(state.sideB.holesSplit).toBe(1);
    expect(state.leadingSideId).toBeNull();
    expectPointSum(state.sideA.pointsEarned, state.sideB.pointsEarned, POINTS_AVAILABLE);
  });

  it('3) side A is 2 UP through 5 holes (in progress)', () => {
    const sequence: HoleResultValue[] = ['A_WINS', 'A_WINS', 'HALVED', 'A_WINS', 'B_WINS'];
    const state = computeMatchState(
      createHoleResults(sequence),
      18,
      POINTS_AVAILABLE,
      SIDE_A_ID,
      SIDE_B_ID
    );

    expect(state.status).toBe('IN_PROGRESS');
    expect(state.summary).toBe('2 UP');
    expect(state.holesUp).toBe(2);
    expect(state.holesRemaining).toBe(13);
    expect(state.leadingSideId).toBe(SIDE_A_ID);
    expectPointSum(state.sideA.pointsEarned, state.sideB.pointsEarned, POINTS_AVAILABLE);
  });

  it('4) dormie 3 in an 18-hole match', () => {
    const sequence: HoleResultValue[] = [
      'A_WINS',
      'HALVED',
      'B_WINS',
      'A_WINS',
      'A_WINS',
      'B_WINS',
      'A_WINS',
      'B_WINS',
      'A_WINS',
      'HALVED',
      'A_WINS',
      'B_WINS',
      'A_WINS',
      'B_WINS',
      'A_WINS',
    ];
    const state = computeMatchState(
      createHoleResults(sequence),
      18,
      POINTS_AVAILABLE,
      SIDE_A_ID,
      SIDE_B_ID
    );

    expect(state.status).toBe('DORMIE');
    expect(state.summary).toBe('DORMIE');
    expect(state.holesUp).toBe(3);
    expect(state.holesRemaining).toBe(3);
    expect(state.leadingSideId).toBe(SIDE_A_ID);
    expectPointSum(state.sideA.pointsEarned, state.sideB.pointsEarned, POINTS_AVAILABLE);
  });

  it('5) match closes 4&3 and awards full points to the winner', () => {
    const sequence: HoleResultValue[] = [
      'A_WINS',
      'A_WINS',
      'B_WINS',
      'A_WINS',
      'HALVED',
      'A_WINS',
      'B_WINS',
      'A_WINS',
      'A_WINS',
      'B_WINS',
      'A_WINS',
      'A_WINS',
      'B_WINS',
      'A_WINS',
      'B_WINS',
    ];
    const state = computeMatchState(
      createHoleResults(sequence),
      18,
      POINTS_AVAILABLE,
      SIDE_A_ID,
      SIDE_B_ID
    );

    expect(state.status).toBe('CLOSED');
    expect(state.closeNotation).toBe('4&3');
    expect(state.summary).toBe('4&3');
    expect(state.holesUp).toBe(4);
    expect(state.holesRemaining).toBe(3);
    expect(state.sideA.pointsEarned).toBe(POINTS_AVAILABLE);
    expect(state.sideB.pointsEarned).toBe(0);
    expectPointSum(state.sideA.pointsEarned, state.sideB.pointsEarned, POINTS_AVAILABLE);
  });

  it('6) match is halved after 18 holes', () => {
    const sequence: HoleResultValue[] = [
      'A_WINS',
      'B_WINS',
      'A_WINS',
      'B_WINS',
      'A_WINS',
      'B_WINS',
      'A_WINS',
      'B_WINS',
      'A_WINS',
      'B_WINS',
      'A_WINS',
      'B_WINS',
      'A_WINS',
      'B_WINS',
      'A_WINS',
      'B_WINS',
      'A_WINS',
      'B_WINS',
    ];
    const state = computeMatchState(
      createHoleResults(sequence),
      18,
      POINTS_AVAILABLE,
      SIDE_A_ID,
      SIDE_B_ID
    );

    expect(state.status).toBe('FINAL');
    expect(state.closeNotation).toBe('HALVED');
    expect(state.summary).toBe('HALVED');
    expect(state.holesUp).toBe(0);
    expect(state.holesRemaining).toBe(0);
    expect(state.sideA.holesWon).toBe(9);
    expect(state.sideB.holesWon).toBe(9);
    expect(state.sideA.pointsEarned).toBe(0.5);
    expect(state.sideB.pointsEarned).toBe(0.5);
    expectPointSum(state.sideA.pointsEarned, state.sideB.pointsEarned, POINTS_AVAILABLE);
  });

  it('7) match is won 1UP on the 18th hole', () => {
    const sequence: HoleResultValue[] = [
      'A_WINS',
      'B_WINS',
      'A_WINS',
      'B_WINS',
      'A_WINS',
      'B_WINS',
      'A_WINS',
      'B_WINS',
      'A_WINS',
      'B_WINS',
      'A_WINS',
      'B_WINS',
      'A_WINS',
      'B_WINS',
      'A_WINS',
      'B_WINS',
      'A_WINS',
      'HALVED',
    ];
    const state = computeMatchState(
      createHoleResults(sequence),
      18,
      POINTS_AVAILABLE,
      SIDE_A_ID,
      SIDE_B_ID
    );

    expect(state.status).toBe('FINAL');
    expect(state.closeNotation).toBe('1UP');
    expect(state.summary).toBe('1 UP');
    expect(state.holesUp).toBe(1);
    expect(state.holesRemaining).toBe(0);
    expect(state.sideA.pointsEarned).toBe(POINTS_AVAILABLE);
    expect(state.sideB.pointsEarned).toBe(0);
    expectPointSum(state.sideA.pointsEarned, state.sideB.pointsEarned, POINTS_AVAILABLE);
  });

  it('8) match closes early 3&2', () => {
    const sequence: HoleResultValue[] = [
      'A_WINS',
      'B_WINS',
      'A_WINS',
      'HALVED',
      'A_WINS',
      'B_WINS',
      'A_WINS',
      'A_WINS',
      'B_WINS',
      'A_WINS',
      'B_WINS',
      'A_WINS',
      'B_WINS',
      'A_WINS',
      'B_WINS',
      'A_WINS',
    ];
    const state = computeMatchState(
      createHoleResults(sequence),
      18,
      POINTS_AVAILABLE,
      SIDE_A_ID,
      SIDE_B_ID
    );

    expect(state.status).toBe('CLOSED');
    expect(state.closeNotation).toBe('3&2');
    expect(state.summary).toBe('3&2');
    expect(state.holesUp).toBe(3);
    expect(state.holesRemaining).toBe(2);
    expect(state.sideA.pointsEarned).toBe(POINTS_AVAILABLE);
    expect(state.sideB.pointsEarned).toBe(0);
    expectPointSum(state.sideA.pointsEarned, state.sideB.pointsEarned, POINTS_AVAILABLE);
  });

  it('9) dormie 2 in a 9-hole sub-match', () => {
    const sequence: HoleResultValue[] = [
      'A_WINS',
      'B_WINS',
      'A_WINS',
      'HALVED',
      'A_WINS',
      'B_WINS',
      'A_WINS',
    ];
    const state = computeMatchState(
      createHoleResults(sequence),
      9,
      POINTS_AVAILABLE,
      SIDE_A_ID,
      SIDE_B_ID
    );

    expect(state.status).toBe('DORMIE');
    expect(state.summary).toBe('DORMIE');
    expect(state.holesUp).toBe(2);
    expect(state.holesRemaining).toBe(2);
    expect(state.leadingSideId).toBe(SIDE_A_ID);
    expectPointSum(state.sideA.pointsEarned, state.sideB.pointsEarned, POINTS_AVAILABLE);
  });

  it('10) 9-hole sub-match is halved', () => {
    const sequence: HoleResultValue[] = [
      'A_WINS',
      'B_WINS',
      'HALVED',
      'A_WINS',
      'B_WINS',
      'A_WINS',
      'B_WINS',
      'A_WINS',
      'B_WINS',
    ];
    const state = computeMatchState(
      createHoleResults(sequence),
      9,
      POINTS_AVAILABLE,
      SIDE_A_ID,
      SIDE_B_ID
    );

    expect(state.status).toBe('FINAL');
    expect(state.closeNotation).toBe('HALVED');
    expect(state.summary).toBe('HALVED');
    expect(state.holesPlayed).toBe(9);
    expect(state.holesRemaining).toBe(0);
    expect(state.holesUp).toBe(0);
    expect(state.sideA.pointsEarned).toBe(0.5);
    expect(state.sideB.pointsEarned).toBe(0.5);
    expectPointSum(state.sideA.pointsEarned, state.sideB.pointsEarned, POINTS_AVAILABLE);
  });
});
