import { NavLink } from 'react-router-dom'
import { usePermission } from '@/features/auth'
import { cn } from '@/shared/lib/cn'
import { isNavGroup, NAV_ENTRIES, type NavLeaf } from './nav'

function visibleLeaves(items: NavLeaf[], can: ReturnType<typeof usePermission>['can']): NavLeaf[] {
  return items.filter((item) => !item.resource || !item.action || can(item.resource, item.action))
}

function NavLeafLink({ item, indented }: { item: NavLeaf; indented?: boolean }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          indented && 'pl-9',
          isActive
            ? 'bg-sidebar-primary text-sidebar-primary-foreground'
            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        )
      }
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </NavLink>
  )
}

export function Sidebar({ className }: { className?: string }) {
  const { can } = usePermission()

  return (
    <nav className={cn('flex flex-col gap-1 overflow-y-auto p-3', className)}>
      {NAV_ENTRIES.map((entry) => {
        if (!isNavGroup(entry)) {
          if (entry.resource && entry.action && !can(entry.resource, entry.action)) return null
          return <NavLeafLink key={entry.path} item={entry} />
        }

        const items = visibleLeaves(entry.items, can)
        if (items.length === 0) return null
        const GroupIcon = entry.icon
        return (
          <div key={entry.label} className="mt-3 first:mt-0">
            <div className="text-sidebar-foreground/60 flex items-center gap-2 px-3 pb-1 text-xs font-semibold tracking-wide uppercase">
              <GroupIcon className="size-3.5" />
              {entry.label}
            </div>
            <div className="flex flex-col gap-0.5">
              {items.map((item) => (
                <NavLeafLink key={item.path} item={item} indented />
              ))}
            </div>
          </div>
        )
      })}
    </nav>
  )
}
