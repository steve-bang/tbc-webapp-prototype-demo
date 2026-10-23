import { registerSeedStep } from '@/shared/fixtures/seedAll'
import { writeJson } from '@/shared/lib/storage'
import { NOTIFICATIONS_STORAGE_KEY } from './api'

// DASHBOARD-PLATFORM-PLAN.md §9.2 — không sinh dữ liệu giả: sự kiện suy ra từ dữ liệu thật ở lần đồng bộ đầu tiên.
// Chỉ đặt lại về rỗng để sau reseed không còn sự kiện trỏ tới id của lần seed cũ.
registerSeedStep(() => {
  writeJson(NOTIFICATIONS_STORAGE_KEY, [])
})
