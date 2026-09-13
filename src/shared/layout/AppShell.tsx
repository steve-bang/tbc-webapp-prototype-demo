import { useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useSessionStore } from '@/features/auth'
import { paths } from '@/app/paths'
import { vi } from '@/shared/i18n/vi'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppShell() {
  const user = useSessionStore((s) => s.user)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  if (!user) {
    return <Navigate to={paths.login} replace />
  }

  return (
    <div className="bg-background flex h-svh flex-col">
      <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />
      <div className="flex min-h-0 flex-1">
        <aside className="bg-sidebar border-sidebar-border hidden w-64 shrink-0 border-r md:block">
          <Sidebar className="h-full" />
        </aside>

        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="bg-sidebar w-72 p-0">
            <SheetHeader className="border-b">
              <SheetTitle>{vi.common.appName}</SheetTitle>
            </SheetHeader>
            <Sidebar />
          </SheetContent>
        </Sheet>

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
