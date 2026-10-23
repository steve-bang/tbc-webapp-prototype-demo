import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { buildAddendumMergeFields, type ConsignmentAddendum } from '../addendumModel'
import type { ConsignmentContract, MergeFieldGroup, SnapshotVehicleInfo, VehicleOwner } from '../model'

const GROUPS: MergeFieldGroup[] = ['A', 'B', 'D', 'E']

const GROUP_TITLE: Partial<Record<MergeFieldGroup, string>> = {
  A: vi.consignment.mergeGroupA,
  B: vi.consignment.mergeGroupB,
  D: vi.consignment.mergeGroupD,
  E: vi.consignment.mergeGroupE,
}

/**
 * "Xem phụ lục" — bảng trường trộn (merge-field) giả lập, mirror `ConsignmentDraftPreviewDialog`. KHÔNG soạn điều khoản pháp lý;
 * nút "Xuất PDF" chỉ hiện toast. Số tài khoản và CCCD / MST luôn ở dạng đã che.
 */
export function ConsignmentAddendumPreviewDialog({
  open,
  onOpenChange,
  contract,
  addendum,
  owner,
  vehicle,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  contract: ConsignmentContract
  addendum: ConsignmentAddendum
  owner?: VehicleOwner
  vehicle?: SnapshotVehicleInfo
}) {
  const fields = owner && vehicle ? buildAddendumMergeFields(contract, addendum, owner, vehicle) : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {vi.consignment.addenda.previewDialogTitle} — {addendum.addendumNo}
          </DialogTitle>
          <DialogDescription>{vi.consignment.previewNote}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {GROUPS.map((group) => {
            const rows = fields.filter((f) => f.group === group)
            if (rows.length === 0) return null
            return (
              <section key={group} className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">{GROUP_TITLE[group]}</h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{vi.consignment.previewColumnPlaceholder}</TableHead>
                        <TableHead>{vi.consignment.previewColumnLabel}</TableHead>
                        <TableHead>{vi.consignment.previewColumnValue}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.placeholder}>
                          <TableCell className="font-mono text-xs">{row.placeholder}</TableCell>
                          <TableCell>{row.label}</TableCell>
                          <TableCell className="whitespace-normal">{row.value}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>
            )
          })}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.close}
          </Button>
          <Button type="button" onClick={() => toast.success(vi.consignment.exportPdfSuccess)}>
            {vi.consignment.exportPdf}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
