import { vi } from '@/shared/i18n/vi'
import { cn } from '@/shared/lib/cn'
import { Button } from './button'

interface PaginationProps {
  /** Trang hiện tại, bắt đầu từ 1. */
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  className?: string
}

/** Phân trang phía client: "x–y / tổng" + Trước/Sau + "Trang a/b". Không render khi `total ≤ pageSize`. */
function Pagination({ page, pageSize, total, onPageChange, className }: PaginationProps) {
  if (total <= pageSize) return null
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(Math.max(1, page), pageCount)
  const from = (current - 1) * pageSize + 1
  const to = Math.min(total, current * pageSize)
  return (
    <div data-slot="pagination" className={cn('flex flex-wrap items-center justify-between gap-2 text-sm', className)}>
      <span className="text-muted-foreground">
        {vi.common.paginationRange.replace('{{from}}', String(from)).replace('{{to}}', String(to)).replace('{{total}}', String(total))}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => onPageChange(current - 1)}>
          {vi.common.paginationPrev}
        </Button>
        <span className="text-muted-foreground">
          {vi.common.paginationPage.replace('{{page}}', String(current)).replace('{{count}}', String(pageCount))}
        </span>
        <Button variant="outline" size="sm" disabled={current >= pageCount} onClick={() => onPageChange(current + 1)}>
          {vi.common.paginationNext}
        </Button>
      </div>
    </div>
  )
}

export { Pagination }
