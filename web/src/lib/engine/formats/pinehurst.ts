import { computeTeamHandicaps } from '../allowances';
import { computeMatchState } from '../matchState';
import type {
  BlendedAllowance,
  HoleResult,
  HoleResultValue,
  HoleScoreInput,
  MatchState,
  PlayerHandicapInput,
  Segment,
  TeeData,
} from '../types';

export interface PinehurstSideInput {
  sideId: number;
  players: PlayerHandicapInput[];
  holeScores: HoleScoreInput[];
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

function indexSideHoleScores(
  side: PinehurstSideInput,
  allowedHoleNumbers: Set<number>
): Map<number, HoleScoreInput> {
  const scoresByHole = new Map<number, HoleScoreInput>();

  for (const holeScore of side.holeScores) {
    if (holeScore.matchSideId !== side.sideId) {
      continue;
    }

    if (!allowedHoleNumbers.has(holeScore.holeNumber)) {
      continue;
    }

    scoresByHole.set(holeScore.holeNumber, holeScore);
  }

  return scoresByHole;
}

function resolveHoleResult(
  sideAHoleScore: HoleScoreInput | undefined,
  sideBHoleScore: HoleScoreInput | undefined,
  sideAStrokes: number,
  sideBStrokes: number
): { result: HoleResultValue; sideANet: number | null; sideBNet: number | null } {
  const sideAConceded = sideAHoleScore?.isConceded ?? false;
  const sideBConceded = sideBHoleScore?.isConceded ?? false;

  if (sideAConceded && !sideBConceded) {
    return { result: 'B_WINS', sideANet: null, sideBNet: null };
  }

  if (sideBConceded && !sideAConceded) {
    return { result: 'A_WINS', sideANet: null, sideBNet: null };
  }

  if (sideAConceded && sideBConceded) {
    return { result: 'HALVED', sideANet: null, sideBNet: null };
  }

  const sideAGross = sideAHoleScore?.grossStrokes ?? null;
  const sideBGross = sideBHoleScore?.grossStrokes ?? null;
  const sideANet = sideAGross === null ? null : sideAGross - sideAStrokes;
  const sideBNet = sideBGross === null ? null : sideBGross - sideBStrokes;

  if (sideANet === null || sideBNet === null) {
    return { result: 'PENDING', sideANet, sideBNet };
  }

  if (sideANet < sideBNet) {
    return { result: 'A_WINS', sideANet, sideBNet };
  }

  if (sideBNet < sideANet) {
    return { result: 'B_WINS', sideANet, sideBNet };
  }

  return { result: 'HALVED', sideANet, sideBNet };
}

export function computePinehurstResults(
  sideA: PinehurstSideInput,
  sideB: PinehurstSideInput,
  tee: TeeData,
  segment: Segment,
  allowance: BlendedAllowance,
  pointsAvailable: number
): MatchState {
  const segmentHoles = getSegmentHoles(tee, segment);
  const allowedHoleNumbers = new Set(segmentHoles.map((hole) => hole.holeNumber));
  const sideAScoresByHole = indexSideHoleScores(sideA, allowedHoleNumbers);
  const sideBScoresByHole = indexSideHoleScores(sideB, allowedHoleNumbers);

  const [sideATeamHandicap, sideBTeamHandicap] = computeTeamHandicaps(
    [
      { sideId: sideA.sideId, players: sideA.players },
      { sideId: sideB.sideId, players: sideB.players },
    ],
    tee,
    segment,
    allowance
  );

  const sideAStrokeMap = sideATeamHandicap.strokeMap as unknown as Record<number, number>;
  const sideBStrokeMap = sideBTeamHandicap.strokeMap as unknown as Record<number, number>;

  const holeResults: HoleResult[] = segmentHoles.map((hole) => {
    const sideAHoleScore = sideAScoresByHole.get(hole.holeNumber);
    const sideBHoleScore = sideBScoresByHole.get(hole.holeNumber);
    const sideAStrokes = sideAStrokeMap[hole.holeNumber] ?? 0;
    const sideBStrokes = sideBStrokeMap[hole.holeNumber] ?? 0;
    const { result, sideANet, sideBNet } = resolveHoleResult(
      sideAHoleScore,
      sideBHoleScore,
      sideAStrokes,
      sideBStrokes
    );

    return {
      holeNumber: hole.holeNumber,
      result,
      sideANet,
      sideBNet,
    };
  });

  return computeMatchState(
    holeResults,
    segmentHoles.length,
    pointsAvailable,
    sideA.sideId,
    sideB.sideId
  );
}
