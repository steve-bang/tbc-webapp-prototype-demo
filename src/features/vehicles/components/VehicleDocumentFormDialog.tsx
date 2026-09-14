import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { VEHICLE_DOCUMENT_TYPES } from '@/shared/domain/enums'
import { VEHICLE_DOCUMENT_TYPE_LABELS, vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { useAddVehicleDocument, useUpdateVehicleDocument } from '../hooks'
import { vehicleDocumentFormSchema, type VehicleDocument, type VehicleDocumentFormValues } from '../model'

function toFormValues(doc?: VehicleDocument | null): VehicleDocumentFormValues {
  return {
    documentType: doc?.documentType ?? 'VEHICLE_REGISTRATION',
    documentNumber: doc?.documentNumber ?? '',
    issueDate: doc?.issueDate ?? '',
    expiryDate: doc?.expiryDate ?? '',
    warningLeadDays: String(doc?.warningLeadDays ?? 30), // CR-2026-046 — mặc định 30 ngày
    note: doc?.note ?? '',
    registeredOwnerName: doc?.registeredOwnerName ?? '',
    inspectionCenter: doc?.inspectionCenter ?? '',
    insuranceProvider: doc?.insuranceProvider ?? '',
    policyNumber: doc?.policyNumber ?? '',
    issuingBank: doc?.issuingBank ?? '',
    heldRegistrationNumber: doc?.heldRegistrationNumber ?? '',
  }
}

/**
 * `VM §16.1`/CR-2026-046 — thêm/sửa `VehicleDocument`. Field riêng theo
 * `documentType` chỉ hiện đúng loại; `expiryDate` ẩn nhãn bắt buộc khi
 * `VEHICLE_REGISTRATION` + xe không `bankFinanced` (BRD §16.1).
 */
export function VehicleDocumentFormDialog({
  vehicleId,
  bankFinanced,
  document,
  open,
  onOpenChange,
}: {
  vehicleId: string
  bankFinanced: boolean
  document?: VehicleDocument | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isEditing = !!document
  const addDocument = useAddVehicleDocument()
  const updateDocument = useUpdateVehicleDocument()
  const schema = useMemo(() => vehicleDocumentFormSchema(bankFinanced), [bankFinanced])

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VehicleDocumentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(document),
  })

  useEffect(() => {
    if (open) reset(toFormValues(document))
  }, [document, open, reset])

  const documentType = useWatch({ control, name: 'documentType' })
  const expiryRequired = documentType !== 'VEHICLE_REGISTRATION' || bankFinanced
  const isBusy = addDocument.isPending || updateDocument.isPending || isSubmitting

  async function onSubmit(values: VehicleDocumentFormValues) {
    const input = {
      documentType: values.documentType,
      documentNumber: values.documentNumber || undefined,
      issueDate: values.issueDate || undefined,
      expiryDate: values.expiryDate || undefined,
      warningLeadDays: Number(values.warningLeadDays),
      note: values.note || undefined,
      registeredOwnerName: values.registeredOwnerName || undefined,
      inspectionCenter: values.inspectionCenter || undefined,
      insuranceProvider: values.insuranceProvider || undefined,
      policyNumber: values.policyNumber || undefined,
      issuingBank: values.issuingBank || undefined,
      heldRegistrationNumber: values.heldRegistrationNumber || undefined,
    }
    try {
      if (isEditing && document) {
        await updateDocument.mutateAsync({ vehicleId, docId: document.id, input })
        toast.success(vi.vehicles.updateDocumentSuccess)
      } else {
        await addDocument.mutateAsync({ vehicleId, input })
        toast.success(vi.vehicles.addDocumentSuccess)
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.vehicles.documentSaveError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? vi.vehicles.editDocument : vi.vehicles.addDocument}</DialogTitle>
        </DialogHeader>

        <form id="vehicle-document-form" className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label>{vi.vehicles.documentType} *</Label>
            <Controller
              control={control}
              name="documentType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={vi.vehicles.documentTypePlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLE_DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {VEHICLE_DOCUMENT_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="documentNumber">{vi.vehicles.documentNumber}</Label>
            <Input id="documentNumber" {...register('documentNumber')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="issueDate">{vi.vehicles.documentIssueDate}</Label>
              <Input id="issueDate" type="date" {...register('issueDate')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expiryDate">
                {vi.vehicles.documentExpiryDate} {expiryRequired ? '*' : ''}
              </Label>
              <Input id="expiryDate" type="date" {...register('expiryDate')} />
              {errors.expiryDate && <p className="text-destructive text-sm">{errors.expiryDate.message}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="warningLeadDays">{vi.vehicles.documentWarningLeadDays} *</Label>
            <Input id="warningLeadDays" type="number" {...register('warningLeadDays')} />
            {errors.warningLeadDays && <p className="text-destructive text-sm">{errors.warningLeadDays.message}</p>}
          </div>

          {documentType === 'VEHICLE_REGISTRATION' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="registeredOwnerName">{vi.vehicles.registeredOwnerName}</Label>
              <Input id="registeredOwnerName" {...register('registeredOwnerName')} />
            </div>
          )}

          {documentType === 'INSPECTION' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inspectionCenter">{vi.vehicles.inspectionCenter}</Label>
              <Input id="inspectionCenter" {...register('inspectionCenter')} />
            </div>
          )}

          {documentType === 'INSURANCE' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="insuranceProvider">{vi.vehicles.insuranceProvider}</Label>
                <Input id="insuranceProvider" {...register('insuranceProvider')} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="policyNumber">{vi.vehicles.policyNumber}</Label>
                <Input id="policyNumber" {...register('policyNumber')} />
              </div>
            </div>
          )}

          {documentType === 'MORTGAGE_RECEIPT' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="issuingBank">{vi.vehicles.issuingBank}</Label>
                <Input id="issuingBank" {...register('issuingBank')} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="heldRegistrationNumber">{vi.vehicles.heldRegistrationNumber}</Label>
                <Input id="heldRegistrationNumber" {...register('heldRegistrationNumber')} />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">{vi.vehicles.documentNote}</Label>
            <Textarea id="note" rows={2} {...register('note')} />
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="submit" form="vehicle-document-form" disabled={isBusy}>
            {vi.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
