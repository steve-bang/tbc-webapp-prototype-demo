import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { CONSIGNMENT_TERMINATION_REQUESTERS } from '@/shared/domain/enums'
import { CONSIGNMENT_TERMINATION_REQUESTER_LABELS, vi } from '@/shared/i18n/vi'
import { formatDate, toDateKey } from '@/shared/lib/datetime'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { useNotifyConsignmentTermination } from '../hooks'
import { type ConsignmentContract } from '../model'
import { earliestPlannedEnd, makeTerminationNoticeSchema, type TerminationNoticeFormValues } from '../payoutModel'
import { VehicleRentalImpactList } from './VehicleRentalImpactList'

/**
 * Ghi nhận thông báo chấm dứt (BRD mục 15, VC-BR-14): bên yêu cầu, ngày thông báo (cho nhập lùi), ngày dự kiến kết thúc
 * (≥ ngày thông báo + thời gian báo trước) và lý do. Hiện các lượt thuê của xe để biết trước ảnh hưởng.
 */
export function ConsignmentTerminationNoticeDialog({
  contract,
  open,
  onOpenChange,
}: {
  contract: ConsignmentContract
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = vi.consignment.termination
  const notify = useNotifyConsignmentTermination()
  const todayKey = toDateKey(new Date())
  const schema = useMemo(
    () =>
      makeTerminationNoticeSchema({
        effectiveFrom: contract.effectiveFrom,
        effectiveTo: contract.effectiveTo,
        noticePeriodDays: contract.noticePeriodDays,
        todayKey,
      }),
    [contract.effectiveFrom, contract.effectiveTo, contract.noticePeriodDays, todayKey],
  )

  const initial = useMemo((): TerminationNoticeFormValues => {
    const earliest = earliestPlannedEnd(todayKey, contract.noticePeriodDays)
    return { requestedBy: 'OWNER', noticeDate: todayKey, plannedEndDate: earliest < contract.effectiveTo ? earliest : '', reason: '' }
  }, [todayKey, contract.noticePeriodDays, contract.effectiveTo])

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TerminationNoticeFormValues>({ resolver: zodResolver(schema), defaultValues: initial })

  useEffect(() => {
    if (open) reset(initial)
  }, [open, initial, reset])

  const noticeDate = useWatch({ control, name: 'noticeDate' })
  const earliest = noticeDate ? earliestPlannedEnd(noticeDate, contract.noticePeriodDays) : undefined

  async function onSubmit(values: TerminationNoticeFormValues) {
    try {
      await notify.mutateAsync({ id: contract.id, input: values })
      toast.success(t.noticeSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.consignment.actionError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t.noticeDialogTitle}</DialogTitle>
          <DialogDescription>{t.noticeDialogDescription(contract.contractNo, contract.noticePeriodDays)}</DialogDescription>
        </DialogHeader>
        <form id="consignment-notice-form" className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label>{t.requestedByLabel} *</Label>
            <Controller
              control={control}
              name="requestedBy"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full sm:w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONSIGNMENT_TERMINATION_REQUESTERS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {CONSIGNMENT_TERMINATION_REQUESTER_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notice-date">{t.noticeDateLabel} *</Label>
              <Input id="notice-date" type="date" max={todayKey} min={contract.effectiveFrom} {...register('noticeDate')} />
              {errors.noticeDate && <p className="text-destructive text-sm">{errors.noticeDate.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notice-planned-end">{t.plannedEndLabel} *</Label>
              <Input id="notice-planned-end" type="date" {...register('plannedEndDate')} />
              {errors.plannedEndDate ? (
                <p className="text-destructive text-sm">{errors.plannedEndDate.message}</p>
              ) : (
                earliest && <p className="text-muted-foreground text-xs">{t.plannedEndHint(formatDate(earliest))}</p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notice-reason">{t.noticeReasonLabel} *</Label>
            <Textarea id="notice-reason" rows={3} {...register('reason')} />
            {errors.reason && <p className="text-destructive text-sm">{errors.reason.message}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{t.impactTitle}</h3>
            <VehicleRentalImpactList vehicleId={contract.vehicleId} />
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="submit" form="consignment-notice-form" disabled={notify.isPending || isSubmitting}>
            {vi.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
