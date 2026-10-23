import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useSessionStore, usePermission } from '@/features/auth'
import { AUDIT_ACTION_LABELS, AUDIT_MODULE_LABELS, AUDIT_SEVERITY_LABELS } from '@/shared/i18n/auditLabels'
import { vi } from '@/shared/i18n/vi'
import { downloadCsv } from '@/shared/lib/csv'
import { formatDateTime } from '@/shared/lib/datetime'
import { PageHeader } from '@/shared/layout/PageHeader'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Pagination } from '@/shared/ui/pagination'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { AuditFilterBar } from '../components/AuditFilterBar'
import { AuditRecordDetailSheet } from '../components/AuditRecordDetailSheet'
import { SEVERITY_BADGE } from '../components/severityBadge'
import { AUDIT_PAGE_SIZE, useAuditRecordsPage, useExportAuditCsv, useRecordAuditLogView } from '../hooks'
import { resolveActorType, resolveModule, resolveSeverity, scopeForRole, type AuditFilter } from '../model'

/** Nhật ký thao tác toàn hệ thống — `/platform/audit` (AuditLog-BRD.md §9, UC-AL-04/05/06/07/10). Chỉ đọc: không có nút sửa/xoá. */
export function AuditLogScreen() {
  const t = vi.audit
  const user = useSessionStore((s) => s.user)
  const { can } = usePermission()
  const scope = user ? scopeForRole(user.role) : 'NONE'
  const [filter, setFilter] = useState<AuditFilter>({})
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | undefined>()

  // Meta-audit mở màn (AL-BR-06): MỘT lần mỗi lần mở — `useRef` chặn gọi trùng do StrictMode.
  const viewLogged = useRef(false)
  const { mutate: recordView } = useRecordAuditLogView()
  useEffect(() => {
    if (scope === 'NONE' || viewLogged.current) return
    viewLogged.current = true
    recordView()
  }, [scope, recordView])

  const { data, isLoading, isError, error } = useAuditRecordsPage(filter, page)
  const exportCsv = useExportAuditCsv()

  function changeFilter(next: AuditFilter) {
    setFilter(next)
    setPage(1)
  }

  async function handleExport() {
    try {
      const csv = await exportCsv.mutateAsync(filter)
      downloadCsv(t.exportFileName, csv)
      toast.success(t.exportDone.replace('{{count}}', String(data?.total ?? 0)))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.loadError)
    }
  }

  if (scope === 'NONE') {
    return (
      <div>
        <PageHeader title={t.title} />
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">{t.errors.noAccess}</p>
      </div>
    )
  }

  const items = data?.items ?? []
  const hasFilter = Object.values(filter).some((v) => v !== undefined && v !== '')

  return (
    <div>
      <PageHeader
        title={t.title}
        description={scope === 'FINANCE' ? t.descriptionFinance : t.description}
        actions={
          can('AUDIT', 'EXPORT') ? (
            <Button variant="outline" size="sm" disabled={exportCsv.isPending} onClick={handleExport}>
              {t.exportCsv}
            </Button>
          ) : undefined
        }
      />

      <p className="bg-muted text-muted-foreground rounded-md px-3 py-2 text-xs">{t.immutableBanner}</p>

      <AuditFilterBar filter={filter} onChange={changeFilter} />

      <div className="mt-4 space-y-3">
        {isLoading ? (
          <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
        ) : isError ? (
          <p className="text-destructive text-sm">{error instanceof Error ? error.message : t.loadError}</p>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            {hasFilter ? t.emptyFiltered : t.empty}
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.columns.time}</TableHead>
                  <TableHead>{t.columns.actor}</TableHead>
                  <TableHead>{t.columns.module}</TableHead>
                  <TableHead>{t.columns.action}</TableHead>
                  <TableHead>{t.columns.entity}</TableHead>
                  <TableHead>{t.columns.summary}</TableHead>
                  <TableHead>{t.columns.severity}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((record) => {
                  const module = resolveModule(record)
                  const severity = resolveSeverity(record)
                  const isSystem = resolveActorType(record) === 'SYSTEM'
                  return (
                    <TableRow
                      key={record.id}
                      className="cursor-pointer"
                      tabIndex={0}
                      onClick={() => setSelectedId(record.id)}
                      onKeyDown={(e) => e.key === 'Enter' && setSelectedId(record.id)}
                    >
                      <TableCell className="whitespace-nowrap">{formatDateTime(record.at)}</TableCell>
                      <TableCell>
                        <div>{record.actorName}</div>
                        <div className="text-muted-foreground text-xs">{isSystem ? 'SYSTEM' : record.actorRole}</div>
                      </TableCell>
                      <TableCell>{module ? AUDIT_MODULE_LABELS[module] : record.entity}</TableCell>
                      <TableCell>{AUDIT_ACTION_LABELS[record.action]}</TableCell>
                      <TableCell>
                        <div>{record.entity}</div>
                        <div className="text-muted-foreground font-mono text-xs">{record.entityId}</div>
                      </TableCell>
                      <TableCell className="max-w-xs whitespace-normal">{record.summary}</TableCell>
                      <TableCell>
                        <Badge variant={SEVERITY_BADGE[severity]}>{AUDIT_SEVERITY_LABELS[severity]}</Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <Pagination page={data?.page ?? page} pageSize={AUDIT_PAGE_SIZE} total={data?.total ?? 0} onPageChange={setPage} />
          </>
        )}
      </div>

      <AuditRecordDetailSheet
        recordId={selectedId}
        onClose={() => setSelectedId(undefined)}
        onFilterCorrelation={(correlationId) => changeFilter({ correlationId })}
      />
    </div>
  )
}
