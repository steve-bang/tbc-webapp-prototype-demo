import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { paths } from '@/app/paths'
import { usePermission } from '@/features/auth'
// `vehicles` chưa export `useVehicles` qua barrel `index.ts` — deep-import thẳng `hooks.ts`.
import { useVehicles } from '@/features/vehicles/hooks'
import { INCIDENT_SEVERITIES, INCIDENT_SOURCES, INCIDENT_STATUSES, type IncidentSeverity, type IncidentSource, type IncidentStatus } from '@/shared/domain/enums'
import { INCIDENT_SEVERITY_LABELS, INCIDENT_SOURCE_LABELS, INCIDENT_STATUS_LABELS, INCIDENT_TYPE_LABELS, LIABILITY_LABELS, vi } from '@/shared/i18n/vi'
import { PageHeader } from '@/shared/layout/PageHeader'
import { formatDateTime } from '@/shared/lib/datetime'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { IncidentCreateDialog } from '../components/IncidentCreateDialog'
import { IncidentSeverityBadge } from '../components/IncidentSeverityBadge'
import { IncidentStatusBadge } from '../components/IncidentStatusBadge'
import { useIncidents } from '../hooks'

/** Giá trị đại diện "Tất cả" trong Select — Radix Select không cho phép value rỗng. */
const ALL = '__ALL__'

/** `docs/DAMAGE-INCIDENT-MANAGEMENT-PLAN.md` §5.1 — danh sách + lọc + tìm theo mã sự cố. */
export function IncidentListScreen() {
  const navigate = useNavigate()
  const { can } = usePermission()
  const canCreate = can('INCIDENT', 'CREATE')

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<IncidentStatus | undefined>(undefined)
  const [severity, setSeverity] = useState<IncidentSeverity | undefined>(undefined)
  const [source, setSource] = useState<IncidentSource | undefined>(undefined)
  const [vehicleId, setVehicleId] = useState<string | undefined>(undefined)
  const [createOpen, setCreateOpen] = useState(false)

  const { data: allIncidents, isLoading } = useIncidents()
  const { data: vehicles = [] } = useVehicles()
  const vehicleById = new Map(vehicles.map((v) => [v.id, v]))

  const filteredIncidents = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (allIncidents ?? [])
      .filter((i) => !status || i.status === status)
      .filter((i) => !severity || i.severity === severity)
      .filter((i) => !source || i.source === source)
      .filter((i) => !vehicleId || i.vehicleId === vehicleId)
      .filter((i) => q.length === 0 || i.incidentCode.toLowerCase().includes(q))
      .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt))
  }, [allIncidents, search, status, severity, source, vehicleId])

  const hasAnyIncident = (allIncidents?.length ?? 0) > 0
  const hasActiveFilter = !!(search.trim() || status || severity || source || vehicleId)

  function openDetail(id: string) {
    navigate(paths.incidentDetail(id))
  }

  return (
    <div>
      <PageHeader
        title={vi.incidents.title}
        description={vi.incidents.description}
        actions={
          canCreate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              {vi.incidents.addButton}
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={vi.incidents.searchPlaceholder} className="max-w-sm flex-1" />
        <Select value={status ?? ALL} onValueChange={(v) => setStatus(v === ALL ? undefined : (v as IncidentStatus))}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder={vi.incidents.filterStatus} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{vi.incidents.filterAllStatuses}</SelectItem>
            {INCIDENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {INCIDENT_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={severity ?? ALL} onValueChange={(v) => setSeverity(v === ALL ? undefined : (v as IncidentSeverity))}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder={vi.incidents.filterSeverity} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{vi.incidents.filterAllSeverities}</SelectItem>
            {INCIDENT_SEVERITIES.map((s) => (
              <SelectItem key={s} value={s}>
                {INCIDENT_SEVERITY_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={source ?? ALL} onValueChange={(v) => setSource(v === ALL ? undefined : (v as IncidentSource))}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder={vi.incidents.filterSource} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{vi.incidents.filterAllSources}</SelectItem>
            {INCIDENT_SOURCES.map((s) => (
              <SelectItem key={s} value={s}>
                {INCIDENT_SOURCE_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={vehicleId ?? ALL} onValueChange={(v) => setVehicleId(v === ALL ? undefined : v)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder={vi.incidents.filterVehicle} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{vi.incidents.filterAllVehicles}</SelectItem>
            {vehicles.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.plate}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
      ) : filteredIncidents.length > 0 ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{vi.incidents.columnCode}</TableHead>
                <TableHead>{vi.incidents.columnVehicle}</TableHead>
                <TableHead>{vi.incidents.columnRental}</TableHead>
                <TableHead>{vi.incidents.columnType}</TableHead>
                <TableHead>{vi.incidents.columnSeverity}</TableHead>
                <TableHead>{vi.common.status}</TableHead>
                <TableHead>{vi.incidents.columnLiability}</TableHead>
                <TableHead>{vi.incidents.columnReportedAt}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredIncidents.map((incident) => {
                const vehicle = vehicleById.get(incident.vehicleId)
                return (
                  <TableRow key={incident.id} className="cursor-pointer" onClick={() => openDetail(incident.id)}>
                    <TableCell className="font-medium">{incident.incidentCode}</TableCell>
                    <TableCell>{vehicle?.plate ?? incident.vehicleId}</TableCell>
                    <TableCell>{incident.rentalId ?? vi.incidents.noRentalValue}</TableCell>
                    <TableCell>{INCIDENT_TYPE_LABELS[incident.type]}</TableCell>
                    <TableCell>
                      <IncidentSeverityBadge severity={incident.severity} />
                    </TableCell>
                    <TableCell>
                      <IncidentStatusBadge status={incident.status} />
                    </TableCell>
                    <TableCell>{LIABILITY_LABELS[incident.liability]}</TableCell>
                    <TableCell>{formatDateTime(incident.reportedAt)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <p className="font-medium">{hasAnyIncident && hasActiveFilter ? vi.incidents.emptyFiltered : vi.incidents.emptyAll}</p>
        </div>
      )}

      {canCreate && <IncidentCreateDialog open={createOpen} onOpenChange={setCreateOpen} />}
    </div>
  )
}
