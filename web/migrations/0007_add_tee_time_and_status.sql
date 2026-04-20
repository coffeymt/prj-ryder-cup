-- Add tee_time to matches (nullable TEXT for time-of-day like "08:30")
ALTER TABLE matches ADD COLUMN tee_time TEXT;

-- Add status to tournaments for archive support (default 'active')
ALTER TABLE tournaments ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived'));
