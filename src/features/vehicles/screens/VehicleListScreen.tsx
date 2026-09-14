import { FileWarning, Plus, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { usePermission } from '@/features/auth'
import { PageHeader } from '@/shared/layout/PageHeader'
import { OWNERSHIP_TYPE_LABELS, VEHICLE_CLASS_LABELS, vi } from '@/shared/i18n/vi'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { VehicleCard } from '../components/VehicleCard'
import { VehicleDocumentsDialog } from '../components/VehicleDocumentsDialog'
import { VehicleFilters, type VehicleFilterValue } from '../components/VehicleFilters'
import { VehicleFormSheet } from '../components/VehicleFormSheet'
import { VehicleStatusBadge } from '../components/VehicleStatusBadge'
import { VehicleStatusDialog } from '../components/VehicleStatusDialog'
import { useVehicles } from '../hooks'
import { countDocumentsNeedingAttention, type Vehicle } from '../model'

/** `UC-VM` — danh sách + tìm kiếm/lọc/tạo/sửa/đổi trạng thái/giấy tờ xe. */
export function VehicleListScreen() {
  const { can } = usePermission()
  const canEdit = can('VEHICLE', 'EDIT')

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<VehicleFilterValue>({})
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [statusVehicleId, setStatusVehicleId] = useState<string | null>(null)
  const [documentsVehicleId, setDocumentsVehicleId] = useState<string | null>(null)

  const { data: allVehicles } = useVehicles()
  const { data: vehicles, isLoading } = useVehicles({ ...filter, search: search.trim() || undefined })

  const brands = useMemo(() => {
    const set = new Set<string>()
    for (const v of allVehicles ?? []) set.add(v.brand)
    return Array.from(set).sort()
  }, [allVehicles])

  const hasAnyVehicle = (allVehicles?.length ?? 0) > 0
  const hasActiveFilter = !!(
    search.trim() ||
    filter.status ||
    filter.brand ||
    filter.vehicleClass ||
    filter.ownershipType
  )

  // Đọc trực tiếp từ danh sách hiện tại (thay vì giữ bản sao Vehicle riêng)
  // để Dialog trạng thái/giấy tờ luôn phản ánh dữ liệu mới nhất sau mutation.
  const statusVehicle = allVehicles?.find((v) => v.id === statusVehicleId) ?? null
  const documentsVehicle = allVehicles?.find((v) => v.id === documentsVehicleId) ?? null

  function openCreate() {
    setEditingVehicle(null)
    setFormOpen(true)
  }

  function openEdit(vehicle: Vehicle) {
    setEditingVehicle(vehicle)
    setFormOpen(true)
  }

  return (
    <div>
      <PageHeader
        title={vi.vehicles.title}
        description={vi.vehicles.description}
        actions={
          canEdit ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              <span className="hidden sm:inline">{vi.vehicles.addButton}</span>
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={vi.vehicles.searchPlaceholder}
            className="flex-1"
          />
          <Button variant="outline" className="shrink-0 md:hidden" onClick={() => setFilterSheetOpen(true)}>
            <SlidersHorizontal className="size-4" />
            {vi.common.filter}
          </Button>
        </div>
        <VehicleFilters value={filter} onChange={setFilter} brands={brands} className="hidden flex-wrap gap-2 md:flex" />
      </div>

      <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
        <SheetContent side="bottom" className="max-h-[80vh]">
          <SheetHeader>
            <SheetTitle>{vi.common.filter}</SheetTitle>
          </SheetHeader>
          <div className="px-5 pb-5">
            <VehicleFilters value={filter} onChange={setFilter} brands={brands} className="flex-col gap-3" />
          </div>
        </SheetContent>
      </Sheet>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
      ) : vehicles && vehicles.length > 0 ? (
        <>
          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{vi.vehicles.plate}</TableHead>
                    <TableHead>{vi.vehicles.model}</TableHead>
                    <TableHead>{vi.vehicles.vehicleClass}</TableHead>
                    <TableHead>{vi.vehicles.ownershipType}</TableHead>
                    <TableHead>{vi.common.status}</TableHead>
                    <TableHead>{vi.vehicles.currentKm}</TableHead>
                    <TableHead>{vi.vehicles.documentsButton}</TableHead>
                    {canEdit && <TableHead className="text-right">{vi.common.actions}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicles.map((vehicle) => {
                    const attentionCount = countDocumentsNeedingAttention(vehicle)
                    return (
                      <TableRow key={vehicle.id}>
                        <TableCell className="font-medium">{vehicle.plate}</TableCell>
                        <TableCell>
                          {vehicle.brand} {vehicle.model}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{VEHICLE_CLASS_LABELS[vehicle.vehicleClass]}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{OWNERSHIP_TYPE_LABELS[vehicle.ownershipType]}</Badge>
                        </TableCell>
                        <TableCell>
                          <VehicleStatusBadge status={vehicle.status} />
                        </TableCell>
                        <TableCell>{vehicle.currentKm.toLocaleString('vi-VN')} km</TableCell>
                        <TableCell>
                          {attentionCount > 0 ? (
                            <span className="text-status-pending flex items-center gap-1 text-xs">
                              <FileWarning className="size-3.5" />
                              {attentionCount}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        {canEdit && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="outline" onClick={() => openEdit(vehicle)}>
                                {vi.common.edit}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setStatusVehicleId(vehicle.id)}>
                                {vi.vehicles.changeStatus}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setDocumentsVehicleId(vehicle.id)}>
                                {vi.vehicles.documentsButton}
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {vehicles.map((vehicle) => (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                canEdit={canEdit}
                onEdit={() => openEdit(vehicle)}
                onDocuments={() => setDocumentsVehicleId(vehicle.id)}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <p className="font-medium">{hasAnyVehicle && hasActiveFilter ? vi.vehicles.emptyFiltered : vi.vehicles.emptyAll}</p>
          {canEdit && !hasAnyVehicle && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" />
              {vi.vehicles.addButton}
            </Button>
          )}
        </div>
      )}

      {canEdit && <VehicleFormSheet vehicle={editingVehicle} open={formOpen} onOpenChange={setFormOpen} />}
      {canEdit && (
        <VehicleStatusDialog
          vehicle={statusVehicle}
          open={!!statusVehicleId}
          onOpenChange={(open) => !open && setStatusVehicleId(null)}
        />
      )}
      <VehicleDocumentsDialog
        vehicle={documentsVehicle}
        canEdit={canEdit}
        open={!!documentsVehicleId}
        onOpenChange={(open) => !open && setDocumentsVehicleId(null)}
      />
    </div>
  )
}
