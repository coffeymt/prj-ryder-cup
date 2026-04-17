import { computePerPlayerHandicaps } from '../allowances';
import { computeMatchState } from '../matchState';
import type {
  HoleResult,
  HoleResultValue,
  HoleScoreInput,
  MatchState,
  PerPlayerAllowance,
  PlayerHandicapInput,
  Segment,
  StrokeMap,
  TeeData,
} from '../types';

export interface ShambleSideInput {
  sideId: number;
  players: PlayerHandicapInput[];
  holeScores: HoleScoreInput[];
}

type SideHoleStatus = 'READY' | 'PENDING' | 'CONCEDED' | 'FORFEIT';

interface SideHoleEvaluation {
  status: SideHoleStatus;
  net: number | null;
}

function toScoreKey(holeNumber: number, playerId: number): string {
  return `${holeNumber}:${playerId}`;
}

function getSegmentHoleNumbers(tee: TeeData, segment: Segment): number[] {
  if (segment === 'F9') {
    return tee.holes
      .filter((hole) => hole.holeNumber >= 1 && hole.holeNumber <= 9)
      .map((hole) => hole.holeNumber)
      .sort((a, b) => a - b);
  }

  if (segment === 'B9') {
    return tee.holes
      .filter((hole) => hole.holeNumber >= 10 && hole.holeNumber <= 18)
      .map((hole) => hole.holeNumber)
      .sort((a, b) => a - b);
  }

  return tee.holes.map((hole) => hole.holeNumber).sort((a, b) => a - b);
}

function indexHoleScores(holeScores: HoleScoreInput[]): Map<string, HoleScoreInput> {
  const index = new Map<string, HoleScoreInput>();

  for (const holeScore of holeScores) {
    if (holeScore.playerId === null) {
      continue;
    }

    index.set(toScoreKey(holeScore.holeNumber, holeScore.playerId), holeScore);
  }

  return index;
}

function evaluateSideHole(
  side: ShambleSideInput,
  holeNumber: number,
  strokeMapsByPlayerId: Map<number, StrokeMap>,
  scoreIndex: Map<string, HoleScoreInput>
): SideHoleEvaluation {
  const holeScores = side.players.map((player) =>
    scoreIndex.get(toScoreKey(holeNumber, player.playerId))
  );

  if (holeScores.some((score) => score?.isConceded === true)) {
    return { status: 'CONCEDED', net: null };
  }

  const availableNets: number[] = [];
  let pickedUpCount = 0;

  for (let index = 0; index < side.players.length; index += 1) {
    const player = side.players[index];
    const holeScore = holeScores[index];

    if (!holeScore) {
      return { status: 'PENDING', net: null };
    }

    if (holeScore.isPickedUp) {
      pickedUpCount += 1;
      continue;
    }

    if (holeScore.grossStrokes === null) {
      return { status: 'PENDING', net: null };
    }

    const strokeMap = strokeMapsByPlayerId.get(player.playerId);
    if (!strokeMap) {
      return { status: 'PENDING', net: null };
    }

    const strokesOnHole = strokeMap[holeNumber] ?? 0;
    availableNets.push(holeScore.grossStrokes - strokesOnHole);
  }

  if (pickedUpCount === side.players.length) {
    return { status: 'FORFEIT', net: null };
  }

  if (availableNets.length === 0) {
    return { status: 'PENDING', net: null };
  }

  return { status: 'READY', net: Math.min(...availableNets) };
}

function resolveHoleResult(
  sideAEvaluation: SideHoleEvaluation,
  sideBEvaluation: SideHoleEvaluation
): HoleResultValue {
  const sideALost = sideAEvaluation.status === 'CONCEDED' || sideAEvaluation.status === 'FORFEIT';
  const sideBLost = sideBEvaluation.status === 'CONCEDED' || sideBEvaluation.status === 'FORFEIT';

  if (sideALost && sideBLost) {
    return 'HALVED';
  }

  if (sideALost) {
    return 'B_WINS';
  }

  if (sideBLost) {
    return 'A_WINS';
  }

  if (sideAEvaluation.status === 'PENDING' || sideBEvaluation.status === 'PENDING') {
    return 'PENDING';
  }

  if (sideAEvaluation.net === null || sideBEvaluation.net === null) {
    return 'PENDING';
  }

  if (sideAEvaluation.net < sideBEvaluation.net) {
    return 'A_WINS';
  }

  if (sideBEvaluation.net < sideAEvaluation.net) {
    return 'B_WINS';
  }

  return 'HALVED';
}

export function computeShambleResults(
  sideA: ShambleSideInput,
  sideB: ShambleSideInput,
  tee: TeeData,
  segment: Segment,
  allowance: PerPlayerAllowance,
  pointsAvailable: number
): MatchState {
  const allPlayers = [...sideA.players, ...sideB.players];
  const playerHandicaps = computePerPlayerHandicaps(allPlayers, tee, segment, allowance);
  const strokeMapsByPlayerId = new Map(
    playerHandicaps.map((playerHandicap) => [playerHandicap.playerId, playerHandicap.strokeMap])
  );

  const sideAScoreIndex = indexHoleScores(sideA.holeScores);
  const sideBScoreIndex = indexHoleScores(sideB.holeScores);
  const holeNumbers = getSegmentHoleNumbers(tee, segment);

  const holeResults: HoleResult[] = holeNumbers.map((holeNumber) => {
    const sideAEvaluation = evaluateSideHole(
      sideA,
      holeNumber,
      strokeMapsByPlayerId,
      sideAScoreIndex
    );
    const sideBEvaluation = evaluateSideHole(
      sideB,
      holeNumber,
      strokeMapsByPlayerId,
      sideBScoreIndex
    );

    return {
      holeNumber,
      result: resolveHoleResult(sideAEvaluation, sideBEvaluation),
      sideANet: sideAEvaluation.net,
      sideBNet: sideBEvaluation.net,
    };
  });

  return computeMatchState(
    holeResults,
    holeNumbers.length,
    pointsAvailable,
    sideA.sideId,
    sideB.sideId
  );
}
