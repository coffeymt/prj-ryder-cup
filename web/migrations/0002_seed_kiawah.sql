-- Ryder Cup App Kiawah seed migration (P1.T2)
-- Retrieval date: 2026-04-17
--
-- Source URLs:
-- - Cougar Point BlueGolf profile: https://course.bluegolf.com/bluegolf/course/course/kiawahcougarpoint/
-- - Cougar Point detailed scorecard: https://course.bluegolf.com/bluegolf/course/course/kiawahcougarpoint/detailedscorecard.htm?showall=true
-- - Osprey Point BlueGolf profile: https://course.bluegolf.com/bluegolf/course/course/kiawahosprey/
-- - Osprey Point detailed scorecard: https://course.bluegolf.com/bluegolf/course/course/kiawahosprey/detailedscorecard.htm?showall=true
-- - Oak Point BlueGolf profile: https://course.bluegolf.com/bluegolf/course/course/kiawahislandgresorto/
-- - Oak Point detailed scorecard: https://course.bluegolf.com/bluegolf/course/course/kiawahislandgresorto/detailedscorecard.htm?showall=true
-- - Turtle Point BlueGolf profile: https://course.bluegolf.com/bluegolf/course/course/kiawahturtlepoint/
-- - Turtle Point detailed scorecard: https://course.bluegolf.com/bluegolf/course/course/kiawahturtlepoint/detailedscorecard.htm?showall=true
-- - Ocean Course official scorecard PDF (from PRD Appendix B): https://kiawahresort.com/wp-content/uploads/2021/04/Ocean_Course_Scorecard-1.pdf
-- - Ocean Course fallback hole table: https://metpga.bluegolf.com/bluegolf/metpga/course/kiawahocean/detailedscorecard.htm?showall=true
--
-- PROVISIONAL: Ocean Course hole-by-hole SI/par are seeded from the metpga BlueGolf fallback
-- PROVISIONAL: because the official PDF URL above returned HTTP 404 during retrieval on 2026-04-17.
-- PROVISIONAL: Ocean Course values must be verified against the official Kiawah PDF before production (P10.T2).
--
-- PROVISIONAL: Cougar Point and Osprey Point cr18/slope18 are seeded from provided research context
-- PROVISIONAL: (Cougar 73.0/134, Osprey 72.9/137) pending full source-of-record reconciliation in P10.T2.
--
-- NOTE: Separate 9-hole ratings were not available from retrieved primary source pages for these tees.
-- NOTE: cr9f/slope9f/par9f/cr9b/slope9b/par9b are intentionally NULL; app fallback handles this.
--
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Cougar Point (Black)
-- ---------------------------------------------------------------------------
INSERT INTO courses (name, location, is_seed)
SELECT 'Cougar Point', 'Kiawah Island, SC', 1
WHERE NOT EXISTS (
  SELECT 1
  FROM courses
  WHERE name = 'Cougar Point'
    AND is_seed = 1
);

INSERT INTO tees (
  course_id,
  name,
  cr18,
  slope18,
  par18,
  cr9f,
  slope9f,
  par9f,
  cr9b,
  slope9b,
  par9b
)
SELECT
  c.id,
  'Black',
  73.0,
  134,
  72,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL
FROM courses c
WHERE c.name = 'Cougar Point'
  AND c.is_seed = 1
  AND NOT EXISTS (
    SELECT 1
    FROM tees t
    WHERE t.course_id = c.id
      AND t.name = 'Black'
  );

WITH hole_seed (hole_number, par, stroke_index) AS (
  VALUES
    (1, 4, 13), (2, 3, 11), (3, 5, 17), (4, 4, 1), (5, 4, 5), (6, 3, 9), (7, 4, 7), (8, 4, 15), (9, 5, 3),
    (10, 4, 4), (11, 5, 18), (12, 3, 8), (13, 4, 10), (14, 3, 16), (15, 5, 14), (16, 4, 6), (17, 4, 12), (18, 4, 2)
)
INSERT INTO holes (tee_id, hole_number, par, stroke_index)
SELECT
  t.id,
  hs.hole_number,
  hs.par,
  hs.stroke_index
FROM hole_seed hs
JOIN tees t
  ON t.name = 'Black'
JOIN courses c
  ON c.id = t.course_id
WHERE c.name = 'Cougar Point'
  AND c.is_seed = 1
  AND NOT EXISTS (
    SELECT 1
    FROM holes h
    WHERE h.tee_id = t.id
      AND h.hole_number = hs.hole_number
  );

-- ---------------------------------------------------------------------------
-- Osprey Point (Black)
-- ---------------------------------------------------------------------------
INSERT INTO courses (name, location, is_seed)
SELECT 'Osprey Point', 'Kiawah Island, SC', 1
WHERE NOT EXISTS (
  SELECT 1
  FROM courses
  WHERE name = 'Osprey Point'
    AND is_seed = 1
);

INSERT INTO tees (
  course_id,
  name,
  cr18,
  slope18,
  par18,
  cr9f,
  slope9f,
  par9f,
  cr9b,
  slope9b,
  par9b
)
SELECT
  c.id,
  'Black',
  72.9,
  137,
  72,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL
FROM courses c
WHERE c.name = 'Osprey Point'
  AND c.is_seed = 1
  AND NOT EXISTS (
    SELECT 1
    FROM tees t
    WHERE t.course_id = c.id
      AND t.name = 'Black'
  );

-- Osprey correction: source research had duplicate SI 14 on B9; hole 16 corrected to SI 10
-- so this tee has a complete SI 1-18 permutation.
WITH hole_seed (hole_number, par, stroke_index) AS (
  VALUES
    (1, 4, 5), (2, 5, 15), (3, 3, 11), (4, 4, 3), (5, 4, 7), (6, 3, 9), (7, 4, 17), (8, 5, 13), (9, 4, 1),
    (10, 4, 6), (11, 3, 4), (12, 5, 14), (13, 4, 12), (14, 4, 16), (15, 3, 8), (16, 4, 10), (17, 4, 18), (18, 5, 2)
)
INSERT INTO holes (tee_id, hole_number, par, stroke_index)
SELECT
  t.id,
  hs.hole_number,
  hs.par,
  hs.stroke_index
FROM hole_seed hs
JOIN tees t
  ON t.name = 'Black'
JOIN courses c
  ON c.id = t.course_id
WHERE c.name = 'Osprey Point'
  AND c.is_seed = 1
  AND NOT EXISTS (
    SELECT 1
    FROM holes h
    WHERE h.tee_id = t.id
      AND h.hole_number = hs.hole_number
  );

-- ---------------------------------------------------------------------------
-- Oak Point (Black)
-- ---------------------------------------------------------------------------
INSERT INTO courses (name, location, is_seed)
SELECT 'Oak Point', 'Kiawah Island, SC', 1
WHERE NOT EXISTS (
  SELECT 1
  FROM courses
  WHERE name = 'Oak Point'
    AND is_seed = 1
);

INSERT INTO tees (
  course_id,
  name,
  cr18,
  slope18,
  par18,
  cr9f,
  slope9f,
  par9f,
  cr9b,
  slope9b,
  par9b
)
SELECT
  c.id,
  'Black',
  72.1,
  137,
  72,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL
FROM courses c
WHERE c.name = 'Oak Point'
  AND c.is_seed = 1
  AND NOT EXISTS (
    SELECT 1
    FROM tees t
    WHERE t.course_id = c.id
      AND t.name = 'Black'
  );

WITH hole_seed (hole_number, par, stroke_index) AS (
  VALUES
    (1, 5, 7), (2, 3, 17), (3, 4, 15), (4, 5, 5), (5, 4, 1), (6, 4, 3), (7, 3, 11), (8, 5, 9), (9, 3, 13),
    (10, 4, 10), (11, 3, 14), (12, 5, 8), (13, 4, 2), (14, 4, 6), (15, 3, 18), (16, 4, 12), (17, 5, 4), (18, 4, 16)
)
INSERT INTO holes (tee_id, hole_number, par, stroke_index)
SELECT
  t.id,
  hs.hole_number,
  hs.par,
  hs.stroke_index
FROM hole_seed hs
JOIN tees t
  ON t.name = 'Black'
JOIN courses c
  ON c.id = t.course_id
WHERE c.name = 'Oak Point'
  AND c.is_seed = 1
  AND NOT EXISTS (
    SELECT 1
    FROM holes h
    WHERE h.tee_id = t.id
      AND h.hole_number = hs.hole_number
  );

-- ---------------------------------------------------------------------------
-- Ocean Course (Tournament)
-- ---------------------------------------------------------------------------
INSERT INTO courses (name, location, is_seed)
SELECT 'Ocean Course', 'Kiawah Island, SC', 1
WHERE NOT EXISTS (
  SELECT 1
  FROM courses
  WHERE name = 'Ocean Course'
    AND is_seed = 1
);

INSERT INTO tees (
  course_id,
  name,
  cr18,
  slope18,
  par18,
  cr9f,
  slope9f,
  par9f,
  cr9b,
  slope9b,
  par9b
)
SELECT
  c.id,
  'Tournament',
  79.6,
  155,
  72,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL
FROM courses c
WHERE c.name = 'Ocean Course'
  AND c.is_seed = 1
  AND NOT EXISTS (
    SELECT 1
    FROM tees t
    WHERE t.course_id = c.id
      AND t.name = 'Tournament'
  );

-- PROVISIONAL: Ocean Course per-hole SI/par loaded from metpga BlueGolf fallback
-- until the official Ocean Course PDF scorecard values are re-verified in P10.T2.
WITH hole_seed (hole_number, par, stroke_index) AS (
  VALUES
    (1, 4, 15), (2, 5, 3), (3, 4, 9), (4, 4, 1), (5, 3, 11), (6, 4, 13), (7, 5, 7), (8, 3, 17), (9, 4, 5),
    (10, 4, 16), (11, 5, 8), (12, 4, 10), (13, 4, 2), (14, 3, 14), (15, 4, 18), (16, 5, 4), (17, 3, 12), (18, 4, 6)
)
INSERT INTO holes (tee_id, hole_number, par, stroke_index)
SELECT
  t.id,
  hs.hole_number,
  hs.par,
  hs.stroke_index
FROM hole_seed hs
JOIN tees t
  ON t.name = 'Tournament'
JOIN courses c
  ON c.id = t.course_id
WHERE c.name = 'Ocean Course'
  AND c.is_seed = 1
  AND NOT EXISTS (
    SELECT 1
    FROM holes h
    WHERE h.tee_id = t.id
      AND h.hole_number = hs.hole_number
  );

-- ---------------------------------------------------------------------------
-- Turtle Point (Black)
-- ---------------------------------------------------------------------------
INSERT INTO courses (name, location, is_seed)
SELECT 'Turtle Point', 'Kiawah Island, SC', 1
WHERE NOT EXISTS (
  SELECT 1
  FROM courses
  WHERE name = 'Turtle Point'
    AND is_seed = 1
);

INSERT INTO tees (
  course_id,
  name,
  cr18,
  slope18,
  par18,
  cr9f,
  slope9f,
  par9f,
  cr9b,
  slope9b,
  par9b
)
SELECT
  c.id,
  'Black',
  73.9,
  141,
  72,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL
FROM courses c
WHERE c.name = 'Turtle Point'
  AND c.is_seed = 1
  AND NOT EXISTS (
    SELECT 1
    FROM tees t
    WHERE t.course_id = c.id
      AND t.name = 'Black'
  );

WITH hole_seed (hole_number, par, stroke_index) AS (
  VALUES
    (1, 4, 9), (2, 5, 5), (3, 4, 15), (4, 3, 13), (5, 5, 7), (6, 4, 11), (7, 3, 17), (8, 4, 1), (9, 4, 3),
    (10, 5, 12), (11, 4, 6), (12, 4, 4), (13, 5, 10), (14, 3, 16), (15, 4, 8), (16, 3, 14), (17, 4, 18), (18, 4, 2)
)
INSERT INTO holes (tee_id, hole_number, par, stroke_index)
SELECT
  t.id,
  hs.hole_number,
  hs.par,
  hs.stroke_index
FROM hole_seed hs
JOIN tees t
  ON t.name = 'Black'
JOIN courses c
  ON c.id = t.course_id
WHERE c.name = 'Turtle Point'
  AND c.is_seed = 1
  AND NOT EXISTS (
    SELECT 1
    FROM holes h
    WHERE h.tee_id = t.id
      AND h.hole_number = hs.hole_number
  );
