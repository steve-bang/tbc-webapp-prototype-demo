import { Construction } from 'lucide-react'

/**
 * Khối placeholder cho tab phụ thuộc module chưa build (Lịch sử thuê/Thanh
 * toán/Sự cố) — `docs/CUSTOMER-MANAGEMENT-PLAN.md` §6.2. Cố ý tách biệt khỏi
 * "bảng rỗng" (empty state tìm kiếm không ra kết quả) để không gây hiểu nhầm.
 */
export function CustomerDetailPlaceholder({ note }: { note: string }) {
  return (
    <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
      <Construction className="size-8" />
      <p className="max-w-md text-sm">{note}</p>
    </div>
  )
}
