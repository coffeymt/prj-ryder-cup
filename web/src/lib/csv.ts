/**
 * Escapes a single CSV cell value.
 *
 * - Numbers are returned as-is (no quoting needed).
 * - null/undefined becomes an empty string.
 * - Strings starting with =, +, -, or @ are prefixed with a single quote to
 *   prevent spreadsheet formula injection.
 * - Strings containing commas, double-quotes, or newlines are wrapped in
 *   double-quotes; any internal double-quotes are doubled per RFC 4180.
 */
export function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  const str = String(value);

  // Formula injection prevention: prefix formula-starting characters
  const safeStr = /^[=+\-@]/.test(str) ? `'${str}` : str;

  // Wrap in double-quotes if the value contains commas, quotes, or line breaks
  if (
    safeStr.includes(',') ||
    safeStr.includes('"') ||
    safeStr.includes('\n') ||
    safeStr.includes('\r')
  ) {
    return `"${safeStr.replace(/"/g, '""')}"`;
  }

  return safeStr;
}

/**
 * Converts an array of cell values into a single CSV row string terminated
 * with a newline character.
 */
export function toCSVRow(values: (string | number | null | undefined)[]): string {
  return values.map(escapeCSV).join(',') + '\n';
}
