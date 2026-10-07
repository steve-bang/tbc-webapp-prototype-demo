import { vi } from '@/shared/i18n/vi'
import { formatDateTime } from '@/shared/lib/datetime'
import type { Incident } from '../model'

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm">{value || vi.incidents.noValue}</span>
    </div>
  )
}

/**
 * Tab "Sửa chữa" — `docs/DAMAGE-INCIDENT-MANAGEMENT-PLAN.md` §5.2. Chỉ mount
 * khi role hiện tại KHÁC `OPERATION_STAFF` (DI-BR-22).
 */
export function IncidentRepairTab({ incident }: { incident: Incident }) {
  if (!incident.repairVendorName) {
    return <p className="text-muted-foreground text-sm">{vi.incidents.noRepairYet}</p>
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label={vi.incidents.fieldRepairVendor} value={incident.repairVendorName} />
        <Field label={vi.incidents.fieldRepairStartDate} value={incident.repairStartDate && formatDateTime(incident.repairStartDate)} />
        <Field label={vi.incidents.fieldRepairEndDate} value={incident.repairEndDate && formatDateTime(incident.repairEndDate)} />
      </div>
      <Field label={vi.incidents.fieldRepairInvoice} value={incident.repairInvoiceMeta?.note} />
    </div>
  )
}
