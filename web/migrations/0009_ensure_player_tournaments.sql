-- Migration: 0009_ensure_player_tournaments
-- Safety migration to guarantee the player_tournaments junction table exists
-- and is fully populated, regardless of what state migration 0008 left behind.
--
-- Background: migration 0008 originally used PRAGMA foreign_keys=OFF + RENAME/DROP,
-- which D1 remote does not support atomically. If 0008 failed partway through,
-- player_tournaments may be absent or partially populated. This migration is
-- idempotent and safe to run in all possible schema states.

-- Step 1: Create player_tournaments if it was never created (handles full rollback
-- of 0008 OR if 0008 was skipped entirely).
CREATE TABLE IF NOT EXISTS player_tournaments (
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

-- Step 2: Backfill any players that are missing from player_tournaments.
-- Uses the vestigial tournament_id / team_id columns on the players table,
-- which are present whether 0008 ran additively (new columns) or whether the
-- table was never touched (original schema).
-- INSERT OR IGNORE is a no-op for rows that already exist (UNIQUE constraint).
INSERT OR IGNORE INTO player_tournaments (player_id, tournament_id, team_id, created_at)
SELECT id, tournament_id, team_id, created_at
FROM players
WHERE tournament_id IS NOT NULL;

-- Step 3: Ensure indexes exist (all use IF NOT EXISTS so they are no-ops if
-- already created by 0008).
CREATE INDEX IF NOT EXISTS idx_player_tournaments_player_id ON player_tournaments(player_id);
CREATE INDEX IF NOT EXISTS idx_player_tournaments_tournament_id ON player_tournaments(tournament_id);
CREATE INDEX IF NOT EXISTS idx_player_tournaments_team_id ON player_tournaments(team_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_ghin_number ON players(ghin_number) WHERE ghin_number IS NOT NULL;
