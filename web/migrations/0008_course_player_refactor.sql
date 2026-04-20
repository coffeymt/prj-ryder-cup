-- Migration: 0008_course_player_refactor
-- Decouples the players table from tournaments.
-- Creates a standalone players table and a player_tournaments junction table.

-- Step 1: Disable FK checks for migration
PRAGMA foreign_keys = OFF;

-- Step 2: Rename current players table
ALTER TABLE players RENAME TO players_old;

-- Step 3: Create new standalone players table (no tournament_id, no team_id)
CREATE TABLE players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  ghin_number TEXT,
  handicap_index REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Step 4: Copy data from old table to new (preserving IDs)
INSERT INTO players (id, name, handicap_index, created_at, updated_at)
SELECT id, name, handicap_index, created_at, created_at
FROM players_old;

-- Step 5: Create player_tournaments junction table
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

-- Step 6: Populate player_tournaments from old players table
INSERT INTO player_tournaments (player_id, tournament_id, team_id, created_at)
SELECT id, tournament_id, team_id, created_at
FROM players_old;

-- Step 7: Drop old table
-- (indexes idx_players_tournament_id and idx_players_team_id are dropped automatically)
DROP TABLE players_old;

-- Step 8: Create indexes for the new tables
CREATE INDEX IF NOT EXISTS idx_player_tournaments_player_id ON player_tournaments(player_id);
CREATE INDEX IF NOT EXISTS idx_player_tournaments_tournament_id ON player_tournaments(tournament_id);
CREATE INDEX IF NOT EXISTS idx_player_tournaments_team_id ON player_tournaments(team_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_ghin_number ON players(ghin_number) WHERE ghin_number IS NOT NULL;

-- Step 9: Re-enable FK checks
PRAGMA foreign_keys = ON;
