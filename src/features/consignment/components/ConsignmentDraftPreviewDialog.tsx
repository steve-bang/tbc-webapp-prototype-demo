import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import {
  buildMergeFields,
  MERGE_FIELD_GROUPS,
  type ConsignmentContract,
  type ConsignmentHandoverRecord,
  type MergeFieldGroup,
  type SnapshotVehicleInfo,
  type VehicleOwner,
} from '../model'

const GROUP_TITLE: Record<MergeFieldGroup, string> = {
  A: vi.consignment.mergeGroupA,
  B: vi.consignment.mergeGroupB,
  C: vi.consignment.mergeGroupC,
  D: vi.consignment.mergeGroupD,
  E: vi.consignment.mergeGroupE,
  FG: vi.consignment.mergeGroupFG,
  H: vi.consignment.mergeGroupH,
  I: vi.consignment.mergeGroupI,
  J: vi.consignment.mergeGroupJ,
}

/**
 * "Xem bản nháp hợp đồng" — bảng trường trộn (merge-field) giả lập theo nhóm A–J, mirror `ContractPreviewDialog`.
 * KHÔNG soạn điều khoản pháp lý; nút "Xuất PDF" chỉ hiện toast.
 * TODO(OQ: CR-2026-049 — khách chưa cấp mẫu .docx; chưa xuất PDF thật)
 */
export function ConsignmentDraftPreviewDialog({
  open,
  onOpenChange,
  contract,
  owner,
  vehicle,
  intake,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  contract: ConsignmentContract
  owner?: VehicleOwner
  vehicle?: SnapshotVehicleInfo
  intake?: ConsignmentHandoverRecord
}) {
  const fields = owner && vehicle ? buildMergeFields(contract, owner, vehicle, intake) : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {vi.consignment.previewTitle} — {contract.contractNo}
          </DialogTitle>
          <DialogDescription>{vi.consignment.previewNote}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {MERGE_FIELD_GROUPS.map((group) => {
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
