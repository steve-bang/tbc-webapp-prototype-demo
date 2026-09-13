import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Role } from '@/shared/domain/enums'
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
          entity: 'UserAccount',
          entityId: user.userId,
          summary: `${user.fullName} (${user.role}) đăng nhập`,
          actorUserId: user.userId,
          actorName: user.fullName,
          actorRole: user.role,
        })
      },
      logout: () => set({ user: null }),
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
