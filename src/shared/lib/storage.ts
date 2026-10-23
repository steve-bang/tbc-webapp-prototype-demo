const NAMESPACE = 'tbc_admin'

function key(name: string): string {
  return `${NAMESPACE}:${name}`
}

/**
 * Wrapper localStorage cho toàn bộ prototype — tương đương vai trò của
 * `expo-sqlite/kv-store` trong App nhân viên (thienbaocar mobile prototype).
 * Mọi feature đọc/ghi qua đây, không gọi `localStorage` trực tiếp, để dễ
 * thay bằng nguồn dữ liệu thật (API) sau này mà không phải sửa UI.
 */
export function readJson<T>(name: string): T | undefined {
  try {
    const raw = localStorage.getItem(key(name))
    if (raw == null) return undefined
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

/** Trả `true` khi ghi thành công, `false` khi `setItem` ném lỗi (đầy/bị chặn) — không bao giờ ném ra ngoài. */
export function writeJson(name: string, value: unknown): boolean {
  try {
    localStorage.setItem(key(name), JSON.stringify(value))
    return true
  } catch {
    // localStorage có thể đầy hoặc bị chặn (chế độ ẩn danh) — caller cũ bỏ qua; caller cần co dữ liệu lại thì dùng giá trị trả về.
    return false
  }
}

export function removeItem(name: string): void {
  localStorage.removeItem(key(name))
}

/** Xoá toàn bộ dữ liệu demo của app (không đụng tới localStorage của site khác). */
export function clearAllAppData(): void {
  const toRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k?.startsWith(`${NAMESPACE}:`)) toRemove.push(k)
  }
  toRemove.forEach((k) => localStorage.removeItem(k))
}

/** Đo dung lượng (ký tự = `key.length + value.length`) các key của app, sắp giảm dần. DASHBOARD-PLATFORM-PLAN.md §19.2. */
export function measureAppStorage(): { totalChars: number; keys: { name: string; chars: number }[] } {
  const prefix = `${NAMESPACE}:`
  const keys: { name: string; chars: number }[] = []
  let totalChars = 0
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k?.startsWith(prefix)) continue
    const chars = k.length + (localStorage.getItem(k)?.length ?? 0)
    keys.push({ name: k.slice(prefix.length), chars })
    totalChars += chars
  }
  keys.sort((a, b) => b.chars - a.chars)
  return { totalChars, keys }
}
