import { ASSIGNMENTS_STORAGE_KEY, EMPLOYEES_STORAGE_KEY } from '@/features/employees'
import { CONSIGNMENT_CONTRACTS_STORAGE_KEY, OWNER_PAYOUT_RECORDS_STORAGE_KEY } from '@/features/consignment'
import { CONTRACTS_STORAGE_KEY } from '@/features/contracts'
import { PAYMENT_REQUESTS_STORAGE_KEY, SETTLEMENTS_STORAGE_KEY, TRANSACTIONS_STORAGE_KEY } from '@/features/finance'
import { INCIDENTS_STORAGE_KEY } from '@/features/incidents'
import { MAINTENANCE_RECORDS_STORAGE_KEY, MAINTENANCE_RULES_STORAGE_KEY } from '@/features/maintenance'
import { RENTALS_STORAGE_KEY } from '@/features/rentals'
import { VEHICLES_STORAGE_KEY } from '@/features/vehicles'
import type { OperationalSignal } from '@/shared/domain/alerts'
import { fakeRequest } from '@/shared/lib/fakeNetwork'
import { readJson } from '@/shared/lib/storage'
import { collectAllSignals, type SignalSources } from './model'

function readSources(): SignalSources {
  return {
    vehicles: readJson<SignalSources['vehicles']>(VEHICLES_STORAGE_KEY) ?? [],
    maintenanceRules: readJson<SignalSources['maintenanceRules']>(MAINTENANCE_RULES_STORAGE_KEY) ?? [],
    maintenanceRecords: readJson<SignalSources['maintenanceRecords']>(MAINTENANCE_RECORDS_STORAGE_KEY) ?? [],
    rentals: readJson<SignalSources['rentals']>(RENTALS_STORAGE_KEY) ?? [],
    contracts: readJson<SignalSources['contracts']>(CONTRACTS_STORAGE_KEY) ?? [],
    paymentRequests: readJson<SignalSources['paymentRequests']>(PAYMENT_REQUESTS_STORAGE_KEY) ?? [],
    transactions: readJson<SignalSources['transactions']>(TRANSACTIONS_STORAGE_KEY) ?? [],
    settlements: readJson<SignalSources['settlements']>(SETTLEMENTS_STORAGE_KEY) ?? [],
    incidents: readJson<SignalSources['incidents']>(INCIDENTS_STORAGE_KEY) ?? [],
    employees: readJson<SignalSources['employees']>(EMPLOYEES_STORAGE_KEY) ?? [],
    assignments: readJson<SignalSources['assignments']>(ASSIGNMENTS_STORAGE_KEY) ?? [],
    consignmentContracts: readJson<SignalSources['consignmentContracts']>(CONSIGNMENT_CONTRACTS_STORAGE_KEY) ?? [],
    ownerPayoutRecords: readJson<SignalSources['ownerPayoutRecords']>(OWNER_PAYOUT_RECORDS_STORAGE_KEY) ?? [],
  }
}

/**
 * Tín hiệu cảnh báo vận hành, tính động từ dữ liệu nguồn — KHÔNG ghi gì (Round 1, DASHBOARD-PLATFORM-PLAN.md D4).
 * Ngoại lệ kiến trúc E1: đọc storage của 8 feature qua storage key export ở barrel.
 */
export async function listOperationalSignals(): Promise<OperationalSignal[]> {
  return fakeRequest(() => collectAllSignals(readSources(), new Date()))
}
