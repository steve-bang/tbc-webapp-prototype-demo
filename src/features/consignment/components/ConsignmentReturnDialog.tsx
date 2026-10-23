import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { useSessionStore } from '@/features/auth'
import { vi } from '@/shared/i18n/vi'
import { dateTimeInputToIso, isoToDateTimeInput } from '@/shared/lib/datetime'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { useConsignmentHandoverRecords, useRecordConsignmentReturn, useVehicleRentalsForConsignment } from '../hooks'
import type { ConsignmentContract } from '../model'
import { listBlockingRentals, makeConsignmentReturnFormSchema, type ConsignmentReturnFormValues } from '../payoutModel'
import { VehicleRentalImpactList } from './VehicleRentalImpactList'

const CHECKLIST_LABEL: Record<string, string> = {
  EXTERIOR: vi.consignment.checklistExterior,
  INTERIOR: vi.consignment.checklistInterior,
  MECHANICAL: vi.consignment.checklistMechanical,
}

function defaultValues(repName: string): ConsignmentReturnFormValues {
  return {
    // N8 — "bây giờ" theo +07 (SA-BR-14), không theo giờ trình duyệt
    handoverAt: isoToDateTimeInput(new Date().toISOString()),
    odoKm: '',
    fuelLevel: '',
    baselineCondition: '',
    checklist: Object.keys(CHECKLIST_LABEL).map((item) => ({ item, ok: true, note: '' })),
    accessoriesText: '',
    documents: [
      { name: vi.consignment.docRegistration, kind: 'ORIGINAL' },
      { name: vi.consignment.docInspection, kind: 'ORIGINAL' },
      { name: vi.consignment.docInsurance, kind: 'ORIGINAL' },
    ],
    missingDocumentsNote: '',
    mediaNote: '',
    companyRepName: repName,
    ownerConfirmed: false,
    companyConfirmed: false,
  }
}

/**
 * Lập biên bản trả xe về chủ xe (`RETURN`) — mirror biên bản nhận xe nhưng không có định giá. VC-BR-15 (hai bên xác nhận),
 * VC-BR-14 (chặn khi xe còn lượt thuê đã xác nhận / đang chạy), thời điểm trả không ở tương lai và không trước lúc nhận xe.
 * "Giấy tờ" ở đây là giấy tờ gốc trả lại cho chủ xe.
 */
export function ConsignmentReturnDialog({
  contract,
  open,
  onOpenChange,
}: {
  contract: ConsignmentContract
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = vi.consignment.termination
  const record = useRecordConsignmentReturn()
  const repName = useSessionStore((s) => s.user?.fullName ?? '')
  const { data: handovers } = useConsignmentHandoverRecords({ contractId: contract.id })
  const intake = handovers?.find((r) => r.type === 'INTAKE')
  const { data: rentals } = useVehicleRentalsForConsignment(contract.vehicleId)
  const blockingCount = listBlockingRentals(rentals ?? [], contract.vehicleId).length
  const schema = useMemo(
    () => makeConsignmentReturnFormSchema({ intakeHandoverAt: intake?.handoverAt ?? contract.effectiveFrom, intakeOdoKm: intake?.odoKm ?? 0 }),
    [intake?.handoverAt, intake?.odoKm, contract.effectiveFrom],
  )
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ConsignmentReturnFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues(repName),
  })

  useEffect(() => {
    if (open) reset(defaultValues(repName))
  }, [open, repName, reset])

  const checklist = useWatch({ control, name: 'checklist' })
  const documents = useWatch({ control, name: 'documents' })

  async function onSubmit(values: ConsignmentReturnFormValues) {
    try {
      await record.mutateAsync({
        contractId: contract.id,
        input: {
          handoverAt: dateTimeInputToIso(values.handoverAt), // N8 — ô datetime-local hiểu theo +07
          odoKm: Number(values.odoKm),
          fuelLevel: Number(values.fuelLevel),
          baselineCondition: values.baselineCondition,
          checklist: values.checklist.map((c) => ({ item: c.item, ok: c.ok, note: c.note || undefined })),
          accessories: (values.accessoriesText ?? '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
          documentsReceived: values.documents.flatMap((d) => (d.kind === 'NONE' ? [] : [{ name: d.name, kind: d.kind }])),
          missingDocumentsNote: values.missingDocumentsNote || undefined,
          mediaNote: values.mediaNote || undefined,
          companyRepName: values.companyRepName,
          ownerConfirmed: values.ownerConfirmed,
          companyConfirmed: values.companyConfirmed,
        },
      })
      toast.success(t.returnSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.consignment.actionError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t.returnDialogTitle}</DialogTitle>
          <DialogDescription>{contract.contractNo}</DialogDescription>
        </DialogHeader>

        <form id="consignment-return-form" className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="intake-at">{t.returnAtLabel} *</Label>
              <Input id="intake-at" type="datetime-local" {...register('handoverAt')} />
              {errors.handoverAt && <p className="text-destructive text-sm">{errors.handoverAt.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="intake-odo">{vi.consignment.intakeOdo} *</Label>
              <Input id="intake-odo" inputMode="numeric" {...register('odoKm')} />
              {errors.odoKm && <p className="text-destructive text-sm">{errors.odoKm.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="intake-fuel">{vi.consignment.intakeFuel} *</Label>
              <Input id="intake-fuel" inputMode="numeric" {...register('fuelLevel')} />
              {errors.fuelLevel && <p className="text-destructive text-sm">{errors.fuelLevel.message}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="intake-baseline">{vi.consignment.intakeBaseline} *</Label>
            <Textarea id="intake-baseline" rows={3} {...register('baselineCondition')} />
            {errors.baselineCondition && <p className="text-destructive text-sm">{errors.baselineCondition.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{vi.consignment.intakeChecklistTitle}</h3>
            {checklist.map((item, index) => (
              <div key={item.item} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[10rem_1fr]">
                <div className="flex items-center gap-2">
                  <Controller
                    control={control}
                    name={`checklist.${index}.ok`}
                    render={({ field }) => (
                      <Checkbox
                        id={`intake-check-${item.item}`}
                        checked={field.value}
                        onCheckedChange={(v) => field.onChange(v === true)}
                      />
                    )}
                  />
                  <Label htmlFor={`intake-check-${item.item}`}>
                    {CHECKLIST_LABEL[item.item] ?? item.item} — {vi.consignment.intakeChecklistOk}
                  </Label>
                </div>
                <Input placeholder={vi.consignment.intakeChecklistNote} {...register(`checklist.${index}.note`)} />
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="intake-accessories">{vi.consignment.intakeAccessories}</Label>
            <Textarea id="intake-accessories" rows={3} {...register('accessoriesText')} />
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{t.returnDocumentsTitle}</h3>
            {documents.map((doc, index) => (
              <div key={doc.name} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[10rem_1fr]">
                <span className="text-sm">{doc.name}</span>
                <Controller
                  control={control}
                  name={`documents.${index}.kind`}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ORIGINAL">{vi.consignment.docKindOriginal}</SelectItem>
                        <SelectItem value="COPY">{vi.consignment.docKindCopy}</SelectItem>
                        <SelectItem value="NONE">{vi.consignment.intakeDocumentNone}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="intake-missing">{vi.consignment.intakeMissingNote}</Label>
            <Input id="intake-missing" {...register('missingDocumentsNote')} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="intake-media">{vi.consignment.intakeMediaNote}</Label>
            <Input id="intake-media" {...register('mediaNote')} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="intake-rep">{vi.consignment.intakeCompanyRep} *</Label>
            <Input id="intake-rep" {...register('companyRepName')} />
            {errors.companyRepName && <p className="text-destructive text-sm">{errors.companyRepName.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{t.impactTitle}</h3>
            <VehicleRentalImpactList vehicleId={contract.vehicleId} />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="ownerConfirmed"
                render={({ field }) => (
                  <Checkbox id="intake-owner-ok" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                )}
              />
              <Label htmlFor="intake-owner-ok">{vi.consignment.intakeOwnerConfirmed}</Label>
            </div>
            {errors.ownerConfirmed && <p className="text-destructive text-sm">{errors.ownerConfirmed.message}</p>}
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="companyConfirmed"
                render={({ field }) => (
                  <Checkbox id="intake-company-ok" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                )}
              />
              <Label htmlFor="intake-company-ok">{vi.consignment.intakeCompanyConfirmed}</Label>
            </div>
            {errors.companyConfirmed && <p className="text-destructive text-sm">{errors.companyConfirmed.message}</p>}
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="submit" form="consignment-return-form" disabled={record.isPending || isSubmitting || blockingCount > 0}>
            {vi.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
