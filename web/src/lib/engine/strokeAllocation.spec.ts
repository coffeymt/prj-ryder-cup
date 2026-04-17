import { describe, expect, it } from 'vitest';

import { buildStrokeMap } from './strokeAllocation';
import type { HoleData, Par, PlayingHandicap, StrokeIndex } from './types';

function createCanonical18Holes(): HoleData[] {
  return Array.from({ length: 18 }, (_, index) => {
    const holeNumber = index + 1;
    return {
      holeNumber,
      par: 4 as Par,
      strokeIndex: holeNumber as StrokeIndex,
    };
  });
}

function toNumericMap(strokeMap: ReturnType<typeof buildStrokeMap>): Record<number, number> {
  return strokeMap as unknown as Record<number, number>;
}

function countHolesWithValue(strokeMap: Record<number, number>, value: number): number {
  return Object.values(strokeMap).filter((strokes) => strokes === value).length;
}

function totalStrokes(strokeMap: Record<number, number>): number {
  return Object.values(strokeMap).reduce((sum, strokes) => sum + strokes, 0);
}

describe('buildStrokeMap', () => {
  it('allocates zero strokes to every hole for PH = 0', () => {
    const holes = createCanonical18Holes();
    const strokeMap = toNumericMap(buildStrokeMap(0 as PlayingHandicap, holes));

    expect(Object.keys(strokeMap)).toHaveLength(18);
    for (const hole of holes) {
      expect(strokeMap[hole.holeNumber]).toBe(0);
    }
  });

  it('allocates one stroke to SI <= 10 for PH = 10', () => {
    const holes = createCanonical18Holes();
    const strokeMap = toNumericMap(buildStrokeMap(10 as PlayingHandicap, holes));

    for (const hole of holes) {
      const expected = hole.holeNumber <= 10 ? 1 : 0;
      expect(strokeMap[hole.holeNumber]).toBe(expected);
    }
    expect(countHolesWithValue(strokeMap, 1)).toBe(10);
  });

  it('allocates exactly one stroke to every hole for PH = 18', () => {
    const holes = createCanonical18Holes();
    const strokeMap = toNumericMap(buildStrokeMap(18 as PlayingHandicap, holes));

    for (const hole of holes) {
      expect(strokeMap[hole.holeNumber]).toBe(1);
    }
  });

  it('wraps correctly for PH = 22 with SI <= 4 getting a second stroke', () => {
    const holes = createCanonical18Holes();
    const strokeMap = toNumericMap(buildStrokeMap(22 as PlayingHandicap, holes));

    for (const hole of holes) {
      const expected = hole.holeNumber <= 4 ? 2 : 1;
      expect(strokeMap[hole.holeNumber]).toBe(expected);
    }
    expect(countHolesWithValue(strokeMap, 2)).toBe(4);
    expect(countHolesWithValue(strokeMap, 1)).toBe(14);
  });

  it('allocates exactly two strokes to every hole for PH = 36', () => {
    const holes = createCanonical18Holes();
    const strokeMap = toNumericMap(buildStrokeMap(36 as PlayingHandicap, holes));

    for (const hole of holes) {
      expect(strokeMap[hole.holeNumber]).toBe(2);
    }
  });

  it('allocates -1 to SI 18, 17, and 16 for PH = -3', () => {
    const holes = createCanonical18Holes();
    const strokeMap = toNumericMap(buildStrokeMap(-3 as PlayingHandicap, holes));

    for (const hole of holes) {
      const expected = hole.holeNumber >= 16 ? -1 : 0;
      expect(strokeMap[hole.holeNumber]).toBe(expected);
    }
    expect(countHolesWithValue(strokeMap, -1)).toBe(3);
  });

  it('allocates seven strokes total for a 9-hole F9 slice with PH = 7', () => {
    const frontNineHoles = createCanonical18Holes().filter((hole) => hole.holeNumber <= 9);
    const strokeMap = toNumericMap(buildStrokeMap(7 as PlayingHandicap, frontNineHoles));

    expect(Object.keys(strokeMap)).toHaveLength(9);
    expect(countHolesWithValue(strokeMap, 1)).toBe(7);
    expect(totalStrokes(strokeMap)).toBe(7);
  });

  it('allocates exactly five strokes for a 9-hole B9 slice with PH = 5', () => {
    const backNineHoles = createCanonical18Holes().filter((hole) => hole.holeNumber >= 10);
    const strokeMap = toNumericMap(buildStrokeMap(5 as PlayingHandicap, backNineHoles));

    expect(Object.keys(strokeMap)).toHaveLength(9);
    expect(countHolesWithValue(strokeMap, 1)).toBe(5);
    expect(totalStrokes(strokeMap)).toBe(5);
  });
});
