/**
 * CSV cell formatting for admin exports.
 *
 * Spreadsheet formula injection (OWASP CSV injection) is neutralised first:
 * a cell starting with `=`, `+`, `-`, `@`, TAB, or CR is prefixed with an
 * apostrophe so Excel and Sheets treat it as text. RFC 4180 quoting then
 * wraps cells containing separators, quotes, or newlines.
 */
export function csvCell(value: string): string {
  const neutralized = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (
    neutralized.includes(",") ||
    neutralized.includes('"') ||
    neutralized.includes("\n") ||
    neutralized.includes("\r")
  ) {
    return `"${neutralized.replace(/"/g, '""')}"`;
  }
  return neutralized;
}
