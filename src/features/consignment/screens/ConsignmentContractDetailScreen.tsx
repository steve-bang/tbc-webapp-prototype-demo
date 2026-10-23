import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { paths } from '@/app/paths'
import { usePermission } from '@/features/auth'
import { useVehicle } from '@/features/vehicles/hooks'
import { CONSIGNMENT_END_REASON_LABELS, CONSIGNMENT_TERMINATION_REQUESTER_LABELS, vi } from '@/shared/i18n/vi'
import { formatDate, toDateKey } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { PageHeader } from '@/shared/layout/PageHeader'
import { Button } from '@/shared/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { ConsignmentNoPermission } from '../components/ConsignmentNoPermission'
import { ConsignmentAddendaTab } from '../components/ConsignmentAddendaTab'
import { ConsignmentAddendumDialog } from '../components/ConsignmentAddendumDialog'
import { ConsignmentAuditTab } from '../components/ConsignmentAuditTab'
import { ConsignmentContractFormSheet } from '../components/ConsignmentContractFormSheet'
import { ConsignmentContractOverviewTab } from '../components/ConsignmentContractOverviewTab'
import { ConsignmentContractStatusBadge } from '../components/ConsignmentContractStatusBadge'
import { ConsignmentDraftPreviewDialog } from '../components/ConsignmentDraftPreviewDialog'
import { ConsignmentEndDialog, type ConsignmentEndKind } from '../components/ConsignmentEndDialog'
import { ConsignmentHandoverRecordsTab } from '../components/ConsignmentHandoverRecordsTab'
import { ConsignmentIntakeDialog } from '../components/ConsignmentIntakeDialog'
import { ConsignmentReasonDialog } from '../components/ConsignmentReasonDialog'
import { ConsignmentReturnDialog } from '../components/ConsignmentReturnDialog'
import { ConsignmentSignDialog } from '../components/ConsignmentSignDialog'
import { ConsignmentTerminationNoticeDialog } from '../components/ConsignmentTerminationNoticeDialog'
import { ConsignmentVehicleLossDialog } from '../components/ConsignmentVehicleLossDialog'
import { OwnerPayoutRecordsPanel } from '../components/OwnerPayoutRecordTable'
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
import { getAutoRenewSuggestion, type ConsignmentAddendumOrigin } from '../addendumModel'
import { isExpiringSoon } from '../model'

type ReasonDialogKind = 'return' | 'suspend' | 'resume' | 'supersede'

/**
 * Chi tiết hợp đồng ký gửi (`/consignment/contracts/:id`) — plan mục 8.4. Thanh hành động theo trạng thái + quyền;
 * nút "Kích hoạt" luôn bấm được ở `SIGNED` để API từ chối khi thiếu biên bản (VC-BR-02 / AC-VC-001).
 */
export function ConsignmentContractDetailScreen() {
  const { can } = usePermission()
  if (!can('CONSIGNMENT', 'VIEW')) return <ConsignmentNoPermission title={vi.consignment.contractsTitle} />
  return <ConsignmentContractDetailScreenContent />
}

function ConsignmentContractDetailScreenContent() {
  const navigate = useNavigate()
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
  const returnRecord = records?.find((r) => r.type === 'RETURN')

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
  const [noticeOpen, setNoticeOpen] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [lossOpen, setLossOpen] = useState(false)
  const [endKind, setEndKind] = useState<ConsignmentEndKind | undefined>(undefined)
  const [reasonKind, setReasonKind] = useState<ReasonDialogKind | undefined>(undefined)
  const [addendumOrigin, setAddendumOrigin] = useState<ConsignmentAddendumOrigin | undefined>(undefined)

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
  const todayKey = toDateKey(new Date())

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
      run: async (reason) => {
        // Bản cũ chuyển "Đã thay thế" — chuyển sang bản nháp mới để người dùng chỉnh sửa tiếp.
        const created = await supersede.mutateAsync({ id: current.id, reason })
        navigate(paths.consignmentContractDetail(created.id))
      },
    },
  }
  const activeReason = reasonKind ? reasonConfig[reasonKind] : undefined

  const { status } = current
  const busy = submit.isPending || activate.isPending
  const running = status === 'ACTIVE' || status === 'SUSPENDED'
  const notice = current.terminationNotice
  const expired = current.effectiveTo <= todayKey
  const autoRenewSuggestion = getAutoRenewSuggestion(current, todayKey)

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

          {running && canApprove && !notice && (
            <Button size="sm" variant="outline" onClick={() => setAddendumOrigin('MANUAL')}>
              {vi.consignment.addenda.actionCreate}
            </Button>
          )}
          {running && canApprove && !notice && (
            <Button size="sm" variant="outline" onClick={() => setNoticeOpen(true)}>
              {vi.consignment.termination.actionNotify}
            </Button>
          )}
          {running && canExecute && !current.returnRecordId && (notice || expired) && (
            <Button size="sm" variant="outline" onClick={() => setReturnOpen(true)}>
              {vi.consignment.termination.actionReturn}
            </Button>
          )}
          {running && canApprove && notice && current.returnRecordId && !expired && (
            <Button size="sm" variant="destructive" onClick={() => setEndKind('terminate')}>
              {vi.consignment.termination.actionTerminate}
            </Button>
          )}
          {running && canApprove && expired && current.returnRecordId && (
            <Button size="sm" onClick={() => setEndKind('close')}>
              {vi.consignment.termination.actionClose}
            </Button>
          )}
          {running && canApprove && (
            <Button size="sm" variant="outline" onClick={() => setLossOpen(true)}>
              {vi.consignment.termination.actionLoss}
            </Button>
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

      {autoRenewSuggestion && (
        <div className="border-status-info/40 bg-status-info/10 text-status-info flex flex-col gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">{vi.consignment.addenda.autoRenewBannerTitle}</p>
            <p>
              {vi.consignment.addenda.autoRenewBannerBody(formatDate(current.effectiveTo), formatDate(autoRenewSuggestion.suggestedEffectiveTo))}
            </p>
          </div>
          {canApprove && (
            <Button size="sm" onClick={() => setAddendumOrigin('AUTO_RENEW')}>
              {vi.consignment.addenda.actionAutoRenew}
            </Button>
          )}
        </div>
      )}

      {running && notice && (
        <div className="border-status-info/40 bg-status-info/10 text-status-info rounded-lg border p-3 text-sm">
          <p className="font-medium">
            {vi.consignment.termination.noticeBanner(
              CONSIGNMENT_TERMINATION_REQUESTER_LABELS[notice.requestedBy],
              formatDate(notice.noticeDate),
              formatDate(notice.plannedEndDate),
            )}
          </p>
          <p>{notice.reason}</p>
          <p className="text-xs">{vi.consignment.termination.noticeBannerNote}</p>
        </div>
      )}

      {(status === 'TERMINATED' || status === 'CLOSED') && current.endedDate && (
        <div className="border-border bg-muted/40 rounded-lg border p-3 text-sm">
          <p className="font-medium">
            {current.endReason ? CONSIGNMENT_END_REASON_LABELS[current.endReason] : vi.consignment.termination.endedGeneric} —{' '}
            {vi.consignment.termination.endedOn(formatDate(current.endedDate))}
          </p>
          {notice && (
            <p className="text-muted-foreground">
              {vi.consignment.termination.noticeBanner(
                CONSIGNMENT_TERMINATION_REQUESTER_LABELS[notice.requestedBy],
                formatDate(notice.noticeDate),
                formatDate(notice.plannedEndDate),
              )}
            </p>
          )}
          {returnRecord && (
            <p className="text-muted-foreground">
              {vi.consignment.termination.returnRecordLine(returnRecord.code, formatDate(returnRecord.handoverAt))}
            </p>
          )}
        </div>
      )}

      {current.lossInfo && (
        <div className="border-destructive/40 bg-destructive/10 flex flex-col gap-2 rounded-lg border p-3 text-sm">
          <p className="text-destructive font-medium">{vi.consignment.termination.lossBannerTitle(formatDate(current.lossInfo.eventDate))}</p>
          <p>{current.lossInfo.note}</p>
          <div className="border-border bg-background/60 flex flex-col gap-1 rounded-md border p-2">
            <p className="font-medium">{vi.consignment.termination.lossReferenceTitle}</p>
            <p>
              {vi.consignment.termination.lossAppraised}: {intake?.appraisedValue ? formatVnd(intake.appraisedValue) : vi.consignment.noValue}
              {intake ? ` (${intake.code} — ${formatDate(intake.handoverAt)})` : ''}
            </p>
            <p>{vi.consignment.termination.lossInsuranceNote}</p>
            <p className="text-muted-foreground text-xs">{vi.consignment.termination.lossReferenceNote}</p>
            <div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => toast.success(vi.consignment.exportPdfSuccess)}
              >
                {vi.consignment.exportPdf}
              </Button>
            </div>
          </div>
          <p className="text-status-pending text-xs">{vi.consignment.termination.lossVehicleStatusReminder}</p>
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList className="max-w-full">
          <TabsTrigger value="overview">{vi.consignment.contractTabOverview}</TabsTrigger>
          <TabsTrigger value="addenda">{vi.consignment.addenda.tab}</TabsTrigger>
          <TabsTrigger value="payouts">{vi.consignment.contractTabPayouts}</TabsTrigger>
          <TabsTrigger value="handover">{vi.consignment.contractTabHandover}</TabsTrigger>
          <TabsTrigger value="audit">{vi.consignment.contractTabAudit}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <ConsignmentContractOverviewTab contract={current} todayKey={todayKey} />
        </TabsContent>
        <TabsContent value="addenda">
          <ConsignmentAddendaTab contract={current} todayKey={todayKey} owner={owner} vehicle={vehicle} />
        </TabsContent>
        <TabsContent value="payouts">
          <OwnerPayoutRecordsPanel filter={{ contractId: current.id }} hideColumns={['owner', 'vehicle', 'contract']} />
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
      {canApprove && running && (
        <ConsignmentTerminationNoticeDialog contract={current} open={noticeOpen} onOpenChange={setNoticeOpen} />
      )}
      {canExecute && running && <ConsignmentReturnDialog contract={current} open={returnOpen} onOpenChange={setReturnOpen} />}
      {canApprove && running && <ConsignmentVehicleLossDialog contract={current} open={lossOpen} onOpenChange={setLossOpen} />}
      {canApprove && running && endKind && (
        <ConsignmentEndDialog
          contract={current}
          kind={endKind}
          open
          onOpenChange={(open) => {
            if (!open) setEndKind(undefined)
          }}
        />
      )}
      {canApprove && running && !notice && addendumOrigin && (
        <ConsignmentAddendumDialog
          contract={current}
          origin={addendumOrigin}
          open
          onOpenChange={(open) => {
            if (!open) setAddendumOrigin(undefined)
          }}
        />
      )}
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
