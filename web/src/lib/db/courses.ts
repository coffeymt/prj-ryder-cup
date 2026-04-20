import type { Course, CourseImportData, Hole, Tee } from './types';

type CreateCourseInput = Omit<Course, 'created_at' | 'updated_at'> &
  Partial<Pick<Course, 'created_at' | 'updated_at'>>;
type CreateTeeInput = Omit<Tee, 'created_at'> & Partial<Pick<Tee, 'created_at'>>;
type UpsertHoleInput = Omit<Hole, 'id' | 'created_at'> & Partial<Pick<Hole, 'id' | 'created_at'>>;

const COURSE_COLUMNS = `
  id,
  name,
  location,
  is_seed,
  created_at,
  updated_at
`;

const TEE_COLUMNS = `
  id,
  course_id,
  name,
  color_hex,
  cr18,
  slope18,
  par18,
  cr9f,
  slope9f,
  par9f,
  cr9b,
  slope9b,
  par9b,
  created_at
`;

const HOLE_COLUMNS = `
  id,
  tee_id,
  hole_number,
  par,
  yardage,
  stroke_index,
  created_at
`;

const COURSE_UPDATABLE_FIELDS = ['name', 'location', 'is_seed'] as const;
const COURSE_UPDATABLE_FIELD_SET = new Set<string>(COURSE_UPDATABLE_FIELDS);

const TEE_UPDATABLE_FIELDS = [
  'name',
  'color_hex',
  'cr18',
  'slope18',
  'par18',
  'cr9f',
  'slope9f',
  'par9f',
  'cr9b',
  'slope9b',
  'par9b',
] as const;
const TEE_UPDATABLE_FIELD_SET = new Set<string>(TEE_UPDATABLE_FIELDS);

const HOLE_UPDATABLE_FIELDS = ['par', 'yardage', 'stroke_index'] as const;
const HOLE_UPDATABLE_FIELD_SET = new Set<string>(HOLE_UPDATABLE_FIELDS);

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeCourse(row: Course | null): Course | null {
  if (!row) {
    return null;
  }

  return {
    ...row,
    id: String(row.id),
  };
}

function normalizeTee(row: Tee | null): Tee | null {
  if (!row) {
    return null;
  }

  return {
    ...row,
    id: String(row.id),
    course_id: String(row.course_id),
  };
}

function normalizeHole(row: Hole | null): Hole | null {
  if (!row) {
    return null;
  }

  return {
    ...row,
    id: String(row.id),
    tee_id: String(row.tee_id),
  };
}

async function getHoleById(db: D1Database, id: string): Promise<Hole | null> {
  const row = await db
    .prepare(
      `
        SELECT ${HOLE_COLUMNS}
        FROM holes
        WHERE id = ?1
        LIMIT 1
      `
    )
    .bind(id)
    .first<Hole>();

  return normalizeHole(row);
}

export async function createCourse(db: D1Database, data: CreateCourseInput): Promise<Course> {
  const createdAt = data.created_at ?? nowIso();
  const updatedAt = data.updated_at ?? createdAt;

  await db
    .prepare(
      `
        INSERT INTO courses (id, name, location, is_seed, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
      `
    )
    .bind(data.id, data.name, data.location, data.is_seed, createdAt, updatedAt)
    .run();

  const created = await getCourseById(db, data.id);

  if (!created) {
    throw new Error(`Failed to create course ${data.id}.`);
  }

  return created;
}

export async function getCourseById(db: D1Database, id: string): Promise<Course | null> {
  const row = await db
    .prepare(
      `
        SELECT ${COURSE_COLUMNS}
        FROM courses
        WHERE id = ?1
        LIMIT 1
      `
    )
    .bind(id)
    .first<Course>();

  return normalizeCourse(row);
}

export async function listCourses(db: D1Database): Promise<Course[]> {
  const result = await db
    .prepare(
      `
        SELECT ${COURSE_COLUMNS}
        FROM courses
        ORDER BY name ASC
      `
    )
    .all<Course>();

  return result.results.map((row) => ({
    ...row,
    id: String(row.id),
  }));
}

export async function updateCourse(
  db: D1Database,
  id: string,
  data: Partial<Course>
): Promise<Course | null> {
  const assignments = Object.entries(data).filter(
    ([field, value]) => COURSE_UPDATABLE_FIELD_SET.has(field) && value !== undefined
  );

  if (assignments.length === 0) {
    return getCourseById(db, id);
  }

  const updatedAt = nowIso();
  const setSql = assignments.map(([field], index) => `${field} = ?${index + 1}`).join(', ');
  const values = assignments.map(([, value]) => value);

  await db
    .prepare(
      `
        UPDATE courses
        SET ${setSql}, updated_at = ?${assignments.length + 1}
        WHERE id = ?${assignments.length + 2}
      `
    )
    .bind(...values, updatedAt, id)
    .run();

  return getCourseById(db, id);
}

export async function createTee(db: D1Database, data: CreateTeeInput): Promise<Tee> {
  const createdAt = data.created_at ?? nowIso();

  await db
    .prepare(
      `
        INSERT INTO tees (
          id,
          course_id,
          name,
          color_hex,
          cr18,
          slope18,
          par18,
          cr9f,
          slope9f,
          par9f,
          cr9b,
          slope9b,
          par9b,
          created_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
      `
    )
    .bind(
      data.id,
      data.course_id,
      data.name,
      data.color_hex,
      data.cr18,
      data.slope18,
      data.par18,
      data.cr9f,
      data.slope9f,
      data.par9f,
      data.cr9b,
      data.slope9b,
      data.par9b,
      createdAt
    )
    .run();

  const row = await db
    .prepare(
      `
        SELECT ${TEE_COLUMNS}
        FROM tees
        WHERE id = ?1
        LIMIT 1
      `
    )
    .bind(data.id)
    .first<Tee>();

  const created = normalizeTee(row);

  if (!created) {
    throw new Error(`Failed to create tee ${data.id}.`);
  }

  return created;
}

export async function listTeesByCourse(db: D1Database, courseId: string): Promise<Tee[]> {
  const result = await db
    .prepare(
      `
        SELECT ${TEE_COLUMNS}
        FROM tees
        WHERE course_id = ?1
        ORDER BY created_at ASC
      `
    )
    .bind(courseId)
    .all<Tee>();

  return result.results.map((row) => ({
    ...row,
    id: String(row.id),
    course_id: String(row.course_id),
  }));
}

export async function upsertHole(db: D1Database, data: UpsertHoleInput): Promise<Hole> {
  const existing = await db
    .prepare(
      `
        SELECT ${HOLE_COLUMNS}
        FROM holes
        WHERE tee_id = ?1 AND hole_number = ?2
        LIMIT 1
      `
    )
    .bind(data.tee_id, data.hole_number)
    .first<Hole>();

  const holeId = data.id ?? (existing ? String(existing.id) : crypto.randomUUID());
  const createdAt = data.created_at ?? (existing ? existing.created_at : nowIso());

  await db
    .prepare(
      `
        INSERT OR REPLACE INTO holes (id, tee_id, hole_number, par, yardage, stroke_index, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
      `
    )
    .bind(
      holeId,
      data.tee_id,
      data.hole_number,
      data.par,
      data.yardage,
      data.stroke_index,
      createdAt
    )
    .run();

  const upserted = await getHoleById(db, holeId);

  if (!upserted) {
    throw new Error(`Failed to upsert hole ${holeId}.`);
  }

  return upserted;
}

export async function listHolesByCourse(db: D1Database, courseId: string): Promise<Hole[]> {
  const result = await db
    .prepare(
      `
        SELECT ${HOLE_COLUMNS}
        FROM holes
        WHERE tee_id IN (
          SELECT id
          FROM tees
          WHERE course_id = ?1
        )
        ORDER BY tee_id ASC, hole_number ASC
      `
    )
    .bind(courseId)
    .all<Hole>();

  return result.results.map((row) => ({
    ...row,
    id: String(row.id),
    tee_id: String(row.tee_id),
  }));
}

export async function deleteCourse(db: D1Database, id: string): Promise<void> {
  await db.prepare(`DELETE FROM courses WHERE id = ?1`).bind(id).run();
}

export async function searchCourses(db: D1Database, query: string): Promise<Course[]> {
  const result = await db
    .prepare(
      `
        SELECT ${COURSE_COLUMNS}
        FROM courses
        WHERE name LIKE ?1
        ORDER BY name ASC
      `
    )
    .bind(`%${query}%`)
    .all<Course>();

  return result.results.map((row) => ({ ...row, id: String(row.id) }));
}

export async function getTeeById(db: D1Database, id: string): Promise<Tee | null> {
  const row = await db
    .prepare(
      `
        SELECT ${TEE_COLUMNS}
        FROM tees
        WHERE id = ?1
        LIMIT 1
      `
    )
    .bind(id)
    .first<Tee>();

  return normalizeTee(row);
}

export async function updateTee(
  db: D1Database,
  id: string,
  data: Partial<Tee>
): Promise<Tee | null> {
  const assignments = Object.entries(data).filter(
    ([field, value]) => TEE_UPDATABLE_FIELD_SET.has(field) && value !== undefined
  );

  if (assignments.length === 0) {
    return getTeeById(db, id);
  }

  const setSql = assignments.map(([field], index) => `${field} = ?${index + 1}`).join(', ');
  const values = assignments.map(([, value]) => value);

  await db
    .prepare(
      `
        UPDATE tees
        SET ${setSql}
        WHERE id = ?${assignments.length + 1}
      `
    )
    .bind(...values, id)
    .run();

  return getTeeById(db, id);
}

export async function deleteTee(db: D1Database, id: string): Promise<void> {
  await db.prepare(`DELETE FROM tees WHERE id = ?1`).bind(id).run();
}

export async function listHolesByTee(db: D1Database, teeId: string): Promise<Hole[]> {
  const result = await db
    .prepare(
      `
        SELECT ${HOLE_COLUMNS}
        FROM holes
        WHERE tee_id = ?1
        ORDER BY hole_number ASC
      `
    )
    .bind(teeId)
    .all<Hole>();

  return result.results.map((row) => ({
    ...row,
    id: String(row.id),
    tee_id: String(row.tee_id),
  }));
}

export async function updateHole(
  db: D1Database,
  id: string,
  data: Partial<Hole>
): Promise<Hole | null> {
  const assignments = Object.entries(data).filter(
    ([field, value]) => HOLE_UPDATABLE_FIELD_SET.has(field) && value !== undefined
  );

  if (assignments.length === 0) {
    return getHoleById(db, id);
  }

  const setSql = assignments.map(([field], index) => `${field} = ?${index + 1}`).join(', ');
  const values = assignments.map(([, value]) => value);

  await db
    .prepare(
      `
        UPDATE holes
        SET ${setSql}
        WHERE id = ?${assignments.length + 1}
      `
    )
    .bind(...values, id)
    .run();

  return getHoleById(db, id);
}

export async function bulkUpsertHoles(
  db: D1Database,
  teeId: string,
  holes: Array<{ hole_number: number; par: number; yardage?: number | null; stroke_index: number }>
): Promise<void> {
  if (holes.length === 0) return;

  const now = nowIso();
  const existing = await listHolesByTee(db, teeId);
  const existingByNumber = new Map(existing.map((h) => [h.hole_number, h]));

  const statements = holes.map((hole) => {
    const existingHole = existingByNumber.get(hole.hole_number);
    const holeId = existingHole?.id ?? crypto.randomUUID();
    const createdAt = existingHole?.created_at ?? now;

    return db
      .prepare(
        `
          INSERT OR REPLACE INTO holes (id, tee_id, hole_number, par, yardage, stroke_index, created_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        `
      )
      .bind(
        holeId,
        teeId,
        hole.hole_number,
        hole.par,
        hole.yardage ?? null,
        hole.stroke_index,
        createdAt
      );
  });

  await db.batch(statements);
}

export async function importFullCourse(
  db: D1Database,
  courseData: CourseImportData
): Promise<Course> {
  const now = nowIso();
  const courseId = crypto.randomUUID();

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `
          INSERT INTO courses (id, name, location, is_seed, created_at, updated_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        `
      )
      .bind(courseId, courseData.name, courseData.location ?? null, 0, now, now),
  ];

  for (const tee of courseData.tees) {
    const teeId = crypto.randomUUID();

    statements.push(
      db
        .prepare(
          `
            INSERT INTO tees (
              id, course_id, name, color_hex,
              cr18, slope18, par18,
              cr9f, slope9f, par9f,
              cr9b, slope9b, par9b,
              created_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
          `
        )
        .bind(
          teeId,
          courseId,
          tee.name,
          tee.color_hex ?? null,
          tee.cr18,
          tee.slope18,
          tee.par18,
          tee.cr9f ?? null,
          tee.slope9f ?? null,
          tee.par9f ?? null,
          tee.cr9b ?? null,
          tee.slope9b ?? null,
          tee.par9b ?? null,
          now
        )
    );

    for (const hole of tee.holes) {
      const holeId = crypto.randomUUID();

      statements.push(
        db
          .prepare(
            `
              INSERT INTO holes (id, tee_id, hole_number, par, yardage, stroke_index, created_at)
              VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            `
          )
          .bind(
            holeId,
            teeId,
            hole.hole_number,
            hole.par,
            hole.yardage ?? null,
            hole.stroke_index,
            now
          )
      );
    }
  }

  await db.batch(statements);

  const created = await getCourseById(db, courseId);

  if (!created) {
    throw new Error(`Failed to import course.`);
  }

  return created;
}
