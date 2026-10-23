import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { paths } from '@/app/paths'
import { usePermission } from '@/features/auth'
import { vi } from '@/shared/i18n/vi'
import { PageHeader } from '@/shared/layout/PageHeader'
import { formatDate } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Button } from '@/shared/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { ConsignmentAppraisalDialog } from '../components/ConsignmentAppraisalDialog'
import { ConsignmentAuditTab } from '../components/ConsignmentAuditTab'
import { ConsignmentContractFormSheet } from '../components/ConsignmentContractFormSheet'
import { ConsignmentContractStatusBadge } from '../components/ConsignmentContractStatusBadge'
import { ConsignmentNoPermission } from '../components/ConsignmentNoPermission'
import { ConsignmentProposalApproveDialog } from '../components/ConsignmentProposalApproveDialog'
import { ConsignmentProposalFormSheet } from '../components/ConsignmentProposalFormSheet'
import { ConsignmentProposalOverviewTab } from '../components/ConsignmentProposalOverviewTab'
import { ConsignmentProposalStatusBadge } from '../components/ConsignmentProposalStatusBadge'
import { ConsignmentReasonDialog } from '../components/ConsignmentReasonDialog'
import {
  useConsignmentContracts,
  useConsignmentProposal,
  useRejectConsignmentProposal,
  useStartConsignmentAppraisal,
  useVehicleOwner,
} from '../hooks'
import { getEffectiveTerm } from '../addendumModel'
import { isExpiringSoon, toLocalDateKey } from '../model'
import { getProposalApprovalBlocker, isProposalConsumed, listProposalContracts } from '../proposalModel'

/** Chi tiết đề nghị ký gửi (`/consignment/proposals/:id`) — gate `CONSIGNMENT.ASSESS`; thanh nút theo trạng thái × quyền. */
export function ConsignmentProposalDetailScreen() {
  const { can } = usePermission()
  if (!can('CONSIGNMENT', 'ASSESS')) return <ConsignmentNoPermission title={vi.consignment.proposals.title} />
  return <ConsignmentProposalDetailScreenContent />
}

function ConsignmentProposalDetailScreenContent() {
  const t = vi.consignment.proposals
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { can } = usePermission()
  const canCreate = can('CONSIGNMENT', 'CREATE')
  const canAssess = can('CONSIGNMENT', 'ASSESS')
  const canApprove = can('CONSIGNMENT', 'APPROVE')
  const canView = can('CONSIGNMENT', 'VIEW')

  const { data: proposal, isLoading } = useConsignmentProposal(id)
  const { data: owner } = useVehicleOwner(proposal?.ownerId)
  const { data: contracts } = useConsignmentContracts()
  const startAppraisal = useStartConsignmentAppraisal()
  const reject = useRejectConsignmentProposal()

  const [editOpen, setEditOpen] = useState(false)
  const [appraisalOpen, setAppraisalOpen] = useState(false)
  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [contractOpen, setContractOpen] = useState(false)

  const linked = useMemo(() => (proposal ? listProposalContracts(proposal, contracts ?? []) : []), [proposal, contracts])

  if (isLoading) {
    return (
      <div>
        <PageHeader title={t.title} />
        <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
      </div>
    )
  }

  if (!proposal) {
    return (
      <div>
        <PageHeader title={t.title} />
        <p className="text-muted-foreground text-sm">{vi.consignment.notFound}</p>
      </div>
    )
  }

  const current = proposal
  const todayKey = toLocalDateKey(new Date())
  const consumed = isProposalConsumed(current, contracts ?? [])
  const approvalBlocker = current.status === 'APPRAISING' ? getProposalApprovalBlocker(current) : undefined

  async function handleStart() {
    try {
      await startAppraisal.mutateAsync(current.id)
      toast.success(t.startSuccess)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.consignment.actionError)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="border-border flex flex-col gap-3 rounded-lg border p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold">{current.code}</h1>
            <ConsignmentProposalStatusBadge status={current.status} />
            {current.status === 'APPROVED' && (
              <span className="text-muted-foreground text-xs">{consumed ? t.usedBadge : t.unusedBadge}</span>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            {t.fieldOwner}:{' '}
            {canView ? (
              <Link className="text-primary underline-offset-4 hover:underline" to={paths.consignmentOwnerDetail(current.ownerId)}>
                {owner?.fullName ?? current.ownerId}
              </Link>
            ) : (
              (owner?.fullName ?? current.ownerId)
            )}{' '}
            · {t.fieldPlate}: {current.declaredVehicle.plate}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {current.status === 'SUBMITTED' && (
            <>
              {canCreate && (
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                  {vi.common.edit}
                </Button>
              )}
              {canAssess && (
                <Button size="sm" disabled={startAppraisal.isPending} onClick={handleStart}>
                  {t.actionStart}
                </Button>
              )}
            </>
          )}

          {current.status === 'APPRAISING' && (
            <>
              {canAssess && (
                <Button size="sm" variant="outline" onClick={() => setAppraisalOpen(true)}>
                  {t.actionRecordAppraisal}
                </Button>
              )}
              {canApprove && (
                <>
                  <Button size="sm" disabled={!!approvalBlocker} onClick={() => setApproveOpen(true)}>
                    {t.actionApprove}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setRejectOpen(true)}>
                    {t.actionReject}
                  </Button>
                </>
              )}
            </>
          )}

          {current.status === 'APPROVED' && !consumed && canCreate && (
            <Button size="sm" onClick={() => setContractOpen(true)}>
              {t.actionDraftContract}
            </Button>
          )}
        </div>
      </div>

      {canApprove && approvalBlocker && (
        <div className="border-status-pending/40 bg-status-pending/10 text-status-pending rounded-lg border p-3 text-sm">
          {approvalBlocker}
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList className="max-w-full">
          <TabsTrigger value="overview">{t.tabOverview}</TabsTrigger>
          <TabsTrigger value="contracts">{t.tabContracts}</TabsTrigger>
          <TabsTrigger value="audit">{vi.consignment.contractTabAudit}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <ConsignmentProposalOverviewTab proposal={current} />
        </TabsContent>
        <TabsContent value="contracts">
          {linked.length === 0 ? (
            <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
              <p className="font-medium">{t.contractsEmpty}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{vi.consignment.contractColumnNo}</TableHead>
                    <TableHead>{vi.common.status}</TableHead>
                    <TableHead>{vi.consignment.contractColumnEffective}</TableHead>
                    <TableHead className="text-right">{vi.consignment.contractColumnAmount}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linked.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        {canView ? (
                          <Link className="text-primary underline-offset-4 hover:underline" to={paths.consignmentContractDetail(c.id)}>
                            {c.contractNo}
                          </Link>
                        ) : (
                          c.contractNo
                        )}
                      </TableCell>
                      <TableCell>
                        <ConsignmentContractStatusBadge status={c.status} expiringSoon={isExpiringSoon(c, todayKey)} />
                      </TableCell>
                      <TableCell>
                        {formatDate(c.effectiveFrom)} – {formatDate(c.effectiveTo)}
                      </TableCell>
                      <TableCell className="text-right">{formatVnd(getEffectiveTerm(c, todayKey).term.fixedMonthlyAmount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
        <TabsContent value="audit">
          <ConsignmentAuditTab proposalId={current.id} />
        </TabsContent>
      </Tabs>

      {canCreate && <ConsignmentProposalFormSheet proposal={current} open={editOpen} onOpenChange={setEditOpen} />}
      {canAssess && <ConsignmentAppraisalDialog proposal={current} open={appraisalOpen} onOpenChange={setAppraisalOpen} />}
      {canApprove && <ConsignmentProposalApproveDialog proposal={current} open={approveOpen} onOpenChange={setApproveOpen} />}
      {canApprove && rejectOpen && (
        <ConsignmentReasonDialog
          open
          onOpenChange={(open) => {
            if (!open) setRejectOpen(false)
          }}
          title={t.rejectDialogTitle}
          description={t.rejectDialogDescription}
          successMessage={t.rejectSuccess}
          onConfirm={(reason) => reject.mutateAsync({ id: current.id, reason })}
        />
      )}
      {canCreate && (
        <ConsignmentContractFormSheet
          open={contractOpen}
          onOpenChange={setContractOpen}
          initialProposalId={current.id}
          onCreated={(created) => navigate(paths.consignmentContractDetail(created.id))}
        />
      )}
    </div>
  )
}
