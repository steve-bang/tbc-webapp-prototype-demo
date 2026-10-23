import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSessionStore } from '@/features/auth'
import { DEFAULT_PAGE_SIZE } from '@/shared/lib/pagination'
import * as api from './api'
import type { AuditFilter } from './model'

/** Số dòng mỗi trang của bảng Nhật ký (DASHBOARD-PLATFORM-PLAN.md §8.3). */
export const AUDIT_PAGE_SIZE = DEFAULT_PAGE_SIZE

function useViewer(): api.AuditViewer | undefined {
  const user = useSessionStore((s) => s.user)
  return user ? { userId: user.userId, fullName: user.fullName, role: user.role } : undefined
}

/** Query key luôn kèm người xem + vai trò để đổi vai trò nhanh không dùng nhầm cache của phạm vi khác. */
export function useAuditRecordsPage(filter: AuditFilter, page: number) {
  const viewer = useViewer()
  return useQuery({
    queryKey: ['audit', 'page', viewer?.userId, viewer?.role, filter, page],
    queryFn: () => api.listAuditRecordsPage(filter, page, AUDIT_PAGE_SIZE, viewer!),
    enabled: !!viewer,
    placeholderData: keepPreviousData,
  })
}

/** Một bản ghi (đã che theo vai trò, chưa "Hiện đầy đủ"). */
export function useAuditRecord(id: string | undefined) {
  const viewer = useViewer()
  return useQuery({
    queryKey: ['audit', 'record', viewer?.userId, viewer?.role, id],
    queryFn: () => api.getAuditRecord(id!, viewer!),
    enabled: !!viewer && !!id,
  })
}

/** "Hiện đầy đủ" — ghi meta-audit `SENSITIVE` (AL-BR-08). */
export function useRevealAuditRecord() {
  const viewer = useViewer()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.revealAuditRecord(id, viewer!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['audit', 'page'] }),
  })
}

/** Meta-audit mở màn (AL-BR-06) — màn gọi đúng MỘT lần khi mở. */
export function useRecordAuditLogView() {
  const viewer = useViewer()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.recordAuditLogView(viewer!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['audit'] }),
  })
}

export function useExportAuditCsv() {
  const viewer = useViewer()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (filter: AuditFilter) => api.exportAuditCsv(filter, viewer!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['audit'] }),
  })
}
