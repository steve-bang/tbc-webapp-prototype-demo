import { Outlet } from 'react-router-dom'
import type { Action, Resource } from '@/shared/domain/permissions'
import { NoPermissionState } from '@/shared/layout/NoPermissionState'
import { usePermission } from '../usePermission'

/**
 * Layout route chặn theo quyền (TECH-HARDENING-PLAN.md §1.2, H1/H2): thiếu quyền thì hiện trạng thái "không có quyền",
 * giữ nguyên URL (không chuyển hướng) để đổi vai trò nhanh ở Topbar hiện lại màn ngay.
 */
export function RequirePermission({ access }: { access: { resource: Resource; action: Action } }) {
  const { can } = usePermission()
  return can(access.resource, access.action) ? <Outlet /> : <NoPermissionState />
}
