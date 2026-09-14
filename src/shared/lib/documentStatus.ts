import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { DocumentStatus } from '@/shared/domain/enums'

/**
 * Tính trạng thái hiệu lực giấy tờ theo Expiry Date − Warning Lead Days.
 * Dùng chung cho `CustomerDocument` (`features/customers/model.ts`) và
 * `VehicleDocument` (`features/vehicles/model.ts`) — công thức giống hệt
 * nhau, chỉ khác nguồn threshold: Customer dùng hằng số tạm (TODO OQ),
 * Vehicle dùng field `warningLeadDays` cấu hình theo từng bản ghi
 * (CR-2026-046, đã chốt chính thức).
 * `docs/PAGE-IMPLEMENTATION-PRIORITY.md` mục 4: Dashboard (Phase 6) sẽ tái
 * dùng hàm này — không viết lại lúc đó.
 */
export function documentExpiryStatus(
  expiryDate: string | undefined,
  warningLeadDays: number,
  today: Date = new Date(),
): DocumentStatus {
  if (!expiryDate) return 'VALID'
  const diffDays = differenceInCalendarDays(parseISO(expiryDate), today)
  if (diffDays < 0) return 'EXPIRED'
  if (diffDays <= warningLeadDays) return 'EXPIRING_SOON'
  return 'VALID'
}
