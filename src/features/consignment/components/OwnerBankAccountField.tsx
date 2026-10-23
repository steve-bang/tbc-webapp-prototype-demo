import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { useRevealOwnerBankAccount } from '../hooks'
import { maskAccountNumber, type VehicleOwner } from '../model'

/**
 * Tài khoản nhận tiền của chủ xe — luôn hiện dạng đã che (BRD mục 21). "Hiện đầy đủ" gọi API (ghi meta-audit mỗi lần);
 * số đầy đủ chỉ nằm trong state của component này, không đưa vào cache truy vấn.
 */
export function OwnerBankAccountField({ owner, canReveal }: { owner: VehicleOwner; canReveal: boolean }) {
  const reveal = useRevealOwnerBankAccount()
  const [fullNumber, setFullNumber] = useState<string | undefined>(undefined)

  if (!owner.bankAccount) {
    return <span className="text-muted-foreground text-sm">{vi.consignment.ownerNoBank}</span>
  }
  const { bankName, accountHolder, accountNumber } = owner.bankAccount

  async function handleReveal() {
    try {
      setFullNumber(await reveal.mutateAsync(owner.id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.consignment.bankRevealError)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm">{fullNumber ?? maskAccountNumber(accountNumber)}</span>
        {canReveal &&
          (fullNumber ? (
            <Button type="button" size="sm" variant="outline" onClick={() => setFullNumber(undefined)}>
              <EyeOff className="size-3.5" />
              {vi.consignment.bankHide}
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" disabled={reveal.isPending} onClick={handleReveal}>
              <Eye className="size-3.5" />
              {vi.consignment.bankReveal}
            </Button>
          ))}
      </div>
      <span className="text-muted-foreground text-xs">
        {bankName} — {accountHolder}
      </span>
      {canReveal && <span className="text-muted-foreground text-xs">{vi.consignment.bankRevealNote}</span>}
    </div>
  )
}
