PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS commissioners_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'OWNER' CHECK (role IN ('OWNER', 'ADMIN')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
);

INSERT INTO commissioners_new (id, tournament_id, email, role, created_at)
SELECT id, tournament_id, email, role, created_at
FROM commissioners;

DROP TABLE commissioners;

ALTER TABLE commissioners_new RENAME TO commissioners;

CREATE INDEX IF NOT EXISTS idx_commissioners_tournament_id ON commissioners(tournament_id);
