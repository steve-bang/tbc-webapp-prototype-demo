import { useState } from 'react'
import { useParams } from 'react-router-dom'
// `customers`/`vehicles` chưa export `useCustomers`/`useVehicles` qua barrel
// `index.ts` nên import thẳng từ `hooks.ts` của feature đó — cùng tinh thần
// `RentalListScreen`/`RentalFormSheet`.
import { useCustomers } from '@/features/customers/hooks'
import { useVehicles } from '@/features/vehicles/hooks'
import { usePermission } from '@/features/auth'
import { vi } from '@/shared/i18n/vi'
import { PageHeader } from '@/shared/layout/PageHeader'
import { Button } from '@/shared/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { RentalAuditTab } from '../components/RentalAuditTab'
import { RentalCancelDialog } from '../components/RentalCancelDialog'
import { RentalConfirmDialog } from '../components/RentalConfirmDialog'
import { RentalContractTab } from '../components/RentalContractTab'
import { RentalDetailPlaceholder } from '../components/RentalDetailPlaceholder'
import { RentalOverviewTab } from '../components/RentalOverviewTab'
import { RentalPricingTab } from '../components/RentalPricingTab'
import { RentalStatusBadge } from '../components/RentalStatusBadge'
import { useRental, useRentals } from '../hooks'
import { canCancel } from '../model'

/**
 * `RentalManagement-BRD.md` §36 — chi tiết lượt thuê, 8 tab
 * (`docs/RENTAL-MANAGEMENT-PLAN.md` §15.2, mirror `CustomerDetailScreen`).
 * Nút Xác nhận/Huỷ ở header tái dùng nguyên `RentalConfirmDialog`/
 * `RentalCancelDialog` đã dùng ở `RentalListScreen` — logic `canConfirm()`/
 * `canCancel()` không đổi, chỉ chuyển vị trí từ hàng danh sách lên header.
 */
export function RentalDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const { can } = usePermission()
  const canConfirmAction = can('RENTAL', 'CONFIRM') // dùng chung cho cả Xác nhận lẫn Huỷ — nguồn permissions.ts

  const { data: rental, isLoading } = useRental(id)
  const { data: allRentals } = useRentals()
  const { data: customers = [] } = useCustomers()
  const { data: vehicles = [] } = useVehicles()

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  const customer = rental ? customers.find((c) => c.id === rental.customerId) : undefined
  const vehicle = rental ? vehicles.find((v) => v.id === rental.vehicleId) : undefined

  if (isLoading) {
    return (
      <div>
        <PageHeader title={vi.rentals.title} />
        <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
      </div>
    )
  }

  if (!rental) {
    return (
      <div>
        <PageHeader title={vi.rentals.title} />
        <p className="text-muted-foreground text-sm">{vi.rentals.notFound}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="border-border flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold">{customer?.fullName ?? rental.customerId}</h1>
            <RentalStatusBadge status={rental.status} />
          </div>
          <p className="text-muted-foreground text-sm">
            {vehicle ? `${vehicle.plate} — ${vehicle.brand} ${vehicle.model}` : rental.vehicleId}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canConfirmAction && rental.status === 'DRAFT' && (
            <Button size="sm" variant="outline" onClick={() => setConfirmOpen(true)}>
              {vi.rentals.confirmAction}
            </Button>
          )}
          {canConfirmAction && canCancel(rental) && (
            <Button size="sm" variant="outline" onClick={() => setCancelOpen(true)}>
              {vi.rentals.cancelAction}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="max-w-full">
          <TabsTrigger value="overview">{vi.rentals.tabOverview}</TabsTrigger>
          <TabsTrigger value="pricing">{vi.rentals.tabPricing}</TabsTrigger>
          <TabsTrigger value="payment">{vi.rentals.tabPayment}</TabsTrigger>
          <TabsTrigger value="contract">{vi.rentals.tabContract}</TabsTrigger>
          <TabsTrigger value="handoverReturn">{vi.rentals.tabHandoverReturn}</TabsTrigger>
          <TabsTrigger value="incidents">{vi.rentals.tabIncidents}</TabsTrigger>
          <TabsTrigger value="assignment">{vi.rentals.tabAssignment}</TabsTrigger>
          <TabsTrigger value="audit">{vi.rentals.tabAudit}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <RentalOverviewTab rental={rental} customer={customer} vehicle={vehicle} />
        </TabsContent>
        <TabsContent value="pricing">
          <RentalPricingTab rental={rental} />
        </TabsContent>
        <TabsContent value="payment">
          <RentalDetailPlaceholder note={vi.rentals.paymentPlaceholder} />
        </TabsContent>
        <TabsContent value="contract">
          <RentalContractTab rental={rental} />
        </TabsContent>
        <TabsContent value="handoverReturn">
          <RentalDetailPlaceholder note={vi.rentals.handoverReturnPlaceholder} />
        </TabsContent>
        <TabsContent value="incidents">
          <RentalDetailPlaceholder note={vi.rentals.incidentsPlaceholder} />
        </TabsContent>
        <TabsContent value="assignment">
          <RentalDetailPlaceholder note={vi.rentals.assignmentPlaceholder} />
        </TabsContent>
        <TabsContent value="audit">
          <RentalAuditTab rentalId={rental.id} />
        </TabsContent>
      </Tabs>

      {canConfirmAction && (
        <RentalConfirmDialog
          rental={confirmOpen ? rental : null}
          customer={customer}
          vehicle={vehicle}
          existingRentals={allRentals ?? []}
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
        />
      )}
      {canConfirmAction && (
        <RentalCancelDialog rental={cancelOpen ? rental : null} open={cancelOpen} onOpenChange={setCancelOpen} />
      )}
    </div>
  )
}
