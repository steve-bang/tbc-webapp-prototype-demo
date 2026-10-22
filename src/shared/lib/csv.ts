/**
 * Xuất CSV phía trình duyệt (demo, không backend). Định dạng: UTF-8 có BOM (Excel đọc đúng tiếng Việt), phân cách dấu phẩy,
 * xuống dòng CRLF. KHÔNG thêm dòng `sep=` (Excel bỏ qua BOM khi có dòng này → lỗi font).
 */

/** Ô CSV: chuỗi (được escape), số (ghi nguyên, Excel cộng được), `null`/`undefined` → ô trống. */
export type CsvCell = string | number | null | undefined

const BOM = '﻿'
const CRLF = '\r\n'
/** Ô chuỗi bắt đầu bằng ký tự này có thể bị Excel hiểu là công thức (CSV injection). */
const INJECTION_RE = /^[=+\-@\t\r]/
const NEEDS_QUOTE_RE = /[",\r\n]/

function escapeCell(cell: CsvCell): string {
  if (cell === null || cell === undefined) return ''
  if (typeof cell === 'number') return Number.isFinite(cell) ? String(cell) : ''
  const text = INJECTION_RE.test(cell) ? `'${cell}` : cell
  return NEEDS_QUOTE_RE.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Ghép các dòng thành nội dung file CSV (BOM + CRLF, có CRLF cuối file). */
export function toCsv(rows: CsvCell[][]): string {
  return BOM + rows.map((row) => row.map(escapeCell).join(',')).join(CRLF) + CRLF
}

/** Tải nội dung CSV về máy qua thẻ `<a download>` tạm. */
export function downloadCsv(fileName: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
