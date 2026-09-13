import { useCallback } from 'react'
import type { Action, Resource } from '@/shared/domain/permissions'
import { can } from '@/shared/domain/permissions'
import { useSessionStore } from './store'

export function usePermission() {
  const role = useSessionStore((s) => s.user?.role)

  const hasPermission = useCallback(
    (resource: Resource, action: Action) => {
      if (!role) return false
      return can(role, resource, action)
    },
    [role],
  )

  return { role, can: hasPermission }
}
