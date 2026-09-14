import { useMemo, useState } from 'react'
import { usePermission } from '@/features/auth'
import type { Vehicle } from '@/features/vehicles'
import { permissionValue } from '@/shared/domain/permissions'
import { PageHeader } from '@/shared/layout/PageHeader'
import { vi } from '@/shared/i18n/vi'
import { formatDate } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import { MaintenanceDueBadge } from '../components/MaintenanceDueBadge'
import { MaintenanceRecordFormDialog } from '../components/MaintenanceRecordFormDialog'
import { MaintenanceRuleFormDialog } from '../components/MaintenanceRuleFormDialog'
import { MaintenanceRuleList } from '../components/MaintenanceRuleList'
import { SparePartRecordFormDialog } from '../components/SparePartRecordFormDialog'
import { VehicleFilterSelect } from '../components/VehicleFilterSelect'
import { useMaintenanceRecords, useMaintenanceRules, useSparePartRecords, useVehicles } from '../hooks'
import { applicableRule, latestOdometerForCategory, maintenanceDueStatus, nextDueKm, type MaintenanceDueStatus } from '../model'

interface DueRow {
  vehicle: Vehicle
  category: string
  nextDue: number
  currentKm: number
  status: MaintenanceDueStatus
}

const STATUS_ORDER: Record<MaintenanceDueStatus, number> = { OVERDUE: 0, DUE_SOON: 1, OK: 2 }

function vehicleLabel(vehicle: Vehicle): string {
  return `${vehicle.plate} — ${vehicle.brand} ${vehicle.model}`
}

/** `UC-MT-01/02/03/04/05` — trang Bảo dưỡng & phụ tùng, 2 tab (CR-2026-039 — giữ một module). */
export function MaintenanceScreen() {
  const { role, can } = usePermission()
  const canCreate = can('MAINTENANCE', 'CREATE')
  const configAllowed = can('MAINTENANCE', 'CONFIG')
  const configTbd = role ? permissionValue(role, 'MAINTENANCE', 'CONFIG') === 'TBD' : false
  const showConfigSection = configAllowed || configTbd

  const [vehicleFilter, setVehicleFilter] = useState<string | undefined>(undefined)
  const [ruleFormOpen, setRuleFormOpen] = useState(false)
  const [recordFormOpen, setRecordFormOpen] = useState(false)
  const [sparePartFormOpen, setSparePartFormOpen] = useState(false)

  const { data: vehicles = [] } = useVehicles()
  const { data: rules = [] } = useMaintenanceRules()
  const { data: records = [] } = useMaintenanceRecords()
  const { data: spareParts = [] } = useSparePartRecords()

  const activeRules = useMemo(() => rules.filter((r) => r.active), [rules])

  const dueRows = useMemo<DueRow[]>(() => {
    // MT §6.3 — với mỗi xe, gom các category có Rule active áp dụng (trực tiếp
    // theo xe hoặc theo dòng xe), rồi resolve đúng 1 Rule bằng applicableRule()
    // (ưu tiên SPECIFIC_VEHICLE — MT-BR-02) để tránh trùng dòng khi có override.
    const rows: DueRow[] = []
    for (const vehicle of vehicles) {
      const categories = new Set(
        activeRules
          .filter(
            (r) =>
              (r.appliesTo === 'SPECIFIC_VEHICLE' && r.vehicleId === vehicle.id) ||
              (r.appliesTo === 'VEHICLE_MODEL' && r.vehicleModel === vehicle.model),
          )
          .map((r) => r.category),
      )
      for (const category of categories) {
        const rule = applicableRule(rules, vehicle, category)
        if (!rule) continue
        const latestOdometer = latestOdometerForCategory(records, vehicle.id, category)
        const nextDue = nextDueKm(rule, latestOdometer)
        rows.push({
          vehicle,
          category,
          nextDue,
          currentKm: vehicle.currentKm,
          status: maintenanceDueStatus(nextDue, vehicle.currentKm),
        })
      }
    }
    return rows
      .filter((row) => !vehicleFilter || row.vehicle.id === vehicleFilter)
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.vehicle.plate.localeCompare(b.vehicle.plate))
  }, [vehicles, rules, activeRules, records, vehicleFilter])

  const historyRecords = useMemo(() => {
    if (!vehicleFilter) return []
    return records
      .filter((r) => r.vehicleId === vehicleFilter)
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [records, vehicleFilter])

  const sparePartRows = useMemo(() => {
    return spareParts
      .filter((r) => !vehicleFilter || r.vehicleId === vehicleFilter)
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [spareParts, vehicleFilter])

  function vehicleOf(vehicleId: string): Vehicle | undefined {
    return vehicles.find((v) => v.id === vehicleId)
  }

  return (
    <div>
      <PageHeader title={vi.maintenance.title} description={vi.maintenance.description} />

      <div className="mb-4">
        <VehicleFilterSelect vehicles={vehicles} value={vehicleFilter} onChange={setVehicleFilter} />
      </div>

      <Tabs defaultValue="maintenance">
        <TabsList>
          <TabsTrigger value="maintenance">{vi.maintenance.tabMaintenance}</TabsTrigger>
          <TabsTrigger value="spareParts">{vi.maintenance.tabSpareParts}</TabsTrigger>
        </TabsList>

        <TabsContent value="maintenance" className="flex flex-col gap-6 pt-4">
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">{vi.maintenance.dueSectionTitle}</h2>
              {canCreate && <Button onClick={() => setRecordFormOpen(true)}>{vi.maintenance.addRecordButton}</Button>}
            </div>

            {dueRows.length === 0 ? (
              <p className="text-muted-foreground text-sm">{vi.maintenance.dueEmpty}</p>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{vi.maintenance.dueColumnVehicle}</TableHead>
                        <TableHead>{vi.maintenance.dueColumnCategory}</TableHead>
                        <TableHead>{vi.maintenance.dueColumnNextDueKm}</TableHead>
                        <TableHead>{vi.maintenance.dueColumnCurrentKm}</TableHead>
                        <TableHead>{vi.common.status}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dueRows.map((row) => (
                        <TableRow key={`${row.vehicle.id}:${row.category}`}>
                          <TableCell className="font-medium">{vehicleLabel(row.vehicle)}</TableCell>
                          <TableCell>{row.category}</TableCell>
                          <TableCell>{row.nextDue.toLocaleString('vi-VN')} km</TableCell>
                          <TableCell>{row.currentKm.toLocaleString('vi-VN')} km</TableCell>
                          <TableCell>
                            <MaintenanceDueBadge status={row.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-col gap-3 md:hidden">
                  {dueRows.map((row) => (
                    <Card key={`${row.vehicle.id}:${row.category}`}>
                      <CardContent className="flex flex-col gap-2 py-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{row.vehicle.plate}</p>
                            <p className="text-muted-foreground text-xs">{row.category}</p>
                          </div>
                          <MaintenanceDueBadge status={row.status} />
                        </div>
                        <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-sm">
                          <span>
                            {vi.maintenance.dueColumnNextDueKm}: {row.nextDue.toLocaleString('vi-VN')} km
                          </span>
                          <span>
                            {vi.maintenance.dueColumnCurrentKm}: {row.currentKm.toLocaleString('vi-VN')} km
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </section>

          {showConfigSection && (
            <section>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold">{vi.maintenance.ruleSectionTitle}</h2>
                {configTbd && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-muted-foreground cursor-help text-xs underline decoration-dotted">
                        {vi.maintenance.configTbdBadge}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{vi.maintenance.configTbdTooltip}</TooltipContent>
                  </Tooltip>
                )}
                {configAllowed && (
                  <Button size="sm" className="ml-auto" onClick={() => setRuleFormOpen(true)}>
                    {vi.maintenance.addRuleButton}
                  </Button>
                )}
              </div>
              <fieldset disabled={!configAllowed} className="disabled:opacity-50">
                <MaintenanceRuleList rules={rules} vehicles={vehicles} canManage={configAllowed} />
              </fieldset>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-base font-semibold">{vi.maintenance.historySectionTitle}</h2>
            {!vehicleFilter ? (
              <p className="text-muted-foreground text-sm">{vi.maintenance.historySelectVehicleHint}</p>
            ) : historyRecords.length === 0 ? (
              <p className="text-muted-foreground text-sm">{vi.maintenance.historyEmpty}</p>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{vi.maintenance.recordDate}</TableHead>
                        <TableHead>{vi.maintenance.recordCategory}</TableHead>
                        <TableHead>{vi.maintenance.recordOdometer}</TableHead>
                        <TableHead>{vi.maintenance.recordCost}</TableHead>
                        <TableHead>{vi.maintenance.recordProvider}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>{formatDate(record.date)}</TableCell>
                          <TableCell className="font-medium">{record.category}</TableCell>
                          <TableCell>{record.odometerAtService.toLocaleString('vi-VN')} km</TableCell>
                          <TableCell>{formatVnd(record.cost)}</TableCell>
                          <TableCell>{record.provider ?? vi.vehicles.noValue}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-col gap-3 md:hidden">
                  {historyRecords.map((record) => (
                    <Card key={record.id}>
                      <CardContent className="flex flex-col gap-1 py-4">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium">{record.category}</p>
                          <p className="text-muted-foreground text-xs">{formatDate(record.date)}</p>
                        </div>
                        <p className="text-muted-foreground text-sm">
                          {record.odometerAtService.toLocaleString('vi-VN')} km · {formatVnd(record.cost)}
                        </p>
                        {record.provider && <p className="text-muted-foreground text-xs">{record.provider}</p>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </section>
        </TabsContent>

        <TabsContent value="spareParts" className="flex flex-col gap-6 pt-4">
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">{vi.maintenance.tabSpareParts}</h2>
              {canCreate && (
                <Button onClick={() => setSparePartFormOpen(true)}>{vi.maintenance.addSparePartButton}</Button>
              )}
            </div>

            {sparePartRows.length === 0 ? (
              <p className="text-muted-foreground text-sm">{vi.maintenance.sparePartHistoryEmpty}</p>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{vi.maintenance.vehicle}</TableHead>
                        <TableHead>{vi.maintenance.sparePartName}</TableHead>
                        <TableHead>{vi.maintenance.sparePartQuantity}</TableHead>
                        <TableHead>{vi.maintenance.sparePartDate}</TableHead>
                        <TableHead>{vi.maintenance.sparePartOdometer}</TableHead>
                        <TableHead>{vi.maintenance.sparePartCost}</TableHead>
                        <TableHead>{vi.maintenance.sparePartProvider}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sparePartRows.map((record) => {
                        const vehicle = vehicleOf(record.vehicleId)
                        return (
                          <TableRow key={record.id}>
                            <TableCell className="font-medium">{vehicle ? vehicle.plate : record.vehicleId}</TableCell>
                            <TableCell>{record.partName}</TableCell>
                            <TableCell>{record.quantity}</TableCell>
                            <TableCell>{formatDate(record.date)}</TableCell>
                            <TableCell>{record.odometerAtReplacement.toLocaleString('vi-VN')} km</TableCell>
                            <TableCell>{formatVnd(record.cost)}</TableCell>
                            <TableCell>{record.provider ?? vi.vehicles.noValue}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-col gap-3 md:hidden">
                  {sparePartRows.map((record) => {
                    const vehicle = vehicleOf(record.vehicleId)
                    return (
                      <Card key={record.id}>
                        <CardContent className="flex flex-col gap-1 py-4">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium">
                              {record.partName} × {record.quantity}
                            </p>
                            <p className="text-muted-foreground text-xs">{formatDate(record.date)}</p>
                          </div>
                          <p className="text-muted-foreground text-sm">{vehicle ? vehicleLabel(vehicle) : record.vehicleId}</p>
                          <p className="text-muted-foreground text-sm">
                            {record.odometerAtReplacement.toLocaleString('vi-VN')} km · {formatVnd(record.cost)}
                          </p>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </>
            )}
          </section>
        </TabsContent>
      </Tabs>

      {canCreate && (
        <MaintenanceRecordFormDialog
          vehicles={vehicles}
          preselectedVehicleId={vehicleFilter}
          open={recordFormOpen}
          onOpenChange={setRecordFormOpen}
        />
      )}
      {canCreate && (
        <SparePartRecordFormDialog
          vehicles={vehicles}
          preselectedVehicleId={vehicleFilter}
          open={sparePartFormOpen}
          onOpenChange={setSparePartFormOpen}
        />
      )}
      {configAllowed && (
        <MaintenanceRuleFormDialog vehicles={vehicles} open={ruleFormOpen} onOpenChange={setRuleFormOpen} />
      )}
    </div>
  )
}
