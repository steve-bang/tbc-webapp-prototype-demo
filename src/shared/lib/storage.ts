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

export function writeJson(name: string, value: unknown): void {
  try {
    localStorage.setItem(key(name), JSON.stringify(value))
  } catch {
    // localStorage có thể đầy hoặc bị chặn (chế độ ẩn danh) — bỏ qua ở bản demo.
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
