import { Link } from 'react-router-dom'
import { paths } from '@/app/paths'
// `vehicles` chưa export `useVehicles` qua barrel `index.ts` — deep-import thẳng `hooks.ts`.
import { useVehicles } from '@/features/vehicles/hooks'
import {
  INCIDENT_BASELINE_REFERENCE_LABELS,
  INCIDENT_SOURCE_LABELS,
  INCIDENT_TYPE_LABELS,
  vi,
} from '@/shared/i18n/vi'
import { formatDateTime } from '@/shared/lib/datetime'
import { Badge } from '@/shared/ui/badge'
import { IncidentSeverityBadge } from './IncidentSeverityBadge'
import type { Incident } from '../model'

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm">{value || vi.incidents.noValue}</span>
    </div>
  )
}

/** Tab "Tổng quan" — `docs/DAMAGE-INCIDENT-MANAGEMENT-PLAN.md` §5.2. */
export function IncidentOverviewTab({ incident }: { incident: Incident }) {
  const { data: vehicles = [] } = useVehicles()
  const vehicle = vehicles.find((v) => v.id === incident.vehicleId)

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground text-xs">{vi.incidents.fieldVehicle}</span>
          {vehicle ? (
            <Link to={paths.vehicleDetail(vehicle.id)} className="text-primary text-sm underline underline-offset-2">
              {vehicle.plate} — {vehicle.brand} {vehicle.model}
            </Link>
          ) : (
            <span className="text-sm">{incident.vehicleId}</span>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground text-xs">{vi.incidents.fieldRental}</span>
          {incident.rentalId ? (
            <Link to={paths.rentalDetail(incident.rentalId)} className="text-primary text-sm underline underline-offset-2">
              {incident.rentalId}
            </Link>
          ) : (
            <span className="text-sm">{vi.incidents.noRentalValue}</span>
          )}
        </div>
        <Field label={vi.incidents.fieldSource} value={INCIDENT_SOURCE_LABELS[incident.source]} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label={vi.incidents.fieldType} value={INCIDENT_TYPE_LABELS[incident.type]} />
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground text-xs">{vi.incidents.fieldSeverity}</span>
          <IncidentSeverityBadge severity={incident.severity} />
        </div>
        <Field label={vi.incidents.fieldSafetyImpact} value={incident.safetyImpact ? vi.handoverReturn.yes : vi.handoverReturn.no} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={vi.incidents.fieldLocation} value={incident.location} />
        {incident.baselineReference && (
          <Field label={vi.incidents.fieldBaselineReference} value={INCIDENT_BASELINE_REFERENCE_LABELS[incident.baselineReference]} />
        )}
      </div>

      <Field label={vi.incidents.fieldDescription} value={incident.description} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={vi.incidents.fieldReportedBy} value={`${incident.reportedByName} (${incident.reportedByRole})`} />
        <Field label={vi.incidents.fieldReportedAt} value={formatDateTime(incident.reportedAt)} />
      </div>

      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold">{vi.handoverReturn.sectionMedia}</h4>
        {incident.mediaMeta.length === 0 ? (
          <p className="text-muted-foreground text-sm">{vi.incidents.mediaEmpty}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {incident.mediaMeta.map((m) => (
              <Badge key={m.id} variant="secondary">
                {m.category} · {formatDateTime(m.capturedAt)}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {incident.status === 'CANCELLED' && incident.cancelReason && (
        <Field label={vi.incidents.cancelReasonLabel} value={incident.cancelReason} />
      )}
      {incident.status === 'DISPUTED' && incident.disputeNote && (
        <Field label={vi.incidents.disputeNoteLabel} value={incident.disputeNote} />
      )}
      {incident.status === 'WRITTEN_OFF' && incident.writeOffReason && (
        <Field label={vi.incidents.writeOffReasonLabel} value={incident.writeOffReason} />
      )}
      {incident.status === 'CLOSED_NO_ACTION' && incident.closedNoActionReason && (
        <Field label={vi.incidents.closedNoActionReasonLabel} value={incident.closedNoActionReason} />
      )}
    </div>
  )
}
