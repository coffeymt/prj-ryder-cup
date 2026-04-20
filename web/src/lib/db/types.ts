export type SegmentType = 'F9' | 'B9' | 'OVERALL' | 'FULL18';
export type MatchFormat = 'SCRAMBLE' | 'PINEHURST' | 'SHAMBLE' | 'FOURBALL' | 'SINGLES';
export type SideLabel = 'A' | 'B';
export type HoleResultValue = 'A_WINS' | 'B_WINS' | 'HALVED' | 'PENDING';
export type MatchResultStatus = 'PENDING' | 'IN_PROGRESS' | 'FINAL';
export type CommissionerRole = 'OWNER' | 'ADMIN';

export type Tournament = {
  id: string;
  code: string;
  name: string;
  start_date: string;
  end_date: string;
  points_to_win: number;
  commissioner_email: string;
  public_ticker_enabled: number;
  allowance_scramble_low: number;
  allowance_scramble_high: number;
  allowance_pinehurst_low: number;
  allowance_pinehurst_high: number;
  allowance_shamble: number;
  allowance_fourball: number;
  allowance_singles: number;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
};

export type Team = {
  id: string;
  tournament_id: string;
  name: string;
  color: string;
  captain_player_id: string | null;
  created_at: string;
};

export type Player = {
  id: string;
  tournament_id: string;
  team_id: string | null;
  name: string;
  handicap_index: number;
  created_at: string;
};

export type Course = {
  id: string;
  name: string;
  location: string | null;
  is_seed: number;
  created_at: string;
  updated_at: string;
};

export type Tee = {
  id: string;
  course_id: string;
  name: string;
  color_hex: string | null;
  cr18: number;
  slope18: number;
  par18: number;
  cr9f: number | null;
  slope9f: number | null;
  par9f: number | null;
  cr9b: number | null;
  slope9b: number | null;
  par9b: number | null;
  created_at: string;
};

export type Hole = {
  id: string;
  tee_id: string;
  hole_number: number;
  par: number;
  yardage: number | null;
  stroke_index: number;
  created_at: string;
};

export type Round = {
  id: string;
  tournament_id: string;
  round_number: number;
  course_id: string;
  tee_id: string;
  scheduled_at: string;
  notes: string | null;
  created_at: string;
};

export type RoundSegment = {
  id: string;
  round_id: string;
  segment_type: SegmentType;
  hole_start: number;
  hole_end: number;
  format: MatchFormat;
  points_available: number;
  allowance_override: number | null;
  created_at: string;
};

export type Match = {
  id: string;
  round_id: string;
  match_number: number;
  format_override: MatchFormat | null;
  tee_time: string | null;
  created_at: string;
};

export type MatchSide = {
  id: string;
  match_id: string;
  team_id: string;
  side_label: SideLabel;
  created_at: string;
};

export type MatchSidePlayer = {
  id: string;
  match_side_id: string;
  player_id: string;
  created_at: string;
};

export type HoleScore = {
  id: string;
  match_id: string;
  hole_number: number;
  player_id: string | null;
  match_side_id: string;
  gross_strokes: number | null;
  is_conceded: number;
  is_picked_up: number;
  entered_by_player_id: string | null;
  entered_at: string;
  op_id: string;
  updated_at: string;
};

export type MatchHoleResult = {
  id: string;
  match_id: string;
  segment_id: string;
  hole_number: number;
  result: HoleResultValue;
  side_a_net: number | null;
  side_b_net: number | null;
  computed_at: string;
};

export type MatchResult = {
  id: string;
  match_id: string;
  segment_id: string;
  status: MatchResultStatus;
  side_a_holes_won: number;
  side_b_holes_won: number;
  halves: number;
  close_notation: string | null;
  side_a_points: number;
  side_b_points: number;
  computed_at: string;
};

export type AuditLog = {
  id: string;
  tournament_id: string;
  actor_player_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
};

export type MagicLinkToken = {
  id: string;
  token_hash: string;
  commissioner_email: string;
  tournament_id: string | null;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
};

export type ProcessedOp = {
  op_id: string;
  endpoint: string;
  processed_at: string;
};

export type Commissioner = {
  id: string;
  tournament_id: string | null;
  email: string;
  role: CommissionerRole;
  created_at: string;
};
