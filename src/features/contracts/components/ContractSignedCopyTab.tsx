import { vi } from '@/shared/i18n/vi'
import { formatDate } from '@/shared/lib/datetime'
import type { Contract } from '../model'

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  )
}

/** Tab "Bản ký" — hiển thị 4 field giả lập upload (§1.1 mục 4 kế hoạch), hoặc placeholder rỗng nếu chưa ký. */
export function ContractSignedCopyTab({ contract }: { contract: Contract }) {
  if (!contract.signedCopyFileName) {
    return (
      <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
        <p className="font-medium">{vi.contracts.signedEmpty}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label={vi.contracts.signedCopyFileName} value={contract.signedCopyFileName} />
      <Field label={vi.contracts.signedDate} value={contract.signedDate ? formatDate(contract.signedDate) : ''} />
      <Field label={vi.contracts.signedByCompany} value={contract.signedByCompany ?? ''} />
      <Field label={vi.contracts.signedByCustomer} value={contract.signedByCustomer ?? ''} />
    </div>
  )
}
