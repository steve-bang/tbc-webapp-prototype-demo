import { z } from 'zod'
import type { Vehicle } from '@/features/vehicles'
import type { ConsignmentProposalStatus } from '@/shared/domain/enums'
import { CONSIGNMENT_CONTRACT_STATUS_LABELS, OWNERSHIP_TYPE_LABELS, vi } from '@/shared/i18n/vi'
import {
  findOpenContractForVehicle,
  INTAKE_CHECKLIST_KEYS,
  INTAKE_DOCUMENT_KEYS,
  type ConsignmentChecklistItem,
  type ConsignmentContract,
} from './model'

/**
 * Đề nghị ký gửi & thẩm định xe (`ConsignmentProposal`) — `VehicleConsignment-BRD.md` mục 7.1, 8; Use Case UC-VC-01/02.
 * Toàn bộ hàm trong file là hàm thuần: không đọc storage, không ghi audit, không tự gọi `new Date()`.
 * Kế hoạch: `docs/CONSIGNMENT-PLAN.md` mục 20.
 */

const t = vi.consignment.proposals

// ---- Kiểu cục bộ (không phải enum nghiệp vụ dùng chung — mã BA đề xuất) ----

/** Kết quả xác minh chủ sở hữu (BRD mục 8): chính chủ · uỷ quyền hợp lệ · không chính chủ / uỷ quyền không đủ. */
export const PROPOSAL_OWNERSHIP_CHECKS = ['REGISTERED_OWNER', 'AUTHORIZED', 'INVALID'] as const
export type ProposalOwnershipCheck = (typeof PROPOSAL_OWNERSHIP_CHECKS)[number]

export type ProposalDocumentKey = (typeof INTAKE_DOCUMENT_KEYS)[number]

export const PROPOSAL_DOCUMENT_LABELS: Record<ProposalDocumentKey, string> = {
  REGISTRATION: vi.consignment.docRegistration,
  INSPECTION: vi.consignment.docInspection,
  INSURANCE: vi.consignment.docInsurance,
}

export const PROPOSAL_CHECKLIST_LABELS: Record<(typeof INTAKE_CHECKLIST_KEYS)[number], string> = {
  EXTERIOR: vi.consignment.checklistExterior,
  INTERIOR: vi.consignment.checklistInterior,
  MECHANICAL: vi.consignment.checklistMechanical,
}

export interface ConsignmentAppraisalDocument {
  key: ProposalDocumentKey
  ok: boolean
  note?: string
}

/** Kết quả thẩm định (BRD mục 8) — ghi được nhiều lần khi `APPRAISING`, bản sau ghi đè (audit giữ before/after). */
export interface ConsignmentAppraisal {
  ownershipCheck: ProposalOwnershipCheck
  documents: ConsignmentAppraisalDocument[]
  checklist: ConsignmentChecklistItem[]
  odoKm: number
  accessories: string[]
  mediaNote?: string
  conditionNote: string
  /** VC-BR-16 — tài liệu tham chiếu, không dùng tính tiền. */
  appraisedValue: number
  /** UC-VC-02 A2 — giấy tờ chưa đạt, chủ xe cam kết bổ sung. */
  pendingDocumentsNote?: string
  appraisedByName: string
  appraisedAt: string
}

export interface ConsignmentProposalVehicle {
  plate: string
  brand: string
  model: string
  manufacturingYear?: number
  color?: string
}

export interface ConsignmentProposalStatusChange {
  from?: ConsignmentProposalStatus
  to: ConsignmentProposalStatus
  at: string
  byName: string
  reason?: string
}

export interface ConsignmentProposal {
  id: string
  /** `DNKG-000001` tuần tự. */
  code: string
  ownerId: string
  /** Thông tin xe do chủ xe khai báo — xe có thể chưa có trong Danh sách xe. */
  declaredVehicle: ConsignmentProposalVehicle
  /** Xe ở Danh sách xe khớp biển số (gán khi ghi nhận nếu đã có; cập nhật khi soạn hợp đồng). */
  vehicleId?: string
  declaredCondition: string
  /** Mức thuê hàng tháng chủ xe kỳ vọng. */
  expectedMonthlyAmount: number
  status: ConsignmentProposalStatus
  appraisal?: ConsignmentAppraisal
  rejectReason?: string
  decidedByName?: string
  decidedAt?: string
  statusHistory: ConsignmentProposalStatusChange[]
  note?: string
  createdByName: string
  createdAt: string
  updatedAt: string
}

// ---- Hàm thuần ----

/** Chuẩn hoá biển số để so khớp — mirror `isPlateTaken` của Danh sách xe. */
export function normalizePlate(plate: string): string {
  return plate.trim().toUpperCase()
}

export function findVehicleByPlate<T extends Pick<Vehicle, 'plate'>>(vehicles: T[], plate: string): T | undefined {
  const normalized = normalizePlate(plate)
  return vehicles.find((v) => normalizePlate(v.plate) === normalized)
}

/** Mọi hợp đồng mang `proposalId` của đề nghị (kể cả bản đã thay thế), cũ → mới. */
export function listProposalContracts(
  proposal: Pick<ConsignmentProposal, 'id'>,
  contracts: ConsignmentContract[],
): ConsignmentContract[] {
  return contracts.filter((c) => c.proposalId === proposal.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/**
 * Đề nghị `APPROVED` được coi là "đã dùng" khi có hợp đồng mang `proposalId` ở trạng thái khác `SUPERSEDED`.
 * Hợp đồng đã kết thúc (`CLOSED`/`TERMINATED`) vẫn giữ đề nghị — ký gửi lại cần đề nghị mới.
 */
export function isProposalConsumed(proposal: Pick<ConsignmentProposal, 'id'>, contracts: ConsignmentContract[]): boolean {
  return listProposalContracts(proposal, contracts).some((c) => c.status !== 'SUPERSEDED')
}

/** Đề nghị đang chiếm biển số: `SUBMITTED`/`APPRAISING`, hoặc `APPROVED` chưa dùng. */
function isProposalPending(proposal: ConsignmentProposal, contracts: ConsignmentContract[]): boolean {
  if (proposal.status === 'SUBMITTED' || proposal.status === 'APPRAISING') return true
  return proposal.status === 'APPROVED' && !isProposalConsumed(proposal, contracts)
}

/**
 * UC-VC-01 bước 4 / A1 — chặn ghi nhận (hoặc duyệt) đề nghị trùng: biển số thuộc xe đang có hợp đồng "mở" (chặt hơn VC-BR-01,
 * BA đề xuất — plan mục 0.3 điểm 3) hoặc đã có đề nghị khác đang xử lý cho cùng biển số. Dùng chung API tạo / sửa / duyệt và UI.
 */
export function getProposalCreateBlocker(
  input: { plate: string; excludeProposalId?: string },
  ctx: { vehicles: Pick<Vehicle, 'id' | 'plate'>[]; contracts: ConsignmentContract[]; proposals: ConsignmentProposal[] },
): string | undefined {
  const vehicle = findVehicleByPlate(ctx.vehicles, input.plate)
  if (vehicle) {
    const open = findOpenContractForVehicle(ctx.contracts, vehicle.id)
    if (open) return t.blockerOpenContract(vehicle.plate, open.contractNo, CONSIGNMENT_CONTRACT_STATUS_LABELS[open.status])
  }
  const normalized = normalizePlate(input.plate)
  const duplicate = ctx.proposals.find(
    (p) =>
      p.id !== input.excludeProposalId &&
      normalizePlate(p.declaredVehicle.plate) === normalized &&
      isProposalPending(p, ctx.contracts),
  )
  if (duplicate) return t.blockerDuplicate(duplicate.declaredVehicle.plate, duplicate.code)
  return undefined
}

/** Mục giấy tờ / hiện trạng chưa đạt của kết quả thẩm định (nhãn tiếng Việt) — chỉ để cảnh báo khi duyệt (UC-VC-02 A2). */
export function listAppraisalIssues(appraisal: ConsignmentAppraisal): string[] {
  const issues: string[] = []
  for (const doc of appraisal.documents) if (!doc.ok) issues.push(t.issueDocument(PROPOSAL_DOCUMENT_LABELS[doc.key]))
  for (const item of appraisal.checklist) {
    if (!item.ok) issues.push(t.issueChecklist(PROPOSAL_CHECKLIST_LABELS[item.item as keyof typeof PROPOSAL_CHECKLIST_LABELS] ?? item.item))
  }
  return issues
}

/**
 * Điều kiện duyệt (plan mục 20.1 điểm 28): `APPRAISING` + đã ghi kết quả thẩm định + định giá > 0 + xác minh chủ sở hữu
 * khác `INVALID` (EX-01: chỉ được từ chối). Giấy tờ chưa đạt KHÔNG chặn — chỉ cảnh báo.
 */
export function getProposalApprovalBlocker(proposal: ConsignmentProposal): string | undefined {
  if (proposal.status !== 'APPRAISING') return t.approveBlockerStatus
  const appraisal = proposal.appraisal
  if (!appraisal) return t.approveBlockerNoAppraisal
  if (!Number.isInteger(appraisal.appraisedValue) || appraisal.appraisedValue <= 0) return t.approveBlockerValue
  if (appraisal.ownershipCheck === 'INVALID') return t.approveBlockerInvalidOwner
  return undefined
}

/** Xe ở Danh sách xe tương ứng đề nghị (theo biển số) — phải có và là xe `CONSIGNED` mới soạn được hợp đồng. */
export function resolveProposalVehicle<T extends Pick<Vehicle, 'plate' | 'ownershipType'>>(
  proposal: Pick<ConsignmentProposal, 'declaredVehicle'>,
  vehicles: T[],
): { vehicle: T } | { error: string } {
  const plate = proposal.declaredVehicle.plate
  const vehicle = findVehicleByPlate(vehicles, plate)
  if (!vehicle) return { error: t.vehicleMissing(plate) }
  if (vehicle.ownershipType !== 'CONSIGNED') return { error: t.vehicleNotConsigned(vehicle.plate, OWNERSHIP_TYPE_LABELS[vehicle.ownershipType]) }
  return { vehicle }
}

/** `SUBMITTED → APPRAISING → APPROVED/REJECTED` (BRD mục 7.1). */
export const PROPOSAL_TRANSITIONS: Record<ConsignmentProposalStatus, ConsignmentProposalStatus[]> = {
  SUBMITTED: ['APPRAISING'],
  APPRAISING: ['APPROVED', 'REJECTED'],
  APPROVED: [],
  REJECTED: [],
}

export function canTransitionProposal(from: ConsignmentProposalStatus, to: ConsignmentProposalStatus): boolean {
  return PROPOSAL_TRANSITIONS[from].includes(to)
}

// ---- Form schema (RHF + zodResolver) ----

const NUMERIC_RE = /^\d+$/

/** Ghi nhận / sửa đề nghị ký gửi (UC-VC-01 bước 3). Field số khai dạng chuỗi trong form rồi đổi sang số ở `toInput`. */
export const consignmentProposalFormSchema = z.object({
  ownerId: z.string().min(1, t.ownerRequired),
  plate: z.string().trim().min(1, t.plateRequired),
  brand: z.string().trim().min(1, t.brandRequired),
  model: z.string().trim().min(1, t.modelRequired),
  manufacturingYear: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || (NUMERIC_RE.test(v) && Number(v) >= 1980 && Number(v) <= 2100), { message: t.yearInvalid }),
  color: z.string().trim().optional(),
  declaredCondition: z.string().trim().min(3, t.conditionRequired),
  expectedMonthlyAmount: z
    .string()
    .trim()
    .refine((v) => NUMERIC_RE.test(v) && Number(v) > 0, { message: t.expectedAmountInvalid }),
  note: z.string().trim().optional(),
})

export type ConsignmentProposalFormValues = z.infer<typeof consignmentProposalFormSchema>

/** Ghi kết quả thẩm định (BRD mục 8): xác minh chủ sở hữu, giấy tờ, checklist, odo, phụ kiện, hiện trạng, định giá. */
export const consignmentAppraisalFormSchema = z.object({
  ownershipCheck: z.enum(PROPOSAL_OWNERSHIP_CHECKS),
  documents: z.array(z.object({ key: z.enum(INTAKE_DOCUMENT_KEYS), ok: z.boolean(), note: z.string().trim().optional() })),
  checklist: z.array(z.object({ item: z.string(), ok: z.boolean(), note: z.string().trim().optional() })),
  odoKm: z.string().trim().refine((v) => NUMERIC_RE.test(v), { message: t.odoInvalid }),
  accessoriesText: z.string().trim().optional(),
  mediaNote: z.string().trim().optional(),
  conditionNote: z.string().trim().min(3, t.conditionNoteRequired),
  appraisedValue: z
    .string()
    .trim()
    .refine((v) => NUMERIC_RE.test(v) && Number(v) > 0, { message: t.appraisedValueInvalid }),
  pendingDocumentsNote: z.string().trim().optional(),
})

export type ConsignmentAppraisalFormValues = z.infer<typeof consignmentAppraisalFormSchema>
