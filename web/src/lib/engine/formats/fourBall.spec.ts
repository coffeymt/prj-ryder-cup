import { describe, expect, it } from 'vitest';

import { computePerPlayerHandicaps } from '../allowances';
import { computeCH18 } from '../courseHandicap';
import { DEFAULT_ALLOWANCES, USGA_ALLOWANCES } from '../types';
import type {
  HandicapIndex,
  HoleScoreInput,
  Par,
  PlayerHandicapInput,
  Segment,
  StrokeIndex,
  TeeData
} from '../types';
import { computeFourBallResults, type FourBallSideInput } from './fourBall';

const SIDE_A_ID = 1;
const SIDE_B_ID = 2;

const FULL18_SEGMENT: Segment = 'FULL18';

const tee: TeeData = {
  id: 1,
  name: 'Test Tee',
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
      strokeIndex: holeNumber as StrokeIndex
    };
  })
};

function createFourBallPlayers(
  sideId: number,
  firstPlayerId: number,
  firstIndex: number,
  secondPlayerId: number,
  secondIndex: number
): PlayerHandicapInput[] {
  return [
    { playerId: firstPlayerId, sideId, handicapIndex: firstIndex as HandicapIndex },
    { playerId: secondPlayerId, sideId, handicapIndex: secondIndex as HandicapIndex }
  ];
}

function createHoleScore(
  holeNumber: number,
  playerId: number | null,
  matchSideId: number,
  grossStrokes: number | null,
  overrides: Partial<Pick<HoleScoreInput, 'isConceded' | 'isPickedUp'>> = {}
): HoleScoreInput {
  return {
    holeNumber,
    playerId,
    matchSideId,
    grossStrokes,
    isConceded: overrides.isConceded ?? false,
    isPickedUp: overrides.isPickedUp ?? false,
    opId: `${matchSideId}-${playerId ?? 'side'}-${holeNumber}-${grossStrokes ?? 'null'}`
  };
}

function buildFull18SideScores(
  sideId: number,
  firstPlayerId: number,
  secondPlayerId: number,
  firstPlayerGrosses: number[],
  secondPlayerGrosses: number[]
): HoleScoreInput[] {
  return firstPlayerGrosses.flatMap((firstGross, index) => [
    createHoleScore(index + 1, firstPlayerId, sideId, firstGross),
    createHoleScore(index + 1, secondPlayerId, sideId, secondPlayerGrosses[index])
  ]);
}

describe('computeFourBallResults', () => {
  it('1) default 100% keeps full CH as PH before normalization and applies delta strokes', () => {
    const allPlayers = [
      ...createFourBallPlayers(SIDE_A_ID, 101, 6.0, 102, 11.4),
      ...createFourBallPlayers(SIDE_B_ID, 201, 10.6, 202, 8.9)
    ];

    const handicaps = computePerPlayerHandicaps(
      allPlayers,
      tee,
      FULL18_SEGMENT,
      DEFAULT_ALLOWANCES.fourBall
    );
    const player101 = handicaps.find((player) => player.playerId === 101);
    const baseline = Math.min(...handicaps.map((player) => Number(player.playingHandicap)));
    const expectedCourseHandicap = Number(
      computeCH18(6.0 as HandicapIndex, tee.slope18, tee.cr18, tee.par18)
    );

    expect(player101).toBeDefined();
    expect(player101?.playingHandicap).toBe(Math.round(expectedCourseHandicap));
    expect(player101?.strokes).toBe(player101 ? Number(player101.playingHandicap) - baseline : 0);
  });

  it('2) USGA 90% allowance reduces PH vs default 100%', () => {
    const allPlayers = [
      ...createFourBallPlayers(SIDE_A_ID, 101, 6.0, 102, 11.4),
      ...createFourBallPlayers(SIDE_B_ID, 201, 10.6, 202, 8.9)
    ];

    const defaultHandicaps = computePerPlayerHandicaps(
      allPlayers,
      tee,
      FULL18_SEGMENT,
      DEFAULT_ALLOWANCES.fourBall
    );
    const usgaHandicaps = computePerPlayerHandicaps(
      allPlayers,
      tee,
      FULL18_SEGMENT,
      USGA_ALLOWANCES.fourBall
    );
    const defaultPlayer102 = defaultHandicaps.find((player) => player.playerId === 102);
    const usgaPlayer102 = usgaHandicaps.find((player) => player.playerId === 102);

    expect(defaultPlayer102).toBeDefined();
    expect(usgaPlayer102).toBeDefined();
    expect(Number(usgaPlayer102?.playingHandicap)).toBeLessThan(
      Number(defaultPlayer102?.playingHandicap)
    );
  });

  it('3) normalization uses all four players across the full match baseline', () => {
    const allPlayers = [
      ...createFourBallPlayers(SIDE_A_ID, 101, 6.0, 102, 11.4),
      ...createFourBallPlayers(SIDE_B_ID, 201, 10.6, 202, 8.9)
    ];

    const handicaps = computePerPlayerHandicaps(
      allPlayers,
      tee,
      FULL18_SEGMENT,
      DEFAULT_ALLOWANCES.fourBall
    );
    const expectedPlayingHandicaps = new Map<number, number>(
      allPlayers.map((player) => [
        player.playerId,
        Math.round(Number(computeCH18(player.handicapIndex, tee.slope18, tee.cr18, tee.par18)))
      ])
    );
    const lowestPlayingHandicap = Math.min(...Array.from(expectedPlayingHandicaps.values()));

    for (const handicap of handicaps) {
      const expectedPlayingHandicap = expectedPlayingHandicaps.get(handicap.playerId);
      expect(expectedPlayingHandicap).toBeDefined();
      expect(Number(handicap.playingHandicap)).toBe(expectedPlayingHandicap);
      expect(Number(handicap.strokes)).toBe(
        Number(expectedPlayingHandicap) - lowestPlayingHandicap
      );
    }

    // Player 202 is the low player on side B, but still receives strokes from side A's lower baseline.
    const player202 = handicaps.find((player) => player.playerId === 202);
    expect(player202).toBeDefined();
    expect(Number(player202?.strokes)).toBeGreaterThan(0);
  });

  it('4) picked-up player is carried by partner net', () => {
    const sideA: FourBallSideInput = {
      sideId: SIDE_A_ID,
      players: createFourBallPlayers(SIDE_A_ID, 101, 10.0, 102, 10.0),
      holeScores: [
        createHoleScore(1, 101, SIDE_A_ID, null, { isPickedUp: true }),
        createHoleScore(1, 102, SIDE_A_ID, 4)
      ]
    };
    const sideB: FourBallSideInput = {
      sideId: SIDE_B_ID,
      players: createFourBallPlayers(SIDE_B_ID, 201, 10.0, 202, 10.0),
      holeScores: [createHoleScore(1, 201, SIDE_B_ID, 5), createHoleScore(1, 202, SIDE_B_ID, 6)]
    };

    const result = computeFourBallResults(
      sideA,
      sideB,
      tee,
      FULL18_SEGMENT,
      DEFAULT_ALLOWANCES.fourBall,
      1
    );

    expect(result.holeResults[0].result).toBe('A_WINS');
    expect(result.holeResults[0].sideANet).toBe(4);
    expect(result.holeResults[0].sideBNet).toBe(5);
  });

  it('5) both players picked up on a side forfeits the hole', () => {
    const sideA: FourBallSideInput = {
      sideId: SIDE_A_ID,
      players: createFourBallPlayers(SIDE_A_ID, 101, 10.0, 102, 10.0),
      holeScores: [
        createHoleScore(1, 101, SIDE_A_ID, null, { isPickedUp: true }),
        createHoleScore(1, 102, SIDE_A_ID, null, { isPickedUp: true })
      ]
    };
    const sideB: FourBallSideInput = {
      sideId: SIDE_B_ID,
      players: createFourBallPlayers(SIDE_B_ID, 201, 10.0, 202, 10.0),
      holeScores: [createHoleScore(1, 201, SIDE_B_ID, 6), createHoleScore(1, 202, SIDE_B_ID, 7)]
    };

    const result = computeFourBallResults(
      sideA,
      sideB,
      tee,
      FULL18_SEGMENT,
      DEFAULT_ALLOWANCES.fourBall,
      1
    );

    expect(result.holeResults[0].result).toBe('B_WINS');
    expect(result.holeResults[0].sideANet).toBeNull();
    expect(result.holeResults[0].sideBNet).toBe(6);
  });

  it('6) conceded hole awards the hole to the non-conceding side', () => {
    const sideA: FourBallSideInput = {
      sideId: SIDE_A_ID,
      players: createFourBallPlayers(SIDE_A_ID, 101, 10.0, 102, 10.0),
      holeScores: [
        createHoleScore(1, 101, SIDE_A_ID, 3),
        createHoleScore(1, 102, SIDE_A_ID, 4),
        createHoleScore(1, null, SIDE_A_ID, null, { isConceded: true })
      ]
    };
    const sideB: FourBallSideInput = {
      sideId: SIDE_B_ID,
      players: createFourBallPlayers(SIDE_B_ID, 201, 10.0, 202, 10.0),
      holeScores: [createHoleScore(1, 201, SIDE_B_ID, 6), createHoleScore(1, 202, SIDE_B_ID, 7)]
    };

    const result = computeFourBallResults(
      sideA,
      sideB,
      tee,
      FULL18_SEGMENT,
      DEFAULT_ALLOWANCES.fourBall,
      1
    );

    expect(result.holeResults[0].result).toBe('B_WINS');
    expect(result.holeResults[0].sideANet).toBeNull();
  });

  it('7) full 18-hole FULL18 match computes final state and leader correctly', () => {
    const sideA: FourBallSideInput = {
      sideId: SIDE_A_ID,
      players: createFourBallPlayers(SIDE_A_ID, 101, 10.0, 102, 10.0),
      holeScores: buildFull18SideScores(
        SIDE_A_ID,
        101,
        102,
        [4, 5, 4, 5, 4, 5, 4, 5, 4, 5, 4, 5, 4, 4, 4, 4, 4, 4],
        [5, 6, 5, 6, 5, 6, 5, 6, 5, 6, 5, 6, 5, 5, 5, 5, 5, 5]
      )
    };
    const sideB: FourBallSideInput = {
      sideId: SIDE_B_ID,
      players: createFourBallPlayers(SIDE_B_ID, 201, 10.0, 202, 10.0),
      holeScores: buildFull18SideScores(
        SIDE_B_ID,
        201,
        202,
        [5, 4, 5, 4, 5, 4, 5, 4, 5, 4, 5, 4, 5, 4, 5, 4, 5, 5],
        [6, 5, 6, 5, 6, 5, 6, 5, 6, 5, 6, 5, 6, 5, 6, 5, 6, 6]
      )
    };

    const result = computeFourBallResults(
      sideA,
      sideB,
      tee,
      FULL18_SEGMENT,
      DEFAULT_ALLOWANCES.fourBall,
      1
    );

    expect(result.status).toBe('FINAL');
    expect(result.leadingSideId).toBe(SIDE_A_ID);
    expect(result.holesPlayed).toBe(18);
    expect(result.holesRemaining).toBe(0);
    expect(result.holesUp).toBe(4);
    expect(result.summary).toBe('4 UP');
    expect(result.closeNotation).toBe('4UP');
    expect(result.sideA.holesWon).toBe(10);
    expect(result.sideB.holesWon).toBe(6);
    expect(result.sideA.holesSplit).toBe(2);
    expect(result.sideB.holesSplit).toBe(2);
  });
});
