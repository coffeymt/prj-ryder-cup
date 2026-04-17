import type {
  HoleResult,
  MatchState,
  MatchStateStatus,
  MatchStateSummary
} from './types';

interface PointsEarned {
  sideAPoints: number;
  sideBPoints: number;
}

function computeStatus(
  holesPlayed: number,
  holesRemaining: number,
  margin: number,
  holesUp: number
): { status: MatchStateStatus; closeNotation: string | null } {
  if (holesPlayed === 0) {
    return { status: 'PENDING', closeNotation: null };
  }

  if (holesRemaining === 0 && margin === 0) {
    return { status: 'FINAL', closeNotation: 'HALVED' };
  }

  if (holesRemaining === 0 && margin !== 0) {
    return { status: 'FINAL', closeNotation: `${holesUp}UP` };
  }

  if (margin > holesRemaining || margin < -holesRemaining) {
    return { status: 'CLOSED', closeNotation: `${holesUp}&${holesRemaining}` };
  }

  if (holesUp > 0 && holesUp === holesRemaining) {
    return { status: 'DORMIE', closeNotation: null };
  }

  return { status: 'IN_PROGRESS', closeNotation: null };
}

function computeSummary(
  status: MatchStateStatus,
  closeNotation: string | null,
  holesUp: number
): MatchStateSummary {
  if (status === 'DORMIE') {
    return 'DORMIE';
  }

  if (status === 'CLOSED' || status === 'FINAL') {
    if (closeNotation === 'HALVED') {
      return 'HALVED';
    }

    if (closeNotation !== null && closeNotation.includes('&')) {
      return closeNotation as MatchStateSummary;
    }

    if (closeNotation !== null && closeNotation.endsWith('UP')) {
      return `${holesUp} UP`;
    }
  }

  if (holesUp === 0) {
    return 'AS';
  }

  return `${holesUp} UP`;
}

function computePointsEarned(margin: number, pointsAvailable: number): PointsEarned {
  if (margin === 0) {
    const sideAPoints = pointsAvailable / 2;
    return {
      sideAPoints,
      sideBPoints: pointsAvailable - sideAPoints
    };
  }

  if (margin > 0) {
    return {
      sideAPoints: pointsAvailable,
      sideBPoints: 0
    };
  }

  return {
    sideAPoints: 0,
    sideBPoints: pointsAvailable
  };
}

export function computeMatchState(
  holeResults: HoleResult[],
  totalHoles: number,
  pointsAvailable: number,
  sideAId: number,
  sideBId: number
): MatchState {
  const boundedTotalHoles = Math.max(0, Math.trunc(totalHoles));
  const normalizedHoleResults = holeResults.slice(0, boundedTotalHoles).map((holeResult) => ({
    ...holeResult
  }));

  let holesPlayed = 0;
  let sideAHolesWon = 0;
  let sideBHolesWon = 0;
  let sideAHolesSplit = 0;
  let sideBHolesSplit = 0;

  for (const holeResult of normalizedHoleResults) {
    switch (holeResult.result) {
      case 'A_WINS':
        sideAHolesWon += 1;
        holesPlayed += 1;
        break;
      case 'B_WINS':
        sideBHolesWon += 1;
        holesPlayed += 1;
        break;
      case 'HALVED':
        sideAHolesSplit += 1;
        sideBHolesSplit += 1;
        holesPlayed += 1;
        break;
      case 'PENDING':
        break;
      default: {
        const exhaustiveResult: never = holeResult.result;
        throw new Error(`Unsupported hole result: ${String(exhaustiveResult)}`);
      }
    }
  }

  const holesRemaining = Math.max(0, boundedTotalHoles - holesPlayed);
  const margin = sideAHolesWon - sideBHolesWon;
  const holesUp = Math.abs(margin);
  const leadingSideId = margin > 0 ? sideAId : margin < 0 ? sideBId : null;

  const { status, closeNotation } = computeStatus(holesPlayed, holesRemaining, margin, holesUp);
  const summary = computeSummary(status, closeNotation, holesUp);
  const { sideAPoints, sideBPoints } = computePointsEarned(margin, pointsAvailable);

  return {
    status,
    holesPlayed,
    holesRemaining,
    leadingSideId,
    holesUp,
    summary,
    closeNotation,
    sideA: {
      sideId: sideAId,
      holesWon: sideAHolesWon,
      holesSplit: sideAHolesSplit,
      pointsEarned: sideAPoints
    },
    sideB: {
      sideId: sideBId,
      holesWon: sideBHolesWon,
      holesSplit: sideBHolesSplit,
      pointsEarned: sideBPoints
    },
    holeResults: normalizedHoleResults
  };
}
