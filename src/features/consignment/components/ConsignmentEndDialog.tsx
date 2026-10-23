import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { formatDate, toDateKey } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import {
  useCloseConsignmentContract,
  useConsignmentEndPreview,
  useConsignmentHandoverRecords,
  useOwnerPayoutRecords,
  useTerminateConsignmentContract,
} from '../hooks'
import { type ConsignmentContract } from '../model'
import { canCloseContract } from '../payoutModel'

export type ConsignmentEndKind = 'terminate' | 'close'

/**
 * Xác nhận Chấm dứt / Đóng hợp đồng (BRD mục 7.2, UC-VC-11). Chấm dứt: xem trước kế hoạch tính lại lịch chi trả (kỳ cuối
 * `x/y` ngày, số khoản bị huỷ, khoản thay thế, số khoản còn chưa chi). Đóng: hiện điều kiện (mọi khoản đã chi) và lý do chặn.
 */
export function ConsignmentEndDialog({
  contract,
  kind,
  open,
  onOpenChange,
}: {
  contract: ConsignmentContract
  kind: ConsignmentEndKind
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = vi.consignment.termination
  const terminate = useTerminateConsignmentContract()
  const close = useCloseConsignmentContract()
  const { data: handovers } = useConsignmentHandoverRecords({ contractId: contract.id })
  const returnRecord = handovers?.find((r) => r.id === contract.returnRecordId && r.type === 'RETURN')
  const { data: payouts } = useOwnerPayoutRecords({ contractId: contract.id })

  const endedDate = kind === 'terminate' && returnRecord ? toDateKey(returnRecord.handoverAt) : undefined
  const { data: preview } = useConsignmentEndPreview(open && endedDate ? contract.id : undefined, endedDate)

  const closeBlocker = kind === 'close' && payouts ? canCloseContract(contract, payouts, returnRecord, toDateKey(new Date())) : undefined
  const unpaid = (payouts ?? []).filter((r) => r.status === 'SCHEDULED' || r.status === 'ON_HOLD')
  const unpaidTotal = unpaid.reduce((sum, r) => sum + r.amountPayable, 0)

  const pending = terminate.isPending || close.isPending
  const blocked = kind === 'terminate' ? !!preview?.error || !endedDate : !!closeBlocker

  async function handleConfirm() {
    try {
      if (kind === 'terminate') {
        await terminate.mutateAsync(contract.id)
        toast.success(t.terminateSuccess)
      } else {
        await close.mutateAsync(contract.id)
        toast.success(t.closeSuccess)
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.consignment.actionError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{kind === 'terminate' ? t.terminateDialogTitle : t.closeDialogTitle}</DialogTitle>
          <DialogDescription>{contract.contractNo}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm">
          {kind === 'terminate' ? (
            <>
              {endedDate && (
                <p>
                  <span className="text-muted-foreground">{t.endedDateLabel}: </span>
                  <span className="font-medium">{formatDate(endedDate)}</span>
                </p>
              )}
              {preview?.error && <p className="text-destructive">{preview.error}</p>}
              {preview && !preview.error && (
                <div className="border-border flex flex-col gap-1 rounded-md border p-3">
                  <p className="font-medium">{t.endPreviewTitle}</p>
                  {preview.lastPeriodDays !== undefined && preview.lastPeriodDaysInMonth !== undefined && (
                    <p>{t.endPreviewLastPeriod(preview.lastPeriodDays, preview.lastPeriodDaysInMonth)}</p>
                  )}
                  <p>{t.endPreviewCounts(preview.cancelCount, preview.createCount)}</p>
                  <p className="text-muted-foreground text-xs">{t.endPreviewUnpaid(preview.unpaidCount)}</p>
                </div>
              )}
              <p className="text-muted-foreground text-xs">{t.terminateNote}</p>
            </>
          ) : (
            <>
              <p>
                <span className="text-muted-foreground">{t.endedDateLabel}: </span>
                <span className="font-medium">{formatDate(contract.effectiveTo)}</span>
              </p>
              <p className="text-muted-foreground">{t.closeUnpaid(unpaid.length, formatVnd(unpaidTotal))}</p>
              {closeBlocker && <p className="text-destructive">{closeBlocker}</p>}
              <p className="text-muted-foreground text-xs">{t.closeNote}</p>
            </>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="button" variant={kind === 'terminate' ? 'destructive' : 'default'} disabled={pending || blocked} onClick={handleConfirm}>
            {kind === 'terminate' ? t.terminateConfirm : t.closeConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
