import { can } from '@/shared/domain/permissions'
import { appendAudit } from '@/shared/lib/audit'
import { fakeRequest } from '@/shared/lib/fakeNetwork'
import { vi } from '@/shared/i18n/vi'
import { todayIso } from '@/shared/lib/datetime'
import { measureAppStorage, readJson, writeJson } from '@/shared/lib/storage'
import { systemConfigSchema, type SystemConfig, type SystemConfigFormValues } from './model'
import type { SessionUser } from './model'

export const SYSTEM_CONFIG_STORAGE_KEY = 'systemConfig'

const EDITABLE_FIELDS = ['companyName', 'address', 'taxCode', 'representative', 'phone', 'email', 'logoNote'] as const

export async function getSystemConfig(): Promise<SystemConfig | undefined> {
  return fakeRequest(() => readJson<SystemConfig>(SYSTEM_CONFIG_STORAGE_KEY))
}

/**
 * Sửa cấu hình công ty — chỉ `SYSTEM_ADMIN` (`SA` §13, kiểm ở tầng api); mọi thay đổi audit `CONFIG_CHANGE` (`SA-BR-09`)
 * chỉ chứa các trường đổi; không đổi gì thì không ghi, trả nguyên. Không hồi tố hợp đồng/biên lai đã sinh (`SA-BR-11`).
 */
export async function updateSystemConfig(
  input: SystemConfigFormValues,
  actor: Pick<SessionUser, 'userId' | 'fullName' | 'role'>,
): Promise<SystemConfig> {
  return fakeRequest(() => {
    if (!can(actor.role, 'SYSTEM_ADMIN', 'CONFIG')) throw new Error(vi.systemConfig.errors.noPermission)
    const values = systemConfigSchema.parse(input)
    const current = readJson<SystemConfig>(SYSTEM_CONFIG_STORAGE_KEY)
    if (!current) throw new Error(vi.systemConfig.errors.notFound)

    const before: Partial<Record<(typeof EDITABLE_FIELDS)[number], string>> = {}
    const after: Partial<Record<(typeof EDITABLE_FIELDS)[number], string>> = {}
    for (const field of EDITABLE_FIELDS) {
      if (current[field] !== values[field]) {
        before[field] = current[field]
        after[field] = values[field]
      }
    }
    const changed = Object.keys(after)
    if (changed.length === 0) return current

    const next: SystemConfig = { ...current, ...values, updatedAt: todayIso(), updatedBy: actor.fullName }
    writeJson(SYSTEM_CONFIG_STORAGE_KEY, next)
    appendAudit({
      action: 'CONFIG_CHANGE',
      module: 'SYSTEM_ADMIN',
      severity: 'NOTICE',
      entity: 'SystemConfig',
      entityId: 'company',
      summary: `${vi.systemConfig.auditSummaryPrefix}${changed.join(', ')}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before,
      after,
    })
    return next
  })
}

/** Dung lượng localStorage đang dùng (đồng hồ ở màn Cấu hình — DASHBOARD-PLATFORM-PLAN.md §8.5/§9.1). */
export async function getAppStorageUsage(): Promise<ReturnType<typeof measureAppStorage>> {
  return fakeRequest(() => measureAppStorage())
}
