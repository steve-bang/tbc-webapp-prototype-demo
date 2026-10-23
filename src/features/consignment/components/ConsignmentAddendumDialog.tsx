import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { usePermission } from '@/features/auth'
import { CONSIGNMENT_PRORATION_RULES } from '@/shared/domain/enums'
import { CONSIGNMENT_PRORATION_RULE_LABELS, vi } from '@/shared/i18n/vi'
import { formatDate, toDateKey } from '@/shared/lib/datetime'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'
import { Textarea } from '@/shared/ui/textarea'
import {
  getAutoRenewSuggestion,
  latestVersionEffectiveFrom,
  makeConsignmentAddendumSchema,
  monthStartKey,
  nextMonthStartKey,
  planAddendum,
  type ConsignmentAddendumDraftInput,
  type ConsignmentAddendumFormValues,
  type ConsignmentAddendumOrigin,
} from '../addendumModel'
import { useCreateConsignmentAddendum, useOwnerPayoutRecords } from '../hooks'
import { resolveTermVersion, type ConsignmentContract } from '../model'
import { formatPeriod } from '../payoutModel'

/** Số tháng tối đa liệt kê trong danh sách "ngày hiệu lực" (chỉ ngày 1 của tháng). */
const MAX_EFFECTIVE_MONTH_OPTIONS = 24

function toDraftInput(values: Partial<ConsignmentAddendumFormValues>): ConsignmentAddendumDraftInput {
  return {
    origin: values.origin ?? 'MANUAL',
    signedDate: values.signedDate ?? '',
    extension: values.extend ? { toEffectiveTo: values.toEffectiveTo ?? '' } : undefined,
    termChange: values.changeTerm
      ? {
          effectiveFrom: values.termEffectiveFrom ?? '',
          to: {
            fixedMonthlyAmount: Number(values.fixedMonthlyAmount),
            paymentDay: Number(values.paymentDay),
            prorationRule: values.prorationRule ?? 'PRORATE_BY_DAY',
          },
        }
      : undefined,
    content: values.content ?? '',
    signedFileName: values.signedFileName ?? '',
  }
}

/** Các ngày 1 của tháng từ tháng hiện tại, sau phiên bản mới nhất và không quá `endKey`. */
function listEffectiveMonthStarts(todayKey: string, latestKey: string, endKey: string): string[] {
  const out: string[] = []
  let cursor = monthStartKey(todayKey)
  for (let i = 0; i < MAX_EFFECTIVE_MONTH_OPTIONS && cursor <= endKey; i += 1) {
    if (cursor > latestKey) out.push(cursor)
    cursor = nextMonthStartKey(cursor)
  }
  return out
}

/**
 * Lập phụ lục (UC-VC-10): hai công tắc "Gia hạn thời hạn" / "Đổi điều khoản chi trả" (công tắc thứ hai khoá khi thiếu quyền
 * `CONSIGNMENT.CONFIG`). Phụ lục hiệu lực ngay khi lập (bản scan đã ký bắt buộc). "Xem trước" dùng CÙNG hàm thuần với API: các khoản
 * chi trả sẽ bị huỷ / thay thế / bù thêm, hoặc lý do chặn. `origin = AUTO_RENEW` điền sẵn gợi ý gia hạn theo hợp đồng bật tự động gia hạn.
 */
export function ConsignmentAddendumDialog({
  contract,
  origin = 'MANUAL',
  open,
  onOpenChange,
}: {
  contract: ConsignmentContract
  origin?: ConsignmentAddendumOrigin
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = vi.consignment.addenda
  const { can } = usePermission()
  const canConfig = can('CONSIGNMENT', 'CONFIG')
  const create = useCreateConsignmentAddendum()
  const { data: records } = useOwnerPayoutRecords({ contractId: contract.id })
  const todayKey = toDateKey(new Date())

  const schema = useMemo(
    () =>
      makeConsignmentAddendumSchema({
        currentEffectiveTo: contract.effectiveTo,
        monthStartKey: monthStartKey(todayKey),
        latestVersionEffectiveFrom: latestVersionEffectiveFrom(contract),
        activatedKey: contract.activatedAt ? toDateKey(contract.activatedAt) : contract.effectiveFrom,
        todayKey,
        canConfig,
      }),
    [contract, todayKey, canConfig],
  )

  const initial = useMemo((): ConsignmentAddendumFormValues => {
    const suggestion = origin === 'AUTO_RENEW' ? getAutoRenewSuggestion(contract, todayKey) : undefined
    // Gợi ý ngày 1 tháng sau; nếu không chọn được (đã có phiên bản hiệu lực từ đó) thì lấy tháng gần nhất còn chọn được.
    const options = listEffectiveMonthStarts(todayKey, latestVersionEffectiveFrom(contract), contract.effectiveTo)
    const next = nextMonthStartKey(todayKey)
    const effectiveFrom = options.includes(next) ? next : (options[0] ?? next)
    const term = resolveTermVersion(contract, effectiveFrom).paymentTerm
    return {
      origin,
      extend: !!suggestion,
      toEffectiveTo: suggestion?.suggestedEffectiveTo ?? '',
      changeTerm: false,
      termEffectiveFrom: effectiveFrom,
      fixedMonthlyAmount: String(term.fixedMonthlyAmount),
      paymentDay: String(term.paymentDay),
      prorationRule: term.prorationRule,
      signedDate: todayKey,
      signedFileName: '',
      content: suggestion ? t.autoRenewContent : '',
    }
  }, [contract, origin, todayKey, t.autoRenewContent])

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ConsignmentAddendumFormValues>({ resolver: zodResolver(schema), defaultValues: initial })

  useEffect(() => {
    if (open) reset(initial)
  }, [open, initial, reset])

  const values = useWatch({ control })
  const extend = values.extend ?? false
  const changeTerm = values.changeTerm ?? false

  // Xem trước: cùng hàm thuần với API (không ghi).
  const preview = useMemo(() => {
    if (!records || (!extend && !changeTerm)) return undefined
    const input = toDraftInput(values)
    return planAddendum(contract, records, input, todayKey, {
      id: 'preview',
      addendumNo: t.previewNo,
      byName: '',
      now: new Date().toISOString(),
    })
  }, [records, extend, changeTerm, values, contract, todayKey, t.previewNo])

  const effectiveEnd = extend && values.toEffectiveTo ? values.toEffectiveTo : contract.effectiveTo
  const monthOptions = useMemo(
    () => listEffectiveMonthStarts(todayKey, latestVersionEffectiveFrom(contract), effectiveEnd),
    [todayKey, contract, effectiveEnd],
  )

  async function onSubmit(formValues: ConsignmentAddendumFormValues) {
    try {
      const result = await create.mutateAsync({ contractId: contract.id, input: toDraftInput(formValues) })
      toast.success(t.createSuccess(result.addendum.addendumNo))
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.consignment.actionError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{origin === 'AUTO_RENEW' ? t.dialogTitleAutoRenew : t.dialogTitle}</DialogTitle>
          <DialogDescription>{t.dialogDescription(contract.contractNo)}</DialogDescription>
        </DialogHeader>

        <form id="consignment-addendum-form" className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="addendum-extend">{t.toggleExtend}</Label>
              <Controller
                control={control}
                name="extend"
                render={({ field }) => <Switch id="addendum-extend" checked={field.value} onCheckedChange={field.onChange} />}
              />
            </div>
            {errors.extend && <p className="text-destructive text-sm">{errors.extend.message}</p>}
            {extend && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="addendum-to">{t.fieldNewEnd} *</Label>
                <Input id="addendum-to" type="date" min={contract.effectiveTo} {...register('toEffectiveTo')} />
                <p className="text-muted-foreground text-xs">{t.currentEnd(formatDate(contract.effectiveTo))}</p>
                {errors.toEffectiveTo && <p className="text-destructive text-sm">{errors.toEffectiveTo.message}</p>}
              </div>
            )}
          </section>

          <section className="border-t pt-4">
            <fieldset disabled={!canConfig} className="flex flex-col gap-3 disabled:opacity-70">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="addendum-change-term">{t.toggleChangeTerm}</Label>
                <Controller
                  control={control}
                  name="changeTerm"
                  render={({ field }) => (
                    <Switch id="addendum-change-term" checked={field.value} onCheckedChange={field.onChange} disabled={!canConfig} />
                  )}
                />
              </div>
              {!canConfig && <p className="text-muted-foreground text-xs">{t.termLockedHint}</p>}
              {errors.changeTerm && <p className="text-destructive text-sm">{errors.changeTerm.message}</p>}
              {changeTerm && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label>{t.fieldTermEffective} *</Label>
                    <Controller
                      control={control}
                      name="termEffectiveFrom"
                      render={({ field }) => (
                        <Select value={field.value || undefined} onValueChange={field.onChange} disabled={!canConfig}>
                          <SelectTrigger className="w-full sm:w-64">
                            <SelectValue placeholder={t.fieldTermEffectivePlaceholder} />
                          </SelectTrigger>
                          <SelectContent>
                            {monthOptions.map((key) => (
                              <SelectItem key={key} value={key}>
                                {formatDate(key)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <p className="text-muted-foreground text-xs">{t.fieldTermEffectiveHint}</p>
                    {errors.termEffectiveFrom && <p className="text-destructive text-sm">{errors.termEffectiveFrom.message}</p>}
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="addendum-amount">{vi.consignment.contractFixedMonthlyAmount} *</Label>
                      <Input id="addendum-amount" inputMode="numeric" {...register('fixedMonthlyAmount')} />
                      {errors.fixedMonthlyAmount && <p className="text-destructive text-sm">{errors.fixedMonthlyAmount.message}</p>}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="addendum-payday">{vi.consignment.contractPaymentDay} *</Label>
                      <Input id="addendum-payday" inputMode="numeric" {...register('paymentDay')} />
                      {errors.paymentDay && <p className="text-destructive text-sm">{errors.paymentDay.message}</p>}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>{vi.consignment.contractProrationRule}</Label>
                      <Controller
                        control={control}
                        name="prorationRule"
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange} disabled={!canConfig}>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CONSIGNMENT_PRORATION_RULES.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {CONSIGNMENT_PRORATION_RULE_LABELS[r]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  </div>
                </>
              )}
            </fieldset>
          </section>

          <section className="flex flex-col gap-4 border-t pt-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="addendum-signed">{t.fieldSignedDate} *</Label>
                <Input id="addendum-signed" type="date" max={todayKey} {...register('signedDate')} />
                {errors.signedDate && <p className="text-destructive text-sm">{errors.signedDate.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="addendum-file">{t.fieldSignedFile} *</Label>
                <Input id="addendum-file" {...register('signedFileName')} />
                {errors.signedFileName && <p className="text-destructive text-sm">{errors.signedFileName.message}</p>}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="addendum-content">{t.fieldContent} *</Label>
              <Textarea id="addendum-content" rows={3} {...register('content')} />
              {errors.content && <p className="text-destructive text-sm">{errors.content.message}</p>}
            </div>
          </section>

          {preview && (
            <section className="border-border flex flex-col gap-1 rounded-md border p-3 text-sm">
              <p className="font-medium">{t.previewTitle}</p>
              {'error' in preview ? (
                <p className="text-destructive">{preview.error}</p>
              ) : preview.plan.cancel.length === 0 && preview.plan.create.length === 0 ? (
                <p className="text-muted-foreground">{t.previewNoImpact}</p>
              ) : (
                <>
                  <p>{t.previewCounts(preview.plan.cancel.length, preview.plan.create.length)}</p>
                  {preview.plan.cancel.length > 0 && (
                    <p className="text-muted-foreground text-xs">
                      {t.previewCancelled}: {preview.plan.cancel.map((r) => `${r.code} (${formatPeriod(r.period)})`).join(', ')}
                    </p>
                  )}
                  {preview.plan.create.length > 0 && (
                    <p className="text-muted-foreground text-xs">
                      {t.previewCreated}: {preview.plan.create.map((d) => formatPeriod(d.period)).join(', ')}
                    </p>
                  )}
                </>
              )}
            </section>
          )}
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button
            type="submit"
            form="consignment-addendum-form"
            disabled={create.isPending || isSubmitting || (!!preview && 'error' in preview)}
          >
            {t.submitButton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
