import { Construction } from 'lucide-react'

/**
 * Khối placeholder cho tab phụ thuộc module chưa build (Chủ xe & Ký gửi/Phạt
 * nguội/Lịch sử thuê/Giao/nhận/Doanh thu/Chi phí/Lợi nhuận) hoặc tab đã có
 * nguồn dữ liệu nhưng chưa phát sinh bản ghi nào (Hiện trạng xe) —
 * `docs/VEHICLE-MANAGEMENT-PLAN.md` §8.3. Copy y hệt
 * `features/customers/components/CustomerDetailPlaceholder.tsx`. Cố ý tách
 * biệt khỏi "bảng rỗng" (empty state tìm kiếm không ra kết quả) để không gây
 * hiểu nhầm.
 */
export function VehicleDetailPlaceholder({ note }: { note: string }) {
  return (
    <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
      <Construction className="size-8" />
      <p className="max-w-md text-sm">{note}</p>
    </div>
  )
}
