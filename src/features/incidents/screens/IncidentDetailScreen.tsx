import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { usePermission } from '@/features/auth'
import type { IncidentStatus } from '@/shared/domain/enums'
import { INCIDENT_STATUS_LABELS, vi } from '@/shared/i18n/vi'
import { PageHeader } from '@/shared/layout/PageHeader'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { IncidentApproveDialog } from '../components/IncidentApproveDialog'
import { IncidentAssessDialog } from '../components/IncidentAssessDialog'
import { IncidentAuditTab } from '../components/IncidentAuditTab'
import { IncidentCancelDialog } from '../components/IncidentCancelDialog'
import { IncidentCompleteRepairDialog } from '../components/IncidentCompleteRepairDialog'
import { IncidentLiabilityDialog } from '../components/IncidentLiabilityDialog'
import { IncidentLiabilityTab } from '../components/IncidentLiabilityTab'
import { IncidentOverviewTab } from '../components/IncidentOverviewTab'
import { IncidentRepairTab } from '../components/IncidentRepairTab'
import { IncidentStartRepairDialog } from '../components/IncidentStartRepairDialog'
import { IncidentStatusBadge } from '../components/IncidentStatusBadge'
import { useCloseIncident, useIncident } from '../hooks'
import { canApprove, canCancelIncident, canClose, canStartAssessing, canStartRepair } from '../model'

/** 7 mốc chính của vòng đời — nhánh phụ (`CANCELLED`/`DISPUTED`/`WRITTEN_OFF`/`CLOSED_NO_ACTION`) không render stepper, chỉ hiện Badge (§5.2 kế hoạch). */
const MAIN_STEPS: IncidentStatus[] = ['OPEN', 'ASSESSING', 'WAITING_APPROVAL', 'APPROVED', 'IN_REPAIR', 'REPAIRED', 'CLOSED']

function IncidentStepper({ status }: { status: IncidentStatus }) {
  const currentIndex = MAIN_STEPS.indexOf(status)
  if (currentIndex === -1) return null
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      {MAIN_STEPS.map((step, index) => (
        <span
          key={step}
          className={cn(
            'rounded-full px-2 py-0.5',
            index < currentIndex && 'bg-status-done/15 text-status-done',
            index === currentIndex && 'bg-primary text-primary-foreground font-medium',
            index > currentIndex && 'bg-muted text-muted-foreground',
          )}
        >
          {INCIDENT_STATUS_LABELS[step]}
        </span>
      ))}
    </div>
  )
}

/**
 * "Hồ sơ sự cố" — `docs/DAMAGE-INCIDENT-MANAGEMENT-PLAN.md` §5.2. Header
 * stepper + nút hành động theo trạng thái hiện tại + 4 tab. 2 tab "Trách
 * nhiệm & chi phí"/"Sửa chữa" ẩn hoàn toàn khỏi `TabsList` khi role hiện tại
 * là `OPERATION_STAFF` (DI-BR-22, mirror `VehicleDetailScreen` ẩn tab theo
 * quyền).
 */
export function IncidentDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const { can, role } = usePermission()
  const isOperationStaff = role === 'OPERATION_STAFF'

  // Gate quyền — xem ghi chú ở từng action (§1.1 kế hoạch; BA quyết định thêm
  // khi tài liệu không nêu rõ gate cho một bước, ghi chú trong báo cáo bàn giao).
  const canAssess = can('INCIDENT', 'CREATE') // UC-DI-03/04 — actor "Operation Staff/Manager", cùng nhóm quyền với CREATE
  const canSetLiability = can('INCIDENT', 'ASSESS')
  const canApproveAction = can('INCIDENT', 'APPROVE')
  const canEditRepair = can('INCIDENT', 'EDIT')
  const canCloseAction = can('INCIDENT', 'CLOSE')
  const canCancelAction = can('INCIDENT', 'CLOSE') // BA quyết định — không có action riêng trong permissions.ts, mirror bảng quyền BRD §21 (Operation/Accountant đều ✗ cho Huỷ, khớp CLOSE)

  const { data: incident, isLoading } = useIncident(id)
  const closeIncident = useCloseIncident()

  const [assessOpen, setAssessOpen] = useState(false)
  const [liabilityOpen, setLiabilityOpen] = useState(false)
  const [approveOpen, setApproveOpen] = useState(false)
  const [startRepairOpen, setStartRepairOpen] = useState(false)
  const [completeRepairOpen, setCompleteRepairOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  async function handleClose() {
    if (!incident) return
    try {
      await closeIncident.mutateAsync(incident.id)
      toast.success(vi.incidents.closeSuccess)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.incidents.closeError)
    }
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title={vi.incidents.title} />
        <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
      </div>
    )
  }

  if (!incident) {
    return (
      <div>
        <PageHeader title={vi.incidents.title} />
        <p className="text-muted-foreground text-sm">{vi.incidents.notFound}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="border-border flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold">{incident.incidentCode}</h1>
              <IncidentStatusBadge status={incident.status} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canAssess && canStartAssessing(incident) && (
              <Button size="sm" variant="outline" onClick={() => setAssessOpen(true)}>
                {vi.incidents.assessAction}
              </Button>
            )}
            {canSetLiability && (incident.status === 'ASSESSING' || incident.status === 'WAITING_APPROVAL' || incident.status === 'APPROVED') && (
              <Button size="sm" variant="outline" onClick={() => setLiabilityOpen(true)}>
                {vi.incidents.liabilityAction}
              </Button>
            )}
            {canApproveAction && canApprove(incident) && incident.status === 'WAITING_APPROVAL' && (
              <Button size="sm" variant="outline" onClick={() => setApproveOpen(true)}>
                {vi.incidents.approveAction}
              </Button>
            )}
            {canEditRepair && canStartRepair(incident) && (
              <Button size="sm" variant="outline" onClick={() => setStartRepairOpen(true)}>
                {vi.incidents.startRepairAction}
              </Button>
            )}
            {canEditRepair && incident.status === 'IN_REPAIR' && (
              <Button size="sm" variant="outline" onClick={() => setCompleteRepairOpen(true)}>
                {vi.incidents.completeRepairAction}
              </Button>
            )}
            {canCloseAction && canClose(incident) && (
              <Button size="sm" variant="outline" disabled={closeIncident.isPending} onClick={handleClose}>
                {vi.incidents.closeAction}
              </Button>
            )}
            {canCancelAction && canCancelIncident(incident) && (
              <Button size="sm" variant="outline" onClick={() => setCancelOpen(true)}>
                {vi.incidents.cancelAction}
              </Button>
            )}
          </div>
        </div>
        <IncidentStepper status={incident.status} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="max-w-full">
          <TabsTrigger value="overview">{vi.incidents.tabOverview}</TabsTrigger>
          {!isOperationStaff && <TabsTrigger value="liability">{vi.incidents.tabLiability}</TabsTrigger>}
          {!isOperationStaff && <TabsTrigger value="repair">{vi.incidents.tabRepair}</TabsTrigger>}
          <TabsTrigger value="audit">{vi.incidents.tabAudit}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <IncidentOverviewTab incident={incident} />
        </TabsContent>
        {!isOperationStaff && (
          <TabsContent value="liability">
            <IncidentLiabilityTab incident={incident} />
          </TabsContent>
        )}
        {!isOperationStaff && (
          <TabsContent value="repair">
            <IncidentRepairTab incident={incident} />
          </TabsContent>
        )}
        <TabsContent value="audit">
          <IncidentAuditTab incidentId={incident.id} />
        </TabsContent>
      </Tabs>

      <IncidentAssessDialog incident={assessOpen ? incident : null} open={assessOpen} onOpenChange={setAssessOpen} />
      <IncidentLiabilityDialog incident={liabilityOpen ? incident : null} open={liabilityOpen} onOpenChange={setLiabilityOpen} />
      <IncidentApproveDialog incident={approveOpen ? incident : null} open={approveOpen} onOpenChange={setApproveOpen} />
      <IncidentStartRepairDialog incident={startRepairOpen ? incident : null} open={startRepairOpen} onOpenChange={setStartRepairOpen} />
      <IncidentCompleteRepairDialog incident={completeRepairOpen ? incident : null} open={completeRepairOpen} onOpenChange={setCompleteRepairOpen} />
      <IncidentCancelDialog incident={cancelOpen ? incident : null} open={cancelOpen} onOpenChange={setCancelOpen} />
    </div>
  )
}
