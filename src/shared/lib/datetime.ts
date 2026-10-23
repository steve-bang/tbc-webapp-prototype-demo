import { formatDistanceToNow, parseISO } from 'date-fns'
import { vi as viLocale } from 'date-fns/locale'
import { vi } from '@/shared/i18n/vi'

/**
 * Ngày giờ của hệ thống — MỘT múi giờ cố định, không phụ thuộc giờ trình duyệt.
 * SA-BR-14 (SystemAdministration-BRD): timestamp toàn hệ thống dùng một múi giờ thống nhất, mặc định UTC+7.
 * Thiết kế: docs/TECH-HARDENING-PLAN.md §4 (N8).
 *
 * Quy ước:
 * - Mốc thời gian lưu là ISO `...Z` (UTC); "date key" là chuỗi `YYYY-MM-DD` theo ngày lịch +07; "month key" là `YYYY-MM`.
 * - Ngoài file này CẤM `getHours/getDate/getMonth/getFullYear/getDay`, `setHours/setDate…`, `new Date(y, m, d)`,
 *   `iso.slice(0, 10|7)` để lấy ngày, `format()` của date-fns cho ngày/giờ — gọi hàm ở đây.
 * - Chỉ dùng `Date.UTC`, `getUTC*`, `getTime`, `toISOString` (không `Intl`, không getter/setter giờ địa phương).
 */

/** SA-BR-14 — múi giờ hệ thống (hiển thị ở Cấu hình hệ thống). */
export const SYSTEM_TIME_ZONE = 'Asia/Ho_Chi_Minh'
/**
 * UTC+7. Việt Nam không có giờ mùa hè từ 1975 nên offset cố định là chính xác tuyệt đối — phép tính thuần, không cần Intl.
 * TODO(OQ: TECH-HARDENING-PLAN.md §9 OQ-N8-1) — múi giờ có cấu hình được không (SA BRD có field Timezone)? Offset gói ở đây để đổi sau.
 */
export const SYSTEM_UTC_OFFSET_MINUTES = 420

const MINUTE_MS = 60_000
const DAY_MS = 86_400_000
const OFFSET_MS = SYSTEM_UTC_OFFSET_MINUTES * MINUTE_MS
const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

const pad2 = (n: number) => String(n).padStart(2, '0')
const pad4 = (n: number) => String(n).padStart(4, '0')

export interface ZonedParts {
  year: number
  /** 1–12 */
  month: number
  day: number
  hour: number
  minute: number
  second: number
  /** 0 = Chủ nhật … 6 = Thứ bảy */
  weekday: number
}

function toMs(value: string | Date | number): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return DATE_KEY_RE.test(value) ? keyToUtcMs(value) - OFFSET_MS : Date.parse(value)
  return value.getTime()
}

/** Các thành phần ngày giờ của một mốc theo +07 (= `getUTC*` của mốc + offset). */
export function zonedParts(value: string | Date | number): ZonedParts {
  const d = new Date(toMs(value) + OFFSET_MS)
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
    weekday: d.getUTCDay(),
  }
}

function partsToKey(year: number, month: number, day: number): string {
  return `${pad4(year)}-${pad2(month)}-${pad2(day)}`
}

/** Ngày lịch +07 của một mốc → `YYYY-MM-DD`. Nhận sẵn date key thì trả nguyên văn. */
export function toDateKey(value: string | Date | number): string {
  if (typeof value === 'string' && DATE_KEY_RE.test(value)) return value
  const p = zonedParts(value)
  return partsToKey(p.year, p.month, p.day)
}

/** Tháng lịch +07 của một mốc (hoặc date key) → `YYYY-MM`. */
export function toMonthKey(value: string | Date | number): string {
  return toDateKey(value).slice(0, 7) // date key đã chuẩn hoá — cắt chuỗi không phụ thuộc múi giờ
}

/** Ngày hôm nay (+07) → `YYYY-MM-DD`. */
export function todayKey(now: Date = new Date()): string {
  return toDateKey(now)
}

/** Date key → mốc 00:00 UTC của chính ngày đó (số học thuần trên "ngày giả UTC"). */
function keyToUtcMs(key: string): number {
  const m = DATE_KEY_RE.exec(key)
  if (!m) return Number.NaN
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function utcMsToKey(ms: number): string {
  const d = new Date(ms)
  return partsToKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

/** (date key, giờ, phút) theo +07 → ISO `...Z`. Thay `setHours(h, m)` + `toISOString()`. */
export function zonedDateTimeToIso(dateKey: string, hour: number, minute = 0): string {
  return new Date(keyToUtcMs(dateKey) + hour * 3_600_000 + minute * MINUTE_MS - OFFSET_MS).toISOString()
}

/** 00:00:00.000 +07 của ngày. */
export function startOfDayIso(dateKey: string): string {
  return zonedDateTimeToIso(dateKey, 0, 0)
}

/** 23:59:59.999 +07 của ngày. */
export function endOfDayIso(dateKey: string): string {
  return new Date(keyToUtcMs(dateKey) + DAY_MS - 1 - OFFSET_MS).toISOString()
}

export function addDaysToKey(key: string, days: number): string {
  return utcMsToKey(keyToUtcMs(key) + days * DAY_MS)
}

/** Cộng tháng, kẹp ngày về cuối tháng đích (31/01 + 1 tháng = 28|29/02) — như `addMonths` của date-fns. */
export function addMonthsToKey(key: string, months: number): string {
  const m = DATE_KEY_RE.exec(key)
  if (!m) return key
  const total = Number(m[1]) * 12 + (Number(m[2]) - 1) + months
  const year = Math.floor(total / 12)
  const month = total - year * 12 + 1
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return partsToKey(year, month, Math.min(Number(m[3]), lastDay))
}

/** Số ngày lịch từ `fromKey` đến `toKey` (toKey - fromKey; âm nếu lùi). */
export function dayDiff(fromKey: string, toKey: string): number {
  return Math.round((keyToUtcMs(toKey) - keyToUtcMs(fromKey)) / DAY_MS)
}

/** Ngày đầu tuần chứa `key` (mặc định thứ Hai; 0 = Chủ nhật). */
export function startOfWeekKey(key: string, weekStartsOn = 1): string {
  const weekday = new Date(keyToUtcMs(key)).getUTCDay()
  return addDaysToKey(key, -((weekday - weekStartsOn + 7) % 7))
}

export function startOfMonthKey(key: string): string {
  return `${key.slice(0, 7)}-01` // date key — không phụ thuộc múi giờ
}

export function endOfMonthKey(key: string): string {
  return addDaysToKey(addMonthsToKey(startOfMonthKey(key), 1), -1)
}

/** Mọi ngày từ `fromKey` đến `toKey` (gồm cả hai đầu); rỗng nếu from > to. */
export function eachDayKey(fromKey: string, toKey: string): string[] {
  const out: string[] = []
  const n = dayDiff(fromKey, toKey)
  for (let i = 0; i <= n; i++) out.push(addDaysToKey(fromKey, i))
  return out
}

/** ISO → giá trị `<input type="datetime-local">` (`YYYY-MM-DDTHH:mm`, luôn hiểu theo +07). */
export function isoToDateTimeInput(iso: string): string {
  const p = zonedParts(iso)
  return `${partsToKey(p.year, p.month, p.day)}T${pad2(p.hour)}:${pad2(p.minute)}`
}

/** Giá trị `<input type="datetime-local">` (`YYYY-MM-DDTHH:mm`, hiểu theo +07) → ISO `...Z`. Rỗng/sai định dạng → chuỗi rỗng. */
export function dateTimeInputToIso(value: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(value)
  return m ? zonedDateTimeToIso(m[1], Number(m[2]), Number(m[3])) : ''
}

/** Mốc (ms) của ISO hoặc giá trị `datetime-local` (không có múi giờ → hiểu theo +07, không theo giờ trình duyệt). Sai định dạng → NaN. */
export function dateTimeToMs(value: string): number {
  return Date.parse(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? dateTimeInputToIso(value) : value)
}

export function formatDate(value: string): string {
  const p = zonedParts(value)
  return `${pad2(p.day)}/${pad2(p.month)}/${pad4(p.year)}`
}

export function formatDateTime(iso: string): string {
  const p = zonedParts(iso)
  return `${pad2(p.day)}/${pad2(p.month)}/${pad4(p.year)} ${pad2(p.hour)}:${pad2(p.minute)}`
}

/** Nhãn thứ viết tắt (`T2`…`T7`, `CN`) của một ngày lịch +07 — chuỗi lấy từ `vi.calendar.weekdayShort`. */
export function formatWeekdayShort(value: string | Date | number): string {
  return vi.calendar.weekdayShort[zonedParts(value).weekday]
}

export function formatTime(iso: string): string {
  const p = zonedParts(iso)
  return `${pad2(p.hour)}:${pad2(p.minute)}`
}

/** Khoảng cách tuyệt đối từ bây giờ — không phụ thuộc múi giờ nên giữ date-fns. */
export function formatRelative(iso: string): string {
  return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: viLocale })
}

/** Hai mốc cùng một ngày lịch +07? */
export function isSameCalendarDay(isoA: string, isoB: string): boolean {
  return toDateKey(isoA) === toDateKey(isoB)
}

export function todayIso(): string {
  return new Date().toISOString()
}

/** Cộng `days` ngày lịch +07, giữ nguyên giờ:phút:giây +07 của mốc gốc. */
export function addDaysIso(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * DAY_MS).toISOString()
}

export function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso)
  const to = Date.parse(toIso)
  return Math.round((to - from) / DAY_MS)
}
