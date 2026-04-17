import { computePerPlayerHandicaps } from '../allowances';
import { computeMatchState } from '../matchState';
import type {
  HoleResult,
  HoleScoreInput,
  MatchState,
  PerPlayerAllowance,
  PlayerHandicapInput,
  Segment,
  TeeData,
} from '../types';

export interface SinglesSideInput {
  sideId: number;
  player: PlayerHandicapInput;
  holeScores: HoleScoreInput[];
}

function getSegmentHoleNumbers(tee: TeeData, segment: Segment): number[] {
  const filteredHoles =
    segment === 'F9'
      ? tee.holes.filter((hole) => hole.holeNumber >= 1 && hole.holeNumber <= 9)
      : segment === 'B9'
        ? tee.holes.filter((hole) => hole.holeNumber >= 10 && hole.holeNumber <= 18)
        : tee.holes;

  return filteredHoles
    .map((hole) => hole.holeNumber)
    .sort((leftHoleNumber, rightHoleNumber) => leftHoleNumber - rightHoleNumber);
}

function isForfeit(score: HoleScoreInput | undefined): boolean {
  if (score === undefined) {
    return false;
  }

  return score.isConceded || score.isPickedUp;
}

function indexScoresByHole(holeScores: HoleScoreInput[]): Map<number, HoleScoreInput> {
  return new Map(holeScores.map((score) => [score.holeNumber, score]));
}

function resolveHoleResult(
  holeNumber: number,
  sideAHole: HoleScoreInput | undefined,
  sideBHole: HoleScoreInput | undefined,
  sideAStrokeMap: Record<number, number>,
  sideBStrokeMap: Record<number, number>
): HoleResult {
  const sideAForfeit = isForfeit(sideAHole);
  const sideBForfeit = isForfeit(sideBHole);

  if (sideAForfeit && sideBForfeit) {
    return { holeNumber, result: 'HALVED', sideANet: null, sideBNet: null };
  }

  if (sideAForfeit) {
    return { holeNumber, result: 'B_WINS', sideANet: null, sideBNet: null };
  }

  if (sideBForfeit) {
    return { holeNumber, result: 'A_WINS', sideANet: null, sideBNet: null };
  }

  if (
    sideAHole === undefined ||
    sideBHole === undefined ||
    sideAHole.grossStrokes === null ||
    sideBHole.grossStrokes === null
  ) {
    return { holeNumber, result: 'PENDING', sideANet: null, sideBNet: null };
  }

  const sideANet = sideAHole.grossStrokes - (sideAStrokeMap[holeNumber] ?? 0);
  const sideBNet = sideBHole.grossStrokes - (sideBStrokeMap[holeNumber] ?? 0);

  if (sideANet < sideBNet) {
    return { holeNumber, result: 'A_WINS', sideANet, sideBNet };
  }

  if (sideBNet < sideANet) {
    return { holeNumber, result: 'B_WINS', sideANet, sideBNet };
  }

  return { holeNumber, result: 'HALVED', sideANet, sideBNet };
}

export function computeSinglesResults(
  sideA: SinglesSideInput,
  sideB: SinglesSideInput,
  tee: TeeData,
  segment: Segment,
  allowance: PerPlayerAllowance,
  pointsAvailable: number
): MatchState {
  const playerHandicaps = computePerPlayerHandicaps(
    [sideA.player, sideB.player],
    tee,
    segment,
    allowance
  );
  const sideAHandicap = playerHandicaps.find(
    (playerHandicap) => playerHandicap.sideId === sideA.sideId
  );
  const sideBHandicap = playerHandicaps.find(
    (playerHandicap) => playerHandicap.sideId === sideB.sideId
  );

  if (sideAHandicap === undefined || sideBHandicap === undefined) {
    throw new Error('Singles sides must map to exactly one normalized player handicap each.');
  }

  const sideAScoreMap = indexScoresByHole(sideA.holeScores);
  const sideBScoreMap = indexScoresByHole(sideB.holeScores);
  const segmentHoleNumbers = getSegmentHoleNumbers(tee, segment);

  const holeResults = segmentHoleNumbers.map((holeNumber) =>
    resolveHoleResult(
      holeNumber,
      sideAScoreMap.get(holeNumber),
      sideBScoreMap.get(holeNumber),
      sideAHandicap.strokeMap as unknown as Record<number, number>,
      sideBHandicap.strokeMap as unknown as Record<number, number>
    )
  );

  return computeMatchState(
    holeResults,
    segmentHoleNumbers.length,
    pointsAvailable,
    sideA.sideId,
    sideB.sideId
  );
}
