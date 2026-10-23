import { vi } from '@/shared/i18n/vi'
import { PageHeader } from '@/shared/layout/PageHeader'

/**
 * Màn thay thế khi thiếu quyền xem Xe ký gửi (`CONSIGNMENT.VIEW`) — mirror `FinanceReportScreen`. Dùng trong mẫu
 * "wrapper kiểm quyền → component nội dung" để không tải dữ liệu nào (CCCD, tài khoản ngân hàng…) khi gõ URL thẳng.
 */
export function ConsignmentNoPermission({ title }: { title: string }) {
  return (
    <div>
      <PageHeader title={title} />
      <p className="text-muted-foreground text-sm">{vi.consignment.noPermission}</p>
    </div>
  )
}
