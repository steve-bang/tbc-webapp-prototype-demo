import { LIABILITY_LABELS, vi } from '@/shared/i18n/vi'
import { formatVnd } from '@/shared/lib/money'
import { validateCostAllocation, type Incident } from '../model'

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm">{value || vi.incidents.noValue}</span>
    </div>
  )
}

/**
 * Tab "Trách nhiệm & chi phí" — `docs/DAMAGE-INCIDENT-MANAGEMENT-PLAN.md`
 * §5.2. Chỉ mount khi role hiện tại KHÁC `OPERATION_STAFF` (DI-BR-22, ẩn hẳn
 * tab ở `IncidentDetailScreen`, không chỉ ẩn field trong tab này).
 */
export function IncidentLiabilityTab({ incident }: { incident: Incident }) {
  if (incident.liability === 'UNDETERMINED' && incident.customerCharge === undefined) {
    return <p className="text-muted-foreground text-sm">{vi.incidents.noLiabilityYet}</p>
  }

  const isAllocationValid = validateCostAllocation(incident)

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={vi.incidents.fieldLiability} value={LIABILITY_LABELS[incident.liability]} />
        {incident.liability === 'SHARED' && <Field label={vi.incidents.fieldLiabilityNote} value={incident.liabilityNote} />}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label={vi.incidents.fieldEstimatedCost} value={formatVnd(incident.estimatedCost)} />
        <Field label={vi.incidents.fieldActualCostParts} value={incident.actualCostParts !== undefined ? formatVnd(incident.actualCostParts) : undefined} />
        <Field label={vi.incidents.fieldActualCostLabor} value={incident.actualCostLabor !== undefined ? formatVnd(incident.actualCostLabor) : undefined} />
        <Field label={vi.incidents.fieldActualCostOther} value={incident.actualCostOther !== undefined ? formatVnd(incident.actualCostOther) : undefined} />
        <Field label={vi.incidents.fieldCustomerCharge} value={incident.customerCharge !== undefined ? formatVnd(incident.customerCharge) : undefined} />
        <Field label={vi.incidents.fieldCompanyCost} value={incident.companyCost !== undefined ? formatVnd(incident.companyCost) : undefined} />
        <Field label={vi.incidents.fieldInsuranceCovered} value={incident.insuranceCovered !== undefined ? formatVnd(incident.insuranceCovered) : undefined} />
      </div>

      {!isAllocationValid && <p className="text-destructive text-sm">{vi.incidents.costAllocationWarning}</p>}

      {(incident.insuranceClaimCode || incident.insuranceClaimStatus || incident.insuranceClaimAmount !== undefined) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label={vi.incidents.fieldInsuranceClaimCode} value={incident.insuranceClaimCode} />
          <Field label={vi.incidents.fieldInsuranceClaimStatus} value={incident.insuranceClaimStatus} />
          <Field
            label={vi.incidents.fieldInsuranceClaimAmount}
            value={incident.insuranceClaimAmount !== undefined ? formatVnd(incident.insuranceClaimAmount) : undefined}
          />
        </div>
      )}
    </div>
  )
}
