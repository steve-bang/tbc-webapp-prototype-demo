import { Plus, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { paths } from '@/app/paths'
import { usePermission } from '@/features/auth'
import { PageHeader } from '@/shared/layout/PageHeader'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { CustomerCard } from '../components/CustomerCard'
import { CustomerFilters, type CustomerFilterValue } from '../components/CustomerFilters'
import { CustomerFormSheet } from '../components/CustomerFormSheet'
import { CustomerReasonDialog } from '../components/CustomerReasonDialog'
import { CustomerStatusBadge } from '../components/CustomerStatusBadge'
import { useBlockCustomer, useCustomers, useUnblockCustomer } from '../hooks'
import { canBlock, canUnblock, type Customer } from '../model'

/** Hành động khoá/mở khoá đang chờ nhập lý do trong `CustomerReasonDialog`. */
type PendingBlockAction = { type: 'block' | 'unblock'; customer: Customer }

/** `UC-CM-01, 02, 03, 05, 06, 14` — danh sách + tìm kiếm/lọc/tạo/sửa/khoá-mở khoá khách hàng. */
export function CustomerListScreen() {
  const navigate = useNavigate()
  const { can } = usePermission()
  const canEdit = can('CUSTOMER', 'EDIT')
  const canBlockAction = can('CUSTOMER', 'BLOCK')

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<CustomerFilterValue>({})
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [pendingBlockAction, setPendingBlockAction] = useState<PendingBlockAction | null>(null)

  const { data: allCustomers } = useCustomers()
  const { data: customers, isLoading } = useCustomers({ ...filter, search: search.trim() || undefined })
  const blockCustomer = useBlockCustomer()
  const unblockCustomer = useUnblockCustomer()

  const hasAnyCustomer = (allCustomers?.length ?? 0) > 0
  const hasActiveFilter = !!(search.trim() || filter.status)
  const isReasonDialogBusy = blockCustomer.isPending || unblockCustomer.isPending

  function openCreate() {
    setEditingCustomer(null)
    setFormOpen(true)
  }

  function openEdit(customer: Customer) {
    setEditingCustomer(customer)
    setFormOpen(true)
  }

  function openDetail(customer: Customer) {
    navigate(paths.customerDetail(customer.id))
  }

  async function handleReasonConfirm(reason: string) {
    if (!pendingBlockAction) return
    try {
      if (pendingBlockAction.type === 'block') {
        await blockCustomer.mutateAsync({ id: pendingBlockAction.customer.id, reason })
        toast.success(vi.customers.blockSuccess)
      } else {
        await unblockCustomer.mutateAsync({ id: pendingBlockAction.customer.id, reason })
        toast.success(vi.customers.unblockSuccess)
      }
      setPendingBlockAction(null)
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : pendingBlockAction.type === 'block'
            ? vi.customers.blockError
            : vi.customers.unblockError,
      )
    }
  }

  return (
    <div>
      <PageHeader
        title={vi.customers.title}
        description={vi.customers.description}
        actions={
          canEdit ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              <span className="hidden sm:inline">{vi.customers.addButton}</span>
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={vi.customers.searchPlaceholder}
            className="flex-1"
          />
          <Button variant="outline" className="shrink-0 md:hidden" onClick={() => setFilterSheetOpen(true)}>
            <SlidersHorizontal className="size-4" />
            {vi.common.filter}
          </Button>
        </div>
        <CustomerFilters value={filter} onChange={setFilter} className="hidden md:flex" />
      </div>

      <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
        <SheetContent side="bottom" className="max-h-[80vh]">
          <SheetHeader>
            <SheetTitle>{vi.common.filter}</SheetTitle>
          </SheetHeader>
          <div className="px-5 pb-5">
            <CustomerFilters value={filter} onChange={setFilter} className="flex-col gap-3" />
          </div>
        </SheetContent>
      </Sheet>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
      ) : customers && customers.length > 0 ? (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{vi.customers.fullName}</TableHead>
                  <TableHead>{vi.customers.phone}</TableHead>
                  <TableHead>{vi.customers.email}</TableHead>
                  <TableHead>{vi.customers.idNumber}</TableHead>
                  <TableHead>{vi.common.status}</TableHead>
                  {(canEdit || canBlockAction) && (
                    <TableHead className="text-right">{vi.common.actions}</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id} className="cursor-pointer" onClick={() => openDetail(customer)}>
                    <TableCell className="font-medium">{customer.fullName}</TableCell>
                    <TableCell>{customer.phone}</TableCell>
                    <TableCell>{customer.email ?? vi.customers.noValue}</TableCell>
                    <TableCell>{customer.idNumber}</TableCell>
                    <TableCell>
                      <CustomerStatusBadge status={customer.status} />
                    </TableCell>
                    {(canEdit || canBlockAction) && (
                      <TableCell className="text-right">
                        {/* stopPropagation — hàng đã gắn onClick mở Detail, nút hành động không được kích hoạt kèm. */}
                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          {canEdit && (
                            <Button size="sm" variant="outline" onClick={() => openEdit(customer)}>
                              {vi.common.edit}
                            </Button>
                          )}
                          {canBlockAction && canBlock(customer.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setPendingBlockAction({ type: 'block', customer })}
                            >
                              {vi.customers.block}
                            </Button>
                          )}
                          {canBlockAction && canUnblock(customer.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setPendingBlockAction({ type: 'unblock', customer })}
                            >
                              {vi.customers.unblock}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {customers.map((customer) => (
              <CustomerCard
                key={customer.id}
                customer={customer}
                canEdit={canEdit}
                canBlockAction={canBlockAction}
                onOpen={() => openDetail(customer)}
                onEdit={() => openEdit(customer)}
                onBlock={() => setPendingBlockAction({ type: 'block', customer })}
                onUnblock={() => setPendingBlockAction({ type: 'unblock', customer })}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <p className="font-medium">
            {hasAnyCustomer && hasActiveFilter ? vi.customers.emptyFiltered : vi.customers.emptyAll}
          </p>
          {canEdit && !hasAnyCustomer && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" />
              {vi.customers.addButton}
            </Button>
          )}
        </div>
      )}

      {canEdit && <CustomerFormSheet customer={editingCustomer} open={formOpen} onOpenChange={setFormOpen} />}
      {canBlockAction && (
        <CustomerReasonDialog
          open={!!pendingBlockAction}
          onOpenChange={(open) => !open && setPendingBlockAction(null)}
          title={pendingBlockAction?.type === 'block' ? vi.customers.blockTitle : vi.customers.unblockTitle}
          description={
            pendingBlockAction
              ? `${pendingBlockAction.customer.fullName} (${pendingBlockAction.customer.phone})`
              : undefined
          }
          confirmLabel={pendingBlockAction?.type === 'block' ? vi.customers.block : vi.customers.unblock}
          busy={isReasonDialogBusy}
          onConfirm={handleReasonConfirm}
        />
      )}
    </div>
  )
}
