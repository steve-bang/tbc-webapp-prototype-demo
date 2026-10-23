import { registerSeedStep } from '@/shared/fixtures/seedAll'
import { writeJson } from '@/shared/lib/storage'
import { SYSTEM_CONFIG_STORAGE_KEY } from './api'
import type { SystemConfig } from './model'

/**
 * Cấu hình công ty mặc định (SystemAdministration-BRD.md §10). Tên công ty trùng hằng `COMPANY_NAME` của `contracts/model.ts`
 * (không import — `contracts` thuộc SCC). phone/email để rỗng (placeholder hiển thị bằng thuộc tính placeholder của ô nhập); các trường văn bản tự do còn lại là placeholder vì SA §19 Q8 (danh sách trường) chưa chốt.
 * Không có `updatedAt`/`updatedBy` để snapshot seed tất định.
 */
registerSeedStep(() => {
  const config: SystemConfig = {
    companyName: 'Công ty TNHH Thiên Bảo Car',
    address: '[Địa chỉ công ty]',
    taxCode: '[Mã số thuế]',
    representative: '[Người đại diện theo pháp luật]',
    phone: '',
    email: '',
    logoNote: '[Logo — chưa tải lên ở bản demo]',
    timezone: 'Asia/Ho_Chi_Minh',
    currency: 'VND',
  }
  writeJson(SYSTEM_CONFIG_STORAGE_KEY, config)
})
