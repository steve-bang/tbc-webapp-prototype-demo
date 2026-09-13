import { Menu, RotateCcw, UserCog } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ROLES } from '@/shared/domain/enums'
import { useSessionStore } from '@/features/auth'
import { resetDemoData } from '@/shared/fixtures/resetDemoData'
import { ROLE_LABELS, vi } from '@/shared/i18n/vi'
import { Avatar, AvatarFallback } from '@/shared/ui/avatar'
import { Button } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  return parts[parts.length - 1]?.[0]?.toUpperCase() ?? '?'
}

export function Topbar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const navigate = useNavigate()
  const user = useSessionStore((s) => s.user)
  const logout = useSessionStore((s) => s.logout)
  const switchRole = useSessionStore((s) => s.switchRole)

  function handleReset() {
    if (window.confirm(vi.common.resetDemoDataConfirm)) {
      resetDemoData()
    }
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  if (!user) return null

  return (
    <header className="bg-background flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:gap-3 sm:px-4">
      <Button variant="ghost" size="icon" className="shrink-0 md:hidden" onClick={onOpenMobileNav}>
        <Menu className="size-5" />
      </Button>
      <span className="min-w-0 truncate font-semibold">{vi.common.appName}</span>
      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        <Button variant="outline" size="sm" onClick={handleReset} title={vi.common.resetDemoData}>
          <RotateCcw className="size-4" />
          <span className="hidden sm:inline">{vi.common.resetDemoData}</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" title={ROLE_LABELS[user.role]}>
              <UserCog className="size-4" />
              <span className="hidden sm:inline">{ROLE_LABELS[user.role]}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{vi.common.switchRole}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {ROLES.map((role) => (
              <DropdownMenuItem
                key={role}
                onSelect={() => {
                  switchRole(role)
                  toast.info(`Đã chuyển sang vai trò ${ROLE_LABELS[role]}`)
                  navigate('/dashboard')
                }}
              >
                {ROLE_LABELS[role]}
                {role === user.role && ' ✓'}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="flex items-center gap-2 rounded-full">
              <Avatar>
                <AvatarFallback>{initials(user.fullName)}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{user.fullName}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleLogout}>{vi.common.logout}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
