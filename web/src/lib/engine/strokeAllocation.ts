import type { HoleData, PlayingHandicap, StrokeMap } from './types';

function byStrokeIndexAscending(left: HoleData, right: HoleData): number {
  return Number(left.strokeIndex) - Number(right.strokeIndex);
}

export function buildStrokeMap(playingHandicap: PlayingHandicap, holes: HoleData[]): StrokeMap {
  const strokeMap: Record<number, number> = {};

  for (const hole of holes) {
    strokeMap[hole.holeNumber] = 0;
  }

  if (holes.length === 0) {
    return strokeMap as unknown as StrokeMap;
  }

  const sortedByStrokeIndex = [...holes].sort(byStrokeIndexAscending);
  const ascendingRankByHole = new Map<number, number>();

  for (let index = 0; index < sortedByStrokeIndex.length; index += 1) {
    const hole = sortedByStrokeIndex[index];
    ascendingRankByHole.set(hole.holeNumber, index + 1);
  }

  const cycleLength = holes.length;
  const handicapValue = Number(playingHandicap);

  if (handicapValue >= 0) {
    const positiveHandicap = Math.max(0, handicapValue);
    const guaranteedStrokes = Math.floor(positiveHandicap / cycleLength);
    const remainderStrokes = positiveHandicap % cycleLength;

    for (const hole of holes) {
      const strokeRank = ascendingRankByHole.get(hole.holeNumber);
      if (strokeRank === undefined) {
        continue;
      }

      const extraStroke = remainderStrokes >= strokeRank ? 1 : 0;
      strokeMap[hole.holeNumber] = guaranteedStrokes + extraStroke;
    }
  } else {
    const absoluteHandicap = Math.abs(handicapValue);
    const guaranteedStrokesGivenBack = Math.floor(absoluteHandicap / cycleLength);
    const remainderStrokesGivenBack = absoluteHandicap % cycleLength;

    for (const hole of holes) {
      const strokeRank = ascendingRankByHole.get(hole.holeNumber);
      if (strokeRank === undefined) {
        continue;
      }

      const descendingRank = cycleLength - strokeRank + 1;
      const extraStrokeGivenBack = remainderStrokesGivenBack >= descendingRank ? 1 : 0;
      const totalGivenBack = guaranteedStrokesGivenBack + extraStrokeGivenBack;
      strokeMap[hole.holeNumber] = totalGivenBack === 0 ? 0 : -totalGivenBack;
    }
  }

  return strokeMap as unknown as StrokeMap;
}
