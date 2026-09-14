import { useState } from 'react'
import { toast } from 'sonner'
import type { Vehicle } from '@/features/vehicles'
import { MAINTENANCE_RULE_APPLIES_TO_LABELS, vi } from '@/shared/i18n/vi'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { useDeactivateMaintenanceRule } from '../hooks'
import type { MaintenanceRule } from '../model'

/**
 * `MT-BR-01/02/11` — danh sách quy tắc bảo dưỡng + nút vô hiệu hoá (không xoá
 * vật lý). Xác nhận qua `Dialog` (không `window.confirm`) — cùng lý do đã ghi
 * ở `EmployeeReasonDialog`: không phù hợp cho môi trường demo khách hàng.
 */
export function MaintenanceRuleList({
  rules,
  vehicles,
  canManage,
}: {
  rules: MaintenanceRule[]
  vehicles: Vehicle[]
  canManage: boolean
}) {
  const deactivateRule = useDeactivateMaintenanceRule()
  const [pendingRule, setPendingRule] = useState<MaintenanceRule | null>(null)

  function targetLabel(rule: MaintenanceRule): string {
    if (rule.appliesTo === 'VEHICLE_MODEL') return rule.vehicleModel ?? '—'
    const vehicle = vehicles.find((v) => v.id === rule.vehicleId)
    return vehicle ? `${vehicle.plate} — ${vehicle.brand} ${vehicle.model}` : (rule.vehicleId ?? '—')
  }

  async function handleConfirmDeactivate() {
    if (!pendingRule) return
    try {
      await deactivateRule.mutateAsync(pendingRule.id)
      toast.success(vi.maintenance.deactivateRuleSuccess)
      setPendingRule(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.maintenance.saveError)
    }
  }

  if (rules.length === 0) {
    return <p className="text-muted-foreground text-sm">{vi.maintenance.ruleEmpty}</p>
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{vi.maintenance.ruleCategory}</TableHead>
            <TableHead>{vi.maintenance.ruleThresholdKm}</TableHead>
            <TableHead>{vi.maintenance.ruleAppliesTo}</TableHead>
            <TableHead>{vi.maintenance.ruleStatus}</TableHead>
            {canManage && <TableHead className="text-right">{vi.common.actions}</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((rule) => (
            <TableRow key={rule.id}>
              <TableCell className="font-medium">{rule.category}</TableCell>
              <TableCell>{rule.thresholdKm.toLocaleString('vi-VN')} km</TableCell>
              <TableCell>
                <Badge variant="outline">{MAINTENANCE_RULE_APPLIES_TO_LABELS[rule.appliesTo]}</Badge>{' '}
                <span className="text-muted-foreground text-xs">{targetLabel(rule)}</span>
              </TableCell>
              <TableCell>
                <Badge variant={rule.active ? 'success' : 'neutral'}>
                  {rule.active ? vi.maintenance.ruleActive : vi.maintenance.ruleInactive}
                </Badge>
              </TableCell>
              {canManage && (
                <TableCell className="text-right">
                  {rule.active && (
                    <Button size="sm" variant="outline" onClick={() => setPendingRule(rule)}>
                      {vi.maintenance.deactivateRuleButton}
                    </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!pendingRule} onOpenChange={(open) => !open && setPendingRule(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{vi.maintenance.deactivateRuleButton}</DialogTitle>
            <DialogDescription>{vi.maintenance.deactivateRuleConfirm}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingRule(null)}>
              {vi.common.cancel}
            </Button>
            <Button type="button" disabled={deactivateRule.isPending} onClick={handleConfirmDeactivate}>
              {vi.common.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
