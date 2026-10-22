import { format } from 'date-fns'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useRentals } from '@/features/rentals'
// Deep-import `hooks.ts` theo tiền lệ `SettlementListScreen` — cấm import giá trị runtime từ barrel `vehicles` (vòng barrel).
import { useVehicles } from '@/features/vehicles/hooks'
import { ALLOCATION_TYPES, type AllocationType } from '@/shared/domain/enums'
import { ALLOCATION_TYPE_LABELS, COST_CATEGORY_LABELS, vi } from '@/shared/i18n/vi'
import { formatDate } from '@/shared/lib/datetime'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import type { CostRecordInput } from '../api'
import { useCreateCostRecord, useUpdateCostRecord } from '../hooks'
import { MANUAL_COST_CATEGORIES, costRecordFormSchema, isManualCostCategory, type CostRecord } from '../model'

const NO_RENTAL = '__NO_RENTAL__'
/** Gợi ý số tháng rải cho loại chi phí thường trả theo năm (BRD §9 — bảo hiểm, đăng kiểm "có thể phân bổ theo kỳ"). */
const SUGGESTED_SPREAD_CATEGORIES = ['INSURANCE', 'INSPECTION']

interface FormState {
  category: string
  amount: string
  costDate: string
  allocationType: AllocationType
  vehicleId: string
  rentalId: string
  spreadMonths: string
  isUnusual: boolean
  evidenceNote: string
  note: string
}

function emptyState(lockedVehicleId?: string): FormState {
  return {
    category: '',
    amount: '',
    costDate: format(new Date(), 'yyyy-MM-dd'),
    allocationType: 'DIRECT',
    vehicleId: lockedVehicleId ?? '',
    rentalId: '',
    spreadMonths: '1',
    isUnusual: false,
    evidenceNote: '',
    note: '',
  }
}

function stateFromRecord(record: CostRecord): FormState {
  return {
    category: record.category,
    amount: String(record.amount),
    costDate: record.costDate,
    allocationType: record.allocationType,
    vehicleId: record.vehicleId ?? '',
    rentalId: record.rentalId ?? '',
    spreadMonths: String(record.spreadMonths),
    isUnusual: record.isUnusual,
    evidenceNote: record.evidenceNote ?? '',
    note: record.note ?? '',
  }
}

/**
 * UC-RV-03/04 — thêm/sửa chi phí nhập tay. Validate qua `costRecordFormSchema.safeParse()` (ngoại lệ form `finance`,
 * `CONVENTIONS.md` §7). `lockedVehicleId` dùng ở tab Chi phí của xe: khoá sẵn `DIRECT` + xe đó.
 * RV-BR-17: gợi ý rõ việc nhập chi phí không tự tạo giao dịch chi.
 */
export function CostRecordFormDialog({
  open,
  onOpenChange,
  record,
  lockedVehicleId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Có → chế độ sửa. */
  record?: CostRecord
  lockedVehicleId?: string
}) {
  const create = useCreateCostRecord()
  const update = useUpdateCostRecord()
  const { data: vehicles = [] } = useVehicles()
  const { data: rentals = [] } = useRentals()

  const [form, setForm] = useState<FormState>(() => emptyState(lockedVehicleId))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setForm(record ? stateFromRecord(record) : emptyState(lockedVehicleId))
      setErrors({})
    }
  }

  const vehicleRentals = useMemo(() => (form.vehicleId ? rentals.filter((r) => r.vehicleId === form.vehicleId) : []), [rentals, form.vehicleId])
  const isDirect = form.allocationType === 'DIRECT'

  function patch(next: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...next }))
    setErrors({})
  }

  function handleCategoryChange(category: string) {
    // Gợi ý rải 12 tháng cho bảo hiểm/đăng kiểm khi người dùng chưa chỉnh số tháng.
    const spreadMonths = SUGGESTED_SPREAD_CATEGORIES.includes(category) && form.spreadMonths === '1' ? '12' : form.spreadMonths
    patch({ category, spreadMonths })
  }

  function handleAllocationChange(value: string) {
    const allocationType = value as AllocationType
    patch(allocationType === 'INDIRECT' ? { allocationType, vehicleId: '', rentalId: '' } : { allocationType })
  }

  async function handleSave() {
    const parsed = costRecordFormSchema.safeParse({
      ...form,
      vehicleId: form.allocationType === 'DIRECT' ? form.vehicleId : undefined,
      rentalId: form.allocationType === 'DIRECT' ? form.rentalId : undefined,
    })
    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form')
        if (!next[key]) next[key] = issue.message
      }
      setErrors(next)
      return
    }
    const values = parsed.data
    if (!isManualCostCategory(values.category)) return
    const input: CostRecordInput = {
      category: values.category,
      amount: Number(values.amount),
      costDate: values.costDate,
      allocationType: values.allocationType,
      vehicleId: values.vehicleId || undefined,
      rentalId: values.rentalId || undefined,
      spreadMonths: Number(values.spreadMonths),
      isUnusual: values.isUnusual,
      evidenceNote: values.evidenceNote || undefined,
      note: values.note || undefined,
    }
    try {
      if (record) {
        await update.mutateAsync({ id: record.id, input })
        toast.success(vi.finance.revenueCost.updateSuccess)
      } else {
        await create.mutateAsync(input)
        toast.success(vi.finance.revenueCost.createSuccess)
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : record ? vi.finance.revenueCost.updateError : vi.finance.revenueCost.createError)
    }
  }

  const pending = create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{record ? vi.finance.revenueCost.formTitleEditWithCode.replace('{code}', record.code) : vi.finance.revenueCost.formTitleCreate}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{vi.finance.revenueCost.categoryLabel} *</Label>
            <Select value={form.category} onValueChange={handleCategoryChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={vi.finance.revenueCost.categoryPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {MANUAL_COST_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {COST_CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && <p className="text-destructive text-sm">{errors.category}</p>}
            {form.category === 'MAINTENANCE' && <p className="text-muted-foreground text-xs">{vi.finance.revenueCost.maintenanceHint}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="cost-amount">{vi.finance.revenueCost.amountLabel} *</Label>
              <Input id="cost-amount" inputMode="numeric" value={form.amount} onChange={(e) => patch({ amount: e.target.value })} />
              {errors.amount && <p className="text-destructive text-sm">{errors.amount}</p>}
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="cost-date">{vi.finance.revenueCost.costDateLabel} *</Label>
              <Input id="cost-date" type="date" max={format(new Date(), 'yyyy-MM-dd')} value={form.costDate} onChange={(e) => patch({ costDate: e.target.value })} />
              {errors.costDate && <p className="text-destructive text-sm">{errors.costDate}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{vi.finance.revenueCost.allocationLabel} *</Label>
            <Select value={form.allocationType} onValueChange={handleAllocationChange} disabled={!!lockedVehicleId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALLOCATION_TYPES.map((a) => (
                  <SelectItem key={a} value={a}>
                    {ALLOCATION_TYPE_LABELS[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isDirect && (
            <div className="flex flex-col gap-1.5">
              <Label>{vi.finance.revenueCost.vehicleLabel} *</Label>
              <Select value={form.vehicleId} onValueChange={(v) => patch({ vehicleId: v, rentalId: '' })} disabled={!!lockedVehicleId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={vi.finance.revenueCost.vehiclePlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.plate} — {v.brand} {v.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.vehicleId && <p className="text-destructive text-sm">{errors.vehicleId}</p>}
            </div>
          )}

          {isDirect && form.vehicleId && (
            <div className="flex flex-col gap-1.5">
              <Label>{vi.finance.revenueCost.rentalLabel}</Label>
              <Select value={form.rentalId || NO_RENTAL} onValueChange={(v) => patch({ rentalId: v === NO_RENTAL ? '' : v })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_RENTAL}>{vi.finance.revenueCost.rentalNone}</SelectItem>
                  {vehicleRentals.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.id} — {formatDate(r.pickupDateTime)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cost-spread">{vi.finance.revenueCost.spreadLabel}</Label>
            <Input id="cost-spread" inputMode="numeric" value={form.spreadMonths} onChange={(e) => patch({ spreadMonths: e.target.value })} className="sm:w-40" />
            <p className="text-muted-foreground text-xs">{vi.finance.revenueCost.spreadHint}</p>
            {errors.spreadMonths && <p className="text-destructive text-sm">{errors.spreadMonths}</p>}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="cost-unusual" checked={form.isUnusual} onCheckedChange={(checked) => patch({ isUnusual: checked === true })} />
            <Label htmlFor="cost-unusual">{vi.finance.revenueCost.unusualLabel}</Label>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cost-evidence">{vi.finance.revenueCost.evidenceLabel}</Label>
            <Input id="cost-evidence" value={form.evidenceNote} onChange={(e) => patch({ evidenceNote: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cost-note">{vi.finance.revenueCost.noteLabel}</Label>
            <Textarea id="cost-note" rows={2} value={form.note} onChange={(e) => patch({ note: e.target.value })} />
          </div>

          <p className="text-muted-foreground text-xs">{vi.finance.revenueCost.paymentHint}</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="button" disabled={pending} onClick={handleSave}>
            {vi.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
