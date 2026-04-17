import type { HandicapIndex, Slope, CourseRating, Par, CourseHandicap } from './types';

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function computeCH18(
  handicapIndex: HandicapIndex,
  slope: Slope,
  courseRating: CourseRating,
  par: Par
): CourseHandicap {
  const result = handicapIndex * (slope / 113) + (courseRating - par);
  return result as CourseHandicap;
}

export function computeCH9(
  handicapIndex: HandicapIndex,
  slope9: Slope,
  cr9: CourseRating,
  par9: Par
): CourseHandicap {
  const halfIndex = roundToOneDecimal(handicapIndex / 2);
  const result = halfIndex * (slope9 / 113) + (cr9 - par9);
  return result as CourseHandicap;
}
