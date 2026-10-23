import { z } from 'zod'
import { CONSIGNMENT_PRORATION_RULES } from '@/shared/domain/enums'
import { CONSIGNMENT_CONTRACT_STATUS_LABELS, CONSIGNMENT_PRORATION_RULE_LABELS, vi } from '@/shared/i18n/vi'
import { addMonthsToKey, formatDate, toDateKey } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import {
  addDaysKey,
  CONSIGNMENT_COMPANY_NAME,
  CONSIGNMENT_EXPIRY_REMINDER_DAYS,
  dayDiff,
  maskAccountNumber,
  maskIdNumber,
  resolveTermVersion,
  type ConsignmentContract,
  type ConsignmentPaymentTerm,
  type ConsignmentTermVersion,
  type MergeField,
  type SnapshotVehicleInfo,
  type VehicleOwner,
} from './model'
import {
  buildExpectedPayouts,
  periodOf,
  reconcilePayoutRecords,
  type ContractEndPlan,
  type OwnerPayoutRecord,
} from './payoutModel'

/**
 * Phụ lục hợp đồng ký gửi (`ConsignmentAddendum`) — gia hạn và/hoặc đổi điều khoản chi trả có ngày hiệu lực
 * (`VehicleConsignment-BRD.md` mục 6.2 / 15, VC-BR-05, AC-VC-012; Use Case UC-VC-10). Lưu TRONG `contract.addenda`.
 * Hàm thuần: không đọc storage, không ghi audit, mọi mốc "hôm nay" / "kỳ hiện tại" là tham số.
 * Kế hoạch: `docs/CONSIGNMENT-PLAN.md` mục 20.5.3, 20.6.
 */

const t = vi.consignment.addenda

// ---- Kiểu ----

/** Nguồn phụ lục (mã BA đề xuất): lập tay · lập theo gợi ý tự động gia hạn. */
export const CONSIGNMENT_ADDENDUM_ORIGINS = ['MANUAL', 'AUTO_RENEW'] as const
export type ConsignmentAddendumOrigin = (typeof CONSIGNMENT_ADDENDUM_ORIGINS)[number]

export interface ConsignmentAddendum {
  id: string
  /** `PLKG-000001` tuần tự toàn hệ thống (mã BA đề xuất). */
  addendumNo: string
  origin: ConsignmentAddendumOrigin
  /** Ngày ký phụ lục `YYYY-MM-DD`: từ ngày kích hoạt tới hôm nay. */
  signedDate: string
  extension?: { fromEffectiveTo: string; toEffectiveTo: string }
  /** `from` = điều khoản đang áp tại `effectiveFrom`. */
  termChange?: { effectiveFrom: string; from: ConsignmentPaymentTerm; to: ConsignmentPaymentTerm; versionNo: number }
  content: string
  signedCopy: { fileName: string; uploadedByName: string; uploadedAt: string }
  createdByName: string
  createdAt: string
}

/** Dữ liệu người dùng nhập khi lập phụ lục (chưa có id / mã / `from` / `versionNo`). */
export interface ConsignmentAddendumDraftInput {
  origin: ConsignmentAddendumOrigin
  signedDate: string
  extension?: { toEffectiveTo: string }
  termChange?: { effectiveFrom: string; to: Pick<ConsignmentPaymentTerm, 'fixedMonthlyAmount' | 'paymentDay' | 'prorationRule'> }
  content: string
  signedFileName: string
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/
const NUMERIC_RE = /^\d+$/

// ---- Điều khoản hiện hành ----

/**
 * Điều khoản đang áp dụng tại `todayKey` — dùng cho MỌI chỗ hiển thị mức / ngày chi trả của hợp đồng đã ký (VC-BR-05).
 * Hợp đồng chưa ký (`termVersions` rỗng) rơi về `contract.paymentTerm` ngay trong `resolveTermVersion`.
 */
export function getEffectiveTerm(
  contract: ConsignmentContract,
  todayKey: string,
): { version: ConsignmentTermVersion; term: ConsignmentPaymentTerm } {
  const version = resolveTermVersion(contract, todayKey)
  return { version, term: version.paymentTerm }
}

export type TermVersionState = 'PAST' | 'CURRENT' | 'UPCOMING'

/** Bảng phiên bản điều khoản: đã qua · đang áp dụng · sắp hiệu lực (kèm mã phụ lục nếu có). */
export function listTermVersionStates(
  contract: ConsignmentContract,
  todayKey: string,
): { version: ConsignmentTermVersion; state: TermVersionState; addendumNo?: string }[] {
  if (contract.termVersions.length === 0) return []
  const current = resolveTermVersion(contract, todayKey)
  return [...contract.termVersions]
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
    .map((version) => ({
      version,
      state: version.effectiveFrom > todayKey ? 'UPCOMING' : version.versionNo === current.versionNo ? 'CURRENT' : 'PAST',
      addendumNo: version.addendumId ? contract.addenda.find((a) => a.id === version.addendumId)?.addendumNo : undefined,
    }))
}

/** Ngày 1 của tháng chứa `todayKey`. */
export function monthStartKey(todayKey: string): string {
  return `${todayKey.slice(0, 7)}-01` // date key — không phụ thuộc múi giờ
}

/** Ngày 1 của tháng kế tiếp tháng chứa `todayKey` — ngày hiệu lực gợi ý cho đổi điều khoản. */
export function nextMonthStartKey(todayKey: string): string {
  return addMonthsToKey(monthStartKey(todayKey), 1)
}

/** `effectiveFrom` lớn nhất trong `termVersions` (phiên bản mới nhất, kể cả "sắp hiệu lực"). */
export function latestVersionEffectiveFrom(contract: ConsignmentContract): string {
  return contract.termVersions.reduce((max, v) => (v.effectiveFrom > max ? v.effectiveFrom : max), '')
}

function sameTerm(a: ConsignmentPaymentTerm, b: ConsignmentPaymentTerm): boolean {
  return a.fixedMonthlyAmount === b.fixedMonthlyAmount && a.paymentDay === b.paymentDay && a.prorationRule === b.prorationRule
}

// ---- Điều kiện lập phụ lục ----

/**
 * Điều kiện lập phụ lục (plan mục 20.1 điểm 32, 33, 35): hợp đồng `ACTIVE`/`SUSPENDED` chưa có thông báo chấm dứt, có ít nhất
 * một thay đổi, ngày ký hợp lệ; gia hạn phải kéo dài thêm; đổi điều khoản phải hiệu lực ngày 1 của tháng, không hồi tố,
 * sau phiên bản mới nhất, không vượt ngày hết hạn và thật sự khác điều khoản đang áp dụng. Dùng chung API và UI.
 * TODO(OQ: VehicleConsignment-BRD.md mục 15 — phụ lục hiệu lực giữa tháng; công thức chi trả chưa mô tả cách tách kỳ)
 */
export function getAddendumBlocker(
  contract: ConsignmentContract,
  input: ConsignmentAddendumDraftInput,
  todayKey: string,
): string | undefined {
  if (contract.status !== 'ACTIVE' && contract.status !== 'SUSPENDED') {
    return t.blockerStatus(CONSIGNMENT_CONTRACT_STATUS_LABELS[contract.status])
  }
  if (contract.terminationNotice || contract.endedDate) return t.blockerNotice
  if (!input.extension && !input.termChange) return t.blockerNothing
  if (!DATE_KEY_RE.test(input.signedDate)) return t.signedDateInvalid
  const activatedKey = contract.activatedAt ? toDateKey(contract.activatedAt) : contract.effectiveFrom
  if (input.signedDate < activatedKey) return t.signedDateBeforeActivated
  if (input.signedDate > todayKey) return t.signedDateFuture

  if (input.extension) {
    if (!DATE_KEY_RE.test(input.extension.toEffectiveTo) || input.extension.toEffectiveTo <= contract.effectiveTo) {
      return t.extensionNotLater(formatDate(contract.effectiveTo))
    }
  }

  const change = input.termChange
  if (change) {
    const { effectiveFrom, to } = change
    if (!Number.isInteger(to.fixedMonthlyAmount) || to.fixedMonthlyAmount <= 0) return t.termAmountInvalid
    if (!Number.isInteger(to.paymentDay) || to.paymentDay < 1 || to.paymentDay > 31) return t.termPaymentDayInvalid
    if (!DATE_KEY_RE.test(effectiveFrom) || effectiveFrom.slice(8) !== '01') return t.termDateNotFirst
    // VC-BR-05 — không hồi tố: ngày hiệu lực không trước ngày 1 của tháng hiện tại.
    if (effectiveFrom < monthStartKey(todayKey)) return t.termDateRetroactive
    if (effectiveFrom <= latestVersionEffectiveFrom(contract)) return t.termDateNotAfterLatest
    const newEnd = input.extension?.toEffectiveTo ?? contract.effectiveTo
    if (effectiveFrom > newEnd) return t.termDateAfterEnd
    const applied = resolveTermVersion(contract, effectiveFrom).paymentTerm
    if (sameTerm(applied, { ...applied, ...to })) return t.termSame
  }
  return undefined
}

/**
 * Áp phụ lục lên hợp đồng (plan mục 20.5.3): cập nhật `effectiveTo` nếu gia hạn; nối `termVersions` nếu đổi điều khoản; thêm vào
 * `addenda`. KHÔNG đổi `termsSnapshot`, `paymentTerm` (bản gốc), `status`, `statusHistory`.
 */
export function applyAddendum(contract: ConsignmentContract, addendum: ConsignmentAddendum): ConsignmentContract {
  const termVersions = addendum.termChange
    ? [
        ...contract.termVersions,
        {
          versionNo: addendum.termChange.versionNo,
          effectiveFrom: addendum.termChange.effectiveFrom,
          paymentTerm: { ...addendum.termChange.to },
          source: 'ADDENDUM' as const,
          addendumId: addendum.id,
          createdAt: addendum.createdAt,
        },
      ]
    : contract.termVersions
  return {
    ...contract,
    effectiveTo: addendum.extension?.toEffectiveTo ?? contract.effectiveTo,
    termVersions,
    addenda: [...contract.addenda, addendum],
    updatedAt: addendum.createdAt,
  }
}

/** Kỳ đầu tiên có khoản chi trả có thể bị ảnh hưởng: nhỏ nhất của kỳ ngày hiệu lực đổi điều khoản và kỳ chứa `effectiveTo` cũ. */
export function getAddendumFromPeriod(addendum: Pick<ConsignmentAddendum, 'extension' | 'termChange'>): string | undefined {
  const periods: string[] = []
  if (addendum.termChange) periods.push(periodOf(addendum.termChange.effectiveFrom))
  if (addendum.extension) periods.push(periodOf(addendum.extension.fromEffectiveTo))
  return periods.sort()[0]
}

/**
 * Tính lại khoản chi trả bị ảnh hưởng bởi phụ lục (plan mục 20.1 điểm 34): Record không huỷ kỳ ≥ `fromPeriod` mà số tiền / ngày bao phủ /
 * hạn chi / phiên bản đổi → huỷ + bản thay thế (kế thừa tạm giữ + điều chỉnh); bù kỳ còn thiếu tới `currentPeriod`; Record bị ảnh
 * hưởng đã `PAID` / đang có lệnh chi → `{ error }`. Kỳ trước `fromPeriod` không bao giờ bị đụng tới.
 */
export function planTermsRecalc(
  contractAfter: ConsignmentContract,
  records: OwnerPayoutRecord[],
  fromPeriod: string,
  currentPeriod: string,
): ContractEndPlan | { error: string } {
  const own = records.filter((r) => r.contractId === contractAfter.id && r.status !== 'CANCELLED' && r.period >= fromPeriod)
  const expected = buildExpectedPayouts(contractAfter, currentPeriod).filter((d) => d.period >= fromPeriod)
  return reconcilePayoutRecords(
    own,
    expected,
    (draft, record) =>
      draft.baseAmount === record.baseAmount &&
      draft.coverageFrom === record.coverageFrom &&
      draft.coverageTo === record.coverageTo &&
      draft.dueDate === record.dueDate &&
      draft.termVersionNo === record.termVersionNo,
    { affectedPaid: t.errorAffectedPaid, amountNotPositive: t.errorAmountNotPositive },
  )
}

/** Dựng phụ lục từ dữ liệu nhập: `termChange.from` = điều khoản đang áp tại ngày hiệu lực, `versionNo` = phiên bản kế tiếp. */
export function buildAddendum(
  contract: ConsignmentContract,
  input: ConsignmentAddendumDraftInput,
  meta: { id: string; addendumNo: string; byName: string; now: string },
): ConsignmentAddendum {
  const change = input.termChange
  return {
    id: meta.id,
    addendumNo: meta.addendumNo,
    origin: input.origin,
    signedDate: input.signedDate,
    extension: input.extension
      ? { fromEffectiveTo: contract.effectiveTo, toEffectiveTo: input.extension.toEffectiveTo }
      : undefined,
    termChange: change
      ? {
          effectiveFrom: change.effectiveFrom,
          from: { ...resolveTermVersion(contract, change.effectiveFrom).paymentTerm },
          // CR-2026-050 — chỉ một mô hình FIXED_MONTHLY.
          to: { model: 'FIXED_MONTHLY', ...change.to },
          versionNo: contract.termVersions.reduce((max, v) => Math.max(max, v.versionNo), 0) + 1,
        }
      : undefined,
    content: input.content.trim(),
    signedCopy: { fileName: input.signedFileName.trim(), uploadedByName: meta.byName, uploadedAt: meta.now },
    createdByName: meta.byName,
    createdAt: meta.now,
  }
}

export interface AddendumPlan {
  addendum: ConsignmentAddendum
  contractAfter: ConsignmentContract
  /** Khoản chi trả bị huỷ / thay thế / bù thêm do phụ lục. */
  plan: ContractEndPlan
}

/**
 * Kế hoạch lập phụ lục = điều kiện (`getAddendumBlocker`) + áp phụ lục + tính lại khoản chi trả bị ảnh hưởng. Dùng chung API (ghi)
 * và hộp thoại "xem trước" (không ghi) để hai bên luôn cho cùng kết quả.
 */
export function planAddendum(
  contract: ConsignmentContract,
  records: OwnerPayoutRecord[],
  input: ConsignmentAddendumDraftInput,
  todayKey: string,
  meta: { id: string; addendumNo: string; byName: string; now: string },
): AddendumPlan | { error: string } {
  const blocker = getAddendumBlocker(contract, input, todayKey)
  if (blocker) return { error: blocker }
  const addendum = buildAddendum(contract, input, meta)
  const contractAfter = applyAddendum(contract, addendum)
  const fromPeriod = getAddendumFromPeriod(addendum)
  if (!fromPeriod) return { error: t.blockerNothing }
  const plan = planTermsRecalc(contractAfter, records, fromPeriod, periodOf(todayKey))
  if ('error' in plan) return { error: plan.error }
  return { addendum, contractAfter, plan }
}

// ---- Gợi ý Auto Renew ----

/**
 * Hợp đồng bật tự động gia hạn, đang chạy, chưa có thông báo chấm dứt và còn ≤ 30 ngày tới hạn (kể cả đã quá hạn) → gợi ý ngày hết
 * hạn mới = `effectiveTo` + thời hạn gốc (từ snapshot lúc ký). Không có tác vụ nền — người dùng bấm "Tạo phụ lục gia hạn".
 * TODO(OQ: VehicleConsignment-BRD.md mục 15 — thời hạn gia hạn tự động và việc giữ nguyên điều khoản chưa nêu)
 */
export function getAutoRenewSuggestion(
  contract: ConsignmentContract,
  todayKey: string,
): { suggestedEffectiveTo: string } | undefined {
  if (!contract.autoRenew) return undefined
  if (contract.status !== 'ACTIVE' && contract.status !== 'SUSPENDED') return undefined
  if (contract.terminationNotice || contract.endedDate) return undefined
  if (dayDiff(todayKey, contract.effectiveTo) > CONSIGNMENT_EXPIRY_REMINDER_DAYS) return undefined
  const base = contract.termsSnapshot ?? contract
  const spanDays = dayDiff(base.effectiveFrom, base.effectiveTo)
  if (spanDays <= 0) return undefined
  return { suggestedEffectiveTo: addDaysKey(contract.effectiveTo, spanDays) }
}

// ---- Bảng trường trộn giả lập ----

/**
 * Bảng trường trộn (merge-field) của phụ lục để xem trước / xuất PDF giả lập — KHÔNG soạn điều khoản pháp lý. Số tài khoản
 * và CCCD / MST luôn ở dạng đã che.
 * Mẫu .docx thật do khách cấp sau (CR-2026-049) — chưa map placeholder thật, như `buildMergeFields` của hợp đồng.
 */
export function buildAddendumMergeFields(
  contract: ConsignmentContract,
  addendum: ConsignmentAddendum,
  owner: VehicleOwner,
  vehicle: SnapshotVehicleInfo,
): MergeField[] {
  const termText = (term: ConsignmentPaymentTerm): string =>
    `${formatVnd(term.fixedMonthlyAmount)} · ${vi.consignment.paymentDayValue(term.paymentDay)} · ${CONSIGNMENT_PRORATION_RULE_LABELS[term.prorationRule]}`
  const idValue = owner.ownerType === 'INDIVIDUAL' ? owner.idNumber : owner.taxCode
  const fields: MergeField[] = [
    { group: 'A', placeholder: '{{addendum.no}}', label: t.mergeAddendumNo, value: addendum.addendumNo },
    { group: 'A', placeholder: '{{contract.no}}', label: t.mergeContractNo, value: contract.contractNo },
    { group: 'A', placeholder: '{{company.name}}', label: vi.consignment.mergeCompanyName, value: CONSIGNMENT_COMPANY_NAME },
    { group: 'A', placeholder: '{{owner.fullName}}', label: vi.consignment.mergeOwnerName, value: owner.fullName },
    {
      group: 'A',
      placeholder: '{{owner.idOrTaxCode}}',
      label: vi.consignment.mergeOwnerId,
      value: idValue ? maskIdNumber(idValue) : vi.consignment.noValue,
    },
    {
      group: 'A',
      placeholder: '{{owner.bankAccount}}',
      label: vi.consignment.mergeOwnerBank,
      value: owner.bankAccount
        ? `${maskAccountNumber(owner.bankAccount.accountNumber)} — ${owner.bankAccount.bankName} — ${owner.bankAccount.accountHolder}`
        : vi.consignment.noValue,
    },
    { group: 'A', placeholder: '{{addendum.signedDate}}', label: t.mergeSignedDate, value: formatDate(addendum.signedDate) },
    { group: 'A', placeholder: '{{addendum.content}}', label: t.mergeContent, value: addendum.content },
    { group: 'B', placeholder: '{{vehicle.plate}}', label: vi.consignment.mergeVehiclePlate, value: vehicle.plate },
    {
      group: 'B',
      placeholder: '{{vehicle.brandModel}}',
      label: vi.consignment.mergeVehicleBrandModel,
      value: `${vehicle.brand} ${vehicle.model}`,
    },
  ]
  if (addendum.extension) {
    fields.push(
      {
        group: 'D',
        placeholder: '{{addendum.extension.from}}',
        label: t.mergeOldEnd,
        value: formatDate(addendum.extension.fromEffectiveTo),
      },
      {
        group: 'D',
        placeholder: '{{addendum.extension.to}}',
        label: t.mergeNewEnd,
        value: formatDate(addendum.extension.toEffectiveTo),
      },
    )
  }
  if (addendum.termChange) {
    fields.push(
      {
        group: 'E',
        placeholder: '{{addendum.term.effectiveFrom}}',
        label: t.mergeTermEffective,
        value: formatDate(addendum.termChange.effectiveFrom),
      },
      { group: 'E', placeholder: '{{addendum.term.old}}', label: t.mergeTermOld, value: termText(addendum.termChange.from) },
      { group: 'E', placeholder: '{{addendum.term.new}}', label: t.mergeTermNew, value: termText(addendum.termChange.to) },
    )
  }
  return fields
}

// ---- Form schema (RHF + zodResolver) ----

export interface ConsignmentAddendumSchemaContext {
  currentEffectiveTo: string
  /** Ngày 1 của tháng hiện tại. */
  monthStartKey: string
  latestVersionEffectiveFrom: string
  /** Ngày địa phương của `activatedAt`. */
  activatedKey: string
  todayKey: string
  /** Có quyền `CONSIGNMENT.CONFIG` — thiếu thì không được đổi điều khoản chi trả. */
  canConfig: boolean
}

/** Factory zod (mirror `makeTerminationNoticeSchema`): form lập phụ lục — 2 công tắc "Gia hạn" / "Đổi điều khoản chi trả". */
export function makeConsignmentAddendumSchema(ctx: ConsignmentAddendumSchemaContext) {
  return z
    .object({
      origin: z.enum(CONSIGNMENT_ADDENDUM_ORIGINS),
      extend: z.boolean(),
      toEffectiveTo: z.string(),
      changeTerm: z.boolean(),
      termEffectiveFrom: z.string(),
      fixedMonthlyAmount: z.string().trim(),
      paymentDay: z.string().trim(),
      prorationRule: z.enum(CONSIGNMENT_PRORATION_RULES),
      signedDate: z.string(),
      signedFileName: z.string().trim().min(1, t.signedFileRequired),
      content: z.string().trim().min(3, t.contentRequired),
    })
    .superRefine((v, c) => {
      const add = (path: string, message: string) => c.addIssue({ code: 'custom', path: [path], message })
      if (!v.extend && !v.changeTerm) add('extend', t.blockerNothing)

      if (!DATE_KEY_RE.test(v.signedDate)) add('signedDate', t.signedDateInvalid)
      else if (v.signedDate < ctx.activatedKey) add('signedDate', t.signedDateBeforeActivated)
      else if (v.signedDate > ctx.todayKey) add('signedDate', t.signedDateFuture)

      if (v.extend) {
        if (!DATE_KEY_RE.test(v.toEffectiveTo) || v.toEffectiveTo <= ctx.currentEffectiveTo) {
          add('toEffectiveTo', t.extensionNotLater(formatDate(ctx.currentEffectiveTo)))
        }
      }
      if (v.changeTerm) {
        if (!ctx.canConfig) add('changeTerm', t.termNeedsConfig)
        if (!NUMERIC_RE.test(v.fixedMonthlyAmount) || Number(v.fixedMonthlyAmount) <= 0) add('fixedMonthlyAmount', t.termAmountInvalid)
        if (!NUMERIC_RE.test(v.paymentDay) || Number(v.paymentDay) < 1 || Number(v.paymentDay) > 31) add('paymentDay', t.termPaymentDayInvalid)
        if (!DATE_KEY_RE.test(v.termEffectiveFrom) || v.termEffectiveFrom.slice(8) !== '01') add('termEffectiveFrom', t.termDateNotFirst)
        else if (v.termEffectiveFrom < ctx.monthStartKey) add('termEffectiveFrom', t.termDateRetroactive)
        else if (v.termEffectiveFrom <= ctx.latestVersionEffectiveFrom) add('termEffectiveFrom', t.termDateNotAfterLatest)
        else {
          const end = v.extend && DATE_KEY_RE.test(v.toEffectiveTo) ? v.toEffectiveTo : ctx.currentEffectiveTo
          if (v.termEffectiveFrom > end) add('termEffectiveFrom', t.termDateAfterEnd)
        }
      }
    })
}

export type ConsignmentAddendumFormValues = z.infer<ReturnType<typeof makeConsignmentAddendumSchema>>
