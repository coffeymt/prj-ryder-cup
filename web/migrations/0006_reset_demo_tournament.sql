-- web/migrations/0006_reset_demo_tournament.sql
-- Resets the DEMO26 demo tournament and seeds a fresh Kiawah Cup 2026 tournament.
-- Corrects swapped team colors: USA → Red (#dc2626), Europe → Blue (#1d4ed8).
-- Matches: 2 FOURBALL matches on F9 (holes 1-9) and B9 (holes 10-18).
-- Commissioner data (coffey.mikey@gmail.com) is preserved throughout.
--
-- Deterministic seed IDs (base 520260000xxx to avoid collisions with 0004 seed):
--   tournament_kiawah_2026   -> 520260000001
--   team_usa                 -> 520260000101
--   team_europe              -> 520260000102
--   player_usa_1             -> 520260000201
--   player_usa_2             -> 520260000202
--   player_eur_1             -> 520260000203
--   player_eur_2             -> 520260000204
--   round_1                  -> 520260000301
--   segment_f9               -> 520260000601
--   segment_b9               -> 520260000602
--   match_1 (holes 1-9)      -> 520260000401
--   match_2 (holes 10-18)    -> 520260000402
--   side_m1_a (USA)          -> 520260000501
--   side_m1_b (Europe)       -> 520260000502
--   side_m2_a (USA)          -> 520260000503
--   side_m2_b (Europe)       -> 520260000504
--   msp_m1_a_p1              -> 520260000701
--   msp_m1_a_p2              -> 520260000702
--   msp_m1_b_p1              -> 520260000703
--   msp_m1_b_p2              -> 520260000704
--   msp_m2_a_p1              -> 520260000705
--   msp_m2_a_p2              -> 520260000706
--   msp_m2_b_p1              -> 520260000707
--   msp_m2_b_p2              -> 520260000708

PRAGMA foreign_keys = ON;

-- ============================================================
-- PART 1: PRESERVE COMMISSIONER BEFORE CASCADE DELETE
-- ============================================================
-- NULL out tournament_id so the CASCADE on DELETE tournaments
-- does not remove the commissioner row for coffey.mikey@gmail.com.
UPDATE commissioners
SET tournament_id = NULL
WHERE email = 'coffey.mikey@gmail.com';

-- ============================================================
-- PART 2: DELETE OLD DEMO DATA (explicit FK-safe order)
-- ============================================================

-- 1. hole_scores for matches in the demo tournament
DELETE FROM hole_scores
WHERE match_id IN (
  SELECT m.id
  FROM matches m
  JOIN rounds r ON m.round_id = r.id
  JOIN tournaments t ON r.tournament_id = t.id
  WHERE t.code = 'DEMO26'
);

-- 2. processed_ops for matches in the demo tournament (match_id added in 0003)
DELETE FROM processed_ops
WHERE match_id IN (
  SELECT CAST(m.id AS TEXT)
  FROM matches m
  JOIN rounds r ON m.round_id = r.id
  JOIN tournaments t ON r.tournament_id = t.id
  WHERE t.code = 'DEMO26'
);

-- 3. match_side_players for matches in the demo tournament
DELETE FROM match_side_players
WHERE match_side_id IN (
  SELECT ms.id
  FROM match_sides ms
  JOIN matches m ON ms.match_id = m.id
  JOIN rounds r ON m.round_id = r.id
  JOIN tournaments t ON r.tournament_id = t.id
  WHERE t.code = 'DEMO26'
);

-- 4. match_sides for matches in the demo tournament
DELETE FROM match_sides
WHERE match_id IN (
  SELECT m.id
  FROM matches m
  JOIN rounds r ON m.round_id = r.id
  JOIN tournaments t ON r.tournament_id = t.id
  WHERE t.code = 'DEMO26'
);

-- 5. matches for rounds in the demo tournament
DELETE FROM matches
WHERE round_id IN (
  SELECT r.id
  FROM rounds r
  JOIN tournaments t ON r.tournament_id = t.id
  WHERE t.code = 'DEMO26'
);

-- 6. round_segments for rounds in the demo tournament
DELETE FROM round_segments
WHERE round_id IN (
  SELECT r.id
  FROM rounds r
  JOIN tournaments t ON r.tournament_id = t.id
  WHERE t.code = 'DEMO26'
);

-- 7. rounds for the demo tournament
DELETE FROM rounds
WHERE tournament_id IN (
  SELECT id FROM tournaments WHERE code = 'DEMO26'
);

-- 8. players for the demo tournament
DELETE FROM players
WHERE tournament_id IN (
  SELECT id FROM tournaments WHERE code = 'DEMO26'
);

-- 9. teams for the demo tournament
DELETE FROM teams
WHERE tournament_id IN (
  SELECT id FROM tournaments WHERE code = 'DEMO26'
);

-- 10. tournament itself
DELETE FROM tournaments WHERE code = 'DEMO26';

-- ============================================================
-- PART 3: SEED FRESH KIAWAH CUP 2026 TOURNAMENT
-- ============================================================

-- tournaments
INSERT OR IGNORE INTO tournaments (
  id,
  code,
  name,
  start_date,
  end_date,
  points_to_win,
  commissioner_email,
  public_ticker_enabled,
  allowance_scramble_low,
  allowance_scramble_high,
  allowance_pinehurst_low,
  allowance_pinehurst_high,
  allowance_shamble,
  allowance_fourball,
  allowance_singles,
  created_at,
  updated_at
)
VALUES (
  520260000001,
  'KIAWAH',
  'Kiawah Cup 2026',
  '2026-06-01',
  '2026-06-03',
  14.5,
  'coffey.mikey@gmail.com',
  1,
  0.35,
  0.15,
  0.60,
  0.40,
  0.85,
  1.00,
  1.00,
  '2026-04-19T12:00:00.000Z',
  '2026-04-19T12:00:00.000Z'
);

-- Re-link the preserved commissioner to the new tournament
UPDATE commissioners
SET tournament_id = (SELECT id FROM tournaments WHERE code = 'KIAWAH')
WHERE email = 'coffey.mikey@gmail.com';

-- Fallback: insert commissioner if the row was somehow absent
INSERT OR IGNORE INTO commissioners (
  tournament_id,
  email,
  role,
  created_at
)
SELECT
  t.id,
  'coffey.mikey@gmail.com',
  'OWNER',
  '2026-04-19T12:00:00.000Z'
FROM tournaments t
WHERE t.code = 'KIAWAH';

-- teams: USA → Red, Europe → Blue (corrects previously swapped colors)
WITH team_seed (id, team_name, color_hex) AS (
  VALUES
    (520260000101, 'USA',    '#dc2626'),
    (520260000102, 'Europe', '#1d4ed8')
)
INSERT OR IGNORE INTO teams (
  id,
  tournament_id,
  name,
  color,
  captain_player_id,
  created_at
)
SELECT
  ts.id,
  t.id,
  ts.team_name,
  ts.color_hex,
  NULL,
  '2026-04-19T12:05:00.000Z'
FROM team_seed ts
JOIN tournaments t ON t.code = 'KIAWAH';

-- players (placeholder names — update via commissioner UI)
WITH player_seed (id, team_name, player_name, handicap_index) AS (
  VALUES
    (520260000201, 'USA',    'Player USA 1', 10.0),
    (520260000202, 'USA',    'Player USA 2', 15.0),
    (520260000203, 'Europe', 'Player EUR 1', 10.0),
    (520260000204, 'Europe', 'Player EUR 2', 15.0)
)
INSERT OR IGNORE INTO players (
  id,
  tournament_id,
  team_id,
  name,
  handicap_index,
  created_at
)
SELECT
  ps.id,
  t.id,
  tm.id,
  ps.player_name,
  ps.handicap_index,
  '2026-04-19T12:10:00.000Z'
FROM player_seed ps
JOIN tournaments t ON t.code = 'KIAWAH'
JOIN teams tm
  ON tm.tournament_id = t.id
 AND tm.name = ps.team_name;

-- rounds — Cougar Point, Black tees (sourced from 0002_seed_kiawah.sql)
INSERT OR IGNORE INTO rounds (
  id,
  tournament_id,
  round_number,
  course_id,
  tee_id,
  scheduled_at,
  notes,
  created_at
)
SELECT
  520260000301,
  t.id,
  1,
  c.id,
  tee.id,
  '2026-06-01T09:00:00.000Z',
  'Kiawah Cup 2026 — Cougar Point, Black tees.',
  '2026-04-19T12:15:00.000Z'
FROM tournaments t
JOIN courses c
  ON c.name = 'Cougar Point'
 AND c.is_seed = 1
JOIN tees tee
  ON tee.course_id = c.id
 AND tee.name = 'Black'
WHERE t.code = 'KIAWAH';

-- round_segments: F9 (holes 1-9) and B9 (holes 10-18), both FOURBALL
WITH seg_seed (id, segment_type, hole_start, hole_end) AS (
  VALUES
    (520260000601, 'F9',  1,  9),
    (520260000602, 'B9', 10, 18)
)
INSERT OR IGNORE INTO round_segments (
  id,
  round_id,
  segment_type,
  hole_start,
  hole_end,
  format,
  points_available,
  allowance_override,
  created_at
)
SELECT
  ss.id,
  r.id,
  ss.segment_type,
  ss.hole_start,
  ss.hole_end,
  'FOURBALL',
  1.0,
  NULL,
  '2026-04-19T12:17:00.000Z'
FROM seg_seed ss
JOIN tournaments t ON t.code = 'KIAWAH'
JOIN rounds r
  ON r.tournament_id = t.id
 AND r.round_number = 1;

-- matches: Match 1 covers holes 1-9 (F9), Match 2 covers holes 10-18 (B9)
WITH match_seed (id, match_number) AS (
  VALUES
    (520260000401, 1),
    (520260000402, 2)
)
INSERT OR IGNORE INTO matches (
  id,
  round_id,
  match_number,
  format_override,
  created_at
)
SELECT
  ms.id,
  r.id,
  ms.match_number,
  'FOURBALL',
  '2026-04-19T12:20:00.000Z'
FROM match_seed ms
JOIN tournaments t ON t.code = 'KIAWAH'
JOIN rounds r
  ON r.tournament_id = t.id
 AND r.round_number = 1;

-- match_sides: Side A = USA, Side B = Europe for each match
WITH side_seed (id, match_number, team_name, side_label) AS (
  VALUES
    (520260000501, 1, 'USA',    'A'),
    (520260000502, 1, 'Europe', 'B'),
    (520260000503, 2, 'USA',    'A'),
    (520260000504, 2, 'Europe', 'B')
)
INSERT OR IGNORE INTO match_sides (
  id,
  match_id,
  team_id,
  side_label,
  created_at
)
SELECT
  ss.id,
  m.id,
  tm.id,
  ss.side_label,
  '2026-04-19T12:25:00.000Z'
FROM side_seed ss
JOIN tournaments t ON t.code = 'KIAWAH'
JOIN rounds r
  ON r.tournament_id = t.id
 AND r.round_number = 1
JOIN matches m
  ON m.round_id = r.id
 AND m.match_number = ss.match_number
JOIN teams tm
  ON tm.tournament_id = t.id
 AND tm.name = ss.team_name;

-- match_side_players: both team players on each side for each match
WITH msp_seed (id, match_number, side_label, player_name) AS (
  VALUES
    (520260000701, 1, 'A', 'Player USA 1'),
    (520260000702, 1, 'A', 'Player USA 2'),
    (520260000703, 1, 'B', 'Player EUR 1'),
    (520260000704, 1, 'B', 'Player EUR 2'),
    (520260000705, 2, 'A', 'Player USA 1'),
    (520260000706, 2, 'A', 'Player USA 2'),
    (520260000707, 2, 'B', 'Player EUR 1'),
    (520260000708, 2, 'B', 'Player EUR 2')
)
INSERT OR IGNORE INTO match_side_players (
  id,
  match_side_id,
  player_id,
  created_at
)
SELECT
  ms.id,
  mside.id,
  p.id,
  '2026-04-19T12:30:00.000Z'
FROM msp_seed ms
JOIN tournaments t ON t.code = 'KIAWAH'
JOIN rounds r
  ON r.tournament_id = t.id
 AND r.round_number = 1
JOIN matches m
  ON m.round_id = r.id
 AND m.match_number = ms.match_number
JOIN match_sides mside
  ON mside.match_id = m.id
 AND mside.side_label = ms.side_label
JOIN players p
  ON p.tournament_id = t.id
 AND p.name = ms.player_name;
