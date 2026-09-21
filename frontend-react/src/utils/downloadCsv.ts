/**
 * 通用 CSV 下载工具
 * 用于报表图表「下载」按钮：将表头 + 二维数据写入带 BOM 的 UTF-8 CSV，触发浏览器下载。
 */
export type CsvCell = string | number | null | undefined;

export function downloadCsv(filename: string, headers: string[], rows: CsvCell[][]): void {
  const escapeCell = (v: CsvCell): string => {
    if (v == null) return '';
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(',')),
  ];
  const csv = '﻿' + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
