import { Construction } from 'lucide-react'

/**
 * Khối placeholder cho tab phụ thuộc module chưa build (Thanh toán/Hợp đồng/
 * Giao-nhận/Sự cố/Phân công) — `docs/RENTAL-MANAGEMENT-PLAN.md` §15.2/§15.3
 * (mirror `CustomerDetailPlaceholder`/`VehicleDetailPlaceholder`). Cố ý tách
 * biệt khỏi "bảng rỗng" (empty state tìm kiếm không ra kết quả) để không gây
 * hiểu nhầm.
 */
export function RentalDetailPlaceholder({ note }: { note: string }) {
  return (
    <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
      <Construction className="size-8" />
      <p className="max-w-md text-sm">{note}</p>
    </div>
  )
}
