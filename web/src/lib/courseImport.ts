import type { CourseImportData } from '$lib/db/types';

export type ValidationError = {
  row: number;
  field: string;
  message: string;
};

export type CsvParseResult =
  | { ok: true; courseData: CourseImportData }
  | { ok: false; errors: ValidationError[] };

const CSV_COLUMNS = [
  'CourseName',
  'CourseLocation',
  'TeeName',
  'TeeColor',
  'CR18',
  'Slope18',
  'Par18',
  'CR9F',
  'Slope9F',
  'Par9F',
  'CR9B',
  'Slope9B',
  'Par9B',
  'HoleNumber',
  'Par',
  'Yardage',
  'StrokeIndex',
] as const;

type CsvColumn = (typeof CSV_COLUMNS)[number];

/** Minimal RFC 4180-compliant CSV parser. Returns rows of trimmed string fields. */
function parseCSVText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];

    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') {
          // Escaped double-quote within a quoted field
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field.trim());
        field = '';
      } else if (ch === '\n') {
        row.push(field.trim());
        if (row.some((f) => f.length > 0)) rows.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }
  }

  // Flush the final field and row
  row.push(field.trim());
  if (row.some((f) => f.length > 0)) rows.push(row);

  return rows;
}

function sanitizeString(value: string, maxLength = 255): string {
  return value.trim().slice(0, maxLength);
}

function parseRequiredFloat(
  value: string,
  field: string,
  rowNum: number,
  errors: ValidationError[]
): number {
  const num = parseFloat(value);
  if (!value.trim() || !Number.isFinite(num)) {
    errors.push({ row: rowNum, field, message: `${field} must be a valid number.` });
    return 0;
  }
  return num;
}

function parseRequiredInt(
  value: string,
  field: string,
  rowNum: number,
  errors: ValidationError[],
  min: number,
  max: number
): number {
  const trimmed = value.trim();
  const num = parseInt(trimmed, 10);
  if (!trimmed || !Number.isInteger(num) || String(num) !== trimmed) {
    errors.push({ row: rowNum, field, message: `${field} must be a valid integer.` });
    return 0;
  }
  if (num < min || num > max) {
    errors.push({
      row: rowNum,
      field,
      message: `${field} must be between ${min} and ${max}.`,
    });
    return 0;
  }
  return num;
}

function parseOptionalFloat(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const num = parseFloat(value);
  return Number.isFinite(num) ? num : undefined;
}

function parseOptionalInt(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const num = parseInt(value, 10);
  return Number.isInteger(num) ? num : undefined;
}

/**
 * Parses a course-import CSV string into a CourseImportData object, or
 * returns a list of row-level validation errors on failure.
 *
 * Expected CSV header (one row per hole per tee):
 * CourseName,CourseLocation,TeeName,TeeColor,CR18,Slope18,Par18,
 * CR9F,Slope9F,Par9F,CR9B,Slope9B,Par9B,HoleNumber,Par,Yardage,StrokeIndex
 */
export function parseCsvToCourseData(text: string): CsvParseResult {
  const rawRows = parseCSVText(text);

  if (rawRows.length < 2) {
    return {
      ok: false,
      errors: [
        {
          row: 0,
          field: 'file',
          message: 'CSV must have a header row and at least one data row.',
        },
      ],
    };
  }

  // Map column names to their index in the header row
  const headerRow = rawRows[0].map((h) => h.trim());
  const colIndex = new Map<CsvColumn, number>();

  for (const col of CSV_COLUMNS) {
    const idx = headerRow.indexOf(col);
    if (idx === -1) {
      return {
        ok: false,
        errors: [{ row: 1, field: col, message: `Missing required column: ${col}.` }],
      };
    }
    colIndex.set(col, idx);
  }

  const getCol = (row: string[], col: CsvColumn): string => {
    const idx = colIndex.get(col)!;
    return row[idx]?.trim() ?? '';
  };

  const errors: ValidationError[] = [];
  const dataRows = rawRows.slice(1);

  // Validate exactly one course per file
  const courseNames = new Set(dataRows.map((r) => getCol(r, 'CourseName')));

  if (courseNames.size === 0) {
    errors.push({ row: 2, field: 'CourseName', message: 'No data rows found.' });
    return { ok: false, errors };
  }

  if (courseNames.size > 1) {
    errors.push({
      row: 2,
      field: 'CourseName',
      message: 'CSV must contain exactly one course. Multiple course names found.',
    });
    return { ok: false, errors };
  }

  const courseName = sanitizeString(getCol(dataRows[0], 'CourseName'));
  if (!courseName) {
    errors.push({ row: 2, field: 'CourseName', message: 'CourseName is required.' });
  }

  const courseLocationRaw = getCol(dataRows[0], 'CourseLocation');
  const courseLocation = courseLocationRaw ? sanitizeString(courseLocationRaw) : undefined;

  // Group rows by TeeName, preserving insertion order
  const teeGroups = new Map<string, { row: string[]; dataIndex: number }[]>();
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const teeName = sanitizeString(getCol(row, 'TeeName'));
    if (!teeName) {
      errors.push({ row: i + 2, field: 'TeeName', message: 'TeeName is required.' });
      continue;
    }
    if (!teeGroups.has(teeName)) teeGroups.set(teeName, []);
    teeGroups.get(teeName)!.push({ row, dataIndex: i });
  }

  if (teeGroups.size === 0 && errors.length === 0) {
    errors.push({ row: 2, field: 'TeeName', message: 'No valid tees found.' });
  }

  if (errors.length > 0) return { ok: false, errors };

  const tees: CourseImportData['tees'] = [];

  for (const [teeName, entries] of teeGroups.entries()) {
    const firstRowNum = entries[0].dataIndex + 2;
    const firstRow = entries[0].row;

    if (entries.length !== 18) {
      errors.push({
        row: firstRowNum,
        field: 'HoleNumber',
        message: `Tee "${teeName}" must have exactly 18 rows. Found ${entries.length}.`,
      });
      continue;
    }

    // Tee-level fields are read from the first row for this tee
    const cr18 = parseRequiredFloat(getCol(firstRow, 'CR18'), 'CR18', firstRowNum, errors);
    const slope18 = parseRequiredInt(
      getCol(firstRow, 'Slope18'),
      'Slope18',
      firstRowNum,
      errors,
      1,
      155
    );
    const par18 = parseRequiredInt(getCol(firstRow, 'Par18'), 'Par18', firstRowNum, errors, 1, 100);

    const teeColorRaw = getCol(firstRow, 'TeeColor');
    const teeColor = teeColorRaw ? sanitizeString(teeColorRaw, 20) : undefined;

    const cr9f = parseOptionalFloat(getCol(firstRow, 'CR9F'));
    const slope9f = parseOptionalInt(getCol(firstRow, 'Slope9F'));
    const par9f = parseOptionalInt(getCol(firstRow, 'Par9F'));
    const cr9b = parseOptionalFloat(getCol(firstRow, 'CR9B'));
    const slope9b = parseOptionalInt(getCol(firstRow, 'Slope9B'));
    const par9b = parseOptionalInt(getCol(firstRow, 'Par9B'));

    const holes: CourseImportData['tees'][0]['holes'] = [];
    const seenHoleNumbers = new Set<number>();
    const seenStrokeIndexes = new Set<number>();

    for (const { row, dataIndex } of entries) {
      const rowNum = dataIndex + 2;

      const holeNumber = parseRequiredInt(
        getCol(row, 'HoleNumber'),
        'HoleNumber',
        rowNum,
        errors,
        1,
        18
      );
      const holePar = parseRequiredInt(getCol(row, 'Par'), 'Par', rowNum, errors, 3, 5);
      const strokeIndex = parseRequiredInt(
        getCol(row, 'StrokeIndex'),
        'StrokeIndex',
        rowNum,
        errors,
        1,
        18
      );
      const yardage = parseOptionalInt(getCol(row, 'Yardage'));

      // Track duplicates only when the value parsed without an error (non-zero default)
      if (holeNumber !== 0) {
        if (seenHoleNumbers.has(holeNumber)) {
          errors.push({
            row: rowNum,
            field: 'HoleNumber',
            message: `Hole number ${holeNumber} is duplicated in tee "${teeName}".`,
          });
        } else {
          seenHoleNumbers.add(holeNumber);
        }
      }

      if (strokeIndex !== 0) {
        if (seenStrokeIndexes.has(strokeIndex)) {
          errors.push({
            row: rowNum,
            field: 'StrokeIndex',
            message: `Stroke index ${strokeIndex} is duplicated in tee "${teeName}".`,
          });
        } else {
          seenStrokeIndexes.add(strokeIndex);
        }
      }

      holes.push({ hole_number: holeNumber, par: holePar, yardage, stroke_index: strokeIndex });
    }

    // Verify all hole numbers 1–18 are accounted for
    for (let n = 1; n <= 18; n++) {
      if (!seenHoleNumbers.has(n)) {
        errors.push({
          row: firstRowNum,
          field: 'HoleNumber',
          message: `Tee "${teeName}" is missing hole number ${n}.`,
        });
      }
    }

    holes.sort((a, b) => a.hole_number - b.hole_number);

    tees.push({
      name: teeName,
      color_hex: teeColor,
      cr18,
      slope18,
      par18,
      cr9f,
      slope9f,
      par9f,
      cr9b,
      slope9b,
      par9b,
      holes,
    });
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    courseData: {
      name: courseName,
      location: courseLocation,
      tees,
    },
  };
}
