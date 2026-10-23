import { Check, Minus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ROLES } from '@/shared/domain/enums'
import { listPermissionMatrix, RESOURCES, type Resource } from '@/shared/domain/permissions'
import { ACTION_LABELS, RESOURCE_LABELS } from '@/shared/i18n/platformLabels'
import { ROLE_LABELS, vi } from '@/shared/i18n/vi'
import { PageHeader } from '@/shared/layout/PageHeader'
import { Badge } from '@/shared/ui/badge'
import { Card, CardContent } from '@/shared/ui/card'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { groupPermissionEntries, summarizePermissionMatrix, type PermissionMatrixEntry } from '../model'
import { usePermission } from '../usePermission'

const ALL = '__ALL__'

function Cell({ value }: { value: PermissionMatrixEntry['values'][keyof PermissionMatrixEntry['values']] }) {
  const t = vi.permissionMatrix
  if (value === true) return <Check className="text-status-done mx-auto size-4" aria-label={t.allowed} />
  if (value === false) return <X className="text-muted-foreground mx-auto size-4" aria-label={t.denied} />
  if (value === 'TBD') return <Badge variant="warning">TBD</Badge>
  return <Minus className="text-muted-foreground mx-auto size-4" aria-label={t.notDeclared} />
}

/**
 * Vai trò & quyền — `/platform/permissions` (SystemAdministration-BRD.md §9, UC-SA-09 phần xem). Chỉ đọc hằng `permissions.ts`.
 * TODO(OQ: SystemAdministration-BRD.md §19 Q10) — chưa chốt tuỳ chỉnh quyền trên UI nên màn này không có thao tác sửa.
 */
export function PermissionMatrixScreen() {
  const t = vi.permissionMatrix
  const { can } = usePermission()
  const [resource, setResource] = useState<string>(ALL)
  const [onlyTbd, setOnlyTbd] = useState(false)

  const entries = useMemo(() => listPermissionMatrix(), [])
  const summary = useMemo(() => summarizePermissionMatrix(entries, ROLES), [entries])
  const groups = useMemo(() => {
    const filtered = entries.filter((e) => (!onlyTbd || ROLES.some((r) => e.values[r] === 'TBD')) && (resource === ALL || e.resource === resource))
    return groupPermissionEntries(filtered)
  }, [entries, resource, onlyTbd])

  if (!can('SYSTEM_ADMIN', 'VIEW')) {
    return (
      <div>
        <PageHeader title={t.title} />
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">{t.noPermission}</p>
      </div>
    )
  }

  const stats = [
    { label: t.statTbdCells, value: summary.tbdCells },
    { label: t.statRowsWithTbd, value: summary.rowsWithTbd },
    { label: t.statTrueCells, value: summary.trueCells },
    { label: t.statUndefinedCells, value: summary.undefinedCells },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t.title} description={t.description} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="py-3">
              <p className="text-muted-foreground text-xs">{s.label}</p>
              <p className="text-2xl font-semibold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-muted-foreground flex flex-col gap-1 text-xs">
        <p>{t.readOnlyNote}</p>
        <p>{t.tbdNote}</p>
        <p>{t.salesNote}</p>
        <p>{t.undefinedNote}</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:w-64">
          <Select value={resource} onValueChange={setResource}>
            <SelectTrigger aria-label={t.filterResource}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t.filterAllResources}</SelectItem>
              {RESOURCES.map((r: Resource) => (
                <SelectItem key={r} value={r}>
                  {RESOURCE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="pm-only-tbd" checked={onlyTbd} onCheckedChange={setOnlyTbd} />
          <Label htmlFor="pm-only-tbd">{t.onlyTbd}</Label>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">{t.empty}</p>
      ) : (
        groups.map((group) => (
          <div key={group.resource} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">{RESOURCE_LABELS[group.resource]}</h2>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.columnAction}</TableHead>
                    {ROLES.map((r) => (
                      <TableHead key={r} className="text-center">
                        {ROLE_LABELS[r]}
                      </TableHead>
                    ))}
                    <TableHead className="hidden lg:table-cell">{t.columnSource}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.entries.map((entry) => (
                    <TableRow key={`${entry.resource}.${entry.action}`}>
                      <TableCell className="align-top font-medium">
                        {ACTION_LABELS[entry.action]}
                        <p className="text-muted-foreground mt-1 text-xs font-normal break-words lg:hidden">{entry.source}</p>
                      </TableCell>
                      {ROLES.map((r) => (
                        <TableCell key={r} className="text-center align-top">
                          <Cell value={entry.values[r]} />
                        </TableCell>
                      ))}
                      <TableCell className="text-muted-foreground hidden max-w-xs text-xs break-words whitespace-normal lg:table-cell">
                        {entry.source}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
