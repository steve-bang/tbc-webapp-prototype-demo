import { toast } from 'sonner'
import type { SettlementRequestType } from '@/shared/domain/enums'
import { SETTLEMENT_REQUEST_TYPE_LABELS, vi } from '@/shared/i18n/vi'
import { formatVnd } from '@/shared/lib/money'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { useCreateSettlementPaymentRequest } from '../hooks'

/** UC-RS-10/11, RS-BR-10/20, EX-03, §0.3 kế hoạch — chỉ ghi lại yêu cầu, không sinh giao dịch. */
export function SettlementPaymentRequestDialog({
  settlementId,
  type,
  amount,
  open,
  onOpenChange,
}: {
  settlementId: string
  type: SettlementRequestType | null
  amount: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const createRequest = useCreateSettlementPaymentRequest()

  async function handleConfirm() {
    if (!type) return
    try {
      await createRequest.mutateAsync({ id: settlementId, type })
      toast.success(vi.finance.createRequestSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.finance.createRequestError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.finance.createRequestDialogTitle}</DialogTitle>
        </DialogHeader>
        {type && (
          <div className="bg-muted/50 flex items-center justify-between rounded-md p-3 text-sm">
            <span className="text-muted-foreground">{SETTLEMENT_REQUEST_TYPE_LABELS[type]}</span>
            <span className="font-medium">{formatVnd(amount)}</span>
          </div>
        )}
        <p className="text-muted-foreground text-sm">{vi.finance.paymentRequestsNote}</p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="button" disabled={createRequest.isPending} onClick={handleConfirm}>
            {vi.common.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
