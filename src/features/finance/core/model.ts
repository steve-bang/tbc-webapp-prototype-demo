// Hàm thuần dùng chung RS + PM (tầng `core`) — docs/FINANCE-REFACTOR-PLAN.md §3.1.
import type { Incident } from '@/features/incidents'
import type { PostSettlementCharge, SettlementLine, SettlementTotals, SettlementWaiver } from './types.ts'

// ---- §3.3 kế hoạch — Final Amount (`RentalSettlement-BRD.md` §11, diễn giải §0.4 điểm 2) ----

/**
 * RS-BR-06/17 — dòng `DRAFT`/`DISPUTED` không tính. Diễn giải §0.4 điểm 2:
 * Gross tính cả dòng `WAIVED` (giữ số thực tế để minh bạch), Total Discount
 * cộng lại số tiền dòng `WAIVED` → hiệu ứng ròng = 0 cho dòng được miễn nhưng
 * vẫn hiện rõ trên bảng.
 */
export function calcSettlementTotals(lines: SettlementLine[], waivers: SettlementWaiver[]): SettlementTotals {
  const gross = lines
    .filter((l) => l.direction === 'CHARGE' && (l.status === 'CONFIRMED' || l.status === 'WAIVED'))
    .reduce((sum, l) => sum + (l.actualAmount ?? 0), 0)
  const discountLines = lines
    .filter((l) => l.direction === 'DISCOUNT' && l.status === 'CONFIRMED')
    .reduce((sum, l) => sum + (l.actualAmount ?? 0), 0)
  const waivedLines = lines
    .filter((l) => l.direction === 'CHARGE' && l.status === 'WAIVED')
    .reduce((sum, l) => sum + (l.actualAmount ?? 0), 0)
  // `WAIVE_LINE` đã cộng vào `waivedLines` qua chính dòng — chỉ cộng thêm
  // waiver loại `PARTIAL_DISCOUNT`/`GOODWILL_CREDIT` để tránh tính trùng.
  const waiverAmount = waivers
    .filter((w) => w.type !== 'WAIVE_LINE' && (w.status === 'APPROVED' || w.status === 'PENDING_APPROVAL'))
    .reduce((sum, w) => sum + w.amount, 0)
  const totalDiscount = discountLines + waivedLines + waiverAmount
  const subtotal = gross - totalDiscount
  // TODO(OQ: RentalSettlement-BRD.md §28 Q5/Q6 — VAT; BRD §19 "chưa áp dụng → cấu hình tắt").
  const tax = 0
  // TODO(OQ: RentalSettlement-BRD.md §28 Q5/Q7 — làm tròn 1.000đ/10.000đ, thứ tự discount/VAT/rounding).
  const rounding = 0
  const finalAmount = subtotal + tax + rounding
  return { gross, totalDiscount, subtotal, tax, rounding, finalAmount }
}

/**
 * Suy diễn khi render, KHÔNG lưu, không phải enum — UC-RS-14 A1: PSC `OPEN`
 * gắn Incident đang `DISPUTED` → "Tạm giữ", chặn "Đánh dấu đã tất toán".
 */
export function isPscOnHold(psc: PostSettlementCharge, incidents: Incident[]): boolean {
  if (psc.status !== 'OPEN' || !psc.incidentId) return false
  return incidents.find((i) => i.id === psc.incidentId)?.status === 'DISPUTED'
}

export const NUMERIC_RE = /^\d+$/
