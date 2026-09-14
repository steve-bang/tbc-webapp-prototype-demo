import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { useRemoveCustomerDocument } from '../hooks'
import type { CustomerDocument } from '../model'

/** `UC-CM-14` — xác nhận xoá một `CustomerDocument` (thao tác có audit `DELETE_CUSTOMER_DOCUMENT`). */
export function CustomerDocumentDeleteDialog({
  customerId,
  document,
  open,
  onOpenChange,
}: {
  customerId: string
  document: CustomerDocument | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const removeDocument = useRemoveCustomerDocument()

  async function handleConfirm() {
    if (!document) return
    try {
      await removeDocument.mutateAsync({ customerId, docId: document.id })
      toast.success(vi.customers.removeDocumentSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.customers.documentRemoveError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.customers.removeDocumentTitle}</DialogTitle>
          <DialogDescription>{vi.customers.removeDocumentDescription}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="button" variant="destructive" disabled={removeDocument.isPending} onClick={handleConfirm}>
            {vi.common.delete}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
