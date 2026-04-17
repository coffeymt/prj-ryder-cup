import { describe, expect, it } from 'vitest';

import { DEFAULT_ALLOWANCES } from './types';
import type {
  HandicapIndex,
  HoleScoreInput,
  MatchStateStatus,
  Par,
  PlayerHandicapInput,
  SegmentConfig,
  StrokeIndex,
  TeeData,
} from './types';
import { computeFourBallResults } from './formats/fourBall';
import { computeSplitFormatResults, type MatchSideInput } from './splitFormat';

const MATCH_ID = 7001;
const SIDE_A_ID = 1;
const SIDE_B_ID = 2;

function createMockTee(): TeeData {
  return {
    id: 99,
    name: 'Split Format Test Tee',
    cr18: 71 as TeeData['cr18'],
    slope18: 130 as TeeData['slope18'],
    par18: 71 as Par,
    cr9f: 35.5 as TeeData['cr9f'],
    slope9f: 128 as TeeData['slope9f'],
    par9f: 35 as Par,
    cr9b: 35.5 as TeeData['cr9b'],
    slope9b: 132 as TeeData['slope9b'],
    par9b: 36 as Par,
    holes: Array.from({ length: 18 }, (_, index) => {
      const holeNumber = index + 1;
      return {
        holeNumber,
        par: 4 as Par,
        strokeIndex: holeNumber as StrokeIndex,
      };
    }),
  };
}

function createPlayers(
  sideId: number,
  handicapInputs: Array<{ playerId: number; handicapIndex: number }>
): PlayerHandicapInput[] {
  return handicapInputs.map((player) => ({
    playerId: player.playerId,
    sideId,
    handicapIndex: player.handicapIndex as HandicapIndex,
  }));
}

function createHoleScore(
  sideId: number,
  playerId: number | null,
  holeNumber: number,
  grossStrokes: number | null,
  flags: Partial<Pick<HoleScoreInput, 'isConceded' | 'isPickedUp'>> = {}
): HoleScoreInput {
  return {
    holeNumber,
    playerId,
    matchSideId: sideId,
    grossStrokes,
    isConceded: flags.isConceded ?? false,
    isPickedUp: flags.isPickedUp ?? false,
    opId: `op-${sideId}-${playerId ?? 'team'}-${holeNumber}`,
  };
}

function createScrambleScores(
  sideId: number,
  holeStart: number,
  holeEnd: number,
  grossByHole: Record<number, number>
): HoleScoreInput[] {
  const scores: HoleScoreInput[] = [];
  for (let holeNumber = holeStart; holeNumber <= holeEnd; holeNumber += 1) {
    scores.push(createHoleScore(sideId, null, holeNumber, grossByHole[holeNumber] ?? null));
  }
  return scores;
}

function createFourBallScores(
  sideId: number,
  firstPlayerId: number,
  secondPlayerId: number,
  grossByHole: Record<number, [number | null, number | null]>
): HoleScoreInput[] {
  const scores: HoleScoreInput[] = [];
  const holeNumbers = Object.keys(grossByHole)
    .map((holeNumber) => Number(holeNumber))
    .sort((leftHole, rightHole) => leftHole - rightHole);

  for (const holeNumber of holeNumbers) {
    const [firstGross, secondGross] = grossByHole[holeNumber];
    scores.push(createHoleScore(sideId, firstPlayerId, holeNumber, firstGross));
    scores.push(createHoleScore(sideId, secondPlayerId, holeNumber, secondGross));
  }
  return scores;
}

function createSideInput(
  sideId: number,
  teamId: number,
  players: PlayerHandicapInput[],
  holeScores: HoleScoreInput[]
): MatchSideInput {
  return {
    sideId,
    teamId,
    players,
    holeScores,
  };
}

describe('computeSplitFormatResults', () => {
  it('1) Cougar Point: routes F9 Scramble + B9 Four-Ball and keeps total awarded points within 6', () => {
    const tee = createMockTee();
    const sideAPlayers = createPlayers(SIDE_A_ID, [
      { playerId: 101, handicapIndex: 4.2 },
      { playerId: 102, handicapIndex: 12.4 },
    ]);
    const sideBPlayers = createPlayers(SIDE_B_ID, [
      { playerId: 201, handicapIndex: 6.1 },
      { playerId: 202, handicapIndex: 15.2 },
    ]);

    const sideAHoleScores = [
      ...createScrambleScores(SIDE_A_ID, 1, 9, {
        1: 4,
        2: 4,
        3: 5,
        4: 4,
        5: 4,
        6: 5,
        7: 4,
        8: 5,
        9: 4,
      }),
      ...createFourBallScores(SIDE_A_ID, 101, 102, {
        10: [4, 5],
        11: [5, 4],
        12: [4, 5],
        13: [5, 4],
        14: [4, 5],
        15: [5, 4],
        16: [4, 5],
        17: [5, 4],
        18: [4, 5],
      }),
    ];
    const sideBHoleScores = [
      ...createScrambleScores(SIDE_B_ID, 1, 9, {
        1: 5,
        2: 5,
        3: 4,
        4: 5,
        5: 5,
        6: 4,
        7: 5,
        8: 4,
        9: 5,
      }),
      ...createFourBallScores(SIDE_B_ID, 201, 202, {
        10: [5, 6],
        11: [4, 5],
        12: [5, 6],
        13: [4, 5],
        14: [5, 6],
        15: [4, 5],
        16: [5, 6],
        17: [4, 5],
        18: [5, 6],
      }),
    ];

    const segments: SegmentConfig[] = [
      {
        segmentId: 11,
        segment: 'F9',
        format: 'SCRAMBLE',
        holeStart: 1,
        holeEnd: 9,
        pointsAvailable: 3,
      },
      {
        segmentId: 12,
        segment: 'B9',
        format: 'FOURBALL',
        holeStart: 10,
        holeEnd: 18,
        pointsAvailable: 3,
      },
    ];

    const result = computeSplitFormatResults(
      {
        segments,
        sideA: createSideInput(SIDE_A_ID, 10, sideAPlayers, sideAHoleScores),
        sideB: createSideInput(SIDE_B_ID, 20, sideBPlayers, sideBHoleScores),
        tee,
        tournamentAllowances: DEFAULT_ALLOWANCES,
      },
      MATCH_ID
    );

    expect(result.segmentResults.length).toBe(2);

    const frontNineState = result.segmentResults[0].matchState;
    expect(frontNineState.holeResults.length).toBe(9);
    expect(frontNineState.holeResults[0].holeNumber).toBe(1);
    expect(frontNineState.holeResults[8].holeNumber).toBe(9);

    const backNineState = result.segmentResults[1].matchState;
    expect(backNineState.holeResults.length).toBe(9);
    expect(backNineState.holeResults[0].holeNumber).toBe(10);
    expect(backNineState.holeResults[8].holeNumber).toBe(18);

    const pointsAwarded = result.segmentResults.reduce(
      (total, segmentResult) =>
        total + segmentResult.subMatchResult.sideAPoints + segmentResult.subMatchResult.sideBPoints,
      0
    );
    expect(pointsAwarded).toBeLessThanOrEqual(6);
  });

  it('2) Ocean Course: computes F9 + B9 + OVERALL as independent sub-matches', () => {
    const tee = createMockTee();
    const sideAPlayers = createPlayers(SIDE_A_ID, [
      { playerId: 101, handicapIndex: 0 },
      { playerId: 102, handicapIndex: 0 },
    ]);
    const sideBPlayers = createPlayers(SIDE_B_ID, [
      { playerId: 201, handicapIndex: 0 },
      { playerId: 202, handicapIndex: 0 },
    ]);

    const sideAHoleScores = createFourBallScores(SIDE_A_ID, 101, 102, {
      1: [4, 5],
      2: [4, 5],
      3: [4, 5],
      4: [4, 5],
      5: [4, 5],
      6: [4, 5],
      7: [4, 5],
      8: [4, 5],
      9: [4, 5],
      10: [6, 7],
      11: [6, 7],
      12: [6, 7],
      13: [6, 7],
      14: [6, 7],
      15: [6, 7],
      16: [6, 7],
      17: [6, 7],
      18: [6, 7],
    });
    const sideBHoleScores = createFourBallScores(SIDE_B_ID, 201, 202, {
      1: [5, 6],
      2: [5, 6],
      3: [5, 6],
      4: [5, 6],
      5: [5, 6],
      6: [5, 6],
      7: [5, 6],
      8: [5, 6],
      9: [5, 6],
      10: [4, 5],
      11: [4, 5],
      12: [4, 5],
      13: [4, 5],
      14: [4, 5],
      15: [4, 5],
      16: [4, 5],
      17: [4, 5],
      18: [4, 5],
    });

    const segments: SegmentConfig[] = [
      {
        segmentId: 21,
        segment: 'F9',
        format: 'FOURBALL',
        holeStart: 1,
        holeEnd: 9,
        pointsAvailable: 3,
      },
      {
        segmentId: 22,
        segment: 'B9',
        format: 'FOURBALL',
        holeStart: 10,
        holeEnd: 18,
        pointsAvailable: 3,
      },
      {
        segmentId: 23,
        segment: 'OVERALL',
        format: 'FOURBALL',
        holeStart: 1,
        holeEnd: 18,
        pointsAvailable: 3,
      },
    ];

    const sideA = createSideInput(SIDE_A_ID, 10, sideAPlayers, sideAHoleScores);
    const sideB = createSideInput(SIDE_B_ID, 20, sideBPlayers, sideBHoleScores);
    const result = computeSplitFormatResults(
      {
        segments,
        sideA,
        sideB,
        tee,
        tournamentAllowances: DEFAULT_ALLOWANCES,
      },
      MATCH_ID
    );

    expect(result.segmentResults.length).toBe(3);

    const overallResult = result.segmentResults.find(
      (segmentResult) => segmentResult.segmentConfig.segment === 'OVERALL'
    );
    expect(overallResult).toBeDefined();
    expect(overallResult?.matchState.holeResults.length).toBe(18);

    for (const segmentResult of result.segmentResults) {
      const totalSegmentPoints =
        segmentResult.subMatchResult.sideAPoints + segmentResult.subMatchResult.sideBPoints;
      expect(totalSegmentPoints).toBe(segmentResult.segmentConfig.pointsAvailable);
    }

    const overallOnlyResult = computeSplitFormatResults(
      {
        segments: [segments[2]],
        sideA,
        sideB,
        tee,
        tournamentAllowances: DEFAULT_ALLOWANCES,
      },
      MATCH_ID + 1
    );

    expect(overallOnlyResult.segmentResults).toHaveLength(1);
    expect(overallOnlyResult.segmentResults[0].subMatchResult.sideAPoints).toBe(
      overallResult?.subMatchResult.sideAPoints
    );
    expect(overallOnlyResult.segmentResults[0].subMatchResult.sideBPoints).toBe(
      overallResult?.subMatchResult.sideBPoints
    );
    expect(overallOnlyResult.segmentResults[0].matchState.closeNotation).toBe(
      overallResult?.matchState.closeNotation
    );
  });

  it('3) applies per-segment allowance override for Four-Ball (75% instead of tournament 100%)', () => {
    const tee = createMockTee();
    const sideAPlayers = createPlayers(SIDE_A_ID, [
      { playerId: 101, handicapIndex: 0 },
      { playerId: 102, handicapIndex: 3.5 },
    ]);
    const sideBPlayers = createPlayers(SIDE_B_ID, [
      { playerId: 201, handicapIndex: 0 },
      { playerId: 202, handicapIndex: 0 },
    ]);

    const sideAHoleScores = createFourBallScores(SIDE_A_ID, 101, 102, {
      4: [7, 5],
    });
    const sideBHoleScores = createFourBallScores(SIDE_B_ID, 201, 202, {
      4: [4, 6],
    });

    const segmentConfig: SegmentConfig = {
      segmentId: 31,
      segment: 'FULL18',
      format: 'FOURBALL',
      holeStart: 1,
      holeEnd: 18,
      pointsAvailable: 1,
      allowanceOverride: { type: 'perPlayer', pct: 0.75 },
    };

    const splitResult = computeSplitFormatResults(
      {
        segments: [segmentConfig],
        sideA: createSideInput(SIDE_A_ID, 10, sideAPlayers, sideAHoleScores),
        sideB: createSideInput(SIDE_B_ID, 20, sideBPlayers, sideBHoleScores),
        tee,
        tournamentAllowances: DEFAULT_ALLOWANCES,
      },
      MATCH_ID
    );

    const overrideState = computeFourBallResults(
      { sideId: SIDE_A_ID, players: sideAPlayers, holeScores: sideAHoleScores },
      { sideId: SIDE_B_ID, players: sideBPlayers, holeScores: sideBHoleScores },
      tee,
      'FULL18',
      { type: 'perPlayer', pct: 0.75 },
      1
    );
    const defaultState = computeFourBallResults(
      { sideId: SIDE_A_ID, players: sideAPlayers, holeScores: sideAHoleScores },
      { sideId: SIDE_B_ID, players: sideBPlayers, holeScores: sideBHoleScores },
      tee,
      'FULL18',
      DEFAULT_ALLOWANCES.fourBall,
      1
    );

    const splitHole4 = splitResult.segmentResults[0].matchState.holeResults.find(
      (holeResult) => holeResult.holeNumber === 4
    );
    const overrideHole4 = overrideState.holeResults.find(
      (holeResult) => holeResult.holeNumber === 4
    );
    const defaultHole4 = defaultState.holeResults.find((holeResult) => holeResult.holeNumber === 4);

    expect(splitHole4?.result).toBe(overrideHole4?.result);
    expect(splitHole4?.result).not.toBe(defaultHole4?.result);
  });

  it('4) Convention 2 fallback: F9 with null 9-hole ratings does not throw and returns a valid state', () => {
    const teeWithoutFrontNineRatings: TeeData = {
      ...createMockTee(),
      cr9f: null,
      slope9f: null,
      par9f: null,
    };

    const sideAPlayers = createPlayers(SIDE_A_ID, [
      { playerId: 101, handicapIndex: 7.2 },
      { playerId: 102, handicapIndex: 14.3 },
    ]);
    const sideBPlayers = createPlayers(SIDE_B_ID, [
      { playerId: 201, handicapIndex: 8.4 },
      { playerId: 202, handicapIndex: 16.1 },
    ]);

    const segmentConfig: SegmentConfig = {
      segmentId: 41,
      segment: 'F9',
      format: 'FOURBALL',
      holeStart: 1,
      holeEnd: 9,
      pointsAvailable: 1,
    };

    expect(() =>
      computeSplitFormatResults(
        {
          segments: [segmentConfig],
          sideA: createSideInput(SIDE_A_ID, 10, sideAPlayers, []),
          sideB: createSideInput(SIDE_B_ID, 20, sideBPlayers, []),
          tee: teeWithoutFrontNineRatings,
          tournamentAllowances: DEFAULT_ALLOWANCES,
        },
        MATCH_ID
      )
    ).not.toThrow();

    const result = computeSplitFormatResults(
      {
        segments: [segmentConfig],
        sideA: createSideInput(SIDE_A_ID, 10, sideAPlayers, []),
        sideB: createSideInput(SIDE_B_ID, 20, sideBPlayers, []),
        tee: teeWithoutFrontNineRatings,
        tournamentAllowances: DEFAULT_ALLOWANCES,
      },
      MATCH_ID + 2
    );

    const status = result.segmentResults[0].matchState.status;
    const allowedStatuses: MatchStateStatus[] = ['PENDING', 'FINAL'];
    expect(allowedStatuses).toContain(status);
  });

  it('5) Turtle Point Singles FULL18 returns one segment and ends FINAL or CLOSED', () => {
    const tee = createMockTee();
    const sideAPlayers = createPlayers(SIDE_A_ID, [{ playerId: 301, handicapIndex: 4.1 }]);
    const sideBPlayers = createPlayers(SIDE_B_ID, [{ playerId: 401, handicapIndex: 8.7 }]);

    const sideAHoleScores = Array.from({ length: 18 }, (_, index) =>
      createHoleScore(SIDE_A_ID, 301, index + 1, 4)
    );
    const sideBHoleScores = Array.from({ length: 18 }, (_, index) =>
      createHoleScore(SIDE_B_ID, 401, index + 1, index < 9 ? 5 : 4)
    );

    const result = computeSplitFormatResults(
      {
        segments: [
          {
            segmentId: 51,
            segment: 'FULL18',
            format: 'SINGLES',
            holeStart: 1,
            holeEnd: 18,
            pointsAvailable: 1,
          },
        ],
        sideA: createSideInput(SIDE_A_ID, 10, sideAPlayers, sideAHoleScores),
        sideB: createSideInput(SIDE_B_ID, 20, sideBPlayers, sideBHoleScores),
        tee,
        tournamentAllowances: DEFAULT_ALLOWANCES,
      },
      MATCH_ID
    );

    expect(result.segmentResults.length).toBe(1);
    expect(['FINAL', 'CLOSED']).toContain(result.segmentResults[0].matchState.status);
  });
});
