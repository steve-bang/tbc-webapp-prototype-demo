import { Plus } from 'lucide-react'
import { useState } from 'react'
import { VEHICLE_DOCUMENT_TYPE_LABELS, vi } from '@/shared/i18n/vi'
import { formatDate } from '@/shared/lib/datetime'
import { documentExpiryStatus } from '@/shared/lib/documentStatus'
import { Button } from '@/shared/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import type { Vehicle, VehicleDocument } from '../model'
import { VehicleDocumentFormDialog } from './VehicleDocumentFormDialog'
import { VehicleDocumentStatusBadge } from './VehicleDocumentStatusBadge'

/**
 * `VM §16.1` — nút Thêm + bảng + trạng thái rỗng của `VehicleDocument` cho một
 * xe. Tách khỏi `VehicleDocumentsDialog` (VEHICLE-MANAGEMENT-PLAN.md §8.4 mục
 * 1) để dùng lại nguyên vẹn ở tab "Giấy tờ" của Vehicle Detail mà không cần
 * bọc `Dialog`. Không có nút Xoá — BRD §16.1 yêu cầu giữ lịch sử.
 */
export function VehicleDocumentsList({ vehicle, canEdit }: { vehicle: Vehicle; canEdit: boolean }) {
  const [formOpen, setFormOpen] = useState(false)
  const [editingDocument, setEditingDocument] = useState<VehicleDocument | null>(null)

  function openAdd() {
    setEditingDocument(null)
    setFormOpen(true)
  }

  function openEdit(document: VehicleDocument) {
    setEditingDocument(document)
    setFormOpen(true)
  }

  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4" />
            {vi.vehicles.addDocument}
          </Button>
        </div>
      )}

      {vehicle.documents.length === 0 ? (
        <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium">{vi.vehicles.documentEmptyAll}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{vi.vehicles.documentType}</TableHead>
                <TableHead>{vi.vehicles.documentNumber}</TableHead>
                <TableHead>{vi.vehicles.documentExpiryDate}</TableHead>
                <TableHead>{vi.vehicles.documentWarningLeadDays}</TableHead>
                <TableHead>{vi.common.status}</TableHead>
                {canEdit && <TableHead className="text-right">{vi.common.actions}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicle.documents.map((document) => (
                <TableRow key={document.id}>
                  <TableCell>{VEHICLE_DOCUMENT_TYPE_LABELS[document.documentType]}</TableCell>
                  <TableCell>{document.documentNumber ?? vi.vehicles.noValue}</TableCell>
                  <TableCell>
                    {document.expiryDate ? formatDate(document.expiryDate) : vi.vehicles.noValue}
                  </TableCell>
                  <TableCell>{document.warningLeadDays}</TableCell>
                  <TableCell>
                    <VehicleDocumentStatusBadge
                      status={documentExpiryStatus(document.expiryDate, document.warningLeadDays)}
                    />
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => openEdit(document)}>
                        {vi.common.edit}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {canEdit && (
        <VehicleDocumentFormDialog
          vehicleId={vehicle.id}
          bankFinanced={vehicle.bankFinanced}
          document={editingDocument}
          open={formOpen}
          onOpenChange={setFormOpen}
        />
      )}
    </div>
  )
}
