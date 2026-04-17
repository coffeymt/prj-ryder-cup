import { computeFourBallResults } from './formats/fourBall';
import { computePinehurstResults } from './formats/pinehurst';
import { computeScrambleResults } from './formats/scramble';
import { computeShambleResults } from './formats/shamble';
import { computeSinglesResults } from './formats/singles';
import type {
  Allowance,
  BlendedAllowance,
  Format,
  HoleScoreInput,
  MatchState,
  PerPlayerAllowance,
  PlayerHandicapInput,
  SegmentConfig,
  SubMatchResult,
  TeeData,
  TournamentAllowances,
} from './types';

export interface MatchSideInput {
  sideId: number;
  teamId: number;
  players: PlayerHandicapInput[];
  holeScores: HoleScoreInput[];
}

export interface SplitFormatInput {
  segments: SegmentConfig[];
  sideA: MatchSideInput;
  sideB: MatchSideInput;
  tee: TeeData;
  tournamentAllowances: TournamentAllowances;
}

export interface SplitFormatResult {
  segmentResults: Array<{
    segmentConfig: SegmentConfig;
    matchState: MatchState;
    subMatchResult: SubMatchResult;
  }>;
  matchId: number;
}

function getTournamentAllowance(format: Format, allowances: TournamentAllowances): Allowance {
  switch (format) {
    case 'SCRAMBLE':
      return allowances.scramble;
    case 'PINEHURST':
      return allowances.pinehurst;
    case 'SHAMBLE':
      return allowances.shamble;
    case 'FOURBALL':
      return allowances.fourBall;
    case 'SINGLES':
      return allowances.singles;
    default: {
      const exhaustiveFormat: never = format;
      throw new Error(`Unsupported split format: ${String(exhaustiveFormat)}`);
    }
  }
}

function assertBlendedAllowance(format: Format, allowance: Allowance): BlendedAllowance {
  if (allowance.type !== 'blended') {
    throw new Error(
      `Allowance type mismatch for ${format}: expected blended, received ${allowance.type}.`
    );
  }

  return allowance;
}

function assertPerPlayerAllowance(format: Format, allowance: Allowance): PerPlayerAllowance {
  if (allowance.type !== 'perPlayer') {
    throw new Error(
      `Allowance type mismatch for ${format}: expected perPlayer, received ${allowance.type}.`
    );
  }

  return allowance;
}

function filterSideHoleScores(
  holeScores: HoleScoreInput[],
  sideId: number,
  holeStart: number,
  holeEnd: number
): HoleScoreInput[] {
  return holeScores.filter(
    (holeScore) =>
      holeScore.matchSideId === sideId &&
      holeScore.holeNumber >= holeStart &&
      holeScore.holeNumber <= holeEnd
  );
}

function computeSegmentMatchState(
  segmentConfig: SegmentConfig,
  sideA: MatchSideInput,
  sideB: MatchSideInput,
  tee: TeeData,
  tournamentAllowances: TournamentAllowances
): MatchState {
  const allowance =
    segmentConfig.allowanceOverride ??
    getTournamentAllowance(segmentConfig.format, tournamentAllowances);

  const sideASegmentScores = filterSideHoleScores(
    sideA.holeScores,
    sideA.sideId,
    segmentConfig.holeStart,
    segmentConfig.holeEnd
  );
  const sideBSegmentScores = filterSideHoleScores(
    sideB.holeScores,
    sideB.sideId,
    segmentConfig.holeStart,
    segmentConfig.holeEnd
  );

  switch (segmentConfig.format) {
    case 'SCRAMBLE':
      return computeScrambleResults(
        {
          sideId: sideA.sideId,
          players: sideA.players,
          holeScores: sideASegmentScores,
        },
        {
          sideId: sideB.sideId,
          players: sideB.players,
          holeScores: sideBSegmentScores,
        },
        tee,
        segmentConfig.segment,
        assertBlendedAllowance(segmentConfig.format, allowance),
        segmentConfig.pointsAvailable
      );
    case 'PINEHURST':
      return computePinehurstResults(
        {
          sideId: sideA.sideId,
          players: sideA.players,
          holeScores: sideASegmentScores,
        },
        {
          sideId: sideB.sideId,
          players: sideB.players,
          holeScores: sideBSegmentScores,
        },
        tee,
        segmentConfig.segment,
        assertBlendedAllowance(segmentConfig.format, allowance),
        segmentConfig.pointsAvailable
      );
    case 'SHAMBLE':
      if (sideA.players.length !== 2 || sideB.players.length !== 2) {
        throw new Error('SHAMBLE requires exactly 2 players per side.');
      }

      return computeShambleResults(
        {
          sideId: sideA.sideId,
          players: sideA.players,
          holeScores: sideASegmentScores,
        },
        {
          sideId: sideB.sideId,
          players: sideB.players,
          holeScores: sideBSegmentScores,
        },
        tee,
        segmentConfig.segment,
        assertPerPlayerAllowance(segmentConfig.format, allowance),
        segmentConfig.pointsAvailable
      );
    case 'FOURBALL':
      return computeFourBallResults(
        {
          sideId: sideA.sideId,
          players: sideA.players,
          holeScores: sideASegmentScores,
        },
        {
          sideId: sideB.sideId,
          players: sideB.players,
          holeScores: sideBSegmentScores,
        },
        tee,
        segmentConfig.segment,
        assertPerPlayerAllowance(segmentConfig.format, allowance),
        segmentConfig.pointsAvailable
      );
    case 'SINGLES':
      if (sideA.players.length !== 1 || sideB.players.length !== 1) {
        throw new Error('SINGLES requires exactly 1 player per side.');
      }

      return computeSinglesResults(
        {
          sideId: sideA.sideId,
          player: sideA.players[0],
          holeScores: sideASegmentScores,
        },
        {
          sideId: sideB.sideId,
          player: sideB.players[0],
          holeScores: sideBSegmentScores,
        },
        tee,
        segmentConfig.segment,
        assertPerPlayerAllowance(segmentConfig.format, allowance),
        segmentConfig.pointsAvailable
      );
    default: {
      const exhaustiveFormat: never = segmentConfig.format;
      throw new Error(`Unsupported split format: ${String(exhaustiveFormat)}`);
    }
  }
}

export function computeSplitFormatResults(
  input: SplitFormatInput,
  matchId: number
): SplitFormatResult {
  const segmentResults = input.segments.map((segmentConfig) => {
    const matchState = computeSegmentMatchState(
      segmentConfig,
      input.sideA,
      input.sideB,
      input.tee,
      input.tournamentAllowances
    );

    const subMatchResult: SubMatchResult = {
      matchId,
      segmentId: segmentConfig.segmentId,
      segment: segmentConfig.segment,
      pointsAvailable: segmentConfig.pointsAvailable,
      sideAPoints: matchState.sideA.pointsEarned,
      sideBPoints: matchState.sideB.pointsEarned,
      closeNotation: matchState.closeNotation,
    };

    return {
      segmentConfig,
      matchState,
      subMatchResult,
    };
  });

  return {
    segmentResults,
    matchId,
  };
}
