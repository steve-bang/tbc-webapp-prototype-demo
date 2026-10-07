import { useState } from 'react'
import { Link } from 'react-router-dom'
import { paths } from '@/app/paths'
// `handover-return`/`incidents` — deep-import `hooks.ts` của feature khác,
// cùng tiền lệ `RentalHandoverReturnTab`/`RentalContractTab`
// (`docs/DAMAGE-INCIDENT-MANAGEMENT-PLAN.md` §0.3 — chỉ đọc, không sửa
// `ReturnRecord.incidentItems`).
import { useReturnRecords } from '@/features/handover-return/hooks'
import { usePermission } from '@/features/auth'
import { IncidentCreateDialog, type IncidentFromReturnPrefill } from '@/features/incidents/components/IncidentCreateDialog'
import { IncidentSeverityBadge } from '@/features/incidents/components/IncidentSeverityBadge'
import { IncidentStatusBadge } from '@/features/incidents/components/IncidentStatusBadge'
import { useIncidents } from '@/features/incidents/hooks'
import { INCIDENT_ITEM_TYPE_LABELS, vi } from '@/shared/i18n/vi'
import { formatDateTime } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import type { Rental } from '../model'

/**
 * Tab "Sự cố" ở `RentalDetailScreen` (thay placeholder) —
 * `docs/DAMAGE-INCIDENT-MANAGEMENT-PLAN.md` §5.3. Danh sách `Incident` của
 * Rental (đọc-only trừ nút tạo mới) + card riêng "Sự cố phát hiện khi trả xe
 * (chưa tạo hồ sơ)" cho các `ReturnIncidentItem` chưa có `Incident` tương ứng.
 */
export function RentalIncidentsTab({ rental }: { rental: Rental }) {
  const { can } = usePermission()
  const canCreate = can('INCIDENT', 'CREATE')

  const { data: incidents = [], isLoading: loadingIncidents } = useIncidents({ rentalId: rental.id })
  const { data: returns = [], isLoading: loadingReturns } = useReturnRecords({ rentalId: rental.id })

  const [createOpen, setCreateOpen] = useState(false)
  const [fromReturnPrefill, setFromReturnPrefill] = useState<IncidentFromReturnPrefill | null>(null)

  if (loadingIncidents || loadingReturns) {
    return <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
  }

  const convertedItemIds = new Set(incidents.map((i) => i.returnIncidentItemId).filter((v): v is string => !!v))
  const pendingItems = returns.flatMap((r) =>
    r.incidentItems.filter((item) => !convertedItemIds.has(item.id)).map((item) => ({ returnRecord: r, item })),
  )

  function openCreateFromReturn(returnRecordId: string, itemId: string) {
    const pending = pendingItems.find((p) => p.item.id === itemId)
    if (!pending) return
    setFromReturnPrefill({
      returnRecordId,
      itemId,
      vehicleId: rental.vehicleId,
      rentalId: rental.id,
      typeLabel: INCIDENT_ITEM_TYPE_LABELS[pending.item.type],
      location: pending.item.position,
      description: pending.item.description,
      estimatedCost: pending.item.estimatedCost,
      baselineReference: pending.item.baselineComparison,
      defaultSafetyImpact: pending.item.affectsSafety,
    })
    setCreateOpen(true)
  }

  function openCreateNew() {
    setFromReturnPrefill(null)
    setCreateOpen(true)
  }

  return (
    <div className="flex flex-col gap-5">
      {pendingItems.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-3 py-4">
            <h3 className="text-sm font-semibold">{vi.incidents.rentalTabPendingTitle}</h3>
            <div className="flex flex-col gap-2">
              {pendingItems.map(({ returnRecord, item }) => (
                <div key={item.id} className="border-border flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      {INCIDENT_ITEM_TYPE_LABELS[item.type]} — {item.position ?? vi.incidents.noValue}
                    </span>
                    <span className="text-muted-foreground text-xs">{item.description}</span>
                    <span className="text-muted-foreground text-xs">{formatVnd(item.estimatedCost)}</span>
                  </div>
                  {canCreate && (
                    <Button size="sm" variant="outline" onClick={() => openCreateFromReturn(returnRecord.id, item.id)}>
                      {vi.incidents.rentalTabCreateFromReturnButton}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{vi.incidents.title}</h3>
        {canCreate && (
          <Button size="sm" variant="outline" onClick={openCreateNew}>
            {vi.incidents.rentalTabReportNewButton}
          </Button>
        )}
      </div>

      {incidents.length === 0 ? (
        <p className="text-muted-foreground text-sm">{vi.incidents.rentalTabEmpty}</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{vi.incidents.columnCode}</TableHead>
                <TableHead>{vi.incidents.columnSeverity}</TableHead>
                <TableHead>{vi.common.status}</TableHead>
                <TableHead>{vi.incidents.columnReportedAt}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidents.map((incident) => (
                <TableRow key={incident.id}>
                  <TableCell className="font-medium">{incident.incidentCode}</TableCell>
                  <TableCell>
                    <IncidentSeverityBadge severity={incident.severity} />
                  </TableCell>
                  <TableCell>
                    <IncidentStatusBadge status={incident.status} />
                  </TableCell>
                  <TableCell>{formatDateTime(incident.reportedAt)}</TableCell>
                  <TableCell className="text-right">
                    <Link to={paths.incidentDetail(incident.id)} className="text-primary text-sm underline underline-offset-2">
                      {vi.common.view}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {canCreate && (
        <IncidentCreateDialog open={createOpen} onOpenChange={setCreateOpen} fromReturn={fromReturnPrefill ?? undefined} />
      )}
    </div>
  )
}
