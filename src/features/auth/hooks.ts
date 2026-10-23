import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from './api'
import type { SystemConfigFormValues } from './model'
import { useSessionStore } from './store'

export function useSystemConfig(enabled = true) {
  return useQuery({ queryKey: ['systemConfig'], queryFn: api.getSystemConfig, enabled })
}

export function useUpdateSystemConfig() {
  const queryClient = useQueryClient()
  const user = useSessionStore((s) => s.user)
  return useMutation({
    mutationFn: (input: SystemConfigFormValues) => {
      if (!user) throw new Error('Chưa đăng nhập')
      return api.updateSystemConfig(input, user)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemConfig'] })
      queryClient.invalidateQueries({ queryKey: ['audit'] })
    },
  })
}

export function useAppStorageUsage(enabled = true) {
  return useQuery({ queryKey: ['appStorageUsage'], queryFn: api.getAppStorageUsage, enabled })
}
