import { useState } from 'react'
import { toast } from 'sonner'
import type { Incident } from '@/features/incidents'
import type { Rental } from '@/features/rentals'
import type { PostSettlementChargeType } from '@/shared/domain/enums'
import { POST_SETTLEMENT_CHARGE_SOURCE_LABELS, POST_SETTLEMENT_CHARGE_TYPE_LABELS, vi } from '@/shared/i18n/vi'
import { formatVnd } from '@/shared/lib/money'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { useCreatePostSettlementCharge } from '../hooks'
import {
  POST_SETTLEMENT_CHARGE_CREATABLE_SOURCES,
  fixedPscType,
  getIncidentPscBlocker,
  pscAmountForIncident,
  type PostSettlementCharge,
  type PscBlockerCode,
  type Settlement,
} from '../model'

/** `docs/RENTAL-SETTLEMENT-PLAN.md` §10.4 — nhãn lý do bị chặn theo khoá i18n (mirror lỗi API ở `finance/api.ts`). */
// PAYMENT-PLAN.md §7/§10 — loại `'payment'`/`'receivables'` vì là object lồng, không phải chuỗi.
const PSC_BLOCKER_LABELS: Record<PscBlockerCode, Exclude<keyof typeof vi.finance, 'payment' | 'receivables'>> = {
  ALREADY_IN_SETTLEMENT: 'pscBlockerAlreadyInSettlement',
  ALREADY_HAS_PSC: 'pscBlockerAlreadyHasPsc',
  NOT_CUSTOMER_LIABILITY: 'pscBlockerNotCustomerLiability',
  INCIDENT_VOID: 'pscBlockerIncidentVoid',
  CUSTOMER_CHARGE_NOT_FINAL: 'pscBlockerCustomerChargeNotFinal',
}

/**
 * Tạo Post-Settlement Charge — UC-RS-14, `docs/RENTAL-SETTLEMENT-PLAN.md`
 * §10.10. TODO(OQ: RentalSettlement-BRD.md §28 Q14/Q15 — thời hạn truy thu +
 * ngưỡng bỏ qua khoản nhỏ; demo không giới hạn, không đề xuất bỏ qua).
 */
export function PostSettlementChargeDialog({
  settlement,
  rental,
  incidents,
  existingPscs,
  open,
  onOpenChange,
}: {
  settlement: Settlement
  rental: Rental
  incidents: Incident[]
  existingPscs: PostSettlementCharge[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const create = useCreatePostSettlementCharge()
  const [source, setSource] = useState<(typeof POST_SETTLEMENT_CHARGE_CREATABLE_SOURCES)[number]>('TRAFFIC_FINE')
  const [incidentId, setIncidentId] = useState('')
  const [type, setType] = useState<PostSettlementChargeType>('RECEIVABLE')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [evidenceNote, setEvidenceNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setSource('TRAFFIC_FINE')
      setIncidentId('')
      setType('RECEIVABLE')
      setAmount('')
      setEvidenceNote('')
      setReason('')
      setError(null)
    }
  }

  const rentalIncidents = incidents.filter((i) => i.rentalId === rental.id)
  const isIncident = source === 'INCIDENT'
  const fixedType = fixedPscType(source)
  const selectedIncident = rentalIncidents.find((i) => i.id === incidentId)
  const blocker = selectedIncident ? getIncidentPscBlocker(selectedIncident, settlement, existingPscs) : undefined
  const lockedAmount = selectedIncident ? pscAmountForIncident(selectedIncident) : undefined

  async function handleConfirm() {
    if (!reason.trim() || reason.trim().length < 3) {
      setError('Lý do là bắt buộc (tối thiểu 3 ký tự)')
      return
    }
    if (isIncident) {
      if (!incidentId) {
        setError('Chọn sự cố liên quan')
        return
      }
      if (blocker) {
        setError(vi.finance[PSC_BLOCKER_LABELS[blocker]])
        return
      }
    } else {
      if (!amount || !/^\d+$/.test(amount) || Number(amount) <= 0) {
        setError('Số tiền phải là số nguyên dương')
        return
      }
      if (!fixedType && !type) {
        setError('Chọn loại khoản')
        return
      }
    }
    try {
      await create.mutateAsync({
        settlementId: settlement.id,
        input: {
          source,
          type: fixedType ?? type,
          amount: isIncident ? undefined : Number(amount),
          incidentId: isIncident ? incidentId : undefined,
          reason: reason.trim(),
          evidenceNote: evidenceNote.trim() || undefined,
        },
      })
      toast.success(vi.finance.pscCreateSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.finance.pscCreateError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.finance.pscDialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{vi.finance.pscSourceLabel}</Label>
            <Select
              value={source}
              onValueChange={(v) => {
                setSource(v as typeof source)
                setIncidentId('')
                setError(null)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POST_SETTLEMENT_CHARGE_CREATABLE_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {POST_SETTLEMENT_CHARGE_SOURCE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isIncident ? (
            <div className="flex flex-col gap-1.5">
              <Label>{vi.finance.pscIncidentLabel}</Label>
              {rentalIncidents.length === 0 ? (
                <p className="text-muted-foreground text-sm">{vi.finance.pscIncidentEmpty}</p>
              ) : (
                <Select value={incidentId} onValueChange={(v) => setIncidentId(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {rentalIncidents.map((i) => {
                      const b = getIncidentPscBlocker(i, settlement, existingPscs)
                      return (
                        <SelectItem key={i.id} value={i.id} disabled={!!b}>
                          {i.incidentCode} — {formatVnd(pscAmountForIncident(i))}
                          {b ? ` (${vi.finance[PSC_BLOCKER_LABELS[b]]})` : ''}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              )}
              {selectedIncident && blocker && <p className="text-destructive text-sm">{vi.finance[PSC_BLOCKER_LABELS[blocker]]}</p>}
              {selectedIncident && !blocker && (
                <>
                  <Label>{vi.finance.pscAmountLabel}</Label>
                  <Input value={lockedAmount !== undefined ? String(lockedAmount) : ''} disabled />
                  <p className="text-muted-foreground text-xs">{vi.finance.pscAmountLockedNote}</p>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="psc-amount">{vi.finance.pscAmountLabel} *</Label>
                <Input
                  id="psc-amount"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value)
                    if (error) setError(null)
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{vi.finance.pscTypeLabel}</Label>
                {fixedType ? (
                  <Input value={POST_SETTLEMENT_CHARGE_TYPE_LABELS[fixedType]} disabled />
                ) : (
                  <Select value={type} onValueChange={(v) => setType(v as PostSettlementChargeType)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RECEIVABLE">{POST_SETTLEMENT_CHARGE_TYPE_LABELS.RECEIVABLE}</SelectItem>
                      <SelectItem value="REFUND">{POST_SETTLEMENT_CHARGE_TYPE_LABELS.REFUND}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="psc-reason">{vi.finance.pscReasonLabel}</Label>
            <Textarea id="psc-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="psc-evidence">{vi.finance.pscEvidenceLabel}</Label>
            <Textarea id="psc-evidence" rows={2} value={evidenceNote} onChange={(e) => setEvidenceNote(e.target.value)} />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="button" disabled={create.isPending} onClick={handleConfirm}>
            {vi.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
