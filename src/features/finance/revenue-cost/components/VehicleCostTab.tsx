import { useMemo, useState } from 'react'
import { usePermission } from '@/features/auth'
import type { Vehicle } from '@/features/vehicles'
import { COST_CATEGORY_LABELS, REVENUE_RECOGNITION_POLICY_LABELS, vi } from '@/shared/i18n/vi'
import { formatVnd } from '@/shared/lib/money'
import { Button } from '@/shared/ui/button'
import { useCostEntries, useCostRecords } from '../hooks'
import {
  REVENUE_RECOGNITION_POLICY,
  breakdownCostByCategory,
  initialPeriodSelection,
  isDateInPeriod,
  summarizePeriod,
  type CostRecord,
  type PeriodSelection,
} from '../model'
import { CostEntryTable } from './CostEntryTable'
import { CostRecordFormDialog } from './CostRecordFormDialog'
import { CostRecordReverseDialog } from './CostRecordReverseDialog'
import { FinancePeriodPicker } from './FinancePeriodPicker'

/**
 * Tab "Chi phí" của Vehicle Detail — `docs/REVENUE-COST-PLAN.md` §11.2: chi phí trực tiếp của xe (nhập tay + sự cố + bảo dưỡng).
 * Thêm chi phí khoá sẵn `DIRECT` + xe này. Gate xem `VEHICLE.EXPORT` do màn cha; nút Thêm/Sửa/Huỷ theo `FINANCE_REPORT.*`.
 */
export function VehicleCostTab({ vehicle, initialSelection }: { vehicle: Vehicle; initialSelection?: PeriodSelection }) {
  const { can } = usePermission()
  const canCreate = can('FINANCE_REPORT', 'CREATE')

  // `initialSelection` (drill-down từ Báo cáo tài chính) — mặc định giữ 12 tháng gần nhất như ở Vehicle Detail.
  const [selection, setSelection] = useState<PeriodSelection>(() => initialSelection ?? initialPeriodSelection('LAST_12_MONTHS'))
  const { data: entries = [], isLoading } = useCostEntries({ vehicleId: vehicle.id })
  const { data: records = [] } = useCostRecords({ vehicleId: vehicle.id, includeReversed: true })
  const recordById = useMemo(() => new Map(records.map((r) => [r.id, r])), [records])

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CostRecord | null>(null)
  const [reversing, setReversing] = useState<CostRecord | null>(null)
  const [reverseOpen, setReverseOpen] = useState(false)

  const periodEntries = useMemo(() => entries.filter((e) => isDateInPeriod(e.costDate, selection.period)), [entries, selection.period])
  const summary = useMemo(() => summarizePeriod([], entries, selection.period), [entries, selection.period])
  const breakdown = useMemo(() => breakdownCostByCategory(periodEntries), [periodEntries])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
        <FinancePeriodPicker value={selection} onChange={setSelection} />
        {canCreate && (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            {vi.finance.revenueCost.addCostForVehicle}
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-xs">
        {vi.finance.revenueCost.recognitionNote} ({REVENUE_RECOGNITION_POLICY_LABELS[REVENUE_RECOGNITION_POLICY]})
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="border-border rounded-md border p-3 text-sm">
          <p className="text-muted-foreground text-xs">{vi.finance.revenueCost.costTabDirectCard}</p>
          <p className="font-medium">{formatVnd(summary.directCost)}</p>
        </div>
        <div className="border-border rounded-md border p-3 text-sm">
          <p className="text-muted-foreground mb-1 text-xs">{vi.finance.revenueCost.costBreakdownTitle}</p>
          {breakdown.length === 0 ? (
            <p className="text-muted-foreground">{vi.common.emptyValue}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {breakdown.map((row) => (
                <li key={row.category} className="flex min-w-0 items-center justify-between gap-2">
                  <span className="min-w-0 truncate">
                    {COST_CATEGORY_LABELS[row.category]}
                    <span className="text-muted-foreground text-xs"> · {vi.finance.revenueCost.costBreakdownCount.replace('{count}', String(row.count))}</span>
                  </span>
                  <span className="font-medium whitespace-nowrap">{formatVnd(row.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
      ) : periodEntries.length === 0 ? (
        <p className="text-muted-foreground text-sm">{vi.finance.revenueCost.costTabEmpty}</p>
      ) : (
        <CostEntryTable
          entries={periodEntries}
          recordById={recordById}
          onEdit={(record) => {
            setEditing(record)
            setFormOpen(true)
          }}
          onReverse={(record) => {
            setReversing(record)
            setReverseOpen(true)
          }}
        />
      )}

      <CostRecordFormDialog open={formOpen} onOpenChange={setFormOpen} record={editing ?? undefined} lockedVehicleId={vehicle.id} />
      <CostRecordReverseDialog record={reversing} open={reverseOpen} onOpenChange={setReverseOpen} />
    </div>
  )
}
