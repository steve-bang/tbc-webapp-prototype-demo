import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { usePermission } from '@/features/auth'
import { vi } from '@/shared/i18n/vi'
import { PageHeader } from '@/shared/layout/PageHeader'
import { Button } from '@/shared/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { ContractAddendumsTab } from '../components/ContractAddendumsTab'
import { ContractAuditTab } from '../components/ContractAuditTab'
import { ContractOverviewTab } from '../components/ContractOverviewTab'
import { ContractPreviewDialog } from '../components/ContractPreviewDialog'
import { ContractSignDialog } from '../components/ContractSignDialog'
import { ContractSignedCopyTab } from '../components/ContractSignedCopyTab'
import { ContractStatusBadge } from '../components/ContractStatusBadge'
import { ContractVoidDialog } from '../components/ContractVoidDialog'
import { useContract } from '../hooks'
import { canMarkSigned, canVoid } from '../model'

/**
 * `docs/CONTRACT-MANAGEMENT-PLAN.md` §5.3 — chi tiết hợp đồng, mirror
 * `RentalDetailScreen`. 4 tab (Tổng quan/Bản ký/Phụ lục/Nhật ký thao tác).
 * Header 3 nút: "Xem trước/Xuất PDF" (mọi trạng thái, gate `CONTRACT.EXPORT`),
 * "Tải lên bản ký" (chỉ `GENERATED`, gate `CONTRACT.CREATE` — bước tiếp nối
 * luồng tạo, không phải xuất file), "Huỷ" (`GENERATED`/`SIGNED`, gate
 * `CONTRACT.VOID` — chỉ `SYSTEM_ADMIN`).
 */
export function ContractDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const { can } = usePermission()
  const canExport = can('CONTRACT', 'EXPORT')
  const canCreate = can('CONTRACT', 'CREATE')
  const canVoidAction = can('CONTRACT', 'VOID')

  const { data: contract, isLoading } = useContract(id)

  const [previewOpen, setPreviewOpen] = useState(false)
  const [signOpen, setSignOpen] = useState(false)
  const [voidOpen, setVoidOpen] = useState(false)

  if (isLoading) {
    return (
      <div>
        <PageHeader title={vi.contracts.title} />
        <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
      </div>
    )
  }

  if (!contract) {
    return (
      <div>
        <PageHeader title={vi.contracts.title} />
        <p className="text-muted-foreground text-sm">{vi.contracts.notFound}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="border-border flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold">{contract.contractCode}</h1>
            <ContractStatusBadge status={contract.status} />
          </div>
          <p className="text-muted-foreground text-sm">
            {contract.snapshotCustomerName} — {contract.snapshotVehiclePlate}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canExport && (
            <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
              {vi.contracts.previewAction}
            </Button>
          )}
          {canCreate && canMarkSigned(contract) && (
            <Button size="sm" variant="outline" onClick={() => setSignOpen(true)}>
              {vi.contracts.signAction}
            </Button>
          )}
          {canVoidAction && canVoid(contract) && (
            <Button size="sm" variant="outline" onClick={() => setVoidOpen(true)}>
              {vi.contracts.voidAction}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="max-w-full">
          <TabsTrigger value="overview">{vi.contracts.tabOverview}</TabsTrigger>
          <TabsTrigger value="signedCopy">{vi.contracts.tabSignedCopy}</TabsTrigger>
          <TabsTrigger value="addendums">{vi.contracts.tabAddendums}</TabsTrigger>
          <TabsTrigger value="audit">{vi.contracts.tabAudit}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ContractOverviewTab contract={contract} />
        </TabsContent>
        <TabsContent value="signedCopy">
          <ContractSignedCopyTab contract={contract} />
        </TabsContent>
        <TabsContent value="addendums">
          <ContractAddendumsTab contractId={contract.id} />
        </TabsContent>
        <TabsContent value="audit">
          <ContractAuditTab contractId={contract.id} />
        </TabsContent>
      </Tabs>

      <ContractPreviewDialog contract={previewOpen ? contract : null} open={previewOpen} onOpenChange={setPreviewOpen} />
      {canCreate && (
        <ContractSignDialog contract={signOpen ? contract : null} open={signOpen} onOpenChange={setSignOpen} />
      )}
      {canVoidAction && (
        <ContractVoidDialog contract={voidOpen ? contract : null} open={voidOpen} onOpenChange={setVoidOpen} />
      )}
    </div>
  )
}
