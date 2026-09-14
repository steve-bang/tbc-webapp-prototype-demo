import { Pencil, RefreshCcw } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { usePermission } from '@/features/auth'
import { vi } from '@/shared/i18n/vi'
import { PageHeader } from '@/shared/layout/PageHeader'
import { Button } from '@/shared/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { VehicleAuditTab } from '../components/VehicleAuditTab'
import { VehicleDetailPlaceholder } from '../components/VehicleDetailPlaceholder'
import { VehicleDocumentsList } from '../components/VehicleDocumentsList'
import { VehicleFormSheet } from '../components/VehicleFormSheet'
import { VehicleMaintenanceTab } from '../components/VehicleMaintenanceTab'
import { VehicleOverviewTab } from '../components/VehicleOverviewTab'
import { VehicleStatusBadge } from '../components/VehicleStatusBadge'
import { VehicleStatusDialog } from '../components/VehicleStatusDialog'
import { useVehicle } from '../hooks'

/**
 * `UC-VM` — chi tiết xe, 12 tab tối đa (`docs/VEHICLE-MANAGEMENT-PLAN.md`
 * §8.3). Tab "Chủ xe & Ký gửi" chỉ hiện khi `ownershipType === 'CONSIGNED'`
 * (ẩn hẳn, không disable); 3 tab Doanh thu/Chi phí/Lợi nhuận ẩn hẳn khỏi
 * `TabsList` khi `!can('VEHICLE','EXPORT')` — gate theo nhóm View Financial
 * chung (`CR-2026-036`), không phân quyền theo từng tab riêng lẻ.
 */
export function VehicleDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const { can } = usePermission()
  const canEdit = can('VEHICLE', 'EDIT')
  const canViewFinancial = can('VEHICLE', 'EXPORT')

  const { data: vehicle, isLoading } = useVehicle(id)

  const [formOpen, setFormOpen] = useState(false)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)

  if (isLoading) {
    return (
      <div>
        <PageHeader title={vi.vehicles.title} />
        <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
      </div>
    )
  }

  if (!vehicle) {
    return (
      <div>
        <PageHeader title={vi.vehicles.title} />
        <p className="text-muted-foreground text-sm">{vi.vehicles.notFound}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="border-border flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold">{vehicle.plate}</h1>
            <VehicleStatusBadge status={vehicle.status} />
          </div>
          <p className="text-muted-foreground text-sm">
            {vehicle.brand} {vehicle.model}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setFormOpen(true)}>
              <Pencil className="size-3.5" />
              {vi.common.edit}
            </Button>
          )}
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setStatusDialogOpen(true)}>
              <RefreshCcw className="size-3.5" />
              {vi.vehicles.changeStatus}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="max-w-full">
          <TabsTrigger value="overview">{vi.vehicles.tabOverview}</TabsTrigger>
          {vehicle.ownershipType === 'CONSIGNED' && (
            <TabsTrigger value="consignment">{vi.vehicles.tabConsignment}</TabsTrigger>
          )}
          <TabsTrigger value="documents">{vi.vehicles.tabDocuments}</TabsTrigger>
          <TabsTrigger value="condition">{vi.vehicles.tabCondition}</TabsTrigger>
          <TabsTrigger value="maintenance">{vi.vehicles.tabMaintenance}</TabsTrigger>
          <TabsTrigger value="trafficFines">{vi.vehicles.tabTrafficFines}</TabsTrigger>
          <TabsTrigger value="rentalHistory">{vi.vehicles.tabRentalHistory}</TabsTrigger>
          <TabsTrigger value="handoverReturn">{vi.vehicles.tabHandoverReturn}</TabsTrigger>
          {canViewFinancial && <TabsTrigger value="revenue">{vi.vehicles.tabRevenue}</TabsTrigger>}
          {canViewFinancial && <TabsTrigger value="cost">{vi.vehicles.tabCost}</TabsTrigger>}
          {canViewFinancial && <TabsTrigger value="profit">{vi.vehicles.tabProfit}</TabsTrigger>}
          <TabsTrigger value="audit">{vi.vehicles.tabAudit}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <VehicleOverviewTab vehicle={vehicle} />
        </TabsContent>
        {vehicle.ownershipType === 'CONSIGNED' && (
          <TabsContent value="consignment">
            <VehicleDetailPlaceholder note={vi.vehicles.consignmentPlaceholder} />
          </TabsContent>
        )}
        <TabsContent value="documents">
          <VehicleDocumentsList vehicle={vehicle} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="condition">
          <VehicleDetailPlaceholder note={vi.vehicles.conditionEmpty} />
        </TabsContent>
        <TabsContent value="maintenance">
          <VehicleMaintenanceTab vehicle={vehicle} />
        </TabsContent>
        <TabsContent value="trafficFines">
          <VehicleDetailPlaceholder note={vi.vehicles.trafficFinesPlaceholder} />
        </TabsContent>
        <TabsContent value="rentalHistory">
          <VehicleDetailPlaceholder note={vi.vehicles.rentalHistoryPlaceholder} />
        </TabsContent>
        <TabsContent value="handoverReturn">
          <VehicleDetailPlaceholder note={vi.vehicles.handoverReturnPlaceholder} />
        </TabsContent>
        {canViewFinancial && (
          <TabsContent value="revenue">
            <VehicleDetailPlaceholder note={vi.vehicles.revenuePlaceholder} />
          </TabsContent>
        )}
        {canViewFinancial && (
          <TabsContent value="cost">
            <VehicleDetailPlaceholder note={vi.vehicles.costPlaceholder} />
          </TabsContent>
        )}
        {canViewFinancial && (
          <TabsContent value="profit">
            <VehicleDetailPlaceholder note={vi.vehicles.profitPlaceholder} />
          </TabsContent>
        )}
        <TabsContent value="audit">
          <VehicleAuditTab vehicleId={vehicle.id} />
        </TabsContent>
      </Tabs>

      {canEdit && <VehicleFormSheet vehicle={vehicle} open={formOpen} onOpenChange={setFormOpen} />}
      {canEdit && <VehicleStatusDialog vehicle={vehicle} open={statusDialogOpen} onOpenChange={setStatusDialogOpen} />}
    </div>
  )
}
