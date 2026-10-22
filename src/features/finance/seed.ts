// Composition root của seed finance — đăng ký 5 bước đúng thứ tự cũ (docs/FINANCE-REFACTOR-PLAN.md §3.4).
// Hàm seed của từng module chỉ `export`, không tự `registerSeedStep`.
import { registerSeedStep } from '@/shared/fixtures/seedAll'
import { seedPaymentRound1, seedPaymentRound2 } from './payment/seed'
import { seedRevenueCost, seedRevenueHistory } from './revenue-cost/seed'
import { seedFinance } from './settlement/seed'

// PAYMENT-PLAN.md §8.1 — chạy TRƯỚC khối Settlement (seedFinance đọc Rental/HandoverRecord, không phụ thuộc Payment ở Round 1).
registerSeedStep(seedPaymentRound1)
registerSeedStep(seedFinance)

// PAYMENT-PLAN.md §8.1/§10.12 — chạy SAU seedFinance (B đã có Settlement/PSC).
registerSeedStep(seedPaymentRound2)
// REVENUE-COST-PLAN.md §9 — chạy SAU seedPaymentRound2: nối thêm lịch sử doanh thu rồi Cost Record nhập tay.
registerSeedStep(seedRevenueHistory)
registerSeedStep(seedRevenueCost)
