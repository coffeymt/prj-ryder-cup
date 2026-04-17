import { computeTeamHandicaps } from '../allowances';
import { computeMatchState } from '../matchState';
import type {
  BlendedAllowance,
  HoleResult,
  HoleScoreInput,
  MatchState,
  PlayerHandicapInput,
  Segment,
  TeeData,
} from '../types';

export interface ScrambleSideInput {
  sideId: number;
  players: PlayerHandicapInput[]; // exactly 2
  holeScores: HoleScoreInput[]; // one entry per hole (player is null for scramble)
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

function indexHoleScores(scores: HoleScoreInput[]): Map<number, HoleScoreInput> {
  const byHole = new Map<number, HoleScoreInput>();
  for (const score of scores) {
    byHole.set(score.holeNumber, score);
  }
  return byHole;
}

function resolveHoleResult(
  holeNumber: number,
  sideAScore: HoleScoreInput | undefined,
  sideBScore: HoleScoreInput | undefined,
  sideAStrokeMap: Record<number, 0 | 1 | 2>,
  sideBStrokeMap: Record<number, 0 | 1 | 2>
): HoleResult {
  if (sideAScore?.isConceded && sideBScore?.isConceded) {
    return {
      holeNumber,
      result: 'HALVED',
      sideANet: null,
      sideBNet: null,
    };
  }

  if (sideAScore?.isConceded) {
    return {
      holeNumber,
      result: 'B_WINS',
      sideANet: null,
      sideBNet: null,
    };
  }

  if (sideBScore?.isConceded) {
    return {
      holeNumber,
      result: 'A_WINS',
      sideANet: null,
      sideBNet: null,
    };
  }

  if (
    sideAScore === undefined ||
    sideBScore === undefined ||
    sideAScore.grossStrokes === null ||
    sideBScore.grossStrokes === null
  ) {
    return {
      holeNumber,
      result: 'PENDING',
      sideANet: null,
      sideBNet: null,
    };
  }

  const sideAStrokes = Number(sideAStrokeMap[holeNumber] ?? 0);
  const sideBStrokes = Number(sideBStrokeMap[holeNumber] ?? 0);
  const sideANet = sideAScore.grossStrokes - sideAStrokes;
  const sideBNet = sideBScore.grossStrokes - sideBStrokes;

  if (sideANet < sideBNet) {
    return {
      holeNumber,
      result: 'A_WINS',
      sideANet,
      sideBNet,
    };
  }

  if (sideBNet < sideANet) {
    return {
      holeNumber,
      result: 'B_WINS',
      sideANet,
      sideBNet,
    };
  }

  return {
    holeNumber,
    result: 'HALVED',
    sideANet,
    sideBNet,
  };
}

export function computeScrambleResults(
  sideA: ScrambleSideInput,
  sideB: ScrambleSideInput,
  tee: TeeData,
  segment: Segment,
  allowance: BlendedAllowance,
  pointsAvailable: number
): MatchState {
  const sideTeamHandicaps = computeTeamHandicaps(
    [
      { sideId: sideA.sideId, players: sideA.players },
      { sideId: sideB.sideId, players: sideB.players },
    ],
    tee,
    segment,
    allowance
  );

  const sideATeamHandicap = sideTeamHandicaps.find((side) => side.sideId === sideA.sideId);
  const sideBTeamHandicap = sideTeamHandicaps.find((side) => side.sideId === sideB.sideId);

  if (sideATeamHandicap === undefined || sideBTeamHandicap === undefined) {
    throw new Error('Could not compute team handicaps for scramble sides.');
  }

  const segmentHoles = getSegmentHoles(tee, segment)
    .slice()
    .sort((a, b) => a.holeNumber - b.holeNumber);
  const sideAScoresByHole = indexHoleScores(sideA.holeScores);
  const sideBScoresByHole = indexHoleScores(sideB.holeScores);

  const holeResults = segmentHoles.map((hole) =>
    resolveHoleResult(
      hole.holeNumber,
      sideAScoresByHole.get(hole.holeNumber),
      sideBScoresByHole.get(hole.holeNumber),
      sideATeamHandicap.strokeMap,
      sideBTeamHandicap.strokeMap
    )
  );

  return computeMatchState(
    holeResults,
    segmentHoles.length,
    pointsAvailable,
    sideA.sideId,
    sideB.sideId
  );
}
