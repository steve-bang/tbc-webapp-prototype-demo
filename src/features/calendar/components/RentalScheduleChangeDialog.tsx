import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { paths } from '@/app/paths'
import { usePermission } from '@/features/auth'
import {
  evaluateScheduleChange,
  needsOverrideReason,
  rentalDurationDays,
  rentalScheduleChangeSchema,
  useChangeRentalVehicle,
  useRentals,
  useRescheduleRental,
  type Rental,
  type RentalScheduleChangeValues,
  type ScheduleIssue,
} from '@/features/rentals'
import { useVehicles } from '@/features/vehicles'
import { calendarLabels } from '@/shared/i18n/calendarLabels'
import { vi } from '@/shared/i18n/vi'
import { dateTimeInputToIso, formatDateTime, isoToDateTimeInput } from '@/shared/lib/datetime'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { useVehicleBlocks } from '../hooks'
import type { VehicleBlock } from '../model'

export type ScheduleChangeMode = 'reschedule' | 'changeVehicle'

/** Điền sẵn từ vị trí thả (Round B2) — ISO. Bỏ trống trường nào = lấy từ lượt thuê hiện tại. */
export interface ScheduleChangeInitial {
  vehicleId?: string
  pickupDateTime?: string
  expectedReturnDateTime?: string
}

function IssueList({
  title,
  issues,
  tone,
  rentals,
  blocks,
  canViewRental,
}: {
  title: string
  issues: ScheduleIssue[]
  tone: 'error' | 'warning'
  rentals: Rental[]
  blocks: VehicleBlock[]
  canViewRental: boolean
}) {
  if (issues.length === 0) return null
  const rentalById = new Map(rentals.map((r) => [r.id, r]))
  const blockById = new Map(blocks.map((b) => [b.id, b]))
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={cn(
        'flex flex-col gap-2 rounded-md border p-3 text-sm',
        tone === 'error' ? 'border-status-error/40 bg-status-error/10' : 'border-status-pending/40 bg-status-pending/10',
      )}
    >
      <p className={cn('font-medium', tone === 'error' && 'text-status-error')}>{title}</p>
      <ul className="flex flex-col gap-2">
        {issues.map((issue) => (
          <li key={issue.code} className="flex flex-col gap-1">
            <span>{vi.rentals.scheduleIssues[issue.code]}</span>
            {issue.rentalIds && issue.rentalIds.length > 0 && (
              <span className="text-muted-foreground flex flex-col gap-0.5 text-xs">
                <span>{calendarLabels.scheduleConflictingRentals}:</span>
                {issue.rentalIds.map((id) => {
                  const r = rentalById.get(id)
                  const label = r ? `${id} (${formatDateTime(r.pickupDateTime)} → ${formatDateTime(r.expectedReturnDateTime)})` : id
                  return (
                    <span key={id} className="flex flex-wrap items-center gap-2">
                      <span>{label}</span>
                      {/* Q20 / OQ-G1 — DISPATCHER kéo được nhưng không mở được Chi tiết lượt thuê: chỉ hiện liên kết khi có RENTAL.VIEW. */}
                      {canViewRental && (
                        <Link to={paths.rentalDetail(id)} target="_blank" rel="noreferrer" className="text-primary underline">
                          {calendarLabels.scheduleOpenRental}
                        </Link>
                      )}
                    </span>
                  )
                })}
              </span>
            )}
            {issue.blockIds && issue.blockIds.length > 0 && (
              <span className="text-muted-foreground flex flex-col gap-0.5 text-xs">
                <span>{calendarLabels.scheduleConflictingBlocks}:</span>
                {issue.blockIds.map((id) => {
                  const b = blockById.get(id)
                  return <span key={id}>{b ? calendarLabels.scheduleBlockLine(id, b.startDate, b.endDate) : id}</span>
                })}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * UC-RC-06 (dời lịch) / UC-RC-07 (đổi xe) trước giao — CALENDAR-ROUND3-PLAN.md §3.4, §14.2 mục 7. Mọi điều kiện nghiệp vụ lấy từ
 * `evaluateScheduleChange` (cùng hàm với `rescheduleRental`/`changeRentalVehicle`) — hộp thoại KHÔNG tự viết điều kiện riêng.
 * Mount có điều kiện (cha chỉ render khi đang mở) nên giá trị mặc định chỉ tính một lần lúc mở.
 */
export function RentalScheduleChangeDialog({
  rental,
  mode,
  initial,
  onClose,
  onResult,
}: {
  rental: Rental
  mode: ScheduleChangeMode
  initial?: ScheduleChangeInitial
  onClose: () => void
  /** `true` = đã ghi thành công; `false` = đóng mà không ghi (Round B2 dùng để hoàn block về vị trí cũ). */
  onResult?: (ok: boolean) => void
}) {
  const { can } = usePermission()
  const { data: rentals } = useRentals()
  const { data: vehicles } = useVehicles()
  const { data: blocks } = useVehicleBlocks()
  const reschedule = useRescheduleRental()
  const changeVehicle = useChangeRentalVehicle()
  // EX-03 — phiên bản dữ liệu lúc mở hộp thoại; API từ chối nếu lượt thuê đã bị sửa kể từ đó.
  const [expectedUpdatedAt] = useState(rental.updatedAt)
  const [now] = useState(() => new Date())

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<RentalScheduleChangeValues>({
    resolver: zodResolver(rentalScheduleChangeSchema),
    defaultValues: {
      vehicleId: initial?.vehicleId ?? rental.vehicleId,
      pickupDateTime: isoToDateTimeInput(initial?.pickupDateTime ?? rental.pickupDateTime),
      expectedReturnDateTime: isoToDateTimeInput(initial?.expectedReturnDateTime ?? rental.expectedReturnDateTime),
      overrideReason: '',
    },
  })
  const vehicleId = useWatch({ control, name: 'vehicleId' })
  const pickup = useWatch({ control, name: 'pickupDateTime' })
  const returnAt = useWatch({ control, name: 'expectedReturnDateTime' })

  const targetVehicle = vehicles?.find((v) => v.id === vehicleId)
  const currentVehicle = vehicles?.find((v) => v.id === rental.vehicleId)
  const evaluation = useMemo(() => {
    if (!rentals || !blocks || !targetVehicle) return null
    return evaluateScheduleChange({
      rental,
      proposed: { vehicleId, pickupDateTime: pickup, expectedReturnDateTime: returnAt },
      rentals,
      targetVehicle,
      vehicleBlocks: blocks,
      now,
    })
  }, [rental, vehicleId, pickup, returnAt, rentals, blocks, targetVehicle, now])

  const pickupIso = dateTimeInputToIso(pickup)
  const returnIso = dateTimeInputToIso(returnAt)
  const newDays = pickupIso && returnIso && returnIso > pickupIso ? rentalDurationDays(pickupIso, returnIso) : undefined

  const isBusy = reschedule.isPending || changeVehicle.isPending
  const needsReason = evaluation ? needsOverrideReason(evaluation.warnings) : false

  function finish(ok: boolean) {
    onResult?.(ok)
    onClose()
  }

  async function onSubmit(values: RentalScheduleChangeValues) {
    if (!evaluation || evaluation.errors.length > 0) return
    const reason = values.overrideReason?.trim() ?? ''
    if (needsOverrideReason(evaluation.warnings) && !reason) {
      setError('overrideReason', { message: vi.rentals.scheduleOverrideReasonRequired })
      return
    }
    const times = {
      // Ô datetime-local (+07) → ISO `...Z`
      pickupDateTime: dateTimeInputToIso(values.pickupDateTime),
      expectedReturnDateTime: dateTimeInputToIso(values.expectedReturnDateTime),
      expectedUpdatedAt,
      overrideReason: reason || undefined,
    }
    try {
      const result =
        mode === 'reschedule'
          ? await reschedule.mutateAsync({ id: rental.id, input: times })
          : await changeVehicle.mutateAsync({ id: rental.id, input: { ...times, vehicleId: values.vehicleId } })
      toast.success(mode === 'reschedule' ? calendarLabels.scheduleSuccess : calendarLabels.scheduleVehicleSuccess)
      // EA-BR-10 — trùng lịch nhân viên chỉ cảnh báo, không chặn.
      if (result.assignmentConflicts.length > 0) toast.warning(calendarLabels.scheduleAssignmentConflictToast)
      finish(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : calendarLabels.scheduleError)
    }
  }

  const plateOf = (v?: { plate: string; brand: string; model: string }) => (v ? `${v.plate} — ${v.brand} ${v.model}` : '—')
  const rows: { label: string; before: string; after: string }[] = [
    { label: calendarLabels.scheduleFieldVehicle, before: plateOf(currentVehicle), after: plateOf(targetVehicle) },
    {
      label: calendarLabels.scheduleFieldPickup,
      before: formatDateTime(rental.pickupDateTime),
      after: pickupIso ? formatDateTime(pickupIso) : '—',
    },
    {
      label: calendarLabels.scheduleFieldReturn,
      before: formatDateTime(rental.expectedReturnDateTime),
      after: returnIso ? formatDateTime(returnIso) : '—',
    },
    {
      label: calendarLabels.scheduleFieldDays,
      before: calendarLabels.scheduleDaysValue(rental.rentalDurationDays),
      after: newDays !== undefined ? calendarLabels.scheduleDaysValue(newDays) : '—',
    },
  ]

  return (
    <Dialog open onOpenChange={(open) => !open && !isBusy && finish(false)}>
      <DialogContent className="max-w-2xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>
            {mode === 'reschedule' ? calendarLabels.scheduleDialogTitleReschedule : calendarLabels.scheduleDialogTitleChangeVehicle}
            {` — ${rental.id}`}
          </DialogTitle>
          <DialogDescription>{calendarLabels.scheduleDialogDescription}</DialogDescription>
        </DialogHeader>

        <form id="rental-schedule-change-form" className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {mode === 'changeVehicle' && (
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="rsc-vehicle">{calendarLabels.scheduleNewVehicle} *</Label>
                <Controller
                  control={control}
                  name="vehicleId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="rsc-vehicle" className="w-full">
                        <SelectValue placeholder={calendarLabels.scheduleNewVehiclePlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {(vehicles ?? []).map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {plateOf(v)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.vehicleId && <p className="text-destructive text-sm">{errors.vehicleId.message}</p>}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rsc-pickup">{calendarLabels.scheduleNewPickup} *</Label>
              <Input id="rsc-pickup" type="datetime-local" {...register('pickupDateTime')} />
              {errors.pickupDateTime && <p className="text-destructive text-sm">{errors.pickupDateTime.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rsc-return">{calendarLabels.scheduleNewReturn} *</Label>
              <Input id="rsc-return" type="datetime-local" {...register('expectedReturnDateTime')} />
              {errors.expectedReturnDateTime && <p className="text-destructive text-sm">{errors.expectedReturnDateTime.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-[5.5rem_1fr_1fr] gap-x-3 gap-y-1.5 rounded-md border p-3 text-xs sm:grid-cols-[7rem_1fr_1fr] sm:text-sm">
            <span />
            <span className="text-muted-foreground font-medium">{calendarLabels.scheduleCurrent}</span>
            <span className="text-muted-foreground font-medium">{calendarLabels.scheduleProposed}</span>
            {rows.map((row) => (
              <div key={row.label} className="contents">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="min-w-0 break-words">{row.before}</span>
                <span className={cn('min-w-0 break-words', row.before !== row.after && 'font-semibold')}>{row.after}</span>
              </div>
            ))}
          </div>

          {!evaluation && <p className="text-muted-foreground text-sm">{calendarLabels.scheduleChecking}</p>}
          {evaluation && rentals && blocks && (
            <>
              <IssueList
                title={calendarLabels.scheduleErrorsTitle}
                issues={evaluation.errors}
                tone="error"
                rentals={rentals}
                blocks={blocks}
                canViewRental={can('RENTAL', 'VIEW')}
              />
              <IssueList
                title={calendarLabels.scheduleWarningsTitle}
                issues={evaluation.warnings}
                tone="warning"
                rentals={rentals}
                blocks={blocks}
                canViewRental={can('RENTAL', 'VIEW')}
              />
            </>
          )}

          {needsReason && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rsc-reason">{calendarLabels.scheduleOverrideReasonLabel} *</Label>
              <Textarea
                id="rsc-reason"
                rows={2}
                placeholder={calendarLabels.scheduleOverrideReasonPlaceholder}
                {...register('overrideReason')}
              />
              {errors.overrideReason && <p className="text-destructive text-sm">{errors.overrideReason.message}</p>}
            </div>
          )}

          <p className="text-muted-foreground text-xs">
            {calendarLabels.scheduleVersionLabel}: {formatDateTime(expectedUpdatedAt)}
          </p>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={isBusy} onClick={() => finish(false)}>
            {vi.common.cancel}
          </Button>
          <Button
            type="submit"
            form="rental-schedule-change-form"
            disabled={isBusy || !evaluation || evaluation.errors.length > 0}
          >
            {calendarLabels.scheduleConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
