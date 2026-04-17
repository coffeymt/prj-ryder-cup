-- Ryder Cup App D1 schema initialization
-- Source of truth: plan/ryder-cup-app/prd.md (Domain Model section).
-- NOTE: SQLite foreign key enforcement is per connection. Application code must
-- execute `PRAGMA foreign_keys = ON` for every D1/SQLite connection.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tournaments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  points_to_win REAL NOT NULL CHECK (points_to_win > 0),
  commissioner_email TEXT NOT NULL,
  public_ticker_enabled INTEGER NOT NULL DEFAULT 0 CHECK (public_ticker_enabled IN (0, 1)),
  allowance_scramble_low REAL NOT NULL DEFAULT 0.35 CHECK (allowance_scramble_low >= 0 AND allowance_scramble_low <= 1.5),
  allowance_scramble_high REAL NOT NULL DEFAULT 0.15 CHECK (allowance_scramble_high >= 0 AND allowance_scramble_high <= 1.5),
  allowance_pinehurst_low REAL NOT NULL DEFAULT 0.60 CHECK (allowance_pinehurst_low >= 0 AND allowance_pinehurst_low <= 1.5),
  allowance_pinehurst_high REAL NOT NULL DEFAULT 0.40 CHECK (allowance_pinehurst_high >= 0 AND allowance_pinehurst_high <= 1.5),
  allowance_shamble REAL NOT NULL DEFAULT 0.85 CHECK (allowance_shamble >= 0 AND allowance_shamble <= 1.5),
  allowance_fourball REAL NOT NULL DEFAULT 1.00 CHECK (allowance_fourball >= 0 AND allowance_fourball <= 1.5),
  allowance_singles REAL NOT NULL DEFAULT 1.00 CHECK (allowance_singles >= 0 AND allowance_singles <= 1.5),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (length(code) = 6)
);

CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL CHECK (length(color) = 7 AND substr(color, 1, 1) = '#'),
  captain_player_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY (captain_player_id) REFERENCES players(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  team_id INTEGER,
  name TEXT NOT NULL,
  handicap_index REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  location TEXT,
  is_seed INTEGER NOT NULL DEFAULT 0 CHECK (is_seed IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS tees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  color_hex TEXT CHECK (color_hex IS NULL OR (length(color_hex) = 7 AND substr(color_hex, 1, 1) = '#')),
  cr18 REAL NOT NULL,
  slope18 INTEGER NOT NULL,
  par18 INTEGER NOT NULL,
  cr9f REAL,
  slope9f INTEGER,
  par9f INTEGER,
  cr9b REAL,
  slope9b INTEGER,
  par9b INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  UNIQUE (course_id, name)
);

CREATE TABLE IF NOT EXISTS holes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tee_id INTEGER NOT NULL,
  hole_number INTEGER NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  par INTEGER NOT NULL CHECK (par > 0),
  yardage INTEGER CHECK (yardage IS NULL OR yardage > 0),
  stroke_index INTEGER NOT NULL CHECK (stroke_index BETWEEN 1 AND 18),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (tee_id) REFERENCES tees(id) ON DELETE CASCADE,
  UNIQUE (tee_id, hole_number),
  UNIQUE (tee_id, stroke_index)
);

CREATE TABLE IF NOT EXISTS rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  round_number INTEGER NOT NULL CHECK (round_number > 0),
  course_id INTEGER NOT NULL,
  tee_id INTEGER NOT NULL,
  scheduled_at TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT,
  FOREIGN KEY (tee_id) REFERENCES tees(id) ON DELETE RESTRICT,
  UNIQUE (tournament_id, round_number)
);

CREATE TABLE IF NOT EXISTS round_segments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id INTEGER NOT NULL,
  segment_type TEXT NOT NULL CHECK (segment_type IN ('F9', 'B9', 'OVERALL', 'FULL18')),
  hole_start INTEGER NOT NULL CHECK (hole_start BETWEEN 1 AND 18),
  hole_end INTEGER NOT NULL CHECK (hole_end BETWEEN 1 AND 18),
  format TEXT NOT NULL CHECK (format IN ('SCRAMBLE', 'PINEHURST', 'SHAMBLE', 'FOURBALL', 'SINGLES')),
  points_available REAL NOT NULL CHECK (points_available >= 0),
  allowance_override REAL CHECK (allowance_override IS NULL OR (allowance_override >= 0 AND allowance_override <= 1.5)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE,
  CHECK (hole_end >= hole_start),
  UNIQUE (round_id, segment_type)
);

CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id INTEGER NOT NULL,
  match_number INTEGER NOT NULL CHECK (match_number > 0),
  format_override TEXT CHECK (format_override IS NULL OR format_override IN ('SCRAMBLE', 'PINEHURST', 'SHAMBLE', 'FOURBALL', 'SINGLES')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE,
  UNIQUE (round_id, match_number)
);

CREATE TABLE IF NOT EXISTS match_sides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  side_label TEXT NOT NULL CHECK (side_label IN ('A', 'B')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE RESTRICT,
  UNIQUE (match_id, side_label)
);

CREATE TABLE IF NOT EXISTS match_side_players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_side_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (match_side_id) REFERENCES match_sides(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE RESTRICT,
  UNIQUE (match_side_id, player_id)
);

CREATE TABLE IF NOT EXISTS hole_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL,
  hole_number INTEGER NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  player_id INTEGER,
  match_side_id INTEGER NOT NULL,
  gross_strokes INTEGER CHECK (gross_strokes IS NULL OR gross_strokes > 0),
  is_conceded INTEGER NOT NULL DEFAULT 0 CHECK (is_conceded IN (0, 1)),
  is_picked_up INTEGER NOT NULL DEFAULT 0 CHECK (is_picked_up IN (0, 1)),
  entered_by_player_id INTEGER,
  entered_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  op_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL,
  FOREIGN KEY (match_side_id) REFERENCES match_sides(id) ON DELETE CASCADE,
  FOREIGN KEY (entered_by_player_id) REFERENCES players(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS match_hole_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL,
  segment_id INTEGER NOT NULL,
  hole_number INTEGER NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  result TEXT NOT NULL CHECK (result IN ('A_WINS', 'B_WINS', 'HALVED', 'PENDING')),
  side_a_net REAL,
  side_b_net REAL,
  computed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (segment_id) REFERENCES round_segments(id) ON DELETE CASCADE,
  UNIQUE (match_id, hole_number)
);

CREATE TABLE IF NOT EXISTS match_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL,
  segment_id INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'IN_PROGRESS', 'FINAL')),
  side_a_holes_won INTEGER NOT NULL DEFAULT 0 CHECK (side_a_holes_won >= 0),
  side_b_holes_won INTEGER NOT NULL DEFAULT 0 CHECK (side_b_holes_won >= 0),
  halves INTEGER NOT NULL DEFAULT 0 CHECK (halves >= 0),
  close_notation TEXT,
  side_a_points REAL NOT NULL DEFAULT 0,
  side_b_points REAL NOT NULL DEFAULT 0,
  computed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (segment_id) REFERENCES round_segments(id) ON DELETE CASCADE,
  UNIQUE (match_id, segment_id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  actor_player_id INTEGER,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_player_id) REFERENCES players(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS magic_link_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL,
  commissioner_email TEXT NOT NULL,
  tournament_id INTEGER,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS processed_ops (
  op_id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS commissioners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'OWNER' CHECK (role IN ('OWNER', 'ADMIN')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  UNIQUE (tournament_id, email)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tournaments_code ON tournaments(code);
CREATE INDEX IF NOT EXISTS idx_teams_tournament_id ON teams(tournament_id);
CREATE INDEX IF NOT EXISTS idx_players_tournament_id ON players(tournament_id);
CREATE INDEX IF NOT EXISTS idx_players_team_id ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_tees_course_id ON tees(course_id);
CREATE INDEX IF NOT EXISTS idx_holes_tee_id ON holes(tee_id);
CREATE INDEX IF NOT EXISTS idx_rounds_tournament_id ON rounds(tournament_id);
CREATE INDEX IF NOT EXISTS idx_round_segments_round_id ON round_segments(round_id);
CREATE INDEX IF NOT EXISTS idx_matches_round_id ON matches(round_id);
CREATE INDEX IF NOT EXISTS idx_match_sides_match_id ON match_sides(match_id);
CREATE INDEX IF NOT EXISTS idx_match_side_players_match_side_id ON match_side_players(match_side_id);
CREATE INDEX IF NOT EXISTS idx_hole_scores_match_id ON hole_scores(match_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hole_scores_op_id ON hole_scores(op_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hole_scores_player_entry
  ON hole_scores(match_id, hole_number, player_id, match_side_id)
  WHERE player_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_hole_scores_team_entry
  ON hole_scores(match_id, hole_number, match_side_id)
  WHERE player_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_match_hole_results_match_id ON match_hole_results(match_id);
CREATE INDEX IF NOT EXISTS idx_match_results_match_id ON match_results(match_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_tournament_created_at_desc ON audit_log(tournament_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_magic_link_tokens_token_hash ON magic_link_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_tournament_id ON magic_link_tokens(tournament_id);
CREATE INDEX IF NOT EXISTS idx_commissioners_tournament_id ON commissioners(tournament_id);
