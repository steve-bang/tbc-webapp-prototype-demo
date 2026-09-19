import { useState } from 'react'
import { usePermission } from '@/features/auth'
// `employees`/`handover-return` chưa export các hook/component này qua barrel
// — deep-import trực tiếp file, đúng tiền lệ `RentalContractTab`
// (`@/features/contracts/hooks`).
import { useEmployees } from '@/features/employees/hooks'
import { HandoverCancelDialog } from '@/features/handover-return/components/HandoverCancelDialog'
import { HandoverEditDialog } from '@/features/handover-return/components/HandoverEditDialog'
import { HandoverReturnStatusBadge } from '@/features/handover-return/components/HandoverReturnStatusBadge'
import { ReturnCancelDialog } from '@/features/handover-return/components/ReturnCancelDialog'
import { ReturnEditDialog } from '@/features/handover-return/components/ReturnEditDialog'
import { useHandoverRecords, useReturnRecords } from '@/features/handover-return/hooks'
import { canCancelHandoverRecord, canCancelReturnRecord, canEditHandoverRecord, canEditReturnRecord } from '@/features/handover-return/model'
import {
  ADDITIONAL_CHARGE_TYPE_LABELS,
  CONDITION_ITEM_TYPE_LABELS,
  INCIDENT_ITEM_TYPE_LABELS,
  vi,
} from '@/shared/i18n/vi'
import { formatDateTime } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Separator } from '@/shared/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { RentalDetailPlaceholder } from './RentalDetailPlaceholder'
import type { Rental } from '../model'

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm">{value || vi.handoverReturn.noValue}</span>
    </div>
  )
}

/**
 * Tab "Giao-nhận" ở `RentalDetailScreen` — `docs/HANDOVER-RETURN-MANAGEMENT-
 * PLAN.md` §5.2. Biên bản Handover (baseline đầy đủ) + Biên bản Return (đối
 * chiếu before/after + khoản phát sinh ước tính) của đúng Rental đang xem.
 * Nút Sửa/Huỷ chỉ hiện khi `HANDOVER_RETURN.EXECUTE` **và** role thuộc
 * `MANAGER`/`SYSTEM_ADMIN` (§9.3 kế hoạch — `HANDOVER_RETURN.EXECUTE` hiện
 * cũng `true` cho `OPERATION_STAFF`/App nhân viên, Webapp Round 1 tự thêm điều
 * kiện role ở tầng UI, không sửa `permissions.ts`).
 */
export function RentalHandoverReturnTab({ rental }: { rental: Rental }) {
  const { can, role } = usePermission()
  const canManage = can('HANDOVER_RETURN', 'EXECUTE') && (role === 'MANAGER' || role === 'SYSTEM_ADMIN')

  const { data: handovers, isLoading: loadingHandovers } = useHandoverRecords({ rentalId: rental.id })
  const { data: returns, isLoading: loadingReturns } = useReturnRecords({ rentalId: rental.id })
  const { data: employees = [] } = useEmployees()
  const employeeById = new Map(employees.map((e) => [e.id, e]))

  const [editHandoverOpen, setEditHandoverOpen] = useState(false)
  const [cancelHandoverOpen, setCancelHandoverOpen] = useState(false)
  const [editReturnOpen, setEditReturnOpen] = useState(false)
  const [cancelReturnOpen, setCancelReturnOpen] = useState(false)

  if (loadingHandovers || loadingReturns) {
    return <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
  }

  const handover = handovers?.[0]
  const returnRecord = returns?.[0]

  if (!handover) {
    return <RentalDetailPlaceholder note={vi.handoverReturn.noHandoverNotice} />
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-col gap-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{vi.handoverReturn.sectionHandover}</h3>
              <HandoverReturnStatusBadge status={handover.status} />
            </div>
            {canManage && handover.status === 'COMPLETED' && (
              <div className="flex gap-2">
                {canEditHandoverRecord(handover) && (
                  <Button size="sm" variant="outline" onClick={() => setEditHandoverOpen(true)}>
                    {vi.common.edit}
                  </Button>
                )}
                {canCancelHandoverRecord(handover) && (
                  <Button size="sm" variant="outline" onClick={() => setCancelHandoverOpen(true)}>
                    {vi.common.cancel}
                  </Button>
                )}
              </div>
            )}
          </div>

          {handover.status === 'CANCELLED' ? (
            <Field label={vi.handoverReturn.cancelReasonLabel} value={handover.cancelReason} />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label={vi.handoverReturn.actualPickupDateTime} value={handover.actualPickupDateTime && formatDateTime(handover.actualPickupDateTime)} />
                <Field label={vi.handoverReturn.odometerHandover} value={handover.odometerHandover !== undefined ? `${handover.odometerHandover.toLocaleString('vi-VN')} km` : undefined} />
                <Field label={vi.handoverReturn.fuelLevelHandover} value={handover.fuelLevelHandover !== undefined ? String(handover.fuelLevelHandover) : undefined} />
                <Field label={vi.handoverReturn.deliveryStaffEmployeeId} value={handover.deliveryStaffEmployeeId ? (employeeById.get(handover.deliveryStaffEmployeeId)?.fullName ?? handover.deliveryStaffEmployeeId) : undefined} />
                <Field label={vi.handoverReturn.prepaymentConfirmed} value={handover.prepaymentConfirmed ? vi.handoverReturn.yes : vi.handoverReturn.no} />
                <Field label={vi.handoverReturn.fullPaymentConfirmed} value={handover.fullPaymentConfirmed ? vi.handoverReturn.yes : vi.handoverReturn.no} />
                <Field label={vi.handoverReturn.customerAcknowledged} value={handover.customerAcknowledged ? vi.handoverReturn.yes : vi.handoverReturn.no} />
                <Field label={vi.handoverReturn.note} value={handover.note} />
              </div>

              {handover.preExistingConditionItems.length > 0 && (
                <>
                  <Separator />
                  <div className="flex flex-col gap-2">
                    <h4 className="text-sm font-semibold">{vi.handoverReturn.sectionConditionItems}</h4>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{vi.handoverReturn.conditionColumnType}</TableHead>
                            <TableHead>{vi.handoverReturn.conditionColumnPosition}</TableHead>
                            <TableHead>{vi.handoverReturn.conditionColumnDescription}</TableHead>
                            <TableHead>{vi.handoverReturn.conditionColumnSeverity}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {handover.preExistingConditionItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{CONDITION_ITEM_TYPE_LABELS[item.type]}</TableCell>
                              <TableCell>{item.position ?? vi.handoverReturn.noValue}</TableCell>
                              <TableCell>{item.description}</TableCell>
                              <TableCell>{item.severity ? vi.handoverReturn.severityLabels[item.severity] : vi.handoverReturn.noValue}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </>
              )}

              <Separator />
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-semibold">{vi.handoverReturn.sectionChecklist}</h4>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{vi.handoverReturn.checklistColumnItem}</TableHead>
                        <TableHead>{vi.handoverReturn.checklistColumnStatus}</TableHead>
                        <TableHead>{vi.handoverReturn.checklistColumnNote}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {handover.checklist.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.itemName}</TableCell>
                          <TableCell>{vi.handoverReturn.checklistStatusLabels[item.status]}</TableCell>
                          <TableCell>{item.note ?? vi.handoverReturn.noValue}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <Separator />
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-semibold">{vi.handoverReturn.sectionMedia}</h4>
                {handover.mediaMeta.length === 0 ? (
                  <p className="text-muted-foreground text-sm">{vi.handoverReturn.mediaEmpty}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {handover.mediaMeta.map((m) => (
                      <Badge key={m.id} variant="secondary">
                        {m.category} · {formatDateTime(m.capturedAt)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {handover.motorbikeCollateral && (
                <>
                  <Separator />
                  <div className="flex flex-col gap-2">
                    <h4 className="text-sm font-semibold">{vi.handoverReturn.sectionMotorbikeCollateral}</h4>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label={vi.handoverReturn.motorbikeOdometer} value={`${handover.motorbikeCollateral.odometer.toLocaleString('vi-VN')} km`} />
                      <Field label={vi.handoverReturn.motorbikeFuelLevel} value={String(handover.motorbikeCollateral.fuelLevel)} />
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {returnRecord ? (
        <Card>
          <CardContent className="flex flex-col gap-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">{vi.handoverReturn.sectionReturn}</h3>
                <HandoverReturnStatusBadge status={returnRecord.status} />
              </div>
              {canManage && returnRecord.status === 'COMPLETED' && (
                <div className="flex gap-2">
                  {canEditReturnRecord(returnRecord) && (
                    <Button size="sm" variant="outline" onClick={() => setEditReturnOpen(true)}>
                      {vi.common.edit}
                    </Button>
                  )}
                  {canCancelReturnRecord(returnRecord) && (
                    <Button size="sm" variant="outline" onClick={() => setCancelReturnOpen(true)}>
                      {vi.common.cancel}
                    </Button>
                  )}
                </div>
              )}
            </div>

            {returnRecord.status === 'CANCELLED' ? (
              <Field label={vi.handoverReturn.cancelReasonLabel} value={returnRecord.cancelReason} />
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <h4 className="text-sm font-semibold">{vi.handoverReturn.sectionBeforeAfter}</h4>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead />
                          <TableHead>{vi.handoverReturn.sectionHandover}</TableHead>
                          <TableHead>{vi.handoverReturn.sectionReturn}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">{vi.handoverReturn.beforeAfterTimeLabel}</TableCell>
                          <TableCell>{handover.actualPickupDateTime ? formatDateTime(handover.actualPickupDateTime) : vi.handoverReturn.noValue}</TableCell>
                          <TableCell>{returnRecord.actualReturnDateTime ? formatDateTime(returnRecord.actualReturnDateTime) : vi.handoverReturn.noValue}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">{vi.handoverReturn.beforeAfterOdometerLabel}</TableCell>
                          <TableCell>{handover.odometerHandover !== undefined ? `${handover.odometerHandover.toLocaleString('vi-VN')} km` : vi.handoverReturn.noValue}</TableCell>
                          <TableCell>{returnRecord.odometerReturn !== undefined ? `${returnRecord.odometerReturn.toLocaleString('vi-VN')} km` : vi.handoverReturn.noValue}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">{vi.handoverReturn.beforeAfterFuelLabel}</TableCell>
                          <TableCell>{handover.fuelLevelHandover !== undefined ? String(handover.fuelLevelHandover) : vi.handoverReturn.noValue}</TableCell>
                          <TableCell>{returnRecord.fuelLevelReturn !== undefined ? String(returnRecord.fuelLevelReturn) : vi.handoverReturn.noValue}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <Field label={vi.handoverReturn.receivingStaffEmployeeId} value={returnRecord.receivingStaffEmployeeId ? (employeeById.get(returnRecord.receivingStaffEmployeeId)?.fullName ?? returnRecord.receivingStaffEmployeeId) : undefined} />

                {returnRecord.incidentItems.length > 0 && (
                  <>
                    <Separator />
                    <div className="flex flex-col gap-2">
                      <h4 className="text-sm font-semibold">{vi.handoverReturn.sectionIncidents}</h4>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{vi.handoverReturn.incidentColumnType}</TableHead>
                              <TableHead>{vi.handoverReturn.incidentColumnPosition}</TableHead>
                              <TableHead>{vi.handoverReturn.incidentColumnDescription}</TableHead>
                              <TableHead>{vi.handoverReturn.incidentColumnBaseline}</TableHead>
                              <TableHead>{vi.handoverReturn.incidentColumnEstimatedCost}</TableHead>
                              <TableHead>{vi.handoverReturn.incidentColumnApproval}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {returnRecord.incidentItems.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>{INCIDENT_ITEM_TYPE_LABELS[item.type]}</TableCell>
                                <TableCell>{item.position ?? vi.handoverReturn.noValue}</TableCell>
                                <TableCell>{item.description}</TableCell>
                                <TableCell>{vi.handoverReturn.baselineComparisonLabels[item.baselineComparison]}</TableCell>
                                <TableCell>{formatVnd(item.estimatedCost)}</TableCell>
                                <TableCell>{vi.handoverReturn.chargeApprovalStatusLabels[item.chargeApprovalStatus]}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </>
                )}

                <Separator />
                <div className="flex flex-col gap-2">
                  <h4 className="text-sm font-semibold">{vi.handoverReturn.sectionChecklistComparison}</h4>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{vi.handoverReturn.checklistColumnItem}</TableHead>
                          <TableHead>{vi.handoverReturn.checklistColumnStatus}</TableHead>
                          <TableHead>{vi.handoverReturn.checklistColumnNote}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {returnRecord.checklistComparison.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.itemName}</TableCell>
                            <TableCell>{vi.handoverReturn.returnChecklistStatusLabels[item.status]}</TableCell>
                            <TableCell>{item.note ?? vi.handoverReturn.noValue}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <Separator />
                <div className="flex flex-col gap-2">
                  <h4 className="text-sm font-semibold">{vi.handoverReturn.sectionAdditionalCharges}</h4>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{vi.handoverReturn.chargeColumnType}</TableHead>
                          <TableHead>{vi.handoverReturn.chargeColumnAmount}</TableHead>
                          <TableHead>{vi.handoverReturn.chargeColumnNote}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {returnRecord.additionalCharges.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{ADDITIONAL_CHARGE_TYPE_LABELS[item.type]}</TableCell>
                            <TableCell>{formatVnd(item.amount)}</TableCell>
                            <TableCell>{item.note ?? vi.handoverReturn.noValue}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="bg-muted/50 flex items-center justify-between rounded-md p-3">
                    <span className="text-sm font-semibold">{vi.handoverReturn.totalChargesLabel}</span>
                    <span className="text-base font-semibold">
                      {formatVnd(returnRecord.additionalCharges.reduce((sum, c) => sum + c.amount, 0))}
                    </span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        handover.status === 'COMPLETED' && <p className="text-muted-foreground text-sm">{vi.handoverReturn.noReturnYetNotice}</p>
      )}

      {canManage && (
        <>
          <HandoverEditDialog handover={editHandoverOpen ? handover : null} open={editHandoverOpen} onOpenChange={setEditHandoverOpen} />
          <HandoverCancelDialog handover={cancelHandoverOpen ? handover : null} open={cancelHandoverOpen} onOpenChange={setCancelHandoverOpen} />
          {returnRecord && (
            <>
              <ReturnEditDialog returnRecord={editReturnOpen ? returnRecord : null} open={editReturnOpen} onOpenChange={setEditReturnOpen} />
              <ReturnCancelDialog returnRecord={cancelReturnOpen ? returnRecord : null} open={cancelReturnOpen} onOpenChange={setCancelReturnOpen} />
            </>
          )}
        </>
      )}
    </div>
  )
}
