import { useState } from 'react'
import { toast } from 'sonner'
import { useSessionStore } from '@/features/auth'
import { AUDIT_ACTION_LABELS, AUDIT_ACTOR_TYPE_LABELS, AUDIT_MODULE_LABELS, AUDIT_SEVERITY_LABELS } from '@/shared/i18n/auditLabels'
import { vi } from '@/shared/i18n/vi'
import type { AuditRecord } from '@/shared/lib/audit'
import { formatDateTime } from '@/shared/lib/datetime'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { useAuditRecord, useRevealAuditRecord } from '../hooks'
import { canRevealAnyIn, resolveActorType, resolveModule, resolveSeverity } from '../model'
import { SEVERITY_BADGE } from './severityBadge'

interface AuditRecordDetailSheetProps {
  recordId: string | undefined
  onClose: () => void
  /** "Xem thao tác liên quan" → màn đặt bộ lọc theo `correlationId`. */
  onFilterCorrelation: (correlationId: string) => void
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

/** Ảnh chụp → các dòng khoá–giá trị; khoá lồng nhau hiện JSON rút gọn. */
function toRows(snapshot: unknown): Array<[string, string]> {
  if (snapshot !== null && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
    return Object.entries(snapshot as Record<string, unknown>).map(([k, v]) => [k, formatValue(v)])
  }
  return [['value', formatValue(snapshot)]]
}

function SnapshotTable({ title, snapshot }: { title: string; snapshot: unknown }) {
  const t = vi.audit.detail
  if (snapshot === undefined) return null
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-medium">{title}</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.field}</TableHead>
            <TableHead>{t.value}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {toRows(snapshot).map(([key, value]) => (
            <TableRow key={key}>
              <TableCell className="font-mono text-xs">{key}</TableCell>
              <TableCell className="text-xs break-all whitespace-normal">{value}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-3 sm:gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words sm:col-span-2">{children}</dd>
    </div>
  )
}

function DetailBody({ recordId, onClose, onFilterCorrelation }: Omit<AuditRecordDetailSheetProps, 'recordId'> & { recordId: string }) {
  const t = vi.audit.detail
  const role = useSessionStore((s) => s.user?.role)
  const { data, isLoading, isError } = useAuditRecord(recordId)
  const reveal = useRevealAuditRecord()
  // Bản đã "Hiện đầy đủ" chỉ giữ trong state của sheet (không đưa vào cache) — mở bản ghi khác thì mất.
  const [revealed, setRevealed] = useState<AuditRecord | undefined>()

  if (isLoading) return <p className="text-muted-foreground px-5 text-sm">{vi.common.loading}</p>
  if (isError || !data) return <p className="text-destructive px-5 text-sm">{t.loadError}</p>

  const record = revealed ?? data
  const module = resolveModule(record)
  const severity = resolveSeverity(record)
  const canReveal = !!role && !revealed && canRevealAnyIn(data, role)

  async function handleReveal() {
    try {
      setRevealed(await reveal.mutateAsync(recordId))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.loadError)
    }
  }

  return (
    <div className="space-y-4 px-5 pb-5">
      <dl className="space-y-2">
        <Field label={t.time}>{formatDateTime(record.at)}</Field>
        <Field label={t.actor}>
          {record.actorName} <span className="text-muted-foreground">({resolveActorType(record) === 'SYSTEM' ? 'SYSTEM' : record.actorRole})</span>
        </Field>
        <Field label={t.actorType}>{AUDIT_ACTOR_TYPE_LABELS[resolveActorType(record)]}</Field>
        <Field label={t.module}>{module ? AUDIT_MODULE_LABELS[module] : vi.audit.unknownModule}</Field>
        <Field label={t.action}>{AUDIT_ACTION_LABELS[record.action]}</Field>
        <Field label={t.entity}>{record.entity}</Field>
        <Field label={t.entityId}>
          <span className="font-mono text-xs">{record.entityId}</span>
        </Field>
        <Field label={t.summary}>{record.summary}</Field>
        <Field label={t.severity}>
          <Badge variant={SEVERITY_BADGE[severity]}>{AUDIT_SEVERITY_LABELS[severity]}</Badge>
        </Field>
        {record.reason && <Field label={t.reason}>{record.reason}</Field>}
        {record.correlationId && (
          <Field label={t.correlation}>
            <span className="font-mono text-xs">{record.correlationId}</span>
          </Field>
        )}
      </dl>

      <div className="flex flex-wrap gap-2">
        {record.correlationId && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onFilterCorrelation(record.correlationId as string)
              onClose()
            }}
          >
            {t.related}
          </Button>
        )}
        {canReveal && (
          <Button variant="outline" size="sm" disabled={reveal.isPending} onClick={handleReveal}>
            {t.reveal}
          </Button>
        )}
      </div>
      {canReveal && <p className="text-muted-foreground text-xs">{t.revealNote}</p>}
      {revealed && <p className="text-muted-foreground text-xs">{t.revealed}</p>}

      {record.before === undefined && record.after === undefined ? (
        <p className="text-muted-foreground text-sm">{t.noSnapshot}</p>
      ) : (
        <>
          <SnapshotTable title={t.before} snapshot={record.before} />
          <SnapshotTable title={t.after} snapshot={record.after} />
        </>
      )}
    </div>
  )
}

/** Chi tiết một bản ghi nhật ký (AL §9.2). Không có nút sửa/xoá (AL-BR-01). */
export function AuditRecordDetailSheet({ recordId, onClose, onFilterCorrelation }: AuditRecordDetailSheetProps) {
  return (
    <Sheet open={!!recordId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{vi.audit.detail.title}</SheetTitle>
          <SheetDescription className="sr-only">{vi.audit.detail.title}</SheetDescription>
        </SheetHeader>
        {recordId && <DetailBody key={recordId} recordId={recordId} onClose={onClose} onFilterCorrelation={onFilterCorrelation} />}
      </SheetContent>
    </Sheet>
  )
}
