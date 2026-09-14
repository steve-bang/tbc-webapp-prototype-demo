import { vi } from '@/shared/i18n/vi'

/**
 * Tab "Tín nhiệm" — `UC-CM-12`. Phase 1 chưa có `Rental`/`Payment`/
 * `DamageIncident` nên mọi chỉ số hiển thị literal "Chưa có dữ liệu"
 * (không phải `0`/`—`) — tránh hiểu nhầm "0 sự cố = khách tốt". Không tự
 * tính điểm/kết luận (CM §20).
 */
const CREDIT_INDICATORS = [
  'creditRentalCount',
  'creditLateReturnCount',
  'creditCancellationCount',
  'creditPaymentIssueCount',
  'creditIncidentCount',
  'creditOutstandingAmount',
] as const satisfies readonly (keyof typeof vi.customers)[]

export function CustomerCreditTab() {
  return (
    <div className="flex flex-col gap-4">
      <div className="divide-border overflow-hidden rounded-lg border divide-y">
        {CREDIT_INDICATORS.map((key) => (
          <div key={key} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <span>{vi.customers[key]}</span>
            <span className="text-muted-foreground">{vi.common.noData}</span>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-sm">{vi.customers.creditNote}</p>
    </div>
  )
}
