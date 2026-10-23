import { VEHICLES_STORAGE_KEY } from '@/features/vehicles/api'
import type { Vehicle } from '@/features/vehicles'
import { readJson, writeJson } from '@/shared/lib/storage'
import type { ConsignmentContract, ConsignmentHandoverRecord, VehicleOwner } from './model'
import type { OwnerPayoutRecord } from './payoutModel'
import type { ConsignmentProposal } from './proposalModel'

/**
 * Storage key + hàm đọc/ghi dùng chung trong feature Xe ký gửi. Tách khỏi `api.ts` để `api.ts` (hợp đồng — kết thúc
 * hợp đồng phải ghi khoản chi trả) và `payoutApi.ts` (khoản chi trả) cùng dùng mà không import lẫn nhau.
 */

export const VEHICLE_OWNERS_STORAGE_KEY = 'vehicleOwners'
export const CONSIGNMENT_CONTRACTS_STORAGE_KEY = 'consignmentContracts'
export const CONSIGNMENT_HANDOVER_RECORDS_STORAGE_KEY = 'consignmentHandoverRecords'
export const OWNER_PAYOUT_RECORDS_STORAGE_KEY = 'ownerPayoutRecords'
export const CONSIGNMENT_PROPOSALS_STORAGE_KEY = 'consignmentProposals'

export function readOwners(): VehicleOwner[] {
  return readJson<VehicleOwner[]>(VEHICLE_OWNERS_STORAGE_KEY) ?? []
}
export function writeOwners(items: VehicleOwner[]): void {
  writeJson(VEHICLE_OWNERS_STORAGE_KEY, items)
}
export function readContracts(): ConsignmentContract[] {
  return readJson<ConsignmentContract[]>(CONSIGNMENT_CONTRACTS_STORAGE_KEY) ?? []
}
export function writeContracts(items: ConsignmentContract[]): void {
  writeJson(CONSIGNMENT_CONTRACTS_STORAGE_KEY, items)
}
export function readRecords(): ConsignmentHandoverRecord[] {
  return readJson<ConsignmentHandoverRecord[]>(CONSIGNMENT_HANDOVER_RECORDS_STORAGE_KEY) ?? []
}
export function writeRecords(items: ConsignmentHandoverRecord[]): void {
  writeJson(CONSIGNMENT_HANDOVER_RECORDS_STORAGE_KEY, items)
}
export function readPayoutRecords(): OwnerPayoutRecord[] {
  return readJson<OwnerPayoutRecord[]>(OWNER_PAYOUT_RECORDS_STORAGE_KEY) ?? []
}
export function writePayoutRecords(items: OwnerPayoutRecord[]): void {
  writeJson(OWNER_PAYOUT_RECORDS_STORAGE_KEY, items)
}
export function readProposals(): ConsignmentProposal[] {
  return readJson<ConsignmentProposal[]>(CONSIGNMENT_PROPOSALS_STORAGE_KEY) ?? []
}
export function writeProposals(items: ConsignmentProposal[]): void {
  writeJson(CONSIGNMENT_PROPOSALS_STORAGE_KEY, items)
}
export function readVehicles(): Vehicle[] {
  return readJson<Vehicle[]>(VEHICLES_STORAGE_KEY) ?? []
}
