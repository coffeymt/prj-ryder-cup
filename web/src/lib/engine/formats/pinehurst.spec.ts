import { describe, expect, it } from 'vitest';

import { computeTeamHandicaps } from '../allowances';
import type {
  BlendedAllowance,
  HandicapIndex,
  HoleScoreInput,
  Par,
  StrokeIndex,
  TeeData,
} from '../types';
import { computePinehurstResults, type PinehurstSideInput } from './pinehurst';

const PINEHURST_ALLOWANCE: BlendedAllowance = { type: 'blended', lowPct: 0.6, highPct: 0.4 };
const SCRAMBLE_ALLOWANCE: BlendedAllowance = { type: 'blended', lowPct: 0.35, highPct: 0.15 };

function createEngineTee(): TeeData {
  return {
    id: 100,
    name: 'Engine Tee',
    cr18: 72 as TeeData['cr18'],
    slope18: 113 as TeeData['slope18'],
    par18: 72 as Par,
    cr9f: 36 as TeeData['cr9f'],
    slope9f: 113 as TeeData['slope9f'],
    par9f: 36 as Par,
    cr9b: 36 as TeeData['cr9b'],
    slope9b: 113 as TeeData['slope9b'],
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

function createPlayers(sideId: number, handicaps: number[]): PinehurstSideInput['players'] {
  return handicaps.map((handicapIndex, index) => ({
    playerId: sideId * 10 + index + 1,
    sideId,
    handicapIndex: handicapIndex as HandicapIndex,
  }));
}

function createTeamHoleScore(
  sideId: number,
  holeNumber: number,
  grossStrokes: number | null,
  overrides: Partial<Pick<HoleScoreInput, 'isConceded' | 'isPickedUp'>> = {}
): HoleScoreInput {
  return {
    holeNumber,
    playerId: null,
    matchSideId: sideId,
    grossStrokes,
    isConceded: overrides.isConceded ?? false,
    isPickedUp: overrides.isPickedUp ?? false,
    opId: `op-${sideId}-${holeNumber}`,
  };
}

function createSide(
  sideId: number,
  handicaps: number[],
  holeScores: HoleScoreInput[]
): PinehurstSideInput {
  return {
    sideId,
    players: createPlayers(sideId, handicaps),
    holeScores,
  };
}

describe('computePinehurstResults', () => {
  it('1) blended PH uses 60/40 and is higher than Scramble 35/15 for the same pair', () => {
    const tee = createEngineTee();
    const players = createPlayers(1, [4, 20]);

    const scrambleTeam = computeTeamHandicaps(
      [{ sideId: 1, players }],
      tee,
      'FULL18',
      SCRAMBLE_ALLOWANCE
    )[0];
    const pinehurstTeam = computeTeamHandicaps(
      [{ sideId: 1, players }],
      tee,
      'FULL18',
      PINEHURST_ALLOWANCE
    )[0];

    expect(scrambleTeam.teamPlayingHandicap).toBe(4);
    expect(pinehurstTeam.teamPlayingHandicap).toBe(10);
    expect(pinehurstTeam.teamPlayingHandicap).toBeGreaterThan(scrambleTeam.teamPlayingHandicap);
  });

  it('2) closes a 9-hole match with Team B winning', () => {
    const tee = createEngineTee();
    const sideA = createSide(
      1,
      [0, 0],
      [
        createTeamHoleScore(1, 1, 5),
        createTeamHoleScore(1, 2, 5),
        createTeamHoleScore(1, 3, 4),
        createTeamHoleScore(1, 4, 5),
        createTeamHoleScore(1, 5, 4),
        createTeamHoleScore(1, 6, 5),
        createTeamHoleScore(1, 7, 4),
      ]
    );
    const sideB = createSide(
      2,
      [0, 0],
      [
        createTeamHoleScore(2, 1, 4),
        createTeamHoleScore(2, 2, 4),
        createTeamHoleScore(2, 3, 5),
        createTeamHoleScore(2, 4, 4),
        createTeamHoleScore(2, 5, 4),
        createTeamHoleScore(2, 6, 4),
        createTeamHoleScore(2, 7, 4),
      ]
    );

    const result = computePinehurstResults(sideA, sideB, tee, 'F9', PINEHURST_ALLOWANCE, 1);

    expect(result.status).toBe('CLOSED');
    expect(result.leadingSideId).toBe(2);
    expect(result.closeNotation).toBe('3&2');
    expect(result.sideA.pointsEarned).toBe(0);
    expect(result.sideB.pointsEarned).toBe(1);
  });

  it('3) awards a conceded hole to the opponent (sideB concedes hole 5)', () => {
    const tee = createEngineTee();
    const sideA = createSide(1, [0, 0], [createTeamHoleScore(1, 5, 4)]);
    const sideB = createSide(2, [0, 0], [createTeamHoleScore(2, 5, null, { isConceded: true })]);

    const result = computePinehurstResults(sideA, sideB, tee, 'F9', PINEHURST_ALLOWANCE, 1);

    expect(result.holeResults[4].result).toBe('A_WINS');
  });

  it('4) computes net correctly when team PH grants a stroke on SI 5', () => {
    const tee = createEngineTee();
    const sideA = createSide(1, [4, 9], [createTeamHoleScore(1, 5, 4)]);
    const sideB = createSide(2, [0, 0], [createTeamHoleScore(2, 5, 4)]);

    const result = computePinehurstResults(sideA, sideB, tee, 'FULL18', PINEHURST_ALLOWANCE, 1);
    const hole5 = result.holeResults[4];

    expect(hole5.sideANet).toBe(3);
    expect(hole5.sideBNet).toBe(4);
    expect(hole5.result).toBe('A_WINS');
  });

  it('5) resolves as halved after 9 holes and splits points evenly', () => {
    const tee = createEngineTee();
    const sideA = createSide(
      1,
      [0, 0],
      [
        createTeamHoleScore(1, 1, 4),
        createTeamHoleScore(1, 2, 5),
        createTeamHoleScore(1, 3, 4),
        createTeamHoleScore(1, 4, 5),
        createTeamHoleScore(1, 5, 4),
        createTeamHoleScore(1, 6, 5),
        createTeamHoleScore(1, 7, 4),
        createTeamHoleScore(1, 8, 5),
        createTeamHoleScore(1, 9, 4),
      ]
    );
    const sideB = createSide(
      2,
      [0, 0],
      [
        createTeamHoleScore(2, 1, 5),
        createTeamHoleScore(2, 2, 4),
        createTeamHoleScore(2, 3, 5),
        createTeamHoleScore(2, 4, 4),
        createTeamHoleScore(2, 5, 5),
        createTeamHoleScore(2, 6, 4),
        createTeamHoleScore(2, 7, 5),
        createTeamHoleScore(2, 8, 4),
        createTeamHoleScore(2, 9, 4),
      ]
    );

    const pointsAvailable = 2;
    const result = computePinehurstResults(
      sideA,
      sideB,
      tee,
      'F9',
      PINEHURST_ALLOWANCE,
      pointsAvailable
    );

    expect(result.status).toBe('FINAL');
    expect(result.summary).toBe('HALVED');
    expect(result.closeNotation).toBe('HALVED');
    expect(result.sideA.pointsEarned).toBe(pointsAvailable / 2);
    expect(result.sideB.pointsEarned).toBe(pointsAvailable / 2);
  });
});
