import { Link } from 'react-router-dom'
import { paths } from '@/app/paths'
import type { Vehicle } from '@/features/vehicles'
import { CONSIGNMENT_PRORATION_RULE_LABELS, OWNER_TYPE_LABELS, vi } from '@/shared/i18n/vi'
import { formatDate, formatDateTime } from '@/shared/lib/datetime'
import { formatNumber, formatVnd } from '@/shared/lib/money'
import { Badge } from '@/shared/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { useConsignmentContracts, useConsignmentHandoverRecords, useVehicleOwner } from '../hooks'
import { getCurrentContractForVehicle, isExpiringSoon, maskAccountNumber, toLocalDateKey } from '../model'
import { ConsignmentContractStatusBadge } from './ConsignmentContractStatusBadge'
import { ConsignmentField } from './ConsignmentField'

/**
 * Tab "Chủ xe & Ký gửi" của Vehicle Detail (plan mục 8.5): chủ xe + hợp đồng hiện hành + biên bản nhận xe + lịch sử hợp
 * đồng của xe. Số tài khoản luôn che, KHÔNG có nút hiện đầy đủ ở đây. Chỉ đọc.
 */
export function VehicleConsignmentTab({ vehicle }: { vehicle: Vehicle }) {
  const { data: contracts, isLoading } = useConsignmentContracts({ vehicleId: vehicle.id })
  const current = contracts ? getCurrentContractForVehicle(contracts, vehicle.id) : undefined
  const { data: owner } = useVehicleOwner(current?.ownerId)
  const { data: records } = useConsignmentHandoverRecords(current ? { contractId: current.id } : undefined)
  const intake = current ? records?.find((r) => r.type === 'INTAKE') : undefined
  const todayKey = toLocalDateKey(new Date())

  if (isLoading) return <p className="text-muted-foreground text-sm">{vi.common.loading}</p>

  if (!current) {
    return (
      <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
        <p className="font-medium">{vi.consignment.tabEmpty}</p>
        <Link className="text-primary text-sm underline-offset-4 hover:underline" to={paths.consignmentContracts}>
          {vi.consignment.tabGoContracts}
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {current.status === 'SUSPENDED' && (
        <div className="border-status-pending/40 bg-status-pending/10 text-status-pending rounded-lg border p-3 text-sm">
          {vi.consignment.suspendedBanner}
        </div>
      )}

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{vi.consignment.tabOwnerBlock}</h3>
        {owner ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <ConsignmentField label={vi.consignment.ownerColumnName}>
              {owner.fullName} <Badge variant="neutral">{OWNER_TYPE_LABELS[owner.ownerType]}</Badge>
            </ConsignmentField>
            <ConsignmentField label={vi.consignment.ownerPhone}>{owner.phone}</ConsignmentField>
            <ConsignmentField label={vi.consignment.ownerBankAccountNumber}>
              {owner.bankAccount ? (
                <span className="font-mono">{maskAccountNumber(owner.bankAccount.accountNumber)}</span>
              ) : (
                vi.consignment.ownerNoBank
              )}
            </ConsignmentField>
            <ConsignmentField label={owner.code}>
              <Link className="text-primary underline-offset-4 hover:underline" to={paths.consignmentOwnerDetail(owner.id)}>
                {vi.consignment.tabOpenOwner}
              </Link>
            </ConsignmentField>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{vi.consignment.tabOwnerMissing}</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{vi.consignment.tabContractBlock}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <ConsignmentField label={vi.consignment.contractColumnNo}>
            <Link className="text-primary underline-offset-4 hover:underline" to={paths.consignmentContractDetail(current.id)}>
              {current.contractNo}
            </Link>
          </ConsignmentField>
          <ConsignmentField label={vi.common.status}>
            <ConsignmentContractStatusBadge status={current.status} expiringSoon={isExpiringSoon(current, todayKey)} />
          </ConsignmentField>
          <ConsignmentField label={vi.consignment.contractColumnEffective}>
            {formatDate(current.effectiveFrom)} – {formatDate(current.effectiveTo)}
          </ConsignmentField>
          <ConsignmentField label={vi.consignment.contractColumnAmount}>
            {formatVnd(current.paymentTerm.fixedMonthlyAmount)} ({CONSIGNMENT_PRORATION_RULE_LABELS[current.paymentTerm.prorationRule]})
          </ConsignmentField>
          <ConsignmentField label={vi.consignment.contractColumnPaymentDay}>
            {vi.consignment.paymentDayValue(current.paymentTerm.paymentDay)}
          </ConsignmentField>
          <div className="sm:col-span-3">
            <ConsignmentField label={vi.consignment.sectionResponsibility}>
              {vi.consignment.tabResponsibilitySummary}
            </ConsignmentField>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{vi.consignment.tabIntakeBlock}</h3>
        {intake ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <ConsignmentField label={intake.code}>{formatDateTime(intake.handoverAt)}</ConsignmentField>
            <ConsignmentField label={vi.consignment.handoverOdo}>{formatNumber(intake.odoKm)} km</ConsignmentField>
            <ConsignmentField label={vi.consignment.handoverAppraised}>
              {intake.appraisedValue ? formatVnd(intake.appraisedValue) : undefined}
            </ConsignmentField>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{vi.consignment.tabNoIntake}</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{vi.consignment.tabHistoryBlock}</h3>
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
              {(contracts ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link className="text-primary underline-offset-4 hover:underline" to={paths.consignmentContractDetail(c.id)}>
                      {c.contractNo}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <ConsignmentContractStatusBadge status={c.status} expiringSoon={isExpiringSoon(c, todayKey)} />
                  </TableCell>
                  <TableCell>
                    {formatDate(c.effectiveFrom)} – {formatDate(c.effectiveTo)}
                  </TableCell>
                  <TableCell className="text-right">{formatVnd(c.paymentTerm.fixedMonthlyAmount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
