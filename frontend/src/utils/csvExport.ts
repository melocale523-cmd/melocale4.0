function escapeCsvField(val: unknown): string {
  const str = String(val ?? '');
  const escaped = str.replace(/"/g, '""');
  return escaped.includes(',') || escaped.includes('\n') || escaped.includes('"')
    ? `"${escaped}"`
    : escaped;
}

export function jsonToCsv(data: Record<string, unknown>[]): string {
  if (!data.length) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map(row => headers.map(h => escapeCsvField(row[h])).join(','));
  return [headers.join(','), ...rows].join('\n');
}

export function rowsToCsv(headers: string[], rows: (string | number)[][]): string {
  const body = rows.map(r => r.map(escapeCsvField).join(','));
  return [headers.join(','), ...body].join('\n');
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
