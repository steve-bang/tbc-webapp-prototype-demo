import { clearAllAppData } from '@/shared/lib/storage'
import { forceReseed } from './seedAll'

/**
 * Xoá toàn bộ dữ liệu demo (kể cả phiên đăng nhập) rồi seed lại từ đầu — dùng
 * khi cần chạy demo nhiều lần liên tiếp cho nhiều khách mà không cần dev can
 * thiệp. Reload trang để mọi cache (TanStack Query) và store (Zustand) đọc
 * lại dữ liệu mới, tránh state cũ còn sót trên UI.
 */
export function resetDemoData(): void {
  clearAllAppData()
  forceReseed()
  window.location.reload()
}
