/**
 * CSV export for the area table (§8.7).
 *
 * The UTF-8 BOM is not decoration: without it Excel on Windows reads the file
 * as the system codepage and every Hebrew column becomes mojibake. It is the
 * single most common way a Hebrew CSV export "works" in testing and fails for
 * the person who actually opens it.
 */
const BOM = '﻿';

/** Escape per RFC 4180: quote when the value contains a comma, quote or newline. */
export function escapeCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(','));
  }
  // CRLF, which is what Excel expects.
  return BOM + lines.join('\r\n');
}

/** Trigger a download of `content` as `filename`. */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
