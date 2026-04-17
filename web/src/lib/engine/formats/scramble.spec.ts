import { describe, expect, it } from 'vitest';

import { computeScrambleResults, type ScrambleSideInput } from './scramble';
import type {
  HandicapIndex,
  HoleScoreInput,
  Par,
  PlayerHandicapInput,
  StrokeIndex,
  TeeData
} from '../types';
import { DEFAULT_ALLOWANCES } from '../types';

const SIDE_A_ID = 1;
const SIDE_B_ID = 2;
const POINTS_AVAILABLE = 1;

const mockTee: TeeData = {
  id: 1,
  name: 'Mock Tee',
  cr18: 71 as unknown as TeeData['cr18'],
  slope18: 130 as unknown as TeeData['slope18'],
  par18: 71 as Par,
  cr9f: 35.5 as unknown as TeeData['cr9f'],
  slope9f: 128 as unknown as TeeData['slope9f'],
  par9f: 35 as Par,
  cr9b: 35.5 as unknown as TeeData['cr9b'],
  slope9b: 132 as unknown as TeeData['slope9b'],
  par9b: 36 as Par,
  holes: Array.from({ length: 18 }, (_, index) => {
    const holeNumber = index + 1;
    return {
      holeNumber,
      par: 4 as Par,
      strokeIndex: holeNumber as StrokeIndex
    };
  })
};

function createPlayers(sideId: number, lowHi: number, highHi: number): PlayerHandicapInput[] {
  return [
    { playerId: sideId * 10 + 1, sideId, handicapIndex: lowHi as HandicapIndex },
    { playerId: sideId * 10 + 2, sideId, handicapIndex: highHi as HandicapIndex }
  ];
}

function createHoleScores(
  sideId: number,
  holeStart: number,
  holeEnd: number,
  values: Record<number, { grossStrokes: number | null; isConceded?: boolean }>
): HoleScoreInput[] {
  const scores: HoleScoreInput[] = [];
  for (let holeNumber = holeStart; holeNumber <= holeEnd; holeNumber += 1) {
    const value = values[holeNumber] ?? { grossStrokes: null };
    scores.push({
      holeNumber,
      playerId: null,
      matchSideId: sideId,
      grossStrokes: value.grossStrokes,
      isConceded: value.isConceded ?? false,
      isPickedUp: false,
      opId: `op-${sideId}-${holeNumber}`
    });
  }
  return scores;
}

function createSide(
  sideId: number,
  players: PlayerHandicapInput[],
  holeScores: HoleScoreInput[]
): ScrambleSideInput {
  return {
    sideId,
    players,
    holeScores
  };
}

describe('computeScrambleResults', () => {
  it('1) closes a full F9 match at 2&1 with Team A ahead by two with one remaining', () => {
    const sideA = createSide(
      SIDE_A_ID,
      createPlayers(SIDE_A_ID, 0, 0),
      createHoleScores(SIDE_A_ID, 1, 9, {
        1: { grossStrokes: 4 },
        2: { grossStrokes: 4 },
        3: { grossStrokes: 5 },
        4: { grossStrokes: 4 },
        5: { grossStrokes: 5 },
        6: { grossStrokes: 4 },
        7: { grossStrokes: 4 },
        8: { grossStrokes: 4 },
        9: { grossStrokes: null }
      })
    );
    const sideB = createSide(
      SIDE_B_ID,
      createPlayers(SIDE_B_ID, 0, 0),
      createHoleScores(SIDE_B_ID, 1, 9, {
        1: { grossStrokes: 5 },
        2: { grossStrokes: 5 },
        3: { grossStrokes: 4 },
        4: { grossStrokes: 5 },
        5: { grossStrokes: 4 },
        6: { grossStrokes: 5 },
        7: { grossStrokes: 4 },
        8: { grossStrokes: 4 },
        9: { grossStrokes: null }
      })
    );

    const state = computeScrambleResults(
      sideA,
      sideB,
      mockTee,
      'F9',
      DEFAULT_ALLOWANCES.scramble,
      POINTS_AVAILABLE
    );

    expect(state.status).toBe('CLOSED');
    expect(state.closeNotation).toBe('2&1');
    expect(state.summary).toBe('2&1');
    expect(state.sideA.holesWon).toBe(4);
    expect(state.sideB.holesWon).toBe(2);
  });

  it('2) returns FINAL HALVED after 9 holes when both teams win the same number of holes', () => {
    const sideA = createSide(
      SIDE_A_ID,
      createPlayers(SIDE_A_ID, 0, 0),
      createHoleScores(SIDE_A_ID, 1, 9, {
        1: { grossStrokes: 4 },
        2: { grossStrokes: 5 },
        3: { grossStrokes: 4 },
        4: { grossStrokes: 5 },
        5: { grossStrokes: 4 },
        6: { grossStrokes: 5 },
        7: { grossStrokes: 4 },
        8: { grossStrokes: 5 },
        9: { grossStrokes: 4 }
      })
    );
    const sideB = createSide(
      SIDE_B_ID,
      createPlayers(SIDE_B_ID, 0, 0),
      createHoleScores(SIDE_B_ID, 1, 9, {
        1: { grossStrokes: 5 },
        2: { grossStrokes: 4 },
        3: { grossStrokes: 5 },
        4: { grossStrokes: 4 },
        5: { grossStrokes: 5 },
        6: { grossStrokes: 4 },
        7: { grossStrokes: 5 },
        8: { grossStrokes: 4 },
        9: { grossStrokes: 4 }
      })
    );

    const state = computeScrambleResults(
      sideA,
      sideB,
      mockTee,
      'F9',
      DEFAULT_ALLOWANCES.scramble,
      POINTS_AVAILABLE
    );

    expect(state.status).toBe('FINAL');
    expect(state.closeNotation).toBe('HALVED');
    expect(state.summary).toBe('HALVED');
    expect(state.sideA.pointsEarned).toBe(0.5);
    expect(state.sideB.pointsEarned).toBe(0.5);
  });

  it('3) marks a conceded hole as a loss for the conceding side', () => {
    const sideA = createSide(
      SIDE_A_ID,
      createPlayers(SIDE_A_ID, 0, 0),
      createHoleScores(SIDE_A_ID, 1, 9, {
        4: { grossStrokes: null, isConceded: true }
      })
    );
    const sideB = createSide(
      SIDE_B_ID,
      createPlayers(SIDE_B_ID, 0, 0),
      createHoleScores(SIDE_B_ID, 1, 9, {
        4: { grossStrokes: 5 }
      })
    );

    const state = computeScrambleResults(
      sideA,
      sideB,
      mockTee,
      'F9',
      DEFAULT_ALLOWANCES.scramble,
      POINTS_AVAILABLE
    );

    expect(state.holeResults[3].result).toBe('B_WINS');
  });

  it('4) applies Team A stroke on SI 1 so gross 5 becomes net 4', () => {
    const sideA = createSide(
      SIDE_A_ID,
      createPlayers(SIDE_A_ID, 2.4, 18.6),
      createHoleScores(SIDE_A_ID, 1, 18, {
        1: { grossStrokes: 5 }
      })
    );
    const sideB = createSide(
      SIDE_B_ID,
      createPlayers(SIDE_B_ID, 0, 0),
      createHoleScores(SIDE_B_ID, 1, 18, {
        1: { grossStrokes: 4 }
      })
    );

    const state = computeScrambleResults(
      sideA,
      sideB,
      mockTee,
      'FULL18',
      DEFAULT_ALLOWANCES.scramble,
      POINTS_AVAILABLE
    );

    expect(state.holeResults[0].sideANet).toBe(4);
    expect(state.holeResults[0].sideBNet).toBe(4);
    expect(state.holeResults[0].result).toBe('HALVED');
  });

  it('5) keeps match IN_PROGRESS and marks unentered holes as PENDING', () => {
    const sideA = createSide(
      SIDE_A_ID,
      createPlayers(SIDE_A_ID, 0, 0),
      createHoleScores(SIDE_A_ID, 1, 9, {
        1: { grossStrokes: 4 },
        2: { grossStrokes: 5 }
      })
    );
    const sideB = createSide(
      SIDE_B_ID,
      createPlayers(SIDE_B_ID, 0, 0),
      createHoleScores(SIDE_B_ID, 1, 9, {
        1: { grossStrokes: 5 },
        2: { grossStrokes: 4 }
      })
    );

    const state = computeScrambleResults(
      sideA,
      sideB,
      mockTee,
      'F9',
      DEFAULT_ALLOWANCES.scramble,
      POINTS_AVAILABLE
    );

    expect(state.status).toBe('IN_PROGRESS');
    expect(state.holeResults[2].result).toBe('PENDING');
    expect(state.holeResults[2].sideANet).toBeNull();
    expect(state.holeResults[2].sideBNet).toBeNull();
  });
});
