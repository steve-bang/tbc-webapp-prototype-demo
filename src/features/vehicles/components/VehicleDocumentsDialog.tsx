import { vi } from '@/shared/i18n/vi'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import type { Vehicle } from '../model'
import { VehicleDocumentsList } from './VehicleDocumentsList'

/**
 * `VM §16.1` — mở "Giấy tờ" của một xe từ `VehicleListScreen` dưới dạng
 * Dialog. Nội dung (nút Thêm + bảng + trạng thái rỗng) đã tách ra
 * `VehicleDocumentsList` (VEHICLE-MANAGEMENT-PLAN.md §8.4 mục 1) — component
 * này chỉ còn bọc `Dialog`, giữ nguyên public API cũ để không đổi hành vi ở
 * màn List. Tab "Giấy tờ" của Vehicle Detail dùng thẳng `VehicleDocumentsList`,
 * không qua Dialog.
 */
export function VehicleDocumentsDialog({
  vehicle,
  canEdit,
  open,
  onOpenChange,
}: {
  vehicle: Vehicle | null
  canEdit: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!vehicle) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{vi.vehicles.documentsDialogTitle}</DialogTitle>
          <DialogDescription>
            {vehicle.plate} — {vehicle.brand} {vehicle.model}
          </DialogDescription>
        </DialogHeader>

        <VehicleDocumentsList vehicle={vehicle} canEdit={canEdit} />
      </DialogContent>
    </Dialog>
  )
}
