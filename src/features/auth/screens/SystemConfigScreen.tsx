import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { resetDemoData } from '@/shared/fixtures/resetDemoData'
import { vi } from '@/shared/i18n/vi'
import { PageHeader } from '@/shared/layout/PageHeader'
import { formatDateTime } from '@/shared/lib/datetime'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { useAppStorageUsage, useSystemConfig, useUpdateSystemConfig } from '../hooks'
import { DEMO_STORAGE_QUOTA_CHARS, storageUsageRatio, systemConfigSchema, type SystemConfig, type SystemConfigFormValues } from '../model'
import { usePermission } from '../usePermission'

const SYSTEM_TIMEZONE = 'Asia/Ho_Chi_Minh'

function toFormValues(config?: SystemConfig): SystemConfigFormValues {
  return {
    companyName: config?.companyName ?? '',
    address: config?.address ?? '',
    taxCode: config?.taxCode ?? '',
    representative: config?.representative ?? '',
    phone: config?.phone ?? '',
    email: config?.email ?? '',
    logoNote: config?.logoNote ?? '',
  }
}

/**
 * Cấu hình hệ thống — `/platform/system-config` (SystemAdministration-BRD.md §6.3/§10, UC-SA-12). Xem: `SYSTEM_ADMIN.VIEW`;
 * sửa: `SYSTEM_ADMIN.CONFIG` (SA §13). TODO(OQ: SystemAdministration-BRD.md §19 Q8) danh sách trường · TODO(OQ: §19 Q9) một pháp nhân.
 */
export function SystemConfigScreen() {
  const t = vi.systemConfig
  const { can } = usePermission()
  const canView = can('SYSTEM_ADMIN', 'VIEW')
  const canConfig = can('SYSTEM_ADMIN', 'CONFIG')

  const { data: config, isLoading, isError } = useSystemConfig(canView)
  const { data: usage, isError: usageError } = useAppStorageUsage(canView)
  const update = useUpdateSystemConfig()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<SystemConfigFormValues>({
    resolver: zodResolver(systemConfigSchema),
    defaultValues: toFormValues(),
  })

  useEffect(() => {
    if (config) reset(toFormValues(config))
  }, [config, reset])

  if (!canView) {
    return (
      <div>
        <PageHeader title={t.title} />
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">{t.noPermission}</p>
      </div>
    )
  }

  async function onSubmit(values: SystemConfigFormValues) {
    if (!isDirty) {
      toast.info(t.saveNoChange)
      return
    }
    try {
      await update.mutateAsync(values)
      toast.success(t.saveSuccess)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.saveError)
    }
  }

  function handleReset() {
    if (window.confirm(vi.common.resetDemoDataConfirm)) resetDemoData()
  }

  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const timezoneMismatch = browserTimezone !== SYSTEM_TIMEZONE
  const ratio = usage ? storageUsageRatio(usage.totalChars) : 0
  const percent = Math.round(ratio * 1000) / 10
  const fields: { name: keyof SystemConfigFormValues; label: string; hint?: string; placeholder?: string }[] = [
    { name: 'companyName', label: t.companyName },
    { name: 'address', label: t.address },
    { name: 'taxCode', label: t.taxCode },
    { name: 'representative', label: t.representative },
    { name: 'phone', label: t.phone, placeholder: t.phonePlaceholder },
    { name: 'email', label: t.email, placeholder: t.emailPlaceholder },
    { name: 'logoNote', label: t.logoNote, hint: t.logoNoteHint },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t.title} description={t.description} />

      <Card>
        <CardHeader>
          <CardTitle>{t.companyCardTitle}</CardTitle>
          {!canConfig && <CardDescription>{t.readOnlyNote}</CardDescription>}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
          ) : isError || !config ? (
            <p className="text-muted-foreground text-sm">{t.loadError}</p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                {fields.map((f) => (
                  <div key={f.name} className="flex min-w-0 flex-col gap-1.5">
                    <Label htmlFor={`sc-${f.name}`}>{f.label}</Label>
                    <Input id={`sc-${f.name}`} readOnly={!canConfig} placeholder={canConfig ? f.placeholder : '—'} {...register(f.name)} />
                    {f.hint && <p className="text-muted-foreground text-xs">{f.hint}</p>}
                    {errors[f.name] && <p className="text-destructive text-xs">{errors[f.name]?.message}</p>}
                  </div>
                ))}
              </div>
              <div className="text-muted-foreground flex flex-col gap-1 text-xs">
                <p>
                  {t.lastUpdated}:{' '}
                  {config.updatedAt
                    ? t.lastUpdatedValue.replace('{{at}}', formatDateTime(config.updatedAt)).replace('{{by}}', config.updatedBy ?? '—')
                    : t.neverUpdated}
                </p>
                <p>{t.noRetroactiveNote}</p>
                {/* TODO(OQ: SystemAdministration-BRD.md §19 Q8) — hợp đồng/biên lai demo chưa đọc cấu hình này. */}
                <p>{t.demoNotWiredNote}</p>
              </div>
              {canConfig && (
                <div>
                  <Button type="submit" disabled={update.isPending}>
                    {t.saveButton}
                  </Button>
                </div>
              )}
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.generalCardTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="min-w-0">
              <dt className="text-muted-foreground text-xs">{t.timezone}</dt>
              <dd className="font-medium">{t.timezoneValue}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground text-xs">{t.currency}</dt>
              <dd className="font-medium">{t.currencyValue}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground text-xs">{t.browserTimezone}</dt>
              <dd className="truncate font-medium">{browserTimezone}</dd>
            </div>
          </dl>
          {timezoneMismatch && (
            <p className="text-status-pending flex items-start gap-2 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0 break-words">{t.timezoneWarning}</span>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.demoCardTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {usageError ? (
            <p className="text-muted-foreground text-sm">{t.storageLoadError}</p>
          ) : usage ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{t.storageUsed}</span>
                <span className="text-muted-foreground min-w-0 truncate">
                  {t.storageUsage
                    .replace('{{used}}', usage.totalChars.toLocaleString('vi-VN'))
                    .replace('{{quota}}', DEMO_STORAGE_QUOTA_CHARS.toLocaleString('vi-VN'))
                    .replace('{{percent}}', String(percent))}
                </span>
              </div>
              <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                <div className="bg-primary h-full" style={{ width: `${Math.min(100, ratio * 100)}%` }} />
              </div>
              <p className="text-muted-foreground text-xs">{t.storageQuotaNote}</p>
              <div className="mt-1">
                <p className="mb-1 text-xs font-medium">{t.storageTopKeys}</p>
                <ul className="text-muted-foreground flex flex-col gap-0.5 text-xs">
                  {usage.keys.slice(0, 5).map((k) => (
                    <li key={k.name} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate">{k.name}</span>
                      <span className="shrink-0">{k.chars.toLocaleString('vi-VN')}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-muted-foreground text-xs">{t.storageCapsNote}</p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
          )}
          <div>
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="size-4" />
              {t.resetButton}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
