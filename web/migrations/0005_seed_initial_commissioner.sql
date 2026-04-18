-- web/migrations/0005_seed_initial_commissioner.sql
-- Seed initial commissioner access for the demo tournament only.
-- Idempotent and safely re-runnable: INSERT OR IGNORE + SELECT filtered by code.
--
-- Deterministic seed constant (UUID-like label + integer row id used by this schema):
--   commissioner_demo26_coffey -> 00000000-0000-4000-8000-420260000702 (id 420260000702)

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
