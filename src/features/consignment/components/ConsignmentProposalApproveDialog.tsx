import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { useApproveConsignmentProposal } from '../hooks'
import { listAppraisalIssues, type ConsignmentProposal } from '../proposalModel'

/**
 * Xác nhận duyệt đề nghị (UC-VC-02). Giấy tờ / hiện trạng chưa đạt chỉ là CẢNH BÁO — người duyệt tự quyết duyệt, giữ chờ hoặc
 * từ chối (A2). Điều kiện cứng (đã thẩm định, định giá > 0, chủ sở hữu hợp lệ) do nơi gọi khoá nút và API chặn.
 */
export function ConsignmentProposalApproveDialog({
  proposal,
  open,
  onOpenChange,
}: {
  proposal: ConsignmentProposal
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = vi.consignment.proposals
  const approve = useApproveConsignmentProposal()
  const issues = proposal.appraisal ? listAppraisalIssues(proposal.appraisal) : []

  async function handleConfirm() {
    try {
      await approve.mutateAsync(proposal.id)
      toast.success(t.approveSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.consignment.actionError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.approveDialogTitle}</DialogTitle>
          <DialogDescription>
            {proposal.code} — {proposal.declaredVehicle.plate}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm">
          {issues.length > 0 && (
            <div className="border-status-pending/40 bg-status-pending/10 text-status-pending flex flex-col gap-1 rounded-lg border p-3">
              <p className="font-medium">{t.approveWarningTitle}</p>
              <ul className="list-disc pl-5">
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
              {proposal.appraisal?.pendingDocumentsNote && <p>{proposal.appraisal.pendingDocumentsNote}</p>}
              <p className="text-xs">{t.approveWarningHint}</p>
            </div>
          )}
          <p className="text-muted-foreground">{t.approveNote}</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="button" disabled={approve.isPending} onClick={handleConfirm}>
            {t.approveConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
