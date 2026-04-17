import { describe, it, expect } from 'vitest';
import { computeCH18, computeCH9 } from './courseHandicap';

describe('computeCH18', () => {
  it('computes CH18 standard case', () => {
    // @ts-expect-error Branded numeric inputs are validated at API boundaries.
    const result = computeCH18(10.6, 131, 71.0, 71);
    const expected = 10.6 * (131 / 113) + (71.0 - 71);

    expect(result).toBeCloseTo(expected, 2);
  });

  it('computes CH18 when course rating is lower than par', () => {
    // @ts-expect-error Branded numeric inputs are validated at API boundaries.
    const result = computeCH18(2.4, 134, 71.0, 72);
    const expected = 2.4 * (134 / 113) + (71.0 - 72);

    expect(result).toBeCloseTo(expected, 2);
  });

  it('computes CH18 for a plus handicap index', () => {
    // @ts-expect-error Branded numeric inputs are validated at API boundaries.
    const result = computeCH18(-2.0, 120, 72.0, 72);
    const expected = -2.0 * (120 / 113) + (72.0 - 72);

    expect(result).toBeCloseTo(expected, 2);
  });

  it('computes CH18 for a high handicap on a difficult tee', () => {
    // @ts-expect-error Branded numeric inputs are validated at API boundaries.
    const result = computeCH18(25.0, 155, 79.6, 72);
    const expected = 25.0 * (155 / 113) + (79.6 - 72);

    expect(result).toBeCloseTo(expected, 2);
  });
});

describe('computeCH9', () => {
  it('computes CH9 standard case', () => {
    // @ts-expect-error Branded numeric inputs are validated at API boundaries.
    const result = computeCH9(11.4, 128, 35.0, 35);
    const expected = 5.7 * (128 / 113) + (35.0 - 35);

    expect(result).toBeCloseTo(expected, 2);
  });

  it('rounds half-index to one decimal using round-half-up behavior', () => {
    // @ts-expect-error Branded numeric inputs are validated at API boundaries.
    const result135 = computeCH9(13.5, 113, 35.0, 35);
    // @ts-expect-error Branded numeric inputs are validated at API boundaries.
    const result134 = computeCH9(13.4, 113, 35.0, 35);

    expect(result135).toBeCloseTo(6.8, 2);
    expect(result134).toBeCloseTo(6.7, 2);
    expect(result135).toBeGreaterThan(result134);
  });

  it('computes CH9 with a negative course-rating offset', () => {
    // @ts-expect-error Branded numeric inputs are validated at API boundaries.
    const result = computeCH9(8.9, 130, 34.5, 35);
    const expected = 4.5 * (130 / 113) + (34.5 - 35);

    expect(result).toBeCloseTo(expected, 2);
  });
});
