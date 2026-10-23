import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { useRecordConsignmentAppraisal } from '../hooks'
import { INTAKE_CHECKLIST_KEYS, INTAKE_DOCUMENT_KEYS } from '../model'
import {
  consignmentAppraisalFormSchema,
  PROPOSAL_CHECKLIST_LABELS,
  PROPOSAL_DOCUMENT_LABELS,
  PROPOSAL_OWNERSHIP_CHECKS,
  type ConsignmentAppraisalFormValues,
  type ConsignmentProposal,
} from '../proposalModel'

function toFormValues(proposal: ConsignmentProposal): ConsignmentAppraisalFormValues {
  const appraisal = proposal.appraisal
  return {
    ownershipCheck: appraisal?.ownershipCheck ?? 'REGISTERED_OWNER',
    documents: INTAKE_DOCUMENT_KEYS.map((key) => {
      const found = appraisal?.documents.find((d) => d.key === key)
      return { key, ok: found?.ok ?? true, note: found?.note ?? '' }
    }),
    checklist: INTAKE_CHECKLIST_KEYS.map((item) => {
      const found = appraisal?.checklist.find((c) => c.item === item)
      return { item, ok: found?.ok ?? true, note: found?.note ?? '' }
    }),
    odoKm: appraisal ? String(appraisal.odoKm) : '',
    accessoriesText: appraisal?.accessories.join('\n') ?? '',
    mediaNote: appraisal?.mediaNote ?? '',
    conditionNote: appraisal?.conditionNote ?? '',
    appraisedValue: appraisal ? String(appraisal.appraisedValue) : '',
    pendingDocumentsNote: appraisal?.pendingDocumentsNote ?? '',
  }
}

/**
 * Ghi kết quả thẩm định (BRD mục 8): xác minh chủ sở hữu, 3 giấy tờ, checklist hiện trạng, odo, phụ kiện, ảnh / video giả lập,
 * mô tả hiện trạng, định giá (VC-BR-16). Điền sẵn khi đã có kết quả — ghi lại sẽ ghi đè, nhật ký giữ bản trước.
 */
export function ConsignmentAppraisalDialog({
  proposal,
  open,
  onOpenChange,
}: {
  proposal: ConsignmentProposal
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = vi.consignment.proposals
  const record = useRecordConsignmentAppraisal()
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ConsignmentAppraisalFormValues>({
    resolver: zodResolver(consignmentAppraisalFormSchema),
    defaultValues: toFormValues(proposal),
  })

  useEffect(() => {
    if (open) reset(toFormValues(proposal))
  }, [open, proposal, reset])

  const documents = useWatch({ control, name: 'documents' })
  const checklist = useWatch({ control, name: 'checklist' })

  async function onSubmit(values: ConsignmentAppraisalFormValues) {
    try {
      await record.mutateAsync({
        id: proposal.id,
        input: {
          ownershipCheck: values.ownershipCheck,
          documents: values.documents.map((d) => ({ key: d.key, ok: d.ok, note: d.note || undefined })),
          checklist: values.checklist.map((c) => ({ item: c.item, ok: c.ok, note: c.note || undefined })),
          odoKm: Number(values.odoKm),
          accessories: (values.accessoriesText ?? '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
          mediaNote: values.mediaNote || undefined,
          conditionNote: values.conditionNote,
          appraisedValue: Number(values.appraisedValue),
          pendingDocumentsNote: values.pendingDocumentsNote || undefined,
        },
      })
      toast.success(t.appraisalSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.consignment.actionError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t.appraisalDialogTitle}</DialogTitle>
          <DialogDescription>
            {proposal.code} — {proposal.declaredVehicle.plate}
          </DialogDescription>
        </DialogHeader>

        <form id="consignment-appraisal-form" className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label>{t.fieldOwnershipCheck} *</Label>
            <Controller
              control={control}
              name="ownershipCheck"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full sm:w-96">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPOSAL_OWNERSHIP_CHECKS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {t.ownershipCheck[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{t.documentsTitle}</h3>
            {documents.map((doc, index) => (
              <div key={doc.key} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[12rem_1fr]">
                <div className="flex items-center gap-2">
                  <Controller
                    control={control}
                    name={`documents.${index}.ok`}
                    render={({ field }) => (
                      <Checkbox id={`appraisal-doc-${doc.key}`} checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                    )}
                  />
                  <Label htmlFor={`appraisal-doc-${doc.key}`}>
                    {PROPOSAL_DOCUMENT_LABELS[doc.key]} — {t.itemOk}
                  </Label>
                </div>
                <Input placeholder={t.itemNote} {...register(`documents.${index}.note`)} />
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{t.checklistTitle}</h3>
            {checklist.map((item, index) => (
              <div key={item.item} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[12rem_1fr]">
                <div className="flex items-center gap-2">
                  <Controller
                    control={control}
                    name={`checklist.${index}.ok`}
                    render={({ field }) => (
                      <Checkbox id={`appraisal-check-${item.item}`} checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                    )}
                  />
                  <Label htmlFor={`appraisal-check-${item.item}`}>
                    {PROPOSAL_CHECKLIST_LABELS[item.item as keyof typeof PROPOSAL_CHECKLIST_LABELS] ?? item.item} — {t.itemOk}
                  </Label>
                </div>
                <Input placeholder={t.itemNote} {...register(`checklist.${index}.note`)} />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="appraisal-odo">{t.fieldOdo} *</Label>
              <Input id="appraisal-odo" inputMode="numeric" {...register('odoKm')} />
              {errors.odoKm && <p className="text-destructive text-sm">{errors.odoKm.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="appraisal-value">{t.fieldAppraisedValue} *</Label>
              <Input id="appraisal-value" inputMode="numeric" {...register('appraisedValue')} />
              {errors.appraisedValue ? (
                <p className="text-destructive text-sm">{errors.appraisedValue.message}</p>
              ) : (
                <p className="text-muted-foreground text-xs">{t.appraisedValueHint}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="appraisal-condition">{t.fieldConditionNote} *</Label>
            <Textarea id="appraisal-condition" rows={3} {...register('conditionNote')} />
            {errors.conditionNote && <p className="text-destructive text-sm">{errors.conditionNote.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="appraisal-accessories">{t.fieldAccessories}</Label>
            <Textarea id="appraisal-accessories" rows={3} {...register('accessoriesText')} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="appraisal-media">{t.fieldMediaNote}</Label>
            <Input id="appraisal-media" {...register('mediaNote')} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="appraisal-pending">{t.fieldPendingDocuments}</Label>
            <Input id="appraisal-pending" {...register('pendingDocumentsNote')} />
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="submit" form="consignment-appraisal-form" disabled={record.isPending || isSubmitting}>
            {vi.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
