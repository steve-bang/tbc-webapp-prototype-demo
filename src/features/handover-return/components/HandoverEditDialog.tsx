import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { CONDITION_ITEM_TYPES } from '@/shared/domain/enums'
import { CONDITION_ITEM_TYPE_LABELS, vi } from '@/shared/i18n/vi'
import { generateId } from '@/shared/lib/id'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { Textarea } from '@/shared/ui/textarea'
import { useUpdateHandover } from '../hooks'
import {
  SUGGESTED_CHECKLIST_ITEMS,
  handoverEditFormSchema,
  type HandoverChecklistItem,
  type HandoverConditionItem,
  type HandoverEditFormValues,
  type HandoverRecord,
} from '../model'

function defaultValues(handover: HandoverRecord): HandoverEditFormValues {
  return {
    actualPickupDateTime: handover.actualPickupDateTime?.slice(0, 16) ?? '',
    odometerHandover: handover.odometerHandover !== undefined ? String(handover.odometerHandover) : '',
    fuelLevelHandover: handover.fuelLevelHandover !== undefined ? String(handover.fuelLevelHandover) : '',
    note: handover.note ?? '',
    customerAcknowledged: handover.customerAcknowledged,
    customerAcknowledgedNote: handover.customerAcknowledgedNote ?? '',
    prepaymentConfirmed: handover.prepaymentConfirmed,
    fullPaymentConfirmed: handover.fullPaymentConfirmed,
    reason: '',
  }
}

/**
 * VH-BR-12/UC-VH-13 — Sửa biên bản giao xe `COMPLETED`.
 * `docs/HANDOVER-RETURN-MANAGEMENT-PLAN.md` §0.3/§5.5: field vô hướng dùng
 * `react-hook-form`+zod; checklist/condition items dùng `useState` mảng thuần
 * (không có tiền lệ `useFieldArray` trong repo — quyết định kỹ thuật xác nhận
 * bởi `tech-lead`).
 */
export function HandoverEditDialog({
  handover,
  open,
  onOpenChange,
}: {
  handover: HandoverRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const updateHandover = useUpdateHandover()
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<HandoverEditFormValues>({
    resolver: zodResolver(handoverEditFormSchema),
    defaultValues: handover ? defaultValues(handover) : undefined,
  })
  const customerAcknowledged = useWatch({ control, name: 'customerAcknowledged' })

  const [conditionItems, setConditionItems] = useState<HandoverConditionItem[]>(handover?.preExistingConditionItems ?? [])
  const [checklist, setChecklist] = useState<HandoverChecklistItem[]>(handover?.checklist ?? [])
  const [motorbikeOdometer, setMotorbikeOdometer] = useState(String(handover?.motorbikeCollateral?.odometer ?? ''))
  const [motorbikeFuelLevel, setMotorbikeFuelLevel] = useState(String(handover?.motorbikeCollateral?.fuelLevel ?? ''))

  // Reset toàn bộ form + state mảng khi dialog vừa mở lại cho 1 bản ghi khác — "adjusting state during render".
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open && handover) {
      reset(defaultValues(handover))
      setConditionItems(handover.preExistingConditionItems)
      setChecklist(handover.checklist)
      setMotorbikeOdometer(String(handover.motorbikeCollateral?.odometer ?? ''))
      setMotorbikeFuelLevel(String(handover.motorbikeCollateral?.fuelLevel ?? ''))
    }
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
  }

  function addConditionItem() {
    setConditionItems((items) => [
      ...items,
      { id: generateId('cnd'), type: 'OTHER', description: '', mediaMeta: [] },
    ])
  }
  function updateConditionItem(id: string, patch: Partial<HandoverConditionItem>) {
    setConditionItems((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }
  function removeConditionItem(id: string) {
    setConditionItems((items) => items.filter((item) => item.id !== id))
  }

  function addChecklistItem() {
    setChecklist((items) => [...items, { id: generateId('chk'), itemName: '', status: 'DELIVERED' }])
  }
  function updateChecklistItem(id: string, patch: Partial<HandoverChecklistItem>) {
    setChecklist((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }
  function removeChecklistItem(id: string) {
    setChecklist((items) => items.filter((item) => item.id !== id))
  }

  async function onSubmit(values: HandoverEditFormValues) {
    if (!handover) return
    try {
      await updateHandover.mutateAsync({
        id: handover.id,
        reason: values.reason,
        patch: {
          actualPickupDateTime: values.actualPickupDateTime,
          odometerHandover: Number(values.odometerHandover),
          fuelLevelHandover: Number(values.fuelLevelHandover),
          note: values.note?.trim() || undefined,
          customerAcknowledged: values.customerAcknowledged,
          customerAcknowledgedNote: values.customerAcknowledgedNote?.trim() || undefined,
          prepaymentConfirmed: values.prepaymentConfirmed,
          fullPaymentConfirmed: values.fullPaymentConfirmed,
          preExistingConditionItems: conditionItems,
          checklist,
          motorbikeCollateral: handover.motorbikeCollateral
            ? { ...handover.motorbikeCollateral, odometer: Number(motorbikeOdometer) || 0, fuelLevel: Number(motorbikeFuelLevel) || 0 }
            : undefined,
        },
      })
      toast.success(vi.handoverReturn.editHandoverSuccess)
      handleOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.handoverReturn.editHandoverError)
    }
  }

  const isBusy = updateHandover.isPending || isSubmitting

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{vi.handoverReturn.editHandoverDialogTitle}</DialogTitle>
        </DialogHeader>

        <form id="handover-edit-form" className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="he-actualPickupDateTime">{vi.handoverReturn.actualPickupDateTime} *</Label>
              <Input id="he-actualPickupDateTime" type="datetime-local" {...register('actualPickupDateTime')} />
              {errors.actualPickupDateTime && <p className="text-destructive text-sm">{errors.actualPickupDateTime.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="he-odometerHandover">{vi.handoverReturn.odometerHandover} *</Label>
              <Input id="he-odometerHandover" inputMode="numeric" {...register('odometerHandover')} />
              {errors.odometerHandover && <p className="text-destructive text-sm">{errors.odometerHandover.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="he-fuelLevelHandover">{vi.handoverReturn.fuelLevelHandover} *</Label>
              <Input id="he-fuelLevelHandover" inputMode="numeric" {...register('fuelLevelHandover')} />
              {errors.fuelLevelHandover && <p className="text-destructive text-sm">{errors.fuelLevelHandover.message}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="he-note">{vi.handoverReturn.note}</Label>
            <Textarea id="he-note" rows={2} {...register('note')} />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="customerAcknowledged"
                render={({ field }) => (
                  <Checkbox id="he-customerAcknowledged" checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                )}
              />
              <Label htmlFor="he-customerAcknowledged" className="font-normal">
                {vi.handoverReturn.customerAcknowledged}
              </Label>
            </div>
            {customerAcknowledged && (
              <Input placeholder={vi.handoverReturn.customerAcknowledgedNote} {...register('customerAcknowledgedNote')} />
            )}
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="prepaymentConfirmed"
                render={({ field }) => (
                  <Checkbox id="he-prepaymentConfirmed" checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                )}
              />
              <Label htmlFor="he-prepaymentConfirmed" className="font-normal">
                {vi.handoverReturn.prepaymentConfirmed}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="fullPaymentConfirmed"
                render={({ field }) => (
                  <Checkbox id="he-fullPaymentConfirmed" checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                )}
              />
              <Label htmlFor="he-fullPaymentConfirmed" className="font-normal">
                {vi.handoverReturn.fullPaymentConfirmed}
              </Label>
            </div>
          </div>

          {handover?.motorbikeCollateral && (
            <>
              <Separator />
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-semibold">{vi.handoverReturn.sectionMotorbikeCollateral}</h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="he-motorbike-odo">{vi.handoverReturn.motorbikeOdometer}</Label>
                    <Input id="he-motorbike-odo" inputMode="numeric" value={motorbikeOdometer} onChange={(e) => setMotorbikeOdometer(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="he-motorbike-fuel">{vi.handoverReturn.motorbikeFuelLevel}</Label>
                    <Input id="he-motorbike-fuel" inputMode="numeric" value={motorbikeFuelLevel} onChange={(e) => setMotorbikeFuelLevel(e.target.value)} />
                  </div>
                </div>
              </div>
            </>
          )}

          <Separator />
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">{vi.handoverReturn.sectionConditionItems}</h4>
              <Button type="button" size="sm" variant="outline" onClick={addConditionItem}>
                {vi.handoverReturn.addConditionItemButton}
              </Button>
            </div>
            {conditionItems.map((item) => (
              <div key={item.id} className="border-border flex flex-col gap-2 rounded-md border p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Select value={item.type} onValueChange={(v) => updateConditionItem(item.id, { type: v as HandoverConditionItem['type'] })}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITION_ITEM_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {CONDITION_ITEM_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder={vi.handoverReturn.conditionColumnPosition}
                    value={item.position ?? ''}
                    onChange={(e) => updateConditionItem(item.id, { position: e.target.value })}
                  />
                  <Input
                    placeholder={vi.handoverReturn.conditionColumnDescription}
                    value={item.description}
                    onChange={(e) => updateConditionItem(item.id, { description: e.target.value })}
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeConditionItem(item.id)}>
                    {vi.handoverReturn.removeItemButton}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Separator />
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">{vi.handoverReturn.sectionChecklist}</h4>
              <Button type="button" size="sm" variant="outline" onClick={addChecklistItem}>
                {vi.handoverReturn.addChecklistItemButton}
              </Button>
            </div>
            {checklist.map((item) => (
              <div key={item.id} className="border-border flex flex-col gap-2 rounded-md border p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Input
                    list="handover-checklist-suggestions"
                    placeholder={vi.handoverReturn.itemNamePlaceholder}
                    value={item.itemName}
                    onChange={(e) => updateChecklistItem(item.id, { itemName: e.target.value })}
                  />
                  <Select
                    value={item.status}
                    onValueChange={(v) => updateChecklistItem(item.id, { status: v as HandoverChecklistItem['status'] })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DELIVERED">{vi.handoverReturn.checklistStatusLabels.DELIVERED}</SelectItem>
                      <SelectItem value="NOT_DELIVERED">{vi.handoverReturn.checklistStatusLabels.NOT_DELIVERED}</SelectItem>
                      <SelectItem value="NOT_APPLICABLE">{vi.handoverReturn.checklistStatusLabels.NOT_APPLICABLE}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder={vi.handoverReturn.checklistColumnNote}
                    value={item.note ?? ''}
                    onChange={(e) => updateChecklistItem(item.id, { note: e.target.value })}
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeChecklistItem(item.id)}>
                    {vi.handoverReturn.removeItemButton}
                  </Button>
                </div>
              </div>
            ))}
            <datalist id="handover-checklist-suggestions">
              {SUGGESTED_CHECKLIST_ITEMS.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <Separator />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="he-reason">{vi.handoverReturn.editReasonLabel} *</Label>
            <Textarea id="he-reason" rows={2} {...register('reason')} />
            {errors.reason && <p className="text-destructive text-sm">{errors.reason.message}</p>}
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="submit" form="handover-edit-form" disabled={isBusy}>
            {vi.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
