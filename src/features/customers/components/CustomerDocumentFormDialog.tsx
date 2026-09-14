import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { CUSTOMER_DOCUMENT_TYPES } from '@/shared/domain/enums'
import { CUSTOMER_DOCUMENT_TYPE_LABELS, vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { useAddCustomerDocument, useUpdateCustomerDocument } from '../hooks'
import { customerDocumentFormSchema, type CustomerDocument, type CustomerDocumentFormValues } from '../model'

function toFormValues(doc?: CustomerDocument | null): CustomerDocumentFormValues {
  return {
    documentType: doc?.documentType ?? 'ID_CARD',
    documentNumber: doc?.documentNumber ?? '',
    issueDate: doc?.issueDate ?? '',
    expiryDate: doc?.expiryDate ?? '',
    note: doc?.note ?? '',
  }
}

/** `UC-CM-07`/`CM §22` — thêm/sửa một `CustomerDocument` của khách hàng. */
export function CustomerDocumentFormDialog({
  customerId,
  document,
  open,
  onOpenChange,
}: {
  customerId: string
  document?: CustomerDocument | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isEditing = !!document
  const addDocument = useAddCustomerDocument()
  const updateDocument = useUpdateCustomerDocument()

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomerDocumentFormValues>({
    resolver: zodResolver(customerDocumentFormSchema),
    defaultValues: toFormValues(document),
  })

  useEffect(() => {
    if (open) reset(toFormValues(document))
  }, [document, open, reset])

  const isBusy = addDocument.isPending || updateDocument.isPending || isSubmitting

  async function onSubmit(values: CustomerDocumentFormValues) {
    const input = {
      documentType: values.documentType,
      documentNumber: values.documentNumber,
      issueDate: values.issueDate || undefined,
      expiryDate: values.expiryDate || undefined,
      note: values.note || undefined,
    }
    try {
      if (isEditing && document) {
        await updateDocument.mutateAsync({ customerId, docId: document.id, input })
        toast.success(vi.customers.updateDocumentSuccess)
      } else {
        await addDocument.mutateAsync({ customerId, input })
        toast.success(vi.customers.addDocumentSuccess)
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.customers.documentSaveError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? vi.customers.editDocument : vi.customers.addDocument}</DialogTitle>
        </DialogHeader>

        <form id="customer-document-form" className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label>{vi.customers.documentType} *</Label>
            <Controller
              control={control}
              name="documentType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={vi.customers.documentTypePlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOMER_DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {CUSTOMER_DOCUMENT_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.documentType && <p className="text-destructive text-sm">{errors.documentType.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="documentNumber">{vi.customers.documentNumber} *</Label>
            <Input id="documentNumber" {...register('documentNumber')} />
            {errors.documentNumber && <p className="text-destructive text-sm">{errors.documentNumber.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="issueDate">{vi.customers.documentIssueDate}</Label>
              <Input id="issueDate" type="date" {...register('issueDate')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expiryDate">{vi.customers.documentExpiryDate}</Label>
              <Input id="expiryDate" type="date" {...register('expiryDate')} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">{vi.customers.documentNote}</Label>
            <Textarea id="note" rows={2} {...register('note')} />
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="submit" form="customer-document-form" disabled={isBusy}>
            {vi.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
