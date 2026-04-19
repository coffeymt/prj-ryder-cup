-- web/migrations/0004_seed_demo_tournament.sql
-- Idempotent seed for a public demo tournament (code DEMO26).
-- Safely re-runnable: all INSERTs are OR IGNORE.
-- References: course UUID sourced from 0002_seed_kiawah.sql.
--
-- Deterministic seed constants (UUID-like labels + integer row ids used by this schema):
--   tournament_demo_2026     -> 00000000-0000-4000-8000-420260000001 (id 420260000001)
--   team_usa                 -> 00000000-0000-4000-8000-420260000101 (id 420260000101)
--   team_europe              -> 00000000-0000-4000-8000-420260000102 (id 420260000102)
--   player_sam_spade         -> 00000000-0000-4000-8000-420260000201 (id 420260000201)
--   player_alex_rivera       -> 00000000-0000-4000-8000-420260000202 (id 420260000202)
--   player_jordan_chen       -> 00000000-0000-4000-8000-420260000203 (id 420260000203)
--   player_casey_morgan      -> 00000000-0000-4000-8000-420260000204 (id 420260000204)
--   player_robin_patel       -> 00000000-0000-4000-8000-420260000205 (id 420260000205)
--   player_morgan_lee        -> 00000000-0000-4000-8000-420260000206 (id 420260000206)
--   player_taylor_kim        -> 00000000-0000-4000-8000-420260000207 (id 420260000207)
--   player_jamie_nguyen      -> 00000000-0000-4000-8000-420260000208 (id 420260000208)
--   round_demo_1             -> 00000000-0000-4000-8000-420260000301 (id 420260000301)
--   segment_demo_1_overall   -> 420260000601 (id 420260000601)
--   match_1_singles          -> 00000000-0000-4000-8000-420260000401 (id 420260000401)
--   match_2_fourball         -> 00000000-0000-4000-8000-420260000402 (id 420260000402)
--   match_3_pinehurst        -> 00000000-0000-4000-8000-420260000403 (id 420260000403)
--   match_4_scramble         -> 00000000-0000-4000-8000-420260000404 (id 420260000404)

PRAGMA foreign_keys = ON;

-- tournaments
-- Compatibility: upgrade a legacy seed code to the 6-char constraint-compliant value.
UPDATE tournaments
SET code = 'DEMO26'
WHERE id = 420260000001
  AND code <> 'DEMO26'
  AND NOT EXISTS (
    SELECT 1
    FROM tournaments
    WHERE code = 'DEMO26'
  );

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
  420260000001,
  'DEMO26',
  'Demo Cup 2026',
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
  '2026-04-18T12:00:00.000Z',
  '2026-04-18T12:00:00.000Z'
);

-- teams
WITH team_seed (id, team_name, color_hex) AS (
  VALUES
    (420260000101, 'USA', '#1d4ed8'),
    (420260000102, 'Europe', '#dc2626')
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
  '2026-04-18T12:05:00.000Z'
FROM team_seed ts
JOIN tournaments t
  ON t.code = 'DEMO26';

-- players
WITH player_seed (id, team_name, player_name, handicap_index) AS (
  VALUES
    (420260000201, 'USA', 'Sam Spade', 5.8),
    (420260000202, 'USA', 'Alex Rivera', 8.9),
    (420260000203, 'USA', 'Jordan Chen', 11.4),
    (420260000204, 'USA', 'Casey Morgan', 14.7),
    (420260000205, 'Europe', 'Robin Patel', 6.3),
    (420260000206, 'Europe', 'Morgan Lee', 9.8),
    (420260000207, 'Europe', 'Taylor Kim', 12.5),
    (420260000208, 'Europe', 'Jamie Nguyen', 16.2)
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
  '2026-04-18T12:10:00.000Z'
FROM player_seed ps
JOIN tournaments t
  ON t.code = 'DEMO26'
JOIN teams tm
  ON tm.tournament_id = t.id
 AND tm.name = ps.team_name;

-- rounds
-- source: 0002_seed_kiawah.sql (first seeded course is "Cougar Point")
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
  420260000301,
  t.id,
  1,
  c.id,
  tee.id,
  '2026-06-01T09:00:00.000Z',
  'Demo round on first Kiawah seeded course.',
  '2026-04-18T12:15:00.000Z'
FROM tournaments t
JOIN courses c
  ON c.name = 'Cougar Point'
 AND c.is_seed = 1
JOIN tees tee
  ON tee.course_id = c.id
 AND tee.name = 'Black'
WHERE t.code = 'DEMO26';

-- round_segments
-- One OVERALL segment covering all 18 holes for round_demo_1.
-- Each match overrides the format via its format_override column;
-- this segment provides the required default (SINGLES).
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
  420260000601,
  r.id,
  'OVERALL',
  1,
  18,
  'SINGLES',
  1.0,
  NULL,
  '2026-04-18T12:17:00.000Z'
FROM tournaments t
JOIN rounds r
  ON r.tournament_id = t.id
 AND r.round_number = 1
WHERE t.code = 'DEMO26';

-- matches
WITH match_seed (id, match_number, format_override) AS (
  VALUES
    (420260000401, 1, 'SINGLES'),
    (420260000402, 2, 'FOURBALL'),
    (420260000403, 3, 'PINEHURST'),
    (420260000404, 4, 'SCRAMBLE')
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
  ms.format_override,
  '2026-04-18T12:20:00.000Z'
FROM match_seed ms
JOIN tournaments t
  ON t.code = 'DEMO26'
JOIN rounds r
  ON r.tournament_id = t.id
 AND r.round_number = 1;

-- match_sides
WITH side_seed (id, match_number, team_name, side_label) AS (
  VALUES
    (420260000501, 1, 'USA', 'A'),
    (420260000502, 1, 'Europe', 'B'),
    (420260000503, 2, 'USA', 'A'),
    (420260000504, 2, 'Europe', 'B'),
    (420260000505, 3, 'USA', 'A'),
    (420260000506, 3, 'Europe', 'B'),
    (420260000507, 4, 'USA', 'A'),
    (420260000508, 4, 'Europe', 'B')
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
  '2026-04-18T12:25:00.000Z'
FROM side_seed ss
JOIN tournaments t
  ON t.code = 'DEMO26'
JOIN rounds r
  ON r.tournament_id = t.id
 AND r.round_number = 1
JOIN matches m
  ON m.round_id = r.id
 AND m.match_number = ss.match_number
JOIN teams tm
  ON tm.tournament_id = t.id
 AND tm.name = ss.team_name;

-- match_side_players
WITH side_player_seed (id, match_number, side_label, team_name, player_name) AS (
  VALUES
    (420260000601, 1, 'A', 'USA', 'Sam Spade'),
    (420260000602, 1, 'B', 'Europe', 'Robin Patel'),
    (420260000603, 2, 'A', 'USA', 'Alex Rivera'),
    (420260000604, 2, 'A', 'USA', 'Jordan Chen'),
    (420260000605, 2, 'B', 'Europe', 'Morgan Lee'),
    (420260000606, 2, 'B', 'Europe', 'Taylor Kim'),
    (420260000607, 3, 'A', 'USA', 'Casey Morgan'),
    (420260000608, 3, 'A', 'USA', 'Sam Spade'),
    (420260000609, 3, 'B', 'Europe', 'Jamie Nguyen'),
    (420260000610, 3, 'B', 'Europe', 'Robin Patel'),
    (420260000611, 4, 'A', 'USA', 'Alex Rivera'),
    (420260000612, 4, 'A', 'USA', 'Casey Morgan'),
    (420260000613, 4, 'B', 'Europe', 'Morgan Lee'),
    (420260000614, 4, 'B', 'Europe', 'Jamie Nguyen')
)
INSERT OR IGNORE INTO match_side_players (
  id,
  match_side_id,
  player_id,
  created_at
)
SELECT
  sps.id,
  ms.id,
  p.id,
  '2026-04-18T12:30:00.000Z'
FROM side_player_seed sps
JOIN tournaments t
  ON t.code = 'DEMO26'
JOIN rounds r
  ON r.tournament_id = t.id
 AND r.round_number = 1
JOIN matches m
  ON m.round_id = r.id
 AND m.match_number = sps.match_number
JOIN match_sides ms
  ON ms.match_id = m.id
 AND ms.side_label = sps.side_label
JOIN teams tm
  ON tm.id = ms.team_id
 AND tm.tournament_id = t.id
 AND tm.name = sps.team_name
JOIN players p
  ON p.team_id = tm.id
 AND p.tournament_id = t.id
 AND p.name = sps.player_name;

-- Deterministic UUID reference list:
-- 00000000-0000-4000-8000-420260000001 (tournament_demo_2026)
-- 00000000-0000-4000-8000-420260000101 (team_usa)
-- 00000000-0000-4000-8000-420260000102 (team_europe)
-- 00000000-0000-4000-8000-420260000201 (player_sam_spade)
-- 00000000-0000-4000-8000-420260000202 (player_alex_rivera)
-- 00000000-0000-4000-8000-420260000203 (player_jordan_chen)
-- 00000000-0000-4000-8000-420260000204 (player_casey_morgan)
-- 00000000-0000-4000-8000-420260000205 (player_robin_patel)
-- 00000000-0000-4000-8000-420260000206 (player_morgan_lee)
-- 00000000-0000-4000-8000-420260000207 (player_taylor_kim)
-- 00000000-0000-4000-8000-420260000208 (player_jamie_nguyen)
-- 00000000-0000-4000-8000-420260000301 (round_demo_1)
-- 00000000-0000-4000-8000-420260000601 (segment_demo_1_overall)
-- 00000000-0000-4000-8000-420260000401 (match_1_singles)
-- 00000000-0000-4000-8000-420260000402 (match_2_fourball)
-- 00000000-0000-4000-8000-420260000403 (match_3_pinehurst)
-- 00000000-0000-4000-8000-420260000404 (match_4_scramble)
