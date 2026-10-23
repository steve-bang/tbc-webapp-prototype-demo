import { useMemo, useState } from 'react'
import { usePermission } from '@/features/auth'
// Deep-import `hooks.ts` theo tiền lệ `SettlementListScreen` — cấm import giá trị runtime từ barrel `vehicles` (vòng barrel).
import { useVehicles } from '@/features/vehicles/hooks'
import { ALLOCATION_TYPES, COST_CATEGORIES, COST_SOURCES, type AllocationType, type CostCategory, type CostSource } from '@/shared/domain/enums'
import { ALLOCATION_TYPE_LABELS, COST_CATEGORY_LABELS, COST_SOURCE_LABELS, vi } from '@/shared/i18n/vi'
import { PageHeader } from '@/shared/layout/PageHeader'
import { formatVnd } from '@/shared/lib/money'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { CostEntryTable } from '../components/CostEntryTable'
import { CostRecordFormDialog } from '../components/CostRecordFormDialog'
import { CostRecordReverseDialog } from '../components/CostRecordReverseDialog'
import { FinancePeriodPicker } from '../components/FinancePeriodPicker'
import { useCostEntries, useCostRecords } from '../hooks'
import { initialPeriodSelection, isDateInPeriod, sumFutureDatedCost, type CostRecord, type PeriodSelection } from '../model'

const ALL = '__ALL__'

/** `WebappQuanTri.md` §11.2 — Chi phí vận hành (`/finance/costs`): chi phí nhập tay + chi phí tự ghi nhận từ sự cố, bảo dưỡng. */
export function CostRecordsScreen() {
  const { can } = usePermission()
  const canCreate = can('FINANCE_REPORT', 'CREATE')

  const { data: entries = [], isLoading } = useCostEntries()
  const { data: records = [] } = useCostRecords({ includeReversed: true })
  const { data: vehicles = [] } = useVehicles()
  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles])
  const recordById = useMemo(() => new Map(records.map((r) => [r.id, r])), [records])

  const [selection, setSelection] = useState<PeriodSelection>(() => initialPeriodSelection('THIS_MONTH'))
  const [source, setSource] = useState<string>(ALL)
  const [category, setCategory] = useState<string>(ALL)
  const [allocation, setAllocation] = useState<string>(ALL)
  const [vehicleId, setVehicleId] = useState<string>(ALL)
  const [showReversed, setShowReversed] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CostRecord | null>(null)
  const [reversing, setReversing] = useState<CostRecord | null>(null)
  const [reverseOpen, setReverseOpen] = useState(false)

  const filteredEntries = useMemo(
    () =>
      entries.filter((e) => {
        if (!isDateInPeriod(e.costDate, selection.period)) return false
        if (source !== ALL && e.source !== source) return false
        if (category !== ALL && e.category !== category) return false
        if (allocation !== ALL && e.allocationType !== allocation) return false
        if (vehicleId !== ALL && e.vehicleId !== vehicleId) return false
        return true
      }),
    [entries, selection.period, source, category, allocation, vehicleId],
  )

  const reversedRecords = useMemo(() => {
    if (!showReversed || (source !== ALL && source !== 'MANUAL')) return []
    return records.filter((r) => {
      if (r.status !== 'REVERSED') return false
      if (!isDateInPeriod(r.costDate, selection.period)) return false
      if (category !== ALL && r.category !== category) return false
      if (allocation !== ALL && r.allocationType !== allocation) return false
      if (vehicleId !== ALL && r.vehicleId !== vehicleId) return false
      return true
    })
  }, [records, showReversed, source, selection.period, category, allocation, vehicleId])

  const totals = useMemo(() => {
    const direct = filteredEntries.filter((e) => e.allocationType === 'DIRECT').reduce((sum, e) => sum + e.amount, 0)
    const indirect = filteredEntries.filter((e) => e.allocationType === 'INDIRECT').reduce((sum, e) => sum + e.amount, 0)
    return { direct, indirect, all: direct + indirect }
  }, [filteredEntries])

  // Chú thích lát chi phí phân bổ có ngày sau hôm nay — chỉ hiển thị, không đổi số liệu (RV-BR-03).
  const [today] = useState(() => new Date()) // mốc "bây giờ"; model quy về ngày +07 qua toDateKey
  const futureCost = useMemo(() => sumFutureDatedCost(filteredEntries, selection.period, today), [filteredEntries, selection.period, today])

  const hasAnyRow = filteredEntries.length > 0 || reversedRecords.length > 0
  const hasActiveFilter = source !== ALL || category !== ALL || allocation !== ALL || vehicleId !== ALL

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }
  function openEdit(record: CostRecord) {
    setEditing(record)
    setFormOpen(true)
  }
  function openReverse(record: CostRecord) {
    setReversing(record)
    setReverseOpen(true)
  }

  return (
    <div>
      <PageHeader
        title={vi.finance.revenueCost.costsTitle}
        description={vi.finance.revenueCost.costsDescription}
        actions={
          canCreate && (
            <Button size="sm" onClick={openCreate}>
              {vi.finance.revenueCost.addCost}
            </Button>
          )
        }
      />

      <div className="mb-4 flex min-w-0 flex-col gap-3">
        <FinancePeriodPicker value={selection} onChange={setSelection} />
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder={vi.finance.revenueCost.filterSource} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{vi.finance.revenueCost.filterSource}: {vi.finance.revenueCost.filterAll}</SelectItem>
              {COST_SOURCES.map((s: CostSource) => (
                <SelectItem key={s} value={s}>
                  {COST_SOURCE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue placeholder={vi.finance.revenueCost.filterCategory} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{vi.finance.revenueCost.filterCategory}: {vi.finance.revenueCost.filterAll}</SelectItem>
              {COST_CATEGORIES.map((c: CostCategory) => (
                <SelectItem key={c} value={c}>
                  {COST_CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={allocation} onValueChange={setAllocation}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder={vi.finance.revenueCost.filterAllocation} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{vi.finance.revenueCost.filterAllocation}: {vi.finance.revenueCost.filterAll}</SelectItem>
              {ALLOCATION_TYPES.map((a: AllocationType) => (
                <SelectItem key={a} value={a}>
                  {ALLOCATION_TYPE_LABELS[a]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={vehicleId} onValueChange={setVehicleId}>
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue placeholder={vi.finance.revenueCost.filterVehicle} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{vi.finance.revenueCost.filterVehicle}: {vi.finance.revenueCost.filterAll}</SelectItem>
              {vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.plate}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Checkbox id="cost-show-reversed" checked={showReversed} onCheckedChange={(checked) => setShowReversed(checked === true)} />
            <Label htmlFor="cost-show-reversed">{vi.finance.revenueCost.showReversed}</Label>
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="border-border rounded-md border p-3 text-sm">
          <p className="text-muted-foreground text-xs">{vi.finance.revenueCost.totalDirect}</p>
          <p className="font-medium">{formatVnd(totals.direct)}</p>
        </div>
        <div className="border-border rounded-md border p-3 text-sm">
          <p className="text-muted-foreground text-xs">{vi.finance.revenueCost.totalIndirect}</p>
          <p className="font-medium">{formatVnd(totals.indirect)}</p>
        </div>
        <div className="border-border rounded-md border p-3 text-sm">
          <p className="text-muted-foreground text-xs">{vi.finance.revenueCost.totalAll}</p>
          <p className="font-medium">{formatVnd(totals.all)}</p>
        </div>
      </div>
      {futureCost > 0 && <p className="text-muted-foreground -mt-2 mb-4 text-xs">{vi.finance.reports.futureCostNote.replace('{amount}', formatVnd(futureCost))}</p>}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
      ) : !hasAnyRow ? (
        <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <p className="font-medium">{hasActiveFilter ? vi.finance.revenueCost.costsEmptyFiltered : vi.finance.revenueCost.costsEmpty}</p>
          {canCreate && (
            <Button size="sm" variant="outline" onClick={openCreate}>
              {vi.finance.revenueCost.addCost}
            </Button>
          )}
        </div>
      ) : (
        <CostEntryTable entries={filteredEntries} reversedRecords={reversedRecords} recordById={recordById} vehicleById={vehicleById} onEdit={openEdit} onReverse={openReverse} />
      )}

      <CostRecordFormDialog open={formOpen} onOpenChange={setFormOpen} record={editing ?? undefined} />
      <CostRecordReverseDialog record={reversing} open={reverseOpen} onOpenChange={setReverseOpen} />
    </div>
  )
}
