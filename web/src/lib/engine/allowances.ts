import { computeCH18, computeCH9 } from './courseHandicap';
import { buildStrokeMap } from './strokeAllocation';
import type {
  BlendedAllowance,
  CourseHandicap,
  PerPlayerAllowance,
  PlayerHandicapInput,
  PlayerPlayingHandicap,
  PlayingHandicap,
  Segment,
  TeamPlayingHandicap,
  TeeData
} from './types';

function toPlayingHandicap(value: number): PlayingHandicap {
  return value as PlayingHandicap;
}

function toCourseHandicap(value: number): CourseHandicap {
  return value as CourseHandicap;
}

function getSegmentHoles(tee: TeeData, segment: Segment): TeeData['holes'] {
  if (segment === 'F9') {
    return tee.holes.filter((hole) => hole.holeNumber >= 1 && hole.holeNumber <= 9);
  }

  if (segment === 'B9') {
    return tee.holes.filter((hole) => hole.holeNumber >= 10 && hole.holeNumber <= 18);
  }

  return tee.holes;
}

function computeSegmentCourseHandicap(
  handicapIndex: PlayerHandicapInput['handicapIndex'],
  tee: TeeData,
  segment: Segment
): CourseHandicap {
  if (segment === 'F9') {
    if (tee.cr9f !== null && tee.slope9f !== null && tee.par9f !== null) {
      return computeCH9(handicapIndex, tee.slope9f, tee.cr9f, tee.par9f);
    }

    // Convention 2 fallback: if 9-hole ratings are missing, use half of CH18.
    return toCourseHandicap(Number(computeCH18(handicapIndex, tee.slope18, tee.cr18, tee.par18)) / 2);
  }

  if (segment === 'B9') {
    if (tee.cr9b !== null && tee.slope9b !== null && tee.par9b !== null) {
      return computeCH9(handicapIndex, tee.slope9b, tee.cr9b, tee.par9b);
    }

    // Convention 2 fallback: if 9-hole ratings are missing, use half of CH18.
    return toCourseHandicap(Number(computeCH18(handicapIndex, tee.slope18, tee.cr18, tee.par18)) / 2);
  }

  return computeCH18(handicapIndex, tee.slope18, tee.cr18, tee.par18);
}

export function applyPerPlayerAllowance(
  courseHandicap: CourseHandicap,
  allowance: PerPlayerAllowance
): PlayingHandicap {
  return toPlayingHandicap(Math.round(Number(courseHandicap) * allowance.pct));
}

export function applyBlendedAllowance(
  lowCH: CourseHandicap,
  highCH: CourseHandicap,
  allowance: BlendedAllowance
): PlayingHandicap {
  const blendedValue = Number(lowCH) * allowance.lowPct + Number(highCH) * allowance.highPct;
  return toPlayingHandicap(Math.round(blendedValue));
}

export function normalizeMatchPlayHandicaps(
  playingHandicaps: PlayingHandicap[]
): PlayingHandicap[] {
  if (playingHandicaps.length === 0) {
    return [];
  }

  const minimum = Math.min(...playingHandicaps.map((value) => Number(value)));
  return playingHandicaps.map((value) => toPlayingHandicap(Number(value) - minimum));
}

export function computePerPlayerHandicaps(
  players: PlayerHandicapInput[],
  tee: TeeData,
  segment: Segment,
  allowance: PerPlayerAllowance
): PlayerPlayingHandicap[] {
  const segmentHoles = getSegmentHoles(tee, segment);
  const courseHandicaps = players.map((player) =>
    computeSegmentCourseHandicap(player.handicapIndex, tee, segment)
  );
  const unnormalizedPlayingHandicaps = courseHandicaps.map((courseHandicap) =>
    applyPerPlayerAllowance(courseHandicap, allowance)
  );
  const normalizedHandicaps = normalizeMatchPlayHandicaps(unnormalizedPlayingHandicaps);

  return players.map((player, index) => {
    const strokes = normalizedHandicaps[index];
    return {
      playerId: player.playerId,
      sideId: player.sideId,
      courseHandicap: courseHandicaps[index],
      playingHandicap: unnormalizedPlayingHandicaps[index],
      strokes,
      strokeMap: buildStrokeMap(strokes, segmentHoles)
    };
  });
}

export function computeTeamHandicaps(
  sidesInput: { sideId: number; players: PlayerHandicapInput[] }[],
  tee: TeeData,
  segment: Segment,
  allowance: BlendedAllowance
): TeamPlayingHandicap[] {
  const segmentHoles = getSegmentHoles(tee, segment);
  const sideValues = sidesInput.map((side) => {
    const sideCourseHandicaps = side.players.map((player) =>
      computeSegmentCourseHandicap(player.handicapIndex, tee, segment)
    );
    const sideNumbers = sideCourseHandicaps.map((value) => Number(value));
    const low = Math.min(...sideNumbers);
    const high = Math.max(...sideNumbers);
    const blendedCourseHandicap = toCourseHandicap(low * allowance.lowPct + high * allowance.highPct);

    return {
      sideId: side.sideId,
      teamCourseHandicap: blendedCourseHandicap,
      teamPlayingHandicap: applyBlendedAllowance(
        toCourseHandicap(low),
        toCourseHandicap(high),
        allowance
      )
    };
  });

  const normalizedTeamStrokes = normalizeMatchPlayHandicaps(
    sideValues.map((side) => side.teamPlayingHandicap)
  );

  return sideValues.map((side, index) => {
    const strokes = normalizedTeamStrokes[index];
    return {
      sideId: side.sideId,
      teamCourseHandicap: side.teamCourseHandicap,
      teamPlayingHandicap: side.teamPlayingHandicap,
      strokes,
      strokeMap: buildStrokeMap(strokes, segmentHoles)
    };
  });
}
