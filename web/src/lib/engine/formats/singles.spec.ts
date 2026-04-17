import { describe, expect, it } from 'vitest';

import { computePerPlayerHandicaps } from '../allowances';
import type {
  HandicapIndex,
  HoleScoreInput,
  Par,
  PerPlayerAllowance,
  Segment,
  StrokeIndex,
  TeeData,
} from '../types';
import { computeSinglesResults, type SinglesSideInput } from './singles';

const FULL_ALLOWANCE: PerPlayerAllowance = { type: 'perPlayer', pct: 1 };
const FULL18: Segment = 'FULL18';
const POINTS_AVAILABLE = 1;

const mockTee: TeeData = {
  id: 1,
  name: 'Singles Test Tee',
  cr18: 72.1 as TeeData['cr18'],
  slope18: 130 as TeeData['slope18'],
  par18: 72 as Par,
  cr9f: 36.0 as TeeData['cr9f'],
  slope9f: 128 as TeeData['slope9f'],
  par9f: 36 as Par,
  cr9b: 36.1 as TeeData['cr9b'],
  slope9b: 132 as TeeData['slope9b'],
  par9b: 36 as Par,
  holes: Array.from({ length: 18 }, (_, index) => ({
    holeNumber: index + 1,
    par: 4 as Par,
    strokeIndex: (index + 1) as StrokeIndex,
  })),
};

type HoleOutcome = 'A' | 'B' | 'H' | 'P';

interface SideInputOptions {
  defaultGross?: number | null;
  grossOverrides?: Record<number, number | null>;
  concededHoles?: number[];
  pickedUpHoles?: number[];
}

function createSideInput(
  sideId: number,
  playerId: number,
  handicapIndex: number,
  options: SideInputOptions = {}
): SinglesSideInput {
  const defaultGross = options.defaultGross ?? 4;
  const grossOverrides = new Map<number, number | null>(
    Object.entries(options.grossOverrides ?? {}).map(([holeNumber, grossStrokes]) => [
      Number(holeNumber),
      grossStrokes,
    ])
  );
  const concededHoleSet = new Set(options.concededHoles ?? []);
  const pickedUpHoleSet = new Set(options.pickedUpHoles ?? []);

  const holeScores: HoleScoreInput[] = mockTee.holes.map((hole) => ({
    holeNumber: hole.holeNumber,
    playerId,
    matchSideId: sideId,
    grossStrokes: grossOverrides.has(hole.holeNumber)
      ? (grossOverrides.get(hole.holeNumber) ?? null)
      : defaultGross,
    isConceded: concededHoleSet.has(hole.holeNumber),
    isPickedUp: pickedUpHoleSet.has(hole.holeNumber),
    opId: `op-${sideId}-${playerId}-${hole.holeNumber}`,
  }));

  return {
    sideId,
    player: {
      playerId,
      sideId,
      handicapIndex: handicapIndex as HandicapIndex,
    },
    holeScores,
  };
}

function buildGrossByOutcome(
  outcomes: HoleOutcome[],
  side: 'A' | 'B'
): Record<number, number | null> {
  const grossByHole: Record<number, number | null> = {};
  outcomes.forEach((outcome, index) => {
    const holeNumber = index + 1;
    if (outcome === 'P') {
      grossByHole[holeNumber] = null;
      return;
    }

    if (outcome === 'H') {
      grossByHole[holeNumber] = 4;
      return;
    }

    if (outcome === 'A') {
      grossByHole[holeNumber] = side === 'A' ? 4 : 5;
      return;
    }

    grossByHole[holeNumber] = side === 'A' ? 5 : 4;
  });
  return grossByHole;
}

describe('computeSinglesResults', () => {
  it('1) Ted vs Corey FULL18 normalizes so Ted plays off 0 and Corey gets the rounded PH difference', () => {
    const ted = createSideInput(11, 1, 2.4, { defaultGross: 4 });
    const corey = createSideInput(22, 2, 5.8, { defaultGross: 4 });

    const handicaps = computePerPlayerHandicaps(
      [ted.player, corey.player],
      mockTee,
      FULL18,
      FULL_ALLOWANCE
    );
    const tedHandicap = handicaps.find((handicap) => handicap.playerId === ted.player.playerId);
    const coreyHandicap = handicaps.find((handicap) => handicap.playerId === corey.player.playerId);

    if (tedHandicap === undefined || coreyHandicap === undefined) {
      throw new Error('Expected handicap results for both singles players.');
    }

    const expectedDifference =
      Math.round(Number(coreyHandicap.playingHandicap)) -
      Math.round(Number(tedHandicap.playingHandicap));

    expect(tedHandicap.strokes).toBe(0);
    expect(coreyHandicap.strokes).toBe(expectedDifference);

    const state = computeSinglesResults(
      ted,
      corey,
      mockTee,
      FULL18,
      FULL_ALLOWANCE,
      POINTS_AVAILABLE
    );
    const coreyWonHoles = state.holeResults.filter(
      (holeResult) => holeResult.result === 'B_WINS'
    ).length;

    expect(coreyWonHoles).toBe(expectedDifference);
  });

  it('2) conceded hole: player conceding their own hole loses that hole', () => {
    const sideA = createSideInput(1, 101, 10, { defaultGross: null, concededHoles: [3] });
    const sideB = createSideInput(2, 202, 10, { defaultGross: null });

    const state = computeSinglesResults(
      sideA,
      sideB,
      mockTee,
      FULL18,
      FULL_ALLOWANCE,
      POINTS_AVAILABLE
    );
    const hole3 = state.holeResults.find((holeResult) => holeResult.holeNumber === 3);

    expect(hole3?.result).toBe('B_WINS');
  });

  it('3) picked-up hole: single player pick-up loses the hole', () => {
    const sideA = createSideInput(1, 101, 10, { defaultGross: null, pickedUpHoles: [7] });
    const sideB = createSideInput(2, 202, 10, { defaultGross: null });

    const state = computeSinglesResults(
      sideA,
      sideB,
      mockTee,
      FULL18,
      FULL_ALLOWANCE,
      POINTS_AVAILABLE
    );
    const hole7 = state.holeResults.find((holeResult) => holeResult.holeNumber === 7);

    expect(hole7?.result).toBe('B_WINS');
  });

  it('4) halved hole when both players produce equal net scores', () => {
    const sideA = createSideInput(1, 101, 10, { defaultGross: null, grossOverrides: { 5: 4 } });
    const sideB = createSideInput(2, 202, 10, { defaultGross: null, grossOverrides: { 5: 4 } });

    const state = computeSinglesResults(
      sideA,
      sideB,
      mockTee,
      FULL18,
      FULL_ALLOWANCE,
      POINTS_AVAILABLE
    );
    const hole5 = state.holeResults.find((holeResult) => holeResult.holeNumber === 5);

    expect(hole5?.result).toBe('HALVED');
    expect(hole5?.sideANet).toBe(hole5?.sideBNet);
  });

  it('5) full 18-hole match won 1UP ends FINAL and awards full points to side A', () => {
    const outcomes: HoleOutcome[] = [
      'A',
      'B',
      'A',
      'B',
      'A',
      'B',
      'A',
      'B',
      'A',
      'B',
      'A',
      'B',
      'A',
      'B',
      'A',
      'B',
      'A',
      'H',
    ];

    const sideA = createSideInput(1, 101, 10, {
      defaultGross: null,
      grossOverrides: buildGrossByOutcome(outcomes, 'A'),
    });
    const sideB = createSideInput(2, 202, 10, {
      defaultGross: null,
      grossOverrides: buildGrossByOutcome(outcomes, 'B'),
    });

    const state = computeSinglesResults(
      sideA,
      sideB,
      mockTee,
      FULL18,
      FULL_ALLOWANCE,
      POINTS_AVAILABLE
    );

    expect(state.status).toBe('FINAL');
    expect(state.closeNotation).toBe('1UP');
    expect(state.sideA.pointsEarned).toBe(POINTS_AVAILABLE);
    expect(state.sideB.pointsEarned).toBe(0);
  });

  it('6) halved match after 18 holes stays HALVED with 0.5 points each (no MVP playoff)', () => {
    const outcomes: HoleOutcome[] = [
      'A',
      'B',
      'A',
      'B',
      'A',
      'B',
      'A',
      'B',
      'A',
      'B',
      'A',
      'B',
      'A',
      'B',
      'A',
      'B',
      'A',
      'B',
    ];

    const sideA = createSideInput(1, 101, 10, {
      defaultGross: null,
      grossOverrides: buildGrossByOutcome(outcomes, 'A'),
    });
    const sideB = createSideInput(2, 202, 10, {
      defaultGross: null,
      grossOverrides: buildGrossByOutcome(outcomes, 'B'),
    });

    const state = computeSinglesResults(
      sideA,
      sideB,
      mockTee,
      FULL18,
      FULL_ALLOWANCE,
      POINTS_AVAILABLE
    );

    expect(state.status).toBe('FINAL');
    expect(state.closeNotation).toBe('HALVED');
    expect(state.summary).toBe('HALVED');
    expect(state.sideA.pointsEarned).toBe(0.5);
    expect(state.sideB.pointsEarned).toBe(0.5);
  });

  it('7) match closes early 3&2 when side A leads by three with two holes left', () => {
    const outcomes: HoleOutcome[] = [
      'A',
      'B',
      'A',
      'B',
      'A',
      'B',
      'A',
      'A',
      'B',
      'A',
      'H',
      'A',
      'B',
      'A',
      'H',
      'H',
      'P',
      'P',
    ];

    const sideA = createSideInput(1, 101, 10, {
      defaultGross: null,
      grossOverrides: buildGrossByOutcome(outcomes, 'A'),
    });
    const sideB = createSideInput(2, 202, 10, {
      defaultGross: null,
      grossOverrides: buildGrossByOutcome(outcomes, 'B'),
    });

    const state = computeSinglesResults(
      sideA,
      sideB,
      mockTee,
      FULL18,
      FULL_ALLOWANCE,
      POINTS_AVAILABLE
    );

    expect(state.status).toBe('CLOSED');
    expect(state.closeNotation).toBe('3&2');
    expect(state.sideA.pointsEarned).toBe(POINTS_AVAILABLE);
    expect(state.sideB.pointsEarned).toBe(0);
  });
});
