import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { paths } from '@/app/paths'
// `handover-return`/`rentals` — deep-import `hooks.ts` của feature khác đúng
// tiền lệ `VehicleRentalHistoryTab`.
import { useHandoverRecords, useReturnRecords } from '@/features/handover-return/hooks'
import { useRentals } from '@/features/rentals'
import type { ConditionEventType } from '@/shared/domain/enums'
import { CONDITION_EVENT_TYPE_LABELS, vi } from '@/shared/i18n/vi'
import { formatDateTime } from '@/shared/lib/datetime'
import { Badge } from '@/shared/ui/badge'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { VehicleDetailPlaceholder } from './VehicleDetailPlaceholder'
import type { Vehicle } from '../model'

/** Mốc dùng ở Round 1 — `CONDITION_EVENT_TYPES` còn 3 giá trị khác giữ chỗ cho `VehicleConsignment`/`VehicleMaintenance` round sau. */
const ROUND1_EVENT_TYPES: ConditionEventType[] = ['HANDOVER_BASELINE', 'RETURN', 'INCIDENT']

interface ConditionEvent {
  id: string
  type: ConditionEventType
  at: string
  rentalId: string
  summary: string
}

const ALL = '__ALL__'

/**
 * Tab "Hiện trạng xe" ở Vehicle Detail — Vehicle Condition Timeline **bản đầy
 * đủ** (CR-2026-045), `docs/HANDOVER-RETURN-MANAGEMENT-PLAN.md` §5.4. Tổng
 * hợp runtime (không lưu storage riêng) từ `HandoverRecord`
 * (`HANDOVER_BASELINE`) + `ReturnRecord` (`RETURN`) +
 * `ReturnRecord.incidentItems` (`INCIDENT`) của xe. Hiển thị đầy đủ số liệu
 * (khác bản App rút gọn theo CR-2026-052) — mốc `INCIDENT` chờ
 * `features/incidents` cho chi tiết đầy đủ (Liability/chi phí thực tế/claim).
 */
export function VehicleConditionTimelineTab({ vehicle }: { vehicle: Vehicle }) {
  const { data: rentals = [] } = useRentals({ vehicleId: vehicle.id })
  const { data: handovers = [] } = useHandoverRecords()
  const { data: returns = [] } = useReturnRecords()

  const [typeFilter, setTypeFilter] = useState<ConditionEventType | undefined>()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const rentalIds = useMemo(() => new Set(rentals.map((r) => r.id)), [rentals])

  const events = useMemo<ConditionEvent[]>(() => {
    const result: ConditionEvent[] = []
    for (const h of handovers) {
      if (!rentalIds.has(h.rentalId) || h.status !== 'COMPLETED' || !h.actualPickupDateTime) continue
      result.push({
        id: `hb_${h.id}`,
        type: 'HANDOVER_BASELINE',
        at: h.actualPickupDateTime,
        rentalId: h.rentalId,
        summary: `Odo ${h.odometerHandover?.toLocaleString('vi-VN') ?? '—'} km · Fuel ${h.fuelLevelHandover ?? '—'} · ${h.preExistingConditionItems.length} hư hỏng có sẵn`,
      })
    }
    for (const r of returns) {
      if (!rentalIds.has(r.rentalId) || r.status !== 'COMPLETED' || !r.actualReturnDateTime) continue
      result.push({
        id: `rt_${r.id}`,
        type: 'RETURN',
        at: r.actualReturnDateTime,
        rentalId: r.rentalId,
        summary: `Odo ${r.odometerReturn?.toLocaleString('vi-VN') ?? '—'} km · Fuel ${r.fuelLevelReturn ?? '—'} · ${r.incidentItems.length} sự cố mới`,
      })
      for (const incident of r.incidentItems) {
        result.push({
          id: `inc_${incident.id}`,
          type: 'INCIDENT',
          at: r.actualReturnDateTime,
          rentalId: r.rentalId,
          summary: `${incident.description} — ${vi.handoverReturn.chargeApprovalStatusLabels[incident.chargeApprovalStatus]}`,
        })
      }
    }
    return result
      .filter((e) => !typeFilter || e.type === typeFilter)
      .filter((e) => !dateFrom || e.at.slice(0, 10) >= dateFrom)
      .filter((e) => !dateTo || e.at.slice(0, 10) <= dateTo)
      .sort((a, b) => b.at.localeCompare(a.at))
  }, [handovers, returns, rentalIds, typeFilter, dateFrom, dateTo])

  if (rentals.length === 0 && events.length === 0) {
    return <VehicleDetailPlaceholder note={vi.vehicles.conditionEmpty} />
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Select value={typeFilter ?? ALL} onValueChange={(v) => setTypeFilter(v === ALL ? undefined : (v as ConditionEventType))}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder={vi.vehicles.conditionFilterType} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{vi.vehicles.conditionFilterAllTypes}</SelectItem>
            {ROUND1_EVENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {CONDITION_EVENT_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cond-date-from" className="text-muted-foreground text-xs font-normal">
            {vi.vehicles.conditionFilterDateFrom}
          </Label>
          <Input id="cond-date-from" type="date" className="w-full sm:w-40" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cond-date-to" className="text-muted-foreground text-xs font-normal">
            {vi.vehicles.conditionFilterDateTo}
          </Label>
          <Input id="cond-date-to" type="date" className="w-full sm:w-40" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      {events.length === 0 ? (
        <VehicleDetailPlaceholder note={vi.vehicles.conditionEmpty} />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{vi.vehicles.conditionColumnDate}</TableHead>
                <TableHead>{vi.vehicles.conditionColumnType}</TableHead>
                <TableHead>{vi.vehicles.conditionColumnSummary}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>{formatDateTime(event.at)}</TableCell>
                  <TableCell>
                    <Badge variant={event.type === 'INCIDENT' ? 'warning' : 'info'}>{CONDITION_EVENT_TYPE_LABELS[event.type]}</Badge>
                  </TableCell>
                  <TableCell>
                    {event.summary}
                    {event.type === 'INCIDENT' && <p className="text-muted-foreground mt-1 text-xs">{vi.vehicles.conditionIncidentNotice}</p>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link to={paths.rentalDetail(event.rentalId)} className="text-primary text-sm underline underline-offset-2">
                      {vi.vehicles.conditionViewSourceLink}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
