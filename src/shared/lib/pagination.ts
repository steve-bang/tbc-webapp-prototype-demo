/** Số dòng mỗi trang mặc định của các danh sách dài (DASHBOARD-PLATFORM-PLAN.md §22). */
export const DEFAULT_PAGE_SIZE = 25

export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  pageCount: number
}

/** Trang ngoài biên được kẹp về biên (trang 1 .. trang cuối). */
export function paginate<T>(items: T[], page: number, pageSize: number): PageResult<T> {
  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount)
  return { items: items.slice((current - 1) * pageSize, current * pageSize), total, page: current, pageCount }
}
