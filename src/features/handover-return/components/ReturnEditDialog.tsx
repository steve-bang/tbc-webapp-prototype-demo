import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { ADDITIONAL_CHARGE_TYPES, INCIDENT_ITEM_TYPES } from '@/shared/domain/enums'
import { ADDITIONAL_CHARGE_TYPE_LABELS, INCIDENT_ITEM_TYPE_LABELS, vi } from '@/shared/i18n/vi'
import { generateId } from '@/shared/lib/id'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { Textarea } from '@/shared/ui/textarea'
import { useUpdateReturn } from '../hooks'
import {
  returnEditFormSchema,
  type AdditionalChargeItem,
  type ReturnChecklistItem,
  type ReturnEditFormValues,
  type ReturnIncidentItem,
  type ReturnRecord,
} from '../model'

function defaultValues(returnRecord: ReturnRecord): ReturnEditFormValues {
  return {
    actualReturnDateTime: returnRecord.actualReturnDateTime?.slice(0, 16) ?? '',
    odometerReturn: returnRecord.odometerReturn !== undefined ? String(returnRecord.odometerReturn) : '',
    fuelLevelReturn: returnRecord.fuelLevelReturn !== undefined ? String(returnRecord.fuelLevelReturn) : '',
    note: returnRecord.note ?? '',
    customerAcknowledged: returnRecord.customerAcknowledged,
    customerAcknowledgedNote: returnRecord.customerAcknowledgedNote ?? '',
    reason: '',
  }
}

/**
 * VR-BR-16/UC-VR-18 — Sửa biên bản trả xe `COMPLETED`. Mirror
 * `HandoverEditDialog` — field vô hướng RHF+zod, danh sách lặp (checklist đối
 * chiếu/sự cố/khoản phát sinh) dùng `useState` mảng thuần.
 */
export function ReturnEditDialog({
  returnRecord,
  open,
  onOpenChange,
}: {
  returnRecord: ReturnRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const updateReturn = useUpdateReturn()
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ReturnEditFormValues>({
    resolver: zodResolver(returnEditFormSchema),
    defaultValues: returnRecord ? defaultValues(returnRecord) : undefined,
  })
  const customerAcknowledged = useWatch({ control, name: 'customerAcknowledged' })

  const [checklistComparison, setChecklistComparison] = useState<ReturnChecklistItem[]>(returnRecord?.checklistComparison ?? [])
  const [incidentItems, setIncidentItems] = useState<ReturnIncidentItem[]>(returnRecord?.incidentItems ?? [])
  const [additionalCharges, setAdditionalCharges] = useState<AdditionalChargeItem[]>(returnRecord?.additionalCharges ?? [])

  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open && returnRecord) {
      reset(defaultValues(returnRecord))
      setChecklistComparison(returnRecord.checklistComparison)
      setIncidentItems(returnRecord.incidentItems)
      setAdditionalCharges(returnRecord.additionalCharges)
    }
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
  }

  function updateChecklistItem(id: string, patch: Partial<ReturnChecklistItem>) {
    setChecklistComparison((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  function addIncidentItem() {
    setIncidentItems((items) => [
      ...items,
      {
        id: generateId('inc'),
        type: 'OTHER',
        description: '',
        baselineComparison: 'NEW',
        estimatedCost: 0,
        affectsSafety: false,
        chargeApprovalStatus: 'ESTIMATED',
        mediaMeta: [],
        status: 'OPEN',
      },
    ])
  }
  function updateIncidentItem(id: string, patch: Partial<ReturnIncidentItem>) {
    setIncidentItems((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }
  function removeIncidentItem(id: string) {
    setIncidentItems((items) => items.filter((item) => item.id !== id))
  }

  function addCharge() {
    setAdditionalCharges((items) => [...items, { id: generateId('chg'), type: 'OTHER', amount: 0 }])
  }
  function updateCharge(id: string, patch: Partial<AdditionalChargeItem>) {
    setAdditionalCharges((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }
  function removeCharge(id: string) {
    setAdditionalCharges((items) => items.filter((item) => item.id !== id))
  }

  async function onSubmit(values: ReturnEditFormValues) {
    if (!returnRecord) return
    try {
      await updateReturn.mutateAsync({
        id: returnRecord.id,
        reason: values.reason,
        patch: {
          actualReturnDateTime: values.actualReturnDateTime,
          odometerReturn: Number(values.odometerReturn),
          fuelLevelReturn: Number(values.fuelLevelReturn),
          note: values.note?.trim() || undefined,
          customerAcknowledged: values.customerAcknowledged,
          customerAcknowledgedNote: values.customerAcknowledgedNote?.trim() || undefined,
          checklistComparison,
          incidentItems,
          additionalCharges,
        },
      })
      toast.success(vi.handoverReturn.editReturnSuccess)
      handleOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.handoverReturn.editReturnError)
    }
  }

  const isBusy = updateReturn.isPending || isSubmitting

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{vi.handoverReturn.editReturnDialogTitle}</DialogTitle>
        </DialogHeader>

        <form id="return-edit-form" className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="re-actualReturnDateTime">{vi.handoverReturn.actualReturnDateTime} *</Label>
              <Input id="re-actualReturnDateTime" type="datetime-local" {...register('actualReturnDateTime')} />
              {errors.actualReturnDateTime && <p className="text-destructive text-sm">{errors.actualReturnDateTime.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="re-odometerReturn">{vi.handoverReturn.odometerReturn} *</Label>
              <Input id="re-odometerReturn" inputMode="numeric" {...register('odometerReturn')} />
              {errors.odometerReturn && <p className="text-destructive text-sm">{errors.odometerReturn.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="re-fuelLevelReturn">{vi.handoverReturn.fuelLevelReturn} *</Label>
              <Input id="re-fuelLevelReturn" inputMode="numeric" {...register('fuelLevelReturn')} />
              {errors.fuelLevelReturn && <p className="text-destructive text-sm">{errors.fuelLevelReturn.message}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="re-note">{vi.handoverReturn.note}</Label>
            <Textarea id="re-note" rows={2} {...register('note')} />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="customerAcknowledged"
                render={({ field }) => (
                  <Checkbox id="re-customerAcknowledged" checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                )}
              />
              <Label htmlFor="re-customerAcknowledged" className="font-normal">
                {vi.handoverReturn.customerAcknowledged}
              </Label>
            </div>
            {customerAcknowledged && (
              <Input placeholder={vi.handoverReturn.customerAcknowledgedNote} {...register('customerAcknowledgedNote')} />
            )}
          </div>

          <Separator />
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-semibold">{vi.handoverReturn.sectionChecklistComparison}</h4>
            {checklistComparison.map((item) => (
              <div key={item.id} className="border-border grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-3">
                <span className="self-center text-sm">{item.itemName}</span>
                <Select value={item.status} onValueChange={(v) => updateChecklistItem(item.id, { status: v as ReturnChecklistItem['status'] })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OK">{vi.handoverReturn.returnChecklistStatusLabels.OK}</SelectItem>
                    <SelectItem value="MISSING">{vi.handoverReturn.returnChecklistStatusLabels.MISSING}</SelectItem>
                    <SelectItem value="DAMAGED">{vi.handoverReturn.returnChecklistStatusLabels.DAMAGED}</SelectItem>
                    <SelectItem value="NOT_APPLICABLE">{vi.handoverReturn.returnChecklistStatusLabels.NOT_APPLICABLE}</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder={vi.handoverReturn.checklistColumnNote}
                  value={item.note ?? ''}
                  onChange={(e) => updateChecklistItem(item.id, { note: e.target.value })}
                />
              </div>
            ))}
          </div>

          <Separator />
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">{vi.handoverReturn.sectionIncidents}</h4>
              <Button type="button" size="sm" variant="outline" onClick={addIncidentItem}>
                {vi.handoverReturn.addIncidentItemButton}
              </Button>
            </div>
            {incidentItems.map((item) => (
              <div key={item.id} className="border-border flex flex-col gap-2 rounded-md border p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Select value={item.type} onValueChange={(v) => updateIncidentItem(item.id, { type: v as ReturnIncidentItem['type'] })}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INCIDENT_ITEM_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {INCIDENT_ITEM_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder={vi.handoverReturn.incidentColumnPosition}
                    value={item.position ?? ''}
                    onChange={(e) => updateIncidentItem(item.id, { position: e.target.value })}
                  />
                  <Input
                    placeholder={vi.handoverReturn.incidentColumnDescription}
                    value={item.description}
                    onChange={(e) => updateIncidentItem(item.id, { description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Select
                    value={item.baselineComparison}
                    onValueChange={(v) => updateIncidentItem(item.id, { baselineComparison: v as ReturnIncidentItem['baselineComparison'] })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEW">{vi.handoverReturn.baselineComparisonLabels.NEW}</SelectItem>
                      <SelectItem value="WORSENED">{vi.handoverReturn.baselineComparisonLabels.WORSENED}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    inputMode="numeric"
                    placeholder={vi.handoverReturn.incidentColumnEstimatedCost}
                    value={String(item.estimatedCost)}
                    onChange={(e) => updateIncidentItem(item.id, { estimatedCost: Number(e.target.value) || 0 })}
                  />
                  <Select
                    value={item.chargeApprovalStatus}
                    onValueChange={(v) => updateIncidentItem(item.id, { chargeApprovalStatus: v as ReturnIncidentItem['chargeApprovalStatus'] })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ESTIMATED">{vi.handoverReturn.chargeApprovalStatusLabels.ESTIMATED}</SelectItem>
                      <SelectItem value="PENDING_MANAGER_APPROVAL">{vi.handoverReturn.chargeApprovalStatusLabels.PENDING_MANAGER_APPROVAL}</SelectItem>
                      <SelectItem value="PENDING_GARAGE_BILL">{vi.handoverReturn.chargeApprovalStatusLabels.PENDING_GARAGE_BILL}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`re-incident-safety-${item.id}`}
                      checked={item.affectsSafety}
                      onCheckedChange={(checked) => updateIncidentItem(item.id, { affectsSafety: checked === true })}
                    />
                    <Label htmlFor={`re-incident-safety-${item.id}`} className="font-normal">
                      {vi.handoverReturn.incidentColumnAffectsSafety}
                    </Label>
                  </div>
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeIncidentItem(item.id)}>
                    {vi.handoverReturn.removeItemButton}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Separator />
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">{vi.handoverReturn.sectionAdditionalCharges}</h4>
              <Button type="button" size="sm" variant="outline" onClick={addCharge}>
                {vi.handoverReturn.addChargeButton}
              </Button>
            </div>
            {additionalCharges.map((item) => (
              <div key={item.id} className="border-border flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center">
                <Select value={item.type} onValueChange={(v) => updateCharge(item.id, { type: v as AdditionalChargeItem['type'] })}>
                  <SelectTrigger className="w-full sm:w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ADDITIONAL_CHARGE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {ADDITIONAL_CHARGE_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  inputMode="numeric"
                  placeholder={vi.handoverReturn.chargeColumnAmount}
                  value={String(item.amount)}
                  onChange={(e) => updateCharge(item.id, { amount: Number(e.target.value) || 0 })}
                />
                <Input
                  placeholder={vi.handoverReturn.chargeColumnNote}
                  value={item.note ?? ''}
                  onChange={(e) => updateCharge(item.id, { note: e.target.value })}
                />
                <Button type="button" size="sm" variant="ghost" onClick={() => removeCharge(item.id)}>
                  {vi.handoverReturn.removeItemButton}
                </Button>
              </div>
            ))}
          </div>

          <Separator />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="re-reason">{vi.handoverReturn.editReasonLabel} *</Label>
            <Textarea id="re-reason" rows={2} {...register('reason')} />
            {errors.reason && <p className="text-destructive text-sm">{errors.reason.message}</p>}
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="submit" form="return-edit-form" disabled={isBusy}>
            {vi.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
