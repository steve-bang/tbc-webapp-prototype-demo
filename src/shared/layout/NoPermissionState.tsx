import { Link } from 'react-router-dom'
import { paths } from '@/app/paths'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { PageHeader } from './PageHeader'

/** Trạng thái chung khi vai trò hiện tại không có quyền mở route (xem `RequirePermission`). */
export function NoPermissionState() {
  return (
    <div>
      <PageHeader title={vi.common.noPermissionTitle} description={vi.common.noPermissionDescription} />
      <Button asChild variant="outline">
        <Link to={paths.dashboard}>{vi.common.backToDashboard}</Link>
      </Button>
    </div>
  )
}
