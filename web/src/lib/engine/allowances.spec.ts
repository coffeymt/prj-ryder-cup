import { describe, expect, it } from 'vitest';

import {
  applyBlendedAllowance,
  applyPerPlayerAllowance,
  computePerPlayerHandicaps,
  computeTeamHandicaps,
  normalizeMatchPlayHandicaps
} from './allowances';
import { computeCH18 } from './courseHandicap';
import type {
  CourseHandicap,
  HandicapIndex,
  Par,
  PerPlayerAllowance,
  PlayingHandicap,
  StrokeMap,
  StrokeIndex,
  TeeData
} from './types';
import { DEFAULT_ALLOWANCES, USGA_ALLOWANCES } from './types';

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

function toNumericStrokeMap(strokeMap: StrokeMap): Record<number, number> {
  return strokeMap as unknown as Record<number, number>;
}

function sumStrokeMap(strokeMap: StrokeMap): number {
  return Object.values(toNumericStrokeMap(strokeMap)).reduce((total, strokes) => total + strokes, 0);
}

describe('allowances', () => {
  it('1) applyPerPlayerAllowance rounds allowed percentages correctly', () => {
    const eightyFivePercent = applyPerPlayerAllowance(
      10 as CourseHandicap,
      { type: 'perPlayer', pct: 0.85 } as PerPlayerAllowance
    );
    const fullAllowance = applyPerPlayerAllowance(
      6.4 as CourseHandicap,
      { type: 'perPlayer', pct: 1 } as PerPlayerAllowance
    );
    const seventyFivePercent = applyPerPlayerAllowance(
      8.2 as CourseHandicap,
      { type: 'perPlayer', pct: 0.75 } as PerPlayerAllowance
    );

    expect(eightyFivePercent).toBe(9);
    expect(fullAllowance).toBe(6);
    expect(seventyFivePercent).toBe(6);
  });

  it('2) applyBlendedAllowance computes blended team PH', () => {
    const teamHandicap = applyBlendedAllowance(
      3 as CourseHandicap,
      20 as CourseHandicap,
      { type: 'blended', lowPct: 0.35, highPct: 0.15 }
    );

    expect(teamHandicap).toBe(4);
  });

  it('3) normalizeMatchPlayHandicaps subtracts the lowest handicap', () => {
    const normalized = normalizeMatchPlayHandicaps([6, 8, 5, 7] as PlayingHandicap[]);
    const allZero = normalizeMatchPlayHandicaps([0, 0] as PlayingHandicap[]);

    expect(normalized).toEqual([1, 3, 0, 2]);
    expect(allZero).toEqual([0, 0]);
  });

  it('4) computePerPlayerHandicaps handles Four-Ball FULL18 normalization and stroke maps', () => {
    const results = computePerPlayerHandicaps(
      [
        { playerId: 1, sideId: 1, handicapIndex: 8.9 as HandicapIndex },
        { playerId: 2, sideId: 2, handicapIndex: 15.4 as HandicapIndex }
      ],
      mockTee,
      'FULL18',
      { type: 'perPlayer', pct: 1.0 }
    );

    expect(results).toHaveLength(2);
    expect(results[0].playingHandicap).toBe(10);
    expect(results[1].playingHandicap).toBe(18);
    expect(results[0].strokes).toBe(0);
    expect(results[1].strokes).toBe(8);
    expect(sumStrokeMap(results[0].strokeMap)).toBe(0);
    expect(sumStrokeMap(results[1].strokeMap)).toBe(8);
    expect(Object.keys(toNumericStrokeMap(results[1].strokeMap))).toHaveLength(18);
  });

  it('5) computePerPlayerHandicaps uses CH9 for F9 and filters stroke map to holes 1-9', () => {
    const results = computePerPlayerHandicaps(
      [
        { playerId: 1, sideId: 1, handicapIndex: 8.9 as HandicapIndex },
        { playerId: 2, sideId: 2, handicapIndex: 15.4 as HandicapIndex }
      ],
      mockTee,
      'F9',
      { type: 'perPlayer', pct: 0.85 }
    );

    expect(results).toHaveLength(2);
    expect(results[0].courseHandicap).toBeCloseTo(5.597, 2);
    expect(results[1].courseHandicap).toBeCloseTo(9.222, 2);
    expect(results[0].playingHandicap).toBe(5);
    expect(results[1].playingHandicap).toBe(8);
    expect(results[0].strokes).toBe(0);
    expect(results[1].strokes).toBe(3);
    expect(Object.keys(toNumericStrokeMap(results[0].strokeMap))).toHaveLength(9);
    expect(Object.keys(toNumericStrokeMap(results[1].strokeMap))).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9'
    ]);
    expect(sumStrokeMap(results[1].strokeMap)).toBe(3);
  });

  it('6) computeTeamHandicaps computes Scramble FULL18 team PH and normalizes lower side to 0', () => {
    const teamResults = computeTeamHandicaps(
      [
        {
          sideId: 11,
          players: [
            { playerId: 1, sideId: 11, handicapIndex: 2.4 as HandicapIndex },
            { playerId: 2, sideId: 11, handicapIndex: 18.6 as HandicapIndex }
          ]
        },
        {
          sideId: 22,
          players: [
            { playerId: 3, sideId: 22, handicapIndex: 5.8 as HandicapIndex },
            { playerId: 4, sideId: 22, handicapIndex: 25.0 as HandicapIndex }
          ]
        }
      ],
      mockTee,
      'FULL18',
      { type: 'blended', lowPct: 0.35, highPct: 0.15 }
    );

    expect(teamResults).toHaveLength(2);
    expect(teamResults[0].teamPlayingHandicap).toBe(4);
    expect(teamResults[1].teamPlayingHandicap).toBe(7);
    expect(teamResults[0].strokes).toBe(0);
    expect(teamResults[1].strokes).toBe(3);
    expect(sumStrokeMap(teamResults[0].strokeMap)).toBe(0);
    expect(sumStrokeMap(teamResults[1].strokeMap)).toBe(3);
  });

  it('7) Convention 2 fallback uses half CH18 when front-nine ratings are missing', () => {
    const teeWithoutFrontNine = {
      ...mockTee,
      cr9f: null,
      slope9f: null,
      par9f: null
    };

    expect(() =>
      computePerPlayerHandicaps(
        [{ playerId: 1, sideId: 1, handicapIndex: 8.9 as HandicapIndex }],
        teeWithoutFrontNine,
        'F9',
        { type: 'perPlayer', pct: 1.0 }
      )
    ).not.toThrow();

    const result = computePerPlayerHandicaps(
      [{ playerId: 1, sideId: 1, handicapIndex: 8.9 as HandicapIndex }],
      teeWithoutFrontNine,
      'F9',
      { type: 'perPlayer', pct: 1.0 }
    );
    const expectedHalfCH18 =
      Number(computeCH18(8.9 as HandicapIndex, mockTee.slope18, mockTee.cr18, mockTee.par18)) / 2;

    expect(result[0].courseHandicap).toBeCloseTo(expectedHalfCH18, 6);
  });

  it('8) exports shamble defaults and USGA one-click values', () => {
    expect(DEFAULT_ALLOWANCES.shamble.pct).toBe(0.85);
    expect(USGA_ALLOWANCES.shamble.pct).toBe(0.75);
  });
});
