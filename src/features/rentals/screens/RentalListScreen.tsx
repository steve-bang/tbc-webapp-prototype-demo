import { Plus, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { paths } from '@/app/paths'
// `customers`/`vehicles` chưa export `useCustomers`/`useVehicles` qua barrel
// `index.ts` nên import thẳng từ `hooks.ts` của feature đó — cùng tinh thần
// `maintenance/hooks.ts` import thẳng `vehicles/hooks.ts`.
import { useCustomers } from '@/features/customers/hooks'
import { useVehicles } from '@/features/vehicles/hooks'
import { usePermission } from '@/features/auth'
import { PageHeader } from '@/shared/layout/PageHeader'
import { vi } from '@/shared/i18n/vi'
import { formatDateTime } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { RentalCancelDialog } from '../components/RentalCancelDialog'
import { RentalCard } from '../components/RentalCard'
import { RentalConfirmDialog } from '../components/RentalConfirmDialog'
import { RentalFilters, type RentalFilterValue } from '../components/RentalFilters'
import { RentalFormSheet } from '../components/RentalFormSheet'
import { RentalStatusBadge } from '../components/RentalStatusBadge'
import { useRentals } from '../hooks'
import { canCancel } from '../model'

/** `UC-RM-01` §5.1 — danh sách + tìm kiếm/lọc/tạo/xác nhận/huỷ lượt thuê. */
export function RentalListScreen() {
  const navigate = useNavigate()
  const { can } = usePermission()
  const canCreate = can('RENTAL', 'CREATE')
  const canConfirmAction = can('RENTAL', 'CONFIRM') // dùng chung cho cả Xác nhận lẫn Huỷ — nguồn permissions.ts

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<RentalFilterValue>({})
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [confirmRentalId, setConfirmRentalId] = useState<string | null>(null)
  const [cancelRentalId, setCancelRentalId] = useState<string | null>(null)

  const { data: allRentals, isLoading } = useRentals()
  const { data: customers = [] } = useCustomers()
  const { data: vehicles = [] } = useVehicles()

  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers])
  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles])

  const filteredRentals = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (allRentals ?? []).filter((r) => {
      if (filter.status && r.status !== filter.status) return false
      if (filter.customerId && r.customerId !== filter.customerId) return false
      if (filter.vehicleId && r.vehicleId !== filter.vehicleId) return false
      const pickupDate = r.pickupDateTime.slice(0, 10)
      if (filter.dateFrom && pickupDate < filter.dateFrom) return false
      if (filter.dateTo && pickupDate > filter.dateTo) return false
      if (q.length > 0) {
        const customer = customerById.get(r.customerId)
        const vehicle = vehicleById.get(r.vehicleId)
        const haystack = [customer?.fullName, customer?.phone, vehicle?.plate].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [allRentals, filter, search, customerById, vehicleById])

  const hasAnyRental = (allRentals?.length ?? 0) > 0
  const hasActiveFilter = !!(
    search.trim() ||
    filter.status ||
    filter.customerId ||
    filter.vehicleId ||
    filter.dateFrom ||
    filter.dateTo
  )

  const confirmRental = allRentals?.find((r) => r.id === confirmRentalId) ?? null
  const cancelRental = allRentals?.find((r) => r.id === cancelRentalId) ?? null

  function openDetail(rentalId: string) {
    navigate(paths.rentalDetail(rentalId))
  }

  return (
    <div>
      <PageHeader
        title={vi.rentals.title}
        description={vi.rentals.description}
        actions={
          canCreate ? (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="size-4" />
              <span className="hidden sm:inline">{vi.rentals.addButton}</span>
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={vi.rentals.searchPlaceholder}
            className="flex-1"
          />
          <Button variant="outline" className="shrink-0 md:hidden" onClick={() => setFilterSheetOpen(true)}>
            <SlidersHorizontal className="size-4" />
            {vi.common.filter}
          </Button>
        </div>
        <RentalFilters
          value={filter}
          onChange={setFilter}
          customers={customers}
          vehicles={vehicles}
          className="hidden md:flex"
        />
      </div>

      <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
        <SheetContent side="bottom" className="max-h-[80vh]">
          <SheetHeader>
            <SheetTitle>{vi.common.filter}</SheetTitle>
          </SheetHeader>
          <div className="px-5 pb-5">
            <RentalFilters value={filter} onChange={setFilter} customers={customers} vehicles={vehicles} className="flex-col" />
          </div>
        </SheetContent>
      </Sheet>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
      ) : filteredRentals.length > 0 ? (
        <>
          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{vi.rentals.columnCustomer}</TableHead>
                    <TableHead>{vi.rentals.columnVehicle}</TableHead>
                    <TableHead>{vi.rentals.columnPeriod}</TableHead>
                    <TableHead>{vi.rentals.columnTotal}</TableHead>
                    <TableHead>{vi.common.status}</TableHead>
                    {canConfirmAction && <TableHead className="text-right">{vi.common.actions}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRentals.map((rental) => {
                    const customer = customerById.get(rental.customerId)
                    const vehicle = vehicleById.get(rental.vehicleId)
                    return (
                      <TableRow key={rental.id} className="cursor-pointer" onClick={() => openDetail(rental.id)}>
                        <TableCell className="font-medium">{customer?.fullName ?? rental.customerId}</TableCell>
                        <TableCell>{vehicle ? `${vehicle.plate} — ${vehicle.brand} ${vehicle.model}` : rental.vehicleId}</TableCell>
                        <TableCell>
                          {formatDateTime(rental.pickupDateTime)} → {formatDateTime(rental.expectedReturnDateTime)}
                        </TableCell>
                        <TableCell>{formatVnd(rental.estimatedTotal)}</TableCell>
                        <TableCell>
                          <RentalStatusBadge status={rental.status} />
                        </TableCell>
                        {canConfirmAction && (
                          <TableCell className="text-right">
                            {/* stopPropagation — hàng đã gắn onClick mở Detail, nút hành động không được kích hoạt kèm. */}
                            <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                              {rental.status === 'DRAFT' && (
                                <Button size="sm" variant="outline" onClick={() => setConfirmRentalId(rental.id)}>
                                  {vi.rentals.confirmAction}
                                </Button>
                              )}
                              {canCancel(rental) && (
                                <Button size="sm" variant="outline" onClick={() => setCancelRentalId(rental.id)}>
                                  {vi.rentals.cancelAction}
                                </Button>
                              )}
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
            {filteredRentals.map((rental) => (
              <RentalCard
                key={rental.id}
                rental={rental}
                customer={customerById.get(rental.customerId)}
                vehicle={vehicleById.get(rental.vehicleId)}
                canConfirmAction={canConfirmAction}
                onOpen={() => openDetail(rental.id)}
                onConfirm={() => setConfirmRentalId(rental.id)}
                onCancel={() => setCancelRentalId(rental.id)}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <p className="font-medium">{hasAnyRental && hasActiveFilter ? vi.rentals.emptyFiltered : vi.rentals.emptyAll}</p>
          {canCreate && !hasAnyRental && (
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="size-4" />
              {vi.rentals.addButton}
            </Button>
          )}
        </div>
      )}

      {canCreate && <RentalFormSheet open={formOpen} onOpenChange={setFormOpen} />}
      <RentalConfirmDialog
        rental={confirmRental}
        customer={confirmRental ? customerById.get(confirmRental.customerId) : undefined}
        vehicle={confirmRental ? vehicleById.get(confirmRental.vehicleId) : undefined}
        existingRentals={allRentals ?? []}
        open={!!confirmRentalId}
        onOpenChange={(open) => !open && setConfirmRentalId(null)}
      />
      <RentalCancelDialog
        rental={cancelRental}
        open={!!cancelRentalId}
        onOpenChange={(open) => !open && setCancelRentalId(null)}
      />
    </div>
  )
}
