import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { paths } from '@/app/paths'
import { usePermission } from '@/features/auth'
import { useVehicle } from '@/features/vehicles/hooks'
import { vi } from '@/shared/i18n/vi'
import { PageHeader } from '@/shared/layout/PageHeader'
import { Button } from '@/shared/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { ConsignmentAuditTab } from '../components/ConsignmentAuditTab'
import { ConsignmentContractFormSheet } from '../components/ConsignmentContractFormSheet'
import { ConsignmentContractOverviewTab } from '../components/ConsignmentContractOverviewTab'
import { ConsignmentContractStatusBadge } from '../components/ConsignmentContractStatusBadge'
import { ConsignmentDraftPreviewDialog } from '../components/ConsignmentDraftPreviewDialog'
import { ConsignmentHandoverRecordsTab } from '../components/ConsignmentHandoverRecordsTab'
import { ConsignmentIntakeDialog } from '../components/ConsignmentIntakeDialog'
import { ConsignmentReasonDialog } from '../components/ConsignmentReasonDialog'
import { ConsignmentSignDialog } from '../components/ConsignmentSignDialog'
import {
  useActivateConsignmentContract,
  useConsignmentContract,
  useConsignmentHandoverRecords,
  useResumeConsignmentContract,
  useReturnConsignmentContractToDraft,
  useSubmitConsignmentContract,
  useSupersedeConsignmentContract,
  useSuspendConsignmentContract,
  useVehicleOwner,
} from '../hooks'
import { isExpiringSoon, toLocalDateKey } from '../model'

type ReasonDialogKind = 'return' | 'suspend' | 'resume' | 'supersede'

/**
 * Chi tiết hợp đồng ký gửi (`/consignment/contracts/:id`) — plan mục 8.4. Thanh hành động theo trạng thái + quyền;
 * nút "Kích hoạt" luôn bấm được ở `SIGNED` để API từ chối khi thiếu biên bản (VC-BR-02 / AC-VC-001).
 */
export function ConsignmentContractDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const { can } = usePermission()
  const canCreate = can('CONSIGNMENT', 'CREATE')
  const canApprove = can('CONSIGNMENT', 'APPROVE')
  const canExecute = can('CONSIGNMENT', 'EXECUTE')
  const canView = can('CONSIGNMENT', 'VIEW')

  const { data: contract, isLoading } = useConsignmentContract(id)
  const { data: owner } = useVehicleOwner(contract?.ownerId)
  const { data: vehicle } = useVehicle(contract?.vehicleId)
  const { data: records } = useConsignmentHandoverRecords(contract ? { contractId: contract.id } : undefined)
  const intake = records?.find((r) => r.type === 'INTAKE')

  const submit = useSubmitConsignmentContract()
  const activate = useActivateConsignmentContract()
  const returnToDraft = useReturnConsignmentContractToDraft()
  const suspend = useSuspendConsignmentContract()
  const resume = useResumeConsignmentContract()
  const supersede = useSupersedeConsignmentContract()

  const [editOpen, setEditOpen] = useState(false)
  const [signOpen, setSignOpen] = useState(false)
  const [intakeOpen, setIntakeOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [reasonKind, setReasonKind] = useState<ReasonDialogKind | undefined>(undefined)

  if (isLoading) {
    return (
      <div>
        <PageHeader title={vi.consignment.contractsTitle} />
        <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
      </div>
    )
  }

  if (!contract) {
    return (
      <div>
        <PageHeader title={vi.consignment.contractsTitle} />
        <p className="text-muted-foreground text-sm">{vi.consignment.notFound}</p>
      </div>
    )
  }

  const current = contract
  const todayKey = toLocalDateKey(new Date())

  async function handleSubmit() {
    try {
      await submit.mutateAsync(current.id)
      toast.success(vi.consignment.submitSuccess)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.consignment.actionError)
    }
  }

  async function handleActivate() {
    try {
      await activate.mutateAsync(current.id)
      toast.success(vi.consignment.activateSuccess)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.consignment.actionError)
    }
  }

  const reasonConfig: Record<
    ReasonDialogKind,
    { title: string; description?: string; successMessage: string; run: (reason: string) => Promise<unknown> }
  > = {
    return: {
      title: vi.consignment.returnDialogTitle,
      successMessage: vi.consignment.returnSuccess,
      run: (reason) => returnToDraft.mutateAsync({ id: current.id, reason }),
    },
    suspend: {
      title: vi.consignment.suspendDialogTitle,
      successMessage: vi.consignment.suspendSuccess,
      run: (reason) => suspend.mutateAsync({ id: current.id, reason }),
    },
    resume: {
      title: vi.consignment.resumeDialogTitle,
      successMessage: vi.consignment.resumeSuccess,
      run: (reason) => resume.mutateAsync({ id: current.id, reason }),
    },
    supersede: {
      title: vi.consignment.supersedeDialogTitle,
      description: vi.consignment.supersedeDialogDescription,
      successMessage: vi.consignment.supersedeSuccess,
      run: (reason) => supersede.mutateAsync({ id: current.id, reason }),
    },
  }
  const activeReason = reasonKind ? reasonConfig[reasonKind] : undefined

  const { status } = current
  const busy = submit.isPending || activate.isPending

  return (
    <div className="flex flex-col gap-5">
      <div className="border-border flex flex-col gap-3 rounded-lg border p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold">{current.contractNo}</h1>
            <ConsignmentContractStatusBadge status={status} expiringSoon={isExpiringSoon(current, todayKey)} />
          </div>
          <p className="text-muted-foreground text-sm">
            {vi.consignment.contractLinkVehicle}:{' '}
            <Link className="text-primary underline-offset-4 hover:underline" to={paths.vehicleDetail(current.vehicleId)}>
              {vehicle?.plate ?? current.vehicleId}
            </Link>{' '}
            · {vi.consignment.contractLinkOwner}:{' '}
            <Link className="text-primary underline-offset-4 hover:underline" to={paths.consignmentOwnerDetail(current.ownerId)}>
              {owner?.fullName ?? current.ownerId}
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canView && (
            <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
              {vi.consignment.actionPreview}
            </Button>
          )}

          {status === 'DRAFT' && canCreate && (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                {vi.consignment.actionEdit}
              </Button>
              <Button size="sm" disabled={busy} onClick={handleSubmit}>
                {vi.consignment.actionSubmit}
              </Button>
            </>
          )}

          {status === 'PENDING_APPROVAL' && canApprove && (
            <>
              <Button size="sm" onClick={() => setSignOpen(true)}>
                {vi.consignment.actionApproveSign}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setReasonKind('return')}>
                {vi.consignment.actionReturnToDraft}
              </Button>
            </>
          )}

          {status === 'SIGNED' && (
            <>
              {canExecute && !intake && (
                <Button size="sm" variant="outline" onClick={() => setIntakeOpen(true)}>
                  {vi.consignment.actionRecordIntake}
                </Button>
              )}
              {canApprove && (
                <Button size="sm" disabled={busy} onClick={handleActivate}>
                  {vi.consignment.actionActivate}
                </Button>
              )}
            </>
          )}

          {status === 'ACTIVE' && canApprove && (
            <Button size="sm" variant="outline" onClick={() => setReasonKind('suspend')}>
              {vi.consignment.actionSuspend}
            </Button>
          )}

          {status === 'SUSPENDED' && canApprove && (
            <Button size="sm" onClick={() => setReasonKind('resume')}>
              {vi.consignment.actionResume}
            </Button>
          )}

          {(status === 'DRAFT' || status === 'PENDING_APPROVAL') && canCreate && (
            <Button size="sm" variant="outline" onClick={() => setReasonKind('supersede')}>
              {vi.consignment.actionSupersede}
            </Button>
          )}
          {status === 'SIGNED' && canApprove && !intake && (
            <Button size="sm" variant="outline" onClick={() => setReasonKind('supersede')}>
              {vi.consignment.actionSupersede}
            </Button>
          )}
        </div>
      </div>

      {status === 'SUSPENDED' && (
        <div className="border-status-pending/40 bg-status-pending/10 text-status-pending rounded-lg border p-3 text-sm">
          {vi.consignment.suspendedBanner}
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList className="max-w-full">
          <TabsTrigger value="overview">{vi.consignment.contractTabOverview}</TabsTrigger>
          <TabsTrigger value="handover">{vi.consignment.contractTabHandover}</TabsTrigger>
          <TabsTrigger value="audit">{vi.consignment.contractTabAudit}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <ConsignmentContractOverviewTab contract={current} />
        </TabsContent>
        <TabsContent value="handover">
          <ConsignmentHandoverRecordsTab contractId={current.id} />
        </TabsContent>
        <TabsContent value="audit">
          <ConsignmentAuditTab contractId={current.id} />
        </TabsContent>
      </Tabs>

      {canCreate && <ConsignmentContractFormSheet contract={current} open={editOpen} onOpenChange={setEditOpen} />}
      {canApprove && <ConsignmentSignDialog contract={current} open={signOpen} onOpenChange={setSignOpen} />}
      {canExecute && <ConsignmentIntakeDialog contract={current} open={intakeOpen} onOpenChange={setIntakeOpen} />}
      <ConsignmentDraftPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        contract={current}
        owner={owner}
        vehicle={vehicle}
        intake={intake}
      />
      {activeReason && (
        <ConsignmentReasonDialog
          open
          onOpenChange={(open) => {
            if (!open) setReasonKind(undefined)
          }}
          title={activeReason.title}
          description={activeReason.description}
          successMessage={activeReason.successMessage}
          onConfirm={activeReason.run}
        />
      )}
    </div>
  )
}
