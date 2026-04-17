export type HandicapIndex = number & { readonly _brand: 'HandicapIndex' };
export type Slope = number & { readonly _brand: 'Slope' };
export type CourseRating = number & { readonly _brand: 'CourseRating' };
export type Par = number & { readonly _brand: 'Par' };
export type StrokeIndex = number & { readonly _brand: 'StrokeIndex' };
export type CourseHandicap = number & { readonly _brand: 'CourseHandicap' };
export type PlayingHandicap = number & { readonly _brand: 'PlayingHandicap' };

export type Unbranded<T> = T extends number & { readonly _brand: infer _ } ? number : T;

export interface HoleData {
  holeNumber: number;
  par: Par;
  strokeIndex: StrokeIndex;
  yardage?: number;
}

export interface TeeData {
  id: number;
  name: string;
  cr18: CourseRating;
  slope18: Slope;
  par18: Par;
  cr9f: CourseRating | null;
  slope9f: Slope | null;
  par9f: Par | null;
  cr9b: CourseRating | null;
  slope9b: Slope | null;
  par9b: Par | null;
  holes: HoleData[];
}

export type Segment = 'F9' | 'B9' | 'OVERALL' | 'FULL18';

export type Format = 'SCRAMBLE' | 'PINEHURST' | 'SHAMBLE' | 'FOURBALL' | 'SINGLES';

export interface BlendedAllowance {
  type: 'blended';
  lowPct: number;
  highPct: number;
}

export interface PerPlayerAllowance {
  type: 'perPlayer';
  pct: number;
}

export type Allowance = BlendedAllowance | PerPlayerAllowance;

export interface TournamentAllowances {
  scramble: BlendedAllowance;
  pinehurst: BlendedAllowance;
  shamble: PerPlayerAllowance;
  fourBall: PerPlayerAllowance;
  singles: PerPlayerAllowance;
}

export const DEFAULT_ALLOWANCES: TournamentAllowances = {
  scramble: { type: 'blended', lowPct: 0.35, highPct: 0.15 },
  pinehurst: { type: 'blended', lowPct: 0.6, highPct: 0.4 },
  shamble: { type: 'perPlayer', pct: 0.85 },
  fourBall: { type: 'perPlayer', pct: 1.0 },
  singles: { type: 'perPlayer', pct: 1.0 }
} as const;

export const USGA_ALLOWANCES: TournamentAllowances = {
  scramble: { type: 'blended', lowPct: 0.35, highPct: 0.15 },
  pinehurst: { type: 'blended', lowPct: 0.6, highPct: 0.4 },
  shamble: { type: 'perPlayer', pct: 0.75 },
  fourBall: { type: 'perPlayer', pct: 0.9 },
  singles: { type: 'perPlayer', pct: 1.0 }
} as const;

export interface PlayerHandicapInput {
  playerId: number;
  sideId: number;
  handicapIndex: HandicapIndex;
}

export interface PlayerPlayingHandicap {
  playerId: number;
  sideId: number;
  courseHandicap: CourseHandicap;
  playingHandicap: PlayingHandicap;
  strokes: PlayingHandicap;
  strokeMap: StrokeMap;
}

export interface TeamPlayingHandicap {
  sideId: number;
  teamCourseHandicap: CourseHandicap;
  teamPlayingHandicap: PlayingHandicap;
  strokes: PlayingHandicap;
  strokeMap: StrokeMap;
}

export type StrokeMap = Record<number, 0 | 1 | 2>;

export interface HoleScoreInput {
  holeNumber: number;
  playerId: number | null;
  matchSideId: number;
  grossStrokes: number | null;
  isConceded: boolean;
  isPickedUp: boolean;
  opId: string;
}

export type HoleResultValue = 'A_WINS' | 'B_WINS' | 'HALVED' | 'PENDING';

export interface HoleResult {
  holeNumber: number;
  result: HoleResultValue;
  sideANet: number | null;
  sideBNet: number | null;
}

export type MatchStateStatus = 'PENDING' | 'IN_PROGRESS' | 'DORMIE' | 'CLOSED' | 'FINAL';

export type MatchStateSummary =
  | 'AS'
  | `${number} UP`
  | 'DORMIE'
  | `${number}&${number}`
  | 'HALVED';

export interface MatchSideState {
  sideId: number;
  holesWon: number;
  holesSplit: number;
  pointsEarned: number;
}

export interface MatchState {
  status: MatchStateStatus;
  holesPlayed: number;
  holesRemaining: number;
  leadingSideId: number | null;
  holesUp: number;
  summary: MatchStateSummary;
  closeNotation: string | null;
  sideA: MatchSideState;
  sideB: MatchSideState;
  holeResults: HoleResult[];
}

export type CloseNotation = `${number}&${number}` | '1UP' | 'HALVED' | 'AS';

export interface SubMatchResult {
  matchId: number;
  segmentId: number;
  segment: Segment;
  pointsAvailable: number;
  sideAPoints: number;
  sideBPoints: number;
  closeNotation: string | null;
}

export interface TournamentPointTally {
  teamAId: number;
  teamBId: number;
  teamATotal: number;
  teamBTotal: number;
  pointsToWin: number;
  leader: 'A' | 'B' | 'AS';
  subMatchResults: SubMatchResult[];
}

export interface SegmentConfig {
  segmentId: number;
  segment: Segment;
  format: Format;
  holeStart: number;
  holeEnd: number;
  pointsAvailable: number;
  allowanceOverride?: Allowance;
}
