import { Construction } from 'lucide-react'
import { vi } from '@/shared/i18n/vi'
import { PageHeader } from './PageHeader'

export function ComingSoon({ title, note }: { title: string; note?: string }) {
  return (
    <div>
      <PageHeader title={title} />
      <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-16 text-center">
        <Construction className="size-8" />
        <p className="font-medium">{vi.common.comingSoon}</p>
        {note && <p className="max-w-md text-sm">{note}</p>}
      </div>
    </div>
  )
}
