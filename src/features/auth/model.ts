import type { Role } from '@/shared/domain/enums'

export interface DemoAccount {
  userId: string
  username: string
  /** Mật khẩu demo hiển thị sẵn trên màn Login — bản demo chấp nhận mọi mật khẩu. */
  password: string
  fullName: string
  role: Role
}

export interface SessionUser {
  userId: string
  username: string
  fullName: string
  role: Role
}

/**
 * Tài khoản nội bộ đăng nhập bằng username + password do Admin cấp — không
 * OTP (CR-2026-034). Mỗi vai trò trong `WebappQuanTri.md` §3 có một tài
 * khoản demo để người trình bày chọn nhanh trên màn Login.
 */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    userId: 'usr_admin',
    username: 'admin',
    password: 'admin123',
    fullName: 'Nguyễn Văn Admin',
    role: 'SYSTEM_ADMIN',
  },
  {
    userId: 'usr_manager',
    username: 'manager',
    password: 'manager123',
    fullName: 'Trần Thị Quản Lý',
    role: 'MANAGER',
  },
  {
    userId: 'usr_dispatcher',
    username: 'dispatcher',
    password: 'dispatcher123',
    fullName: 'Lê Văn Điều Phối',
    role: 'DISPATCHER',
  },
  {
    userId: 'usr_sales',
    username: 'sales',
    password: 'sales123',
    fullName: 'Phạm Thị Kinh Doanh',
    role: 'SALES',
  },
  {
    userId: 'usr_accountant',
    username: 'accountant',
    password: 'accountant123',
    fullName: 'Đỗ Thị Kế Toán',
    role: 'ACCOUNTANT',
  },
  {
    userId: 'usr_staff',
    username: 'staff',
    password: 'staff123',
    fullName: 'Hoàng Văn Nhân Viên',
    role: 'OPERATION_STAFF',
  },
]

export function findDemoAccount(username: string, password: string): DemoAccount | undefined {
  return DEMO_ACCOUNTS.find(
    (a) => a.username.toLowerCase() === username.trim().toLowerCase() && password.length > 0,
  )
}
