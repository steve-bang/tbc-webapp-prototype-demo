import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Role } from '@/shared/domain/enums'
import { vi } from '@/shared/i18n/vi'
import { appendAudit } from '@/shared/lib/audit'
import type { SessionUser } from './model'
import { DEMO_ACCOUNTS } from './model'

interface SessionState {
  user: SessionUser | null
  login: (user: SessionUser) => void
  logout: () => void
  /** Đổi vai trò nhanh ngay trong phiên demo — không cần đăng xuất/đăng nhập lại. */
  switchRole: (role: Role) => void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      user: null,
      login: (user) => {
        set({ user })
        appendAudit({
          action: 'LOGIN',
          module: 'AUTH',
          entity: 'UserAccount',
          entityId: user.userId,
          summary: `${user.fullName} (${user.role}) đăng nhập`,
          actorUserId: user.userId,
          actorName: user.fullName,
          actorRole: user.role,
        })
      },
      logout: () => {
        // Ghi audit TRƯỚC khi xoá `user` để actor là người vừa đăng xuất (SA-BR-08; AuditLog-BRD.md §6 action LOGOUT).
        const current = get().user
        if (current) {
          appendAudit({
            action: 'LOGOUT',
            module: 'AUTH',
            entity: 'UserAccount',
            entityId: current.userId,
            summary: vi.auth.logoutAuditSummary.replace('{{name}}', current.fullName).replace('{{role}}', current.role),
            actorUserId: current.userId,
            actorName: current.fullName,
            actorRole: current.role,
          })
        }
        set({ user: null })
      },
      switchRole: (role) => {
        const account = DEMO_ACCOUNTS.find((a) => a.role === role)
        const current = get().user
        if (!account || !current) return
        const nextUser: SessionUser = {
          userId: account.userId,
          username: account.username,
          fullName: account.fullName,
          role: account.role,
        }
        set({ user: nextUser })
        appendAudit({
          action: 'LOGIN',
          module: 'AUTH',
          entity: 'UserAccount',
          entityId: nextUser.userId,
          summary: `Chuyển sang vai trò demo ${role} (${nextUser.fullName})`,
          actorUserId: nextUser.userId,
          actorName: nextUser.fullName,
          actorRole: nextUser.role,
        })
      },
    }),
    { name: 'tbc_admin:session' },
  ),
)
