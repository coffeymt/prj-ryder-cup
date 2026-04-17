import { describe, expect, it } from 'vitest';

import { computePerPlayerHandicaps } from '../allowances';
import { DEFAULT_ALLOWANCES, USGA_ALLOWANCES } from '../types';
import type {
  HandicapIndex,
  HoleScoreInput,
  MatchState,
  Par,
  PlayerHandicapInput,
  StrokeMap,
  StrokeIndex,
  TeeData,
} from '../types';
import { computeShambleResults, type ShambleSideInput } from './shamble';

const SIDE_A_ID = 101;
const SIDE_B_ID = 202;

const mockTee: TeeData = {
  id: 1,
  name: 'Mock Tee',
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

const equalHandicapSideAPlayers: PlayerHandicapInput[] = [
  { playerId: 11, sideId: SIDE_A_ID, handicapIndex: 10 as HandicapIndex },
  { playerId: 12, sideId: SIDE_A_ID, handicapIndex: 10 as HandicapIndex },
];

const equalHandicapSideBPlayers: PlayerHandicapInput[] = [
  { playerId: 21, sideId: SIDE_B_ID, handicapIndex: 10 as HandicapIndex },
  { playerId: 22, sideId: SIDE_B_ID, handicapIndex: 10 as HandicapIndex },
];

function sumStrokeMap(strokeMap: StrokeMap): number {
  return Object.values(strokeMap as Record<number, number>).reduce(
    (total, strokes) => total + strokes,
    0
  );
}

function createHoleScore(
  sideId: number,
  playerId: number,
  holeNumber: number,
  grossStrokes: number | null,
  flags: { isConceded?: boolean; isPickedUp?: boolean } = {}
): HoleScoreInput {
  return {
    holeNumber,
    playerId,
    matchSideId: sideId,
    grossStrokes,
    isConceded: flags.isConceded ?? false,
    isPickedUp: flags.isPickedUp ?? false,
    opId: `${sideId}-${playerId}-${holeNumber}`,
  };
}

function createSideInput(
  sideId: number,
  players: PlayerHandicapInput[],
  holeScores: HoleScoreInput[]
): ShambleSideInput {
  return {
    sideId,
    players,
    holeScores,
  };
}

function getHoleResult(state: MatchState, holeNumber: number) {
  const holeResult = state.holeResults.find((result) => result.holeNumber === holeNumber);
  expect(holeResult).toBeDefined();
  return holeResult!;
}

describe('computeShambleResults', () => {
  it('1) default 85% allowance produces expected PH and stroke count', () => {
    const players: PlayerHandicapInput[] = [
      { playerId: 1, sideId: SIDE_A_ID, handicapIndex: 8.9 as HandicapIndex },
      { playerId: 2, sideId: SIDE_B_ID, handicapIndex: 15.4 as HandicapIndex },
    ];
    const handicaps = computePerPlayerHandicaps(
      players,
      mockTee,
      'FULL18',
      DEFAULT_ALLOWANCES.shamble
    );
    const targetPlayer = handicaps.find((player) => player.playerId === 2);
    expect(targetPlayer).toBeDefined();

    const expectedCourseHandicap = 15.4 * (130 / 113) + (71 - 71);
    const expectedPlayingHandicap = Math.round(expectedCourseHandicap * 0.85);
    const expectedLowerPlayingHandicap = Math.round((8.9 * (130 / 113) + (71 - 71)) * 0.85);

    expect(targetPlayer!.courseHandicap).toBeCloseTo(expectedCourseHandicap, 2);
    expect(targetPlayer!.playingHandicap).toBe(expectedPlayingHandicap);
    expect(targetPlayer!.strokes).toBe(expectedPlayingHandicap - expectedLowerPlayingHandicap);
    expect(sumStrokeMap(targetPlayer!.strokeMap)).toBe(targetPlayer!.strokes);
  });

  it('2) USGA 75% allowance produces a lower PH and fewer strokes', () => {
    const players: PlayerHandicapInput[] = [
      { playerId: 1, sideId: SIDE_A_ID, handicapIndex: 8.9 as HandicapIndex },
      { playerId: 2, sideId: SIDE_B_ID, handicapIndex: 15.4 as HandicapIndex },
    ];
    const defaultHandicaps = computePerPlayerHandicaps(
      players,
      mockTee,
      'FULL18',
      DEFAULT_ALLOWANCES.shamble
    );
    const usgaHandicaps = computePerPlayerHandicaps(
      players,
      mockTee,
      'FULL18',
      USGA_ALLOWANCES.shamble
    );

    const defaultTarget = defaultHandicaps.find((player) => player.playerId === 2);
    const usgaTarget = usgaHandicaps.find((player) => player.playerId === 2);

    expect(defaultTarget).toBeDefined();
    expect(usgaTarget).toBeDefined();
    expect(usgaTarget!.playingHandicap).toBeLessThan(defaultTarget!.playingHandicap);
    expect(usgaTarget!.strokes).toBeLessThan(defaultTarget!.strokes);
  });

  it('3) picked-up player is ignored and partner net carries the side', () => {
    const sideA = createSideInput(SIDE_A_ID, equalHandicapSideAPlayers, [
      createHoleScore(SIDE_A_ID, 11, 3, null, { isPickedUp: true }),
      createHoleScore(SIDE_A_ID, 12, 3, 4),
    ]);
    const sideB = createSideInput(SIDE_B_ID, equalHandicapSideBPlayers, [
      createHoleScore(SIDE_B_ID, 21, 3, 5),
      createHoleScore(SIDE_B_ID, 22, 3, 6),
    ]);

    const state = computeShambleResults(sideA, sideB, mockTee, 'F9', DEFAULT_ALLOWANCES.shamble, 1);
    const hole3 = getHoleResult(state, 3);

    expect(hole3.sideANet).toBe(4);
    expect(hole3.sideBNet).toBe(5);
    expect(hole3.result).toBe('A_WINS');
  });

  it('4) both picked up causes side forfeit and opponent wins hole', () => {
    const sideA = createSideInput(SIDE_A_ID, equalHandicapSideAPlayers, [
      createHoleScore(SIDE_A_ID, 11, 5, null, { isPickedUp: true }),
      createHoleScore(SIDE_A_ID, 12, 5, null, { isPickedUp: true }),
    ]);
    const sideB = createSideInput(SIDE_B_ID, equalHandicapSideBPlayers, [
      createHoleScore(SIDE_B_ID, 21, 5, 5),
      createHoleScore(SIDE_B_ID, 22, 5, 6),
    ]);

    const state = computeShambleResults(sideA, sideB, mockTee, 'F9', DEFAULT_ALLOWANCES.shamble, 1);
    const hole5 = getHoleResult(state, 5);

    expect(hole5.sideANet).toBeNull();
    expect(hole5.sideBNet).toBe(5);
    expect(hole5.result).toBe('B_WINS');
  });

  it('5) conceded hole awards immediate win to opponent side', () => {
    const sideA = createSideInput(SIDE_A_ID, equalHandicapSideAPlayers, [
      createHoleScore(SIDE_A_ID, 11, 7, 4),
      createHoleScore(SIDE_A_ID, 12, 7, 5),
    ]);
    const sideB = createSideInput(SIDE_B_ID, equalHandicapSideBPlayers, [
      createHoleScore(SIDE_B_ID, 21, 7, null, { isConceded: true }),
      createHoleScore(SIDE_B_ID, 22, 7, 4),
    ]);

    const state = computeShambleResults(sideA, sideB, mockTee, 'F9', DEFAULT_ALLOWANCES.shamble, 1);
    const hole7 = getHoleResult(state, 7);

    expect(hole7.result).toBe('A_WINS');
  });

  it('6) normal min-net selection compares sides by the best player net', () => {
    const sideA = createSideInput(SIDE_A_ID, equalHandicapSideAPlayers, [
      createHoleScore(SIDE_A_ID, 11, 2, 4),
      createHoleScore(SIDE_A_ID, 12, 2, 6),
    ]);
    const sideB = createSideInput(SIDE_B_ID, equalHandicapSideBPlayers, [
      createHoleScore(SIDE_B_ID, 21, 2, 5),
      createHoleScore(SIDE_B_ID, 22, 2, 4),
    ]);

    const state = computeShambleResults(sideA, sideB, mockTee, 'F9', DEFAULT_ALLOWANCES.shamble, 1);
    const hole2 = getHoleResult(state, 2);

    expect(hole2.sideANet).toBe(4);
    expect(hole2.sideBNet).toBe(4);
    expect(hole2.result).toBe('HALVED');
  });

  it('7) full 9-hole shamble match computes final state and leader', () => {
    const sideAHoleScores: HoleScoreInput[] = [];
    const sideBHoleScores: HoleScoreInput[] = [];

    const scorePlan = [
      { holeNumber: 1, sideAGross: [4, 6], sideBGross: [5, 7] },
      { holeNumber: 2, sideAGross: [4, 6], sideBGross: [4, 5] },
      { holeNumber: 3, sideAGross: [5, 6], sideBGross: [4, 7] },
      { holeNumber: 4, sideAGross: [4, 6], sideBGross: [5, 6] },
      { holeNumber: 5, sideAGross: [4, 5], sideBGross: [5, 7] },
      { holeNumber: 6, sideAGross: [5, 7], sideBGross: [4, 6] },
      { holeNumber: 7, sideAGross: [4, 6], sideBGross: [5, 6] },
      { holeNumber: 8, sideAGross: [4, 5], sideBGross: [4, 6] },
      { holeNumber: 9, sideAGross: [4, 7], sideBGross: [5, 6] },
    ];

    for (const holePlan of scorePlan) {
      sideAHoleScores.push(
        createHoleScore(SIDE_A_ID, 11, holePlan.holeNumber, holePlan.sideAGross[0]),
        createHoleScore(SIDE_A_ID, 12, holePlan.holeNumber, holePlan.sideAGross[1])
      );
      sideBHoleScores.push(
        createHoleScore(SIDE_B_ID, 21, holePlan.holeNumber, holePlan.sideBGross[0]),
        createHoleScore(SIDE_B_ID, 22, holePlan.holeNumber, holePlan.sideBGross[1])
      );
    }

    const sideA = createSideInput(SIDE_A_ID, equalHandicapSideAPlayers, sideAHoleScores);
    const sideB = createSideInput(SIDE_B_ID, equalHandicapSideBPlayers, sideBHoleScores);

    const state = computeShambleResults(sideA, sideB, mockTee, 'F9', DEFAULT_ALLOWANCES.shamble, 1);

    expect(['FINAL', 'CLOSED']).toContain(state.status);
    expect(state.leadingSideId).toBe(SIDE_A_ID);
    expect(state.holesPlayed).toBe(9);
    expect(state.holesUp).toBeGreaterThan(0);
  });
});
