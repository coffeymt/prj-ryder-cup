-- web/migrations/0005_seed_initial_commissioner.sql
-- Seed initial commissioner access for first-login and demo exercise flow.
-- Idempotent: all writes use INSERT OR IGNORE.
--
-- Deterministic seed constants (UUID-like labels + integer row ids used by this schema):
--   commissioner_global_coffey   -> 00000000-0000-4000-8000-420260000701 (id 420260000701)
--   commissioner_demo26_coffey   -> 00000000-0000-4000-8000-420260000702 (id 420260000702)
--   global_scope_tournament       -> 00000000-0000-4000-8000-420260009001 (id 420260009001)
--
-- "Global" commissioner scope is represented by a dedicated scope row in
-- tournaments (`code = 'GLBL00'`) rather than a specific playable tournament.

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
  420260009001,
  'GLBL00',
  'Global Commissioner Scope',
  '2026-01-01',
  '2026-12-31',
  14.5,
  'global.scope@example.invalid',
  0,
  0.35,
  0.15,
  0.60,
  0.40,
  0.85,
  1.00,
  1.00,
  '2026-04-18T12:55:00.000Z',
  '2026-04-18T12:55:00.000Z'
);

INSERT OR IGNORE INTO commissioners (
  id,
  tournament_id,
  email,
  role,
  created_at
)
VALUES (
  420260000701,
  420260009001,
  'coffey.mikey@gmail.com',
  'OWNER',
  '2026-04-18T13:00:00.000Z'
);

INSERT OR IGNORE INTO commissioners (
  id,
  tournament_id,
  email,
  role,
  created_at
)
SELECT
  420260000702,
  t.id,
  'coffey.mikey@gmail.com',
  'OWNER',
  '2026-04-18T13:05:00.000Z'
FROM tournaments t
WHERE t.code = 'DEMO26';
