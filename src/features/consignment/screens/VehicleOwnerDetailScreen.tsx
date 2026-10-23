import { Pencil } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { paths } from '@/app/paths'
import { usePermission } from '@/features/auth'
import { useVehicles } from '@/features/vehicles/hooks'
import { CONSIGNMENT_PRORATION_RULE_LABELS, OWNER_TYPE_LABELS, vi } from '@/shared/i18n/vi'
import { PageHeader } from '@/shared/layout/PageHeader'
import { formatDate, formatDateTime, toDateKey } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { ConsignmentNoPermission } from '../components/ConsignmentNoPermission'
import { ConsignmentAuditTab } from '../components/ConsignmentAuditTab'
import { ConsignmentContractStatusBadge } from '../components/ConsignmentContractStatusBadge'
import { ConsignmentProposalFormSheet } from '../components/ConsignmentProposalFormSheet'
import { ConsignmentProposalStatusBadge } from '../components/ConsignmentProposalStatusBadge'
import { ConsignmentField } from '../components/ConsignmentField'
import { OwnerBankAccountField } from '../components/OwnerBankAccountField'
import { OwnerPayoutRecordsPanel } from '../components/OwnerPayoutRecordTable'
import { VehicleOwnerFormSheet } from '../components/VehicleOwnerFormSheet'
import { getEffectiveTerm } from '../addendumModel'
import { useConsignmentContracts, useConsignmentProposals, useOwnerPayoutRecords, useVehicleOwner } from '../hooks'
import { calcAge, isExpiringSoon } from '../model'
import { summarizeOwnerPayables } from '../payoutModel'

const GENDER_LABEL = {
  MALE: vi.consignment.ownerGenderMale,
  FEMALE: vi.consignment.ownerGenderFemale,
  OTHER: vi.consignment.ownerGenderOther,
} as const

/** Chi tiết chủ xe (`/consignment/owners/:id`) — plan mục 8.2: Hồ sơ · Xe & hợp đồng · Nhật ký. */
export function VehicleOwnerDetailScreen() {
  const { can } = usePermission()
  if (!can('CONSIGNMENT', 'VIEW')) return <ConsignmentNoPermission title={vi.consignment.ownersTitle} />
  return <VehicleOwnerDetailScreenContent />
}

function VehicleOwnerDetailScreenContent() {
  const { id } = useParams<{ id: string }>()
  const { can } = usePermission()
  const canEdit = can('CONSIGNMENT', 'CREATE')
  const canAssess = can('CONSIGNMENT', 'ASSESS')
  // TODO(OQ: VehicleConsignment-BRD.md mục 21 — vai trò xem đầy đủ số tài khoản chưa nêu rõ; BA đề xuất CREATE hoặc CONFIRM)
  const canReveal = canEdit || can('CONSIGNMENT', 'CONFIRM')

  const { data: owner, isLoading } = useVehicleOwner(id)
  const { data: contracts } = useConsignmentContracts({ ownerId: id })
  const { data: vehicles } = useVehicles()
  const { data: payoutRecords } = useOwnerPayoutRecords({ ownerId: id })
  const { data: proposals } = useConsignmentProposals({ ownerId: id }, canAssess)
  const [formOpen, setFormOpen] = useState(false)
  const [proposalFormOpen, setProposalFormOpen] = useState(false)

  const todayKey = toDateKey(new Date())
  const plateById = useMemo(() => new Map((vehicles ?? []).map((v) => [v.id, v.plate])), [vehicles])
  const payable = useMemo(() => summarizeOwnerPayables(payoutRecords ?? [], todayKey)[0], [payoutRecords, todayKey])
  const monthlyTotal = useMemo(
    () =>
      (contracts ?? [])
        .filter((c) => c.status === 'ACTIVE' || c.status === 'SUSPENDED')
        .reduce((sum, c) => sum + getEffectiveTerm(c, todayKey).term.fixedMonthlyAmount, 0),
    [contracts, todayKey],
  )

  if (isLoading) {
    return (
      <div>
        <PageHeader title={vi.consignment.ownersTitle} />
        <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
      </div>
    )
  }

  if (!owner) {
    return (
      <div>
        <PageHeader title={vi.consignment.ownersTitle} />
        <p className="text-muted-foreground text-sm">{vi.consignment.notFound}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="border-border flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold">{owner.fullName}</h1>
            <Badge variant="neutral">{OWNER_TYPE_LABELS[owner.ownerType]}</Badge>
          </div>
          <p className="text-muted-foreground text-sm">{owner.code}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setProposalFormOpen(true)}>
              {vi.consignment.proposals.addButton}
            </Button>
          )}
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setFormOpen(true)}>
              <Pencil className="size-3.5" />
              {vi.common.edit}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="max-w-full">
          <TabsTrigger value="profile">{vi.consignment.ownerTabProfile}</TabsTrigger>
          <TabsTrigger value="contracts">{vi.consignment.ownerTabContracts}</TabsTrigger>
          <TabsTrigger value="payouts">{vi.consignment.ownerTabPayouts}</TabsTrigger>
          <TabsTrigger value="audit">{vi.consignment.ownerTabAudit}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ConsignmentField label={vi.consignment.ownerType}>{OWNER_TYPE_LABELS[owner.ownerType]}</ConsignmentField>
            <ConsignmentField label={vi.consignment.ownerPhone}>{owner.phone}</ConsignmentField>
            {owner.ownerType === 'INDIVIDUAL' ? (
              <>
                <ConsignmentField label={vi.consignment.ownerIdNumber}>{owner.idNumber}</ConsignmentField>
                <ConsignmentField label={vi.consignment.ownerDateOfBirth}>
                  {owner.dateOfBirth ? formatDate(owner.dateOfBirth) : undefined}
                </ConsignmentField>
                <ConsignmentField label={vi.consignment.ownerAge}>
                  {owner.dateOfBirth ? calcAge(owner.dateOfBirth, todayKey) : undefined}
                </ConsignmentField>
                <ConsignmentField label={vi.consignment.ownerGender}>
                  {owner.gender ? GENDER_LABEL[owner.gender] : undefined}
                </ConsignmentField>
              </>
            ) : (
              <ConsignmentField label={vi.consignment.ownerTaxCode}>{owner.taxCode}</ConsignmentField>
            )}
            <ConsignmentField label={vi.consignment.ownerEmail}>{owner.email}</ConsignmentField>
            <ConsignmentField label={vi.consignment.ownerAddress}>{owner.address}</ConsignmentField>
            <div className="sm:col-span-2">
              <ConsignmentField label={vi.consignment.ownerBankAccountNumber}>
                <OwnerBankAccountField owner={owner} canReveal={canReveal} />
              </ConsignmentField>
            </div>
            <div className="sm:col-span-2">
              <ConsignmentField label={vi.consignment.ownerNote}>{owner.note}</ConsignmentField>
            </div>
            <ConsignmentField label={vi.consignment.ownerCreatedBy}>{owner.createdByName}</ConsignmentField>
            <ConsignmentField label={vi.consignment.ownerCreatedAt}>{formatDateTime(owner.createdAt)}</ConsignmentField>
          </div>
        </TabsContent>

        <TabsContent value="contracts">
          <div className="flex flex-col gap-6">
          {(contracts?.length ?? 0) === 0 ? (
            <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
              <p className="font-medium">{vi.consignment.ownerContractsEmpty}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm">
                <span className="text-muted-foreground">{vi.consignment.ownerContractsMonthlyTotal}: </span>
                <span className="font-medium">{formatVnd(monthlyTotal)}</span>
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{vi.consignment.contractColumnNo}</TableHead>
                      <TableHead>{vi.consignment.contractColumnVehicle}</TableHead>
                      <TableHead>{vi.common.status}</TableHead>
                      <TableHead>{vi.consignment.contractColumnEffective}</TableHead>
                      <TableHead className="text-right">{vi.consignment.contractColumnAmount}</TableHead>
                      <TableHead>{vi.consignment.contractColumnPaymentDay}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(contracts ?? []).map((c) => {
                      const term = getEffectiveTerm(c, todayKey).term
                      return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          <Link className="text-primary underline-offset-4 hover:underline" to={paths.consignmentContractDetail(c.id)}>
                            {c.contractNo}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link className="text-primary underline-offset-4 hover:underline" to={paths.vehicleDetail(c.vehicleId)}>
                            {plateById.get(c.vehicleId) ?? c.vehicleId}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <ConsignmentContractStatusBadge status={c.status} expiringSoon={isExpiringSoon(c, todayKey)} />
                        </TableCell>
                        <TableCell>
                          {formatDate(c.effectiveFrom)} – {formatDate(c.effectiveTo)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span title={CONSIGNMENT_PRORATION_RULE_LABELS[term.prorationRule]}>
                            {formatVnd(term.fixedMonthlyAmount)}
                          </span>
                        </TableCell>
                        <TableCell>{vi.consignment.paymentDayValue(term.paymentDay)}</TableCell>
                      </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

            {canAssess && (
              <section className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold">{vi.consignment.proposals.ownerBlockTitle}</h3>
                {(proposals?.length ?? 0) === 0 ? (
                  <p className="text-muted-foreground text-sm">{vi.consignment.proposals.ownerBlockEmpty}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{vi.consignment.proposals.columnCode}</TableHead>
                          <TableHead>{vi.consignment.proposals.columnPlate}</TableHead>
                          <TableHead>{vi.common.status}</TableHead>
                          <TableHead className="text-right">{vi.consignment.proposals.columnExpected}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(proposals ?? []).map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">
                              <Link className="text-primary underline-offset-4 hover:underline" to={paths.consignmentProposalDetail(p.id)}>
                                {p.code}
                              </Link>
                            </TableCell>
                            <TableCell>{p.declaredVehicle.plate}</TableCell>
                            <TableCell>
                              <ConsignmentProposalStatusBadge status={p.status} />
                            </TableCell>
                            <TableCell className="text-right">{formatVnd(p.expectedMonthlyAmount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </section>
            )}
          </div>
        </TabsContent>

        <TabsContent value="payouts">
          <div className="flex flex-col gap-3">
            {payable && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <ConsignmentField label={vi.consignment.payouts.ownerSummaryDue}>{formatVnd(payable.dueUnpaid)}</ConsignmentField>
                <ConsignmentField label={vi.consignment.payouts.ownerSummaryHold}>{formatVnd(payable.onHold)}</ConsignmentField>
                <ConsignmentField label={vi.consignment.payouts.ownerSummaryOverdue}>
                  {formatVnd(payable.overdueAmount)} ({vi.consignment.payouts.kpiCount(payable.overdueCount)})
                </ConsignmentField>
                <ConsignmentField label={vi.consignment.payouts.ownerSummaryPaid}>{formatVnd(payable.paidTotal)}</ConsignmentField>
              </div>
            )}
            <OwnerPayoutRecordsPanel filter={{ ownerId: owner.id }} hideColumns={['owner']} />
          </div>
        </TabsContent>

        <TabsContent value="audit">
          <ConsignmentAuditTab ownerId={owner.id} />
        </TabsContent>
      </Tabs>

      {canEdit && <VehicleOwnerFormSheet owner={owner} open={formOpen} onOpenChange={setFormOpen} />}
      {canEdit && <ConsignmentProposalFormSheet initialOwnerId={owner.id} open={proposalFormOpen} onOpenChange={setProposalFormOpen} />}
    </div>
  )
}
