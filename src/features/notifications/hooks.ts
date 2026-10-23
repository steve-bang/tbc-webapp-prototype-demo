import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSessionStore } from '@/features/auth'
import * as api from './api'
import type { NotificationFilter } from './model'

/** Tín hiệu cảnh báo vận hành cho Dashboard (Round 1) — chỉ đọc. */
export function useOperationalSignals() {
  return useQuery({
    queryKey: ['notifications', 'signals'],
    queryFn: () => api.listOperationalSignals(),
  })
}

function useActor(): api.NotificationActor | undefined {
  const user = useSessionStore((s) => s.user)
  return user ? { userId: user.userId, fullName: user.fullName, role: user.role } : undefined
}

/** Danh sách thông báo của tôi (Round 2) — mỗi lần đọc đồng bộ tín hiệu → sự kiện (E3). */
export function useMyNotifications(filter: NotificationFilter) {
  const actor = useActor()
  return useQuery({
    queryKey: ['notifications', 'mine', actor?.userId, actor?.role, filter],
    queryFn: () => api.listMyNotifications(actor!, filter),
    enabled: !!actor,
  })
}

/** Số chưa đọc cho chuông. Feature khác không invalidate key này nên phải poll + refetch khi focus. */
export function useUnreadNotificationCount() {
  const actor = useActor()
  return useQuery({
    queryKey: ['notifications', 'unread', actor?.userId, actor?.role],
    queryFn: () => api.getUnreadCount(actor!),
    enabled: !!actor,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
}

export function useMarkNotificationRead() {
  const actor = useActor()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id, actor!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useMarkAllNotificationsRead() {
  const actor = useActor()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.markAllNotificationsRead(actor!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}
