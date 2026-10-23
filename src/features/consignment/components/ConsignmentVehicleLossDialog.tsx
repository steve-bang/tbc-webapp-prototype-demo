import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { INCIDENT_STATUS_LABELS, vi } from '@/shared/i18n/vi'
import { formatDate, formatDateTime } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import {
  useConsignmentEndPreview,
  useConsignmentHandoverRecords,
  useRecordConsignmentVehicleLoss,
  useVehicleIncidentsForConsignment,
} from '../hooks'
import { toLocalDateKey, type ConsignmentContract } from '../model'
import { calcPayoutWindow, makeVehicleLossSchema, type VehicleLossFormValues } from '../payoutModel'

const NO_INCIDENT = '__NONE__'

/**
 * Ghi nhận mất xe (BRD mục 11, VC-BR-16, AC-VC-015): chấm dứt hợp đồng từ ngày xảy ra sự kiện, KHÔNG cần biên bản trả xe.
 * Bồi thường và tranh chấp bảo hiểm do hai bên thoả thuận ngoài hệ thống; ở đây chỉ hiện tài liệu tham chiếu (giá trị định giá
 * lúc nhận xe) và xem trước khoản chi trả tháng cuối.
 */
export function ConsignmentVehicleLossDialog({
  contract,
  open,
  onOpenChange,
}: {
  contract: ConsignmentContract
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = vi.consignment.termination
  const record = useRecordConsignmentVehicleLoss()
  const todayKey = toLocalDateKey(new Date())
  const window = calcPayoutWindow(contract)
  const schema = useMemo(() => makeVehicleLossSchema({ payoutStart: window?.start ?? contract.effectiveFrom, todayKey }), [window?.start, contract.effectiveFrom, todayKey])
  const { data: incidents } = useVehicleIncidentsForConsignment(contract.vehicleId)
  const { data: handovers } = useConsignmentHandoverRecords({ contractId: contract.id })
  const intake = handovers?.find((r) => r.type === 'INTAKE')

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VehicleLossFormValues>({ resolver: zodResolver(schema), defaultValues: { eventDate: todayKey, incidentId: '', note: '' } })

  useEffect(() => {
    if (open) reset({ eventDate: todayKey, incidentId: '', note: '' })
  }, [open, todayKey, reset])

  const eventDate = useWatch({ control, name: 'eventDate' })
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(eventDate ?? '') && eventDate <= todayKey && (!window || eventDate >= window.start)
  const { data: preview } = useConsignmentEndPreview(open && validDate ? contract.id : undefined, validDate ? eventDate : undefined)

  async function onSubmit(values: VehicleLossFormValues) {
    try {
      await record.mutateAsync({ id: contract.id, input: { eventDate: values.eventDate, incidentId: values.incidentId || undefined, note: values.note } })
      toast.success(t.lossSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.consignment.actionError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t.lossDialogTitle}</DialogTitle>
          <DialogDescription>{t.lossDialogDescription(contract.contractNo)}</DialogDescription>
        </DialogHeader>
        <form id="consignment-loss-form" className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="loss-date">{t.lossDateLabel} *</Label>
            <Input id="loss-date" type="date" max={todayKey} min={window?.start} {...register('eventDate')} />
            {errors.eventDate && <p className="text-destructive text-sm">{errors.eventDate.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t.lossIncidentLabel}</Label>
            <Controller
              control={control}
              name="incidentId"
              render={({ field }) => (
                <Select value={field.value || NO_INCIDENT} onValueChange={(v) => field.onChange(v === NO_INCIDENT ? '' : v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_INCIDENT}>{t.lossIncidentNone}</SelectItem>
                    {(incidents ?? []).map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.incidentCode} — {INCIDENT_STATUS_LABELS[i.status]} — {formatDateTime(i.reportedAt)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="loss-note">{t.lossNoteLabel} *</Label>
            <Textarea id="loss-note" rows={3} {...register('note')} />
            {errors.note && <p className="text-destructive text-sm">{errors.note.message}</p>}
          </div>

          <div className="border-border bg-muted/40 flex flex-col gap-1 rounded-md border p-3 text-sm">
            <p className="font-medium">{t.lossReferenceTitle}</p>
            <p>
              <span className="text-muted-foreground">{t.lossAppraised}: </span>
              {intake?.appraisedValue ? formatVnd(intake.appraisedValue) : vi.consignment.noValue}
              {intake ? ` (${intake.code} — ${formatDate(intake.handoverAt)})` : ''}
            </p>
            <p className="text-muted-foreground text-xs">{t.lossReferenceNote}</p>
          </div>

          {preview && !preview.error && (
            <div className="border-border flex flex-col gap-1 rounded-md border p-3 text-sm">
              <p className="font-medium">{t.endPreviewTitle}</p>
              {preview.lastPeriodDays !== undefined && preview.lastPeriodDaysInMonth !== undefined && (
                <p>{t.endPreviewLastPeriod(preview.lastPeriodDays, preview.lastPeriodDaysInMonth)}</p>
              )}
              <p>{t.endPreviewCounts(preview.cancelCount, preview.createCount)}</p>
            </div>
          )}
          {preview?.error && <p className="text-destructive text-sm">{preview.error}</p>}

          <p className="text-status-pending text-xs">{t.lossVehicleStatusReminder}</p>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="submit" form="consignment-loss-form" variant="destructive" disabled={record.isPending || isSubmitting || !!preview?.error}>
            {t.lossConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
