import { computePerPlayerHandicaps } from '../allowances';
import { computeMatchState } from '../matchState';
import type {
  HoleResult,
  HoleScoreInput,
  MatchState,
  PerPlayerAllowance,
  PlayerHandicapInput,
  PlayerPlayingHandicap,
  Segment,
  TeeData
} from '../types';

export interface FourBallSideInput {
  sideId: number;
  players: PlayerHandicapInput[];
  holeScores: HoleScoreInput[];
}

interface SideHoleEvaluation {
  teamNet: number | null;
  isForfeit: boolean;
  isPending: boolean;
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

function indexScoresByHole(holeScores: HoleScoreInput[]): Map<number, HoleScoreInput[]> {
  const scoresByHole = new Map<number, HoleScoreInput[]>();

  for (const holeScore of holeScores) {
    const existing = scoresByHole.get(holeScore.holeNumber);
    if (existing !== undefined) {
      existing.push(holeScore);
      continue;
    }

    scoresByHole.set(holeScore.holeNumber, [holeScore]);
  }

  return scoresByHole;
}

function indexLatestPlayerHoleScores(
  holeScores: HoleScoreInput[]
): Map<string, HoleScoreInput> {
  const latestScores = new Map<string, HoleScoreInput>();

  for (const holeScore of holeScores) {
    if (holeScore.playerId === null) {
      continue;
    }

    latestScores.set(`${holeScore.holeNumber}:${holeScore.playerId}`, holeScore);
  }

  return latestScores;
}

function getPlayerHandicapByPlayerId(
  playerHandicaps: PlayerPlayingHandicap[]
): Map<number, PlayerPlayingHandicap> {
  const handicapsByPlayerId = new Map<number, PlayerPlayingHandicap>();

  for (const playerHandicap of playerHandicaps) {
    handicapsByPlayerId.set(playerHandicap.playerId, playerHandicap);
  }

  return handicapsByPlayerId;
}

function evaluateSideHole(
  sidePlayers: PlayerHandicapInput[],
  handicapsByPlayerId: Map<number, PlayerPlayingHandicap>,
  latestScores: Map<string, HoleScoreInput>,
  holeNumber: number
): SideHoleEvaluation {
  const nets: number[] = [];
  let missingScores = 0;
  let pickedUpPlayers = 0;

  for (const player of sidePlayers) {
    const holeScore = latestScores.get(`${holeNumber}:${player.playerId}`);
    if (holeScore === undefined) {
      missingScores += 1;
      continue;
    }

    if (holeScore.isPickedUp || holeScore.grossStrokes === null) {
      pickedUpPlayers += 1;
      continue;
    }

    const playerHandicap = handicapsByPlayerId.get(player.playerId);
    if (playerHandicap === undefined) {
      throw new Error(`Missing handicap for player ${player.playerId}`);
    }

    const strokesOnHole = Number(playerHandicap.strokeMap[holeNumber] ?? 0);
    nets.push(holeScore.grossStrokes - strokesOnHole);
  }

  const allPlayersPickedUp =
    sidePlayers.length > 0 && pickedUpPlayers === sidePlayers.length && missingScores === 0;

  if (allPlayersPickedUp) {
    return {
      teamNet: null,
      isForfeit: true,
      isPending: false
    };
  }

  if (nets.length === 0) {
    return {
      teamNet: null,
      isForfeit: false,
      isPending: true
    };
  }

  return {
    teamNet: Math.min(...nets),
    isForfeit: false,
    isPending: false
  };
}

function computeHoleResult(
  holeNumber: number,
  sideAScoresOnHole: HoleScoreInput[],
  sideBScoresOnHole: HoleScoreInput[],
  sideAEvaluation: SideHoleEvaluation,
  sideBEvaluation: SideHoleEvaluation
): HoleResult {
  const sideAConceded = sideAScoresOnHole.some((score) => score.isConceded);
  const sideBConceded = sideBScoresOnHole.some((score) => score.isConceded);

  if (sideAConceded && sideBConceded) {
    return {
      holeNumber,
      result: 'HALVED',
      sideANet: null,
      sideBNet: null
    };
  }

  if (sideAConceded) {
    return {
      holeNumber,
      result: 'B_WINS',
      sideANet: null,
      sideBNet: sideBEvaluation.teamNet
    };
  }

  if (sideBConceded) {
    return {
      holeNumber,
      result: 'A_WINS',
      sideANet: sideAEvaluation.teamNet,
      sideBNet: null
    };
  }

  if (sideAEvaluation.isForfeit && sideBEvaluation.isForfeit) {
    return {
      holeNumber,
      result: 'HALVED',
      sideANet: null,
      sideBNet: null
    };
  }

  if (sideAEvaluation.isForfeit) {
    return {
      holeNumber,
      result: 'B_WINS',
      sideANet: null,
      sideBNet: sideBEvaluation.teamNet
    };
  }

  if (sideBEvaluation.isForfeit) {
    return {
      holeNumber,
      result: 'A_WINS',
      sideANet: sideAEvaluation.teamNet,
      sideBNet: null
    };
  }

  if (sideAEvaluation.isPending || sideBEvaluation.isPending) {
    return {
      holeNumber,
      result: 'PENDING',
      sideANet: sideAEvaluation.teamNet,
      sideBNet: sideBEvaluation.teamNet
    };
  }

  if (sideAEvaluation.teamNet === null || sideBEvaluation.teamNet === null) {
    return {
      holeNumber,
      result: 'PENDING',
      sideANet: sideAEvaluation.teamNet,
      sideBNet: sideBEvaluation.teamNet
    };
  }

  if (sideAEvaluation.teamNet < sideBEvaluation.teamNet) {
    return {
      holeNumber,
      result: 'A_WINS',
      sideANet: sideAEvaluation.teamNet,
      sideBNet: sideBEvaluation.teamNet
    };
  }

  if (sideBEvaluation.teamNet < sideAEvaluation.teamNet) {
    return {
      holeNumber,
      result: 'B_WINS',
      sideANet: sideAEvaluation.teamNet,
      sideBNet: sideBEvaluation.teamNet
    };
  }

  return {
    holeNumber,
    result: 'HALVED',
    sideANet: sideAEvaluation.teamNet,
    sideBNet: sideBEvaluation.teamNet
  };
}

export function computeFourBallResults(
  sideA: FourBallSideInput,
  sideB: FourBallSideInput,
  tee: TeeData,
  segment: Segment,
  allowance: PerPlayerAllowance,
  pointsAvailable: number
): MatchState {
  // Four-Ball match-play normalization must include all players in the match.
  const allPlayerHandicaps = computePerPlayerHandicaps(
    [...sideA.players, ...sideB.players],
    tee,
    segment,
    allowance
  );
  const handicapsByPlayerId = getPlayerHandicapByPlayerId(allPlayerHandicaps);

  const sideAScoresByHole = indexScoresByHole(sideA.holeScores);
  const sideBScoresByHole = indexScoresByHole(sideB.holeScores);
  const sideALatestScores = indexLatestPlayerHoleScores(sideA.holeScores);
  const sideBLatestScores = indexLatestPlayerHoleScores(sideB.holeScores);

  const holeResults: HoleResult[] = getSegmentHoles(tee, segment).map((hole) => {
    const sideAScoresOnHole = sideAScoresByHole.get(hole.holeNumber) ?? [];
    const sideBScoresOnHole = sideBScoresByHole.get(hole.holeNumber) ?? [];
    const sideAEvaluation = evaluateSideHole(
      sideA.players,
      handicapsByPlayerId,
      sideALatestScores,
      hole.holeNumber
    );
    const sideBEvaluation = evaluateSideHole(
      sideB.players,
      handicapsByPlayerId,
      sideBLatestScores,
      hole.holeNumber
    );

    return computeHoleResult(
      hole.holeNumber,
      sideAScoresOnHole,
      sideBScoresOnHole,
      sideAEvaluation,
      sideBEvaluation
    );
  });

  return computeMatchState(
    holeResults,
    holeResults.length,
    pointsAvailable,
    sideA.sideId,
    sideB.sideId
  );
}
