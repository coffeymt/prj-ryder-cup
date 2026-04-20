-- Migration: 0008_course_player_refactor
-- Decouples the players table from tournaments.
-- Additive-only: adds new columns to players, creates player_tournaments junction.
-- The old tournament_id and team_id columns remain on players (vestigial) to
-- avoid rename/drop cycles that break D1 remote FK constraint enforcement.

-- Step 1: Add new columns to existing players table
ALTER TABLE players ADD COLUMN email TEXT;
ALTER TABLE players ADD COLUMN ghin_number TEXT;
ALTER TABLE players ADD COLUMN updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'));

-- Step 2: Create player_tournaments junction table
CREATE TABLE player_tournaments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  tournament_id INTEGER NOT NULL,
  team_id INTEGER,
  handicap_index_override REAL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
  UNIQUE (player_id, tournament_id)
);

-- Step 3: Populate player_tournaments from existing players data
INSERT INTO player_tournaments (player_id, tournament_id, team_id, created_at)
SELECT id, tournament_id, team_id, created_at
FROM players;

-- Step 4: Create indexes for the new table and column
CREATE INDEX IF NOT EXISTS idx_player_tournaments_player_id ON player_tournaments(player_id);
CREATE INDEX IF NOT EXISTS idx_player_tournaments_tournament_id ON player_tournaments(tournament_id);
CREATE INDEX IF NOT EXISTS idx_player_tournaments_team_id ON player_tournaments(team_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_ghin_number ON players(ghin_number) WHERE ghin_number IS NOT NULL;
