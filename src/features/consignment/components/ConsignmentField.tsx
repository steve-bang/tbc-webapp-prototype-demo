import type { ReactNode } from 'react'
import { vi } from '@/shared/i18n/vi'

/** Cặp nhãn - giá trị dùng chung trong các tab / dialog của Xe ký gửi. */
export function ConsignmentField({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm break-words">{children ?? vi.consignment.noValue}</span>
    </div>
  )
}
