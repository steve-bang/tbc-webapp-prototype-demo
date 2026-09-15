import { Lock, LockOpen, Pencil } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { usePermission } from '@/features/auth'
import { vi } from '@/shared/i18n/vi'
import { PageHeader } from '@/shared/layout/PageHeader'
import { Button } from '@/shared/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { CustomerCreditTab } from '../components/CustomerCreditTab'
import { CustomerDetailPlaceholder } from '../components/CustomerDetailPlaceholder'
import { CustomerDocumentsTab } from '../components/CustomerDocumentsTab'
import { CustomerFormSheet } from '../components/CustomerFormSheet'
import { CustomerProfileTab } from '../components/CustomerProfileTab'
import { CustomerReasonDialog } from '../components/CustomerReasonDialog'
import { CustomerRentalHistoryTab } from '../components/CustomerRentalHistoryTab'
import { CustomerStatusBadge } from '../components/CustomerStatusBadge'
import { useBlockCustomer, useCustomer, useUnblockCustomer } from '../hooks'
import { canBlock, canUnblock } from '../model'

type PendingAction = 'block' | 'unblock' | null

/** `UC-CM-04, 07, 12` — chi tiết khách hàng, 6 tab (`docs/CUSTOMER-MANAGEMENT-PLAN.md` §6.2). */
export function CustomerDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const { can } = usePermission()
  const canEdit = can('CUSTOMER', 'EDIT')
  const canBlockAction = can('CUSTOMER', 'BLOCK')

  const { data: customer, isLoading } = useCustomer(id)
  const blockCustomer = useBlockCustomer()
  const unblockCustomer = useUnblockCustomer()

  const [formOpen, setFormOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const isReasonDialogBusy = blockCustomer.isPending || unblockCustomer.isPending

  async function handleReasonConfirm(reason: string) {
    if (!customer || !pendingAction) return
    try {
      if (pendingAction === 'block') {
        await blockCustomer.mutateAsync({ id: customer.id, reason })
        toast.success(vi.customers.blockSuccess)
      } else {
        await unblockCustomer.mutateAsync({ id: customer.id, reason })
        toast.success(vi.customers.unblockSuccess)
      }
      setPendingAction(null)
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : pendingAction === 'block'
            ? vi.customers.blockError
            : vi.customers.unblockError,
      )
    }
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title={vi.customers.title} />
        <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
      </div>
    )
  }

  if (!customer) {
    return (
      <div>
        <PageHeader title={vi.customers.title} />
        <p className="text-muted-foreground text-sm">{vi.customers.notFound}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="border-border flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold">{customer.fullName}</h1>
            <CustomerStatusBadge status={customer.status} />
          </div>
          <p className="text-muted-foreground text-sm">{customer.phone}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setFormOpen(true)}>
              <Pencil className="size-3.5" />
              {vi.common.edit}
            </Button>
          )}
          {canBlockAction && canBlock(customer.status) && (
            <Button size="sm" variant="outline" onClick={() => setPendingAction('block')}>
              <Lock className="size-3.5" />
              {vi.customers.block}
            </Button>
          )}
          {canBlockAction && canUnblock(customer.status) && (
            <Button size="sm" variant="outline" onClick={() => setPendingAction('unblock')}>
              <LockOpen className="size-3.5" />
              {vi.customers.unblock}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">{vi.customers.tabProfile}</TabsTrigger>
          <TabsTrigger value="documents">{vi.customers.tabDocuments}</TabsTrigger>
          <TabsTrigger value="rentals">{vi.customers.tabRentalHistory}</TabsTrigger>
          <TabsTrigger value="payment">{vi.customers.tabPayment}</TabsTrigger>
          <TabsTrigger value="incidents">{vi.customers.tabIncidents}</TabsTrigger>
          <TabsTrigger value="credit">{vi.customers.tabCredit}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <CustomerProfileTab customer={customer} />
        </TabsContent>
        <TabsContent value="documents">
          <CustomerDocumentsTab customer={customer} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="rentals">
          <CustomerRentalHistoryTab customer={customer} />
        </TabsContent>
        <TabsContent value="payment">
          <CustomerDetailPlaceholder note={vi.customers.paymentPlaceholder} />
        </TabsContent>
        <TabsContent value="incidents">
          <CustomerDetailPlaceholder note={vi.customers.incidentsPlaceholder} />
        </TabsContent>
        <TabsContent value="credit">
          <CustomerCreditTab />
        </TabsContent>
      </Tabs>

      {canEdit && <CustomerFormSheet customer={customer} open={formOpen} onOpenChange={setFormOpen} />}
      {canBlockAction && (
        <CustomerReasonDialog
          open={!!pendingAction}
          onOpenChange={(open) => !open && setPendingAction(null)}
          title={pendingAction === 'block' ? vi.customers.blockTitle : vi.customers.unblockTitle}
          description={`${customer.fullName} (${customer.phone})`}
          confirmLabel={pendingAction === 'block' ? vi.customers.block : vi.customers.unblock}
          busy={isReasonDialogBusy}
          onConfirm={handleReasonConfirm}
        />
      )}
    </div>
  )
}
