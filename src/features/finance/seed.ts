// Composition root của seed finance — đăng ký 5 bước đúng thứ tự cũ (docs/FINANCE-REFACTOR-PLAN.md §3.4).
// Hàm seed của từng module chỉ `export`, không tự `registerSeedStep`.
import { registerSeedStep } from '@/shared/fixtures/seedAll'
import { seedOwnerPayouts, seedPaymentRound1, seedPaymentRound2 } from './payment/seed'
import { seedDemoRentalHistory, seedRevenueCost, seedRevenueHistory } from './revenue-cost/seed'
import { seedFinance } from './settlement/seed'

// PAYMENT-PLAN.md §8.1 — chạy TRƯỚC khối Settlement (seedFinance đọc Rental/HandoverRecord, không phụ thuộc Payment ở Round 1).
registerSeedStep(seedPaymentRound1)
registerSeedStep(seedFinance)

// PAYMENT-PLAN.md §8.1/§10.12 — chạy SAU seedFinance (B đã có Settlement/PSC).
registerSeedStep(seedPaymentRound2)
// REVENUE-COST-PLAN.md §9 — chạy SAU seedPaymentRound2: nối thêm lịch sử doanh thu rồi Cost Record nhập tay.
registerSeedStep(seedRevenueHistory)
registerSeedStep(seedRevenueCost)
// docs/CONSIGNMENT-PLAN.md §19.9.2 — chạy CUỐI: giao dịch chi trả chủ xe khớp lịch chi trả của features/consignment (đã seed trước finance).
registerSeedStep(seedOwnerPayouts)
// docs/DEMO-DATA-PLAN.md §3.3 — chạy SAU CÙNG (sau seedOwnerPayouts): lịch thu/giao dịch/quyết toán cho lượt thuê demo rt_040… (giữ nguyên mã GD-/CK- cũ).
registerSeedStep(seedDemoRentalHistory)
