import { registerSeedStep } from '@/shared/fixtures/seedAll'
import { addDaysToKey, todayKey, zonedDateTimeToIso } from '@/shared/lib/datetime'
import { writeJson } from '@/shared/lib/storage'
import { CUSTOMERS_STORAGE_KEY } from './api'
import type { Customer } from './model'

/** `YYYY-MM-DD` tính từ hôm nay ± số ngày — dùng để seed `CustomerDocument.expiryDate` demo đúng ngưỡng `documentExpiryStatus()` (30 ngày) dù chạy seed vào ngày nào. */
function isoDateOffset(days: number): string {
  return addDaysToKey(todayKey(), days)
}

// ---- Khách hàng demo bổ sung cho lịch sử lượt thuê 12 tháng (docs/DEMO-DATA-PLAN.md §3.1) ----
// Dữ liệu giả lập phục vụ demo. Sinh tất định bằng phép số học trên chỉ số — KHÔNG dùng Math.random/generateId để không
// làm xê dịch chuỗi ngẫu nhiên của các seed chạy sau (vehicles/seed.ts) hay id/số giấy tờ của bản ghi cũ.

const DEMO_CUSTOMER_COUNT = 48
const DEMO_CUSTOMER_FIRST_SEQ = 10 // cus_010 … cus_057

const DEMO_SURNAMES = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Huỳnh', 'Võ', 'Phan', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô']
const DEMO_MIDDLE_MALE = ['Văn', 'Minh', 'Quốc', 'Đức', 'Hữu', 'Anh', 'Thanh', 'Gia']
const DEMO_MIDDLE_FEMALE = ['Thị', 'Ngọc', 'Thanh', 'Kim', 'Hoài', 'Phương', 'Mai', 'Bảo']
// 24 tên mỗi giới, không trùng nhau ⇒ họ tên không trùng (mỗi khách dùng một tên riêng theo giới).
const DEMO_GIVEN_MALE = [
  'Hùng', 'Dũng', 'Nam', 'Khoa', 'Long', 'Phúc', 'Tài', 'Đạt', 'Huy', 'Khang', 'Bình', 'Cường',
  'Sơn', 'Tùng', 'Vinh', 'Hiếu', 'Quân', 'Thắng', 'Trung', 'Lâm', 'Phong', 'Duy', 'Kiên', 'Toàn',
]
const DEMO_GIVEN_FEMALE = [
  'Lan', 'Hà', 'Linh', 'Trang', 'Thảo', 'Nhi', 'Vy', 'My', 'Yến', 'Hương', 'Ngân', 'Oanh',
  'Phượng', 'Quyên', 'Trâm', 'Uyên', 'Xuân', 'Châu', 'Diệp', 'Giang', 'Hạnh', 'Khánh', 'Loan', 'Nga',
]
// Tiền tố di động — bỏ 090/091/093 để chắc chắn không trùng 9 khách cũ.
const DEMO_PHONE_PREFIXES = ['089', '070', '076', '077', '078', '079', '083', '084', '085', '081', '032', '033', '034', '035', '036', '037', '038', '039', '098', '097', '096', '086']
const DEMO_STREETS = [
  'Nguyễn Thị Minh Khai', 'Lý Thường Kiệt', 'Cộng Hòa', 'Xô Viết Nghệ Tĩnh', 'Nguyễn Oanh', 'Quang Trung',
  'Lê Văn Việt', 'Phạm Văn Đồng', 'Võ Văn Tần', 'Hai Bà Trưng', 'Âu Cơ', 'Tô Hiến Thành',
]
const DEMO_DISTRICTS = ['Quận 1', 'Quận 3', 'Quận 5', 'Quận 7', 'Quận 10', 'Bình Thạnh', 'Phú Nhuận', 'Tân Bình', 'Gò Vấp', 'Thủ Đức']

/** Bỏ dấu tiếng Việt + chữ thường, dùng cho phần local-part email. */
function slugVi(text: string): string {
  return text
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0')
}

function buildDemoCustomers(existing: Customer[]): Customer[] {
  const usedPhones = new Set(existing.map((c) => c.phone))
  const usedIds = new Set(existing.map((c) => c.idNumber))
  const usedLicenses = new Set(existing.map((c) => c.licenseNumber).filter((v): v is string => !!v))
  const usedNames = new Set(existing.map((c) => c.fullName))
  const result: Customer[] = []

  for (let k = 0; k < DEMO_CUSTOMER_COUNT; k++) {
    const male = k % 2 === 0
    const surname = DEMO_SURNAMES[k % DEMO_SURNAMES.length]
    const middle = male ? DEMO_MIDDLE_MALE[(k * 3) % DEMO_MIDDLE_MALE.length] : DEMO_MIDDLE_FEMALE[(k * 3) % DEMO_MIDDLE_FEMALE.length]
    const given = (male ? DEMO_GIVEN_MALE : DEMO_GIVEN_FEMALE)[k >> 1]
    const fullName = `${surname} ${middle} ${given}`

    const birthYear = 1975 + ((k * 7) % 28) // 1975 … 2002
    const birthMonth = 1 + ((k * 5) % 12)
    const birthDay = 1 + ((k * 11) % 28)
    const dob = `${birthYear}-${pad(birthMonth)}-${pad(birthDay)}`

    const phone = `${DEMO_PHONE_PREFIXES[k % DEMO_PHONE_PREFIXES.length]}${pad((1000003 * (k + 7) + 4321 * k) % 10_000_000, 7)}`
    // CCCD 12 số: 079 + mã giới tính/thế kỷ (0/1 = sinh thế kỷ 20, 2/3 = thế kỷ 21) + 2 số cuối năm sinh + 6 số.
    const genderCentury = (birthYear >= 2000 ? 2 : 0) + (male ? 0 : 1)
    const idNumber = `079${genderCentury}${pad(birthYear % 100)}${pad(100_000 + (((k + 1) * 7919 * 13) % 900_000), 6)}`
    const licenseNumber = `79${pad(((k + 1) * 48271) % 10_000_000_000, 10)}`

    const idIssueYear = 2021 + (k % 4)
    const idIssueDate = `${idIssueYear}-${pad(1 + ((k * 3) % 12))}-${pad(1 + ((k * 5) % 28))}`
    const idExpiryDate = `${idIssueYear + 15}${idIssueDate.slice(4)}`
    // GPLX B2: đủ 18 tuổi lúc cấp; hạn = cấp + 10 năm ⇒ luôn ≥ hôm nay + 1 năm (không nhiễu cảnh báo giấy tờ sắp hết hạn).
    const licenseIssueYear = Math.max(2019 + (k % 6), birthYear + 19)
    const licenseIssueDate = `${licenseIssueYear}-${pad(1 + ((k * 7) % 12))}-${pad(1 + ((k * 9) % 28))}`
    const licenseExpiryDate = `${licenseIssueYear + 10}${licenseIssueDate.slice(4)}`

    if (usedPhones.has(phone) || usedIds.has(idNumber) || usedLicenses.has(licenseNumber) || usedNames.has(fullName)) {
      throw new Error(`[seed customers/demo] trùng SĐT/CCCD/GPLX/họ tên ở khách demo #${k + 1}`)
    }
    usedPhones.add(phone)
    usedIds.add(idNumber)
    usedLicenses.add(licenseNumber)
    usedNames.add(fullName)

    // Tạo trước toàn bộ lịch sử lượt thuê (lượt đầu ≈ 365 ngày trước, đặt trước 3 ngày).
    const createdAt = zonedDateTimeToIso(addDaysToKey(todayKey(), -(380 + 3 * k)), 9, 0)

    result.push({
      id: `cus_${pad(DEMO_CUSTOMER_FIRST_SEQ + k, 3)}`,
      fullName,
      dob,
      gender: male ? 'MALE' : 'FEMALE',
      phone,
      email: `${slugVi(given)}.${slugVi(surname)}${DEMO_CUSTOMER_FIRST_SEQ + k}@example.com`,
      address: `${1 + ((k * 13) % 200)} ${DEMO_STREETS[k % DEMO_STREETS.length]}, ${DEMO_DISTRICTS[(k * 5) % DEMO_DISTRICTS.length]}, TP.HCM`,
      idType: 'ID_CARD',
      idNumber,
      idIssueDate,
      idIssuePlace: 'Cục CS QLHC về TTXH',
      idExpiryDate,
      licenseNumber,
      licenseClass: 'B2',
      licenseIssueDate,
      licenseExpiryDate,
      status: 'ACTIVE',
      documents: [],
      createdAt,
      updatedAt: createdAt,
    })
  }
  return result
}

/**
 * 9 khách hàng demo — `CustomerManagement-BRD.md` §7 / `WebappQuanTri.md` §7.4 /
 * `docs/CUSTOMER-MANAGEMENT-PLAN.md` §8. Round 2 hoàn thiện seed `CustomerDocument`
 * (Round 1 seed `documents: []` cho mọi khách vì chưa có CRUD).
 */
function seedCustomers(): void {
  const customers: Customer[] = [
    {
      id: 'cus_001',
      fullName: 'Nguyễn Thị Hồng Nhung',
      dob: '1992-05-14',
      gender: 'FEMALE',
      phone: '0909111222',
      email: 'nhung.nguyen@example.com',
      address: '12 Nguyễn Huệ, Quận 1, TP.HCM',
      idType: 'ID_CARD',
      idNumber: '079192001234',
      idIssueDate: '2015-06-01',
      idIssuePlace: 'CA TP.HCM',
      idExpiryDate: '2035-06-01',
      licenseNumber: '079192005678',
      licenseClass: 'B2',
      licenseIssueDate: '2016-03-10',
      licenseExpiryDate: '2031-03-10',
      status: 'ACTIVE',
      documents: [
        // CM §22/UC-CM-07 — document ID_CARD còn hiệu lực (demo badge VALID).
        {
          id: 'doc_001',
          documentType: 'ID_CARD',
          documentNumber: '079192001234',
          issueDate: '2015-06-01',
          expiryDate: '2035-06-01',
          createdAt: '2024-01-10T02:00:00.000Z',
          updatedAt: '2024-01-10T02:00:00.000Z',
        },
      ],
      createdAt: '2024-01-10T02:00:00.000Z',
      updatedAt: '2024-01-10T02:00:00.000Z',
    },
    {
      id: 'cus_002',
      fullName: 'Trần Văn Bảo Long',
      dob: '1988-11-02',
      gender: 'MALE',
      phone: '0909333444',
      email: 'long.tran@example.com',
      address: '45 Lê Lợi, Quận 3, TP.HCM',
      idType: 'ID_CARD',
      idNumber: '079188002345',
      idIssueDate: '2014-02-20',
      idIssuePlace: 'CA TP.HCM',
      idExpiryDate: '2034-02-20',
      licenseNumber: '079188006789',
      licenseClass: 'B2',
      licenseIssueDate: '2012-08-15',
      licenseExpiryDate: '2027-08-15',
      status: 'ACTIVE',
      documents: [
        // CM §22/UC-CM-07 — document ID_CARD còn hiệu lực (demo badge VALID).
        {
          id: 'doc_002',
          documentType: 'ID_CARD',
          documentNumber: '079188002345',
          issueDate: '2014-02-20',
          expiryDate: '2034-02-20',
          createdAt: '2024-01-15T02:00:00.000Z',
          updatedAt: '2024-01-15T02:00:00.000Z',
        },
      ],
      createdAt: '2024-01-15T02:00:00.000Z',
      updatedAt: '2024-01-15T02:00:00.000Z',
    },
    {
      id: 'cus_003',
      fullName: 'Sarah Johnson',
      dob: '1990-07-22',
      gender: 'FEMALE',
      phone: '0909555666',
      email: 'sarah.johnson@example.com',
      address: 'Khách sạn Rex, Quận 1, TP.HCM',
      idType: 'PASSPORT', // demo idType = PASSPORT
      idNumber: 'N1234567',
      idIssueDate: '2020-01-05',
      idIssuePlace: 'US Department of State',
      idExpiryDate: '2030-01-05',
      status: 'ACTIVE',
      documents: [],
      createdAt: '2024-02-01T02:00:00.000Z',
      updatedAt: '2024-02-01T02:00:00.000Z',
    },
    {
      id: 'cus_004',
      fullName: 'Phạm Minh Tuấn',
      dob: '1995-03-18',
      gender: 'MALE',
      phone: '0909777888',
      email: 'tuan.pham@example.com',
      address: '78 Cách Mạng Tháng 8, Quận 10, TP.HCM',
      idType: 'ID_CARD',
      idNumber: '079195003456',
      idIssueDate: '2016-09-01',
      idIssuePlace: 'CA TP.HCM',
      idExpiryDate: '2036-09-01',
      licenseNumber: '079195007890',
      licenseClass: 'B2',
      licenseIssueDate: '2017-05-20',
      licenseExpiryDate: '2032-05-20',
      status: 'ACTIVE',
      documents: [
        // CM §22/UC-CM-07 — document DRIVER_LICENSE sắp hết hạn trong 30 ngày (demo badge EXPIRING_SOON).
        {
          id: 'doc_003',
          documentType: 'DRIVER_LICENSE',
          documentNumber: '079195007890',
          issueDate: '2017-05-20',
          expiryDate: isoDateOffset(20),
          createdAt: '2024-02-10T02:00:00.000Z',
          updatedAt: '2024-02-10T02:00:00.000Z',
        },
      ],
      createdAt: '2024-02-10T02:00:00.000Z',
      updatedAt: '2024-02-10T02:00:00.000Z',
    },
    {
      id: 'cus_005',
      fullName: 'Lê Thị Kim Anh',
      dob: '1985-09-30',
      gender: 'FEMALE',
      phone: '0909999000',
      email: 'anh.le@example.com',
      address: '23 Điện Biên Phủ, Bình Thạnh, TP.HCM',
      idType: 'ID_CARD',
      idNumber: '079185004567',
      idIssueDate: '2013-04-11',
      idIssuePlace: 'CA TP.HCM',
      idExpiryDate: '2033-04-11',
      licenseNumber: '079185008901',
      licenseClass: 'B2',
      licenseIssueDate: '2010-01-01',
      licenseExpiryDate: '2025-01-01',
      status: 'ACTIVE',
      documents: [
        // CM §22/UC-CM-07 — document ID_CARD đã hết hạn (demo badge EXPIRED).
        {
          id: 'doc_004',
          documentType: 'ID_CARD',
          documentNumber: '079185004567',
          issueDate: '2013-04-11',
          expiryDate: isoDateOffset(-10),
          createdAt: '2024-03-01T02:00:00.000Z',
          updatedAt: '2024-03-01T02:00:00.000Z',
        },
      ],
      createdAt: '2024-03-01T02:00:00.000Z',
      updatedAt: '2024-03-01T02:00:00.000Z',
    },
    {
      id: 'cus_006',
      // Thiếu email + licenseNumber — demo hiển thị "Chưa có" trên UI.
      fullName: 'Đặng Văn Hùng',
      gender: 'MALE',
      phone: '0912345678',
      address: '9 Hoàng Văn Thụ, Tân Bình, TP.HCM',
      idType: 'ID_CARD',
      idNumber: '079190005678',
      status: 'ACTIVE',
      documents: [],
      createdAt: '2024-03-15T02:00:00.000Z',
      updatedAt: '2024-03-15T02:00:00.000Z',
    },
    {
      id: 'cus_007',
      // SĐT tiền tố trùng cus_006 (0912...) — demo tìm kiếm partial-match.
      fullName: 'Vũ Thị Ngọc Mai',
      dob: '1998-12-05',
      gender: 'FEMALE',
      phone: '0912345699',
      email: 'mai.vu@example.com',
      address: '156 Phan Xích Long, Phú Nhuận, TP.HCM',
      idType: 'ID_CARD',
      idNumber: '079198006789',
      idIssueDate: '2018-07-07',
      idIssuePlace: 'CA TP.HCM',
      idExpiryDate: '2038-07-07',
      licenseNumber: '079198009012',
      licenseClass: 'A1',
      licenseIssueDate: '2019-02-14',
      licenseExpiryDate: '2034-02-14',
      status: 'ACTIVE',
      documents: [],
      createdAt: '2024-04-01T02:00:00.000Z',
      updatedAt: '2024-04-01T02:00:00.000Z',
    },
    {
      id: 'cus_008',
      fullName: 'Hoàng Anh Dũng',
      dob: '1980-01-25',
      gender: 'MALE',
      phone: '0918888777',
      email: 'dung.hoang@example.com',
      address: '34 Trường Chinh, Tân Phú, TP.HCM',
      idType: 'ID_CARD',
      idNumber: '079180007890',
      status: 'BLOCKED',
      // CM §10/CM-R03 — có blockReason cụ thể, 0 document (empty state).
      blockReason: 'Nợ tiền phạt phát sinh từ lượt thuê trước, chưa thanh toán quá 30 ngày.',
      documents: [],
      createdAt: '2023-11-01T02:00:00.000Z',
      updatedAt: '2026-02-01T02:00:00.000Z',
    },
    {
      id: 'cus_009',
      fullName: 'Nguyễn Thị Diễm Quỳnh',
      dob: '1993-08-08',
      gender: 'FEMALE',
      phone: '0933222111',
      email: 'quynh.nguyen@example.com',
      address: '67 Nguyễn Trãi, Quận 5, TP.HCM',
      idType: 'ID_CARD',
      idNumber: '079193008901',
      idIssueDate: '2019-10-10',
      idIssuePlace: 'CA TP.HCM',
      idExpiryDate: '2039-10-10',
      licenseNumber: '079193009999',
      licenseClass: 'B2',
      licenseIssueDate: '2020-06-06',
      licenseExpiryDate: '2035-06-06',
      status: 'ACTIVE',
      documents: [],
      createdAt: '2024-05-01T02:00:00.000Z',
      updatedAt: '2024-05-01T02:00:00.000Z',
    },
  ]
  customers.push(...buildDemoCustomers(customers)) // docs/DEMO-DATA-PLAN.md §3.1
  writeJson(CUSTOMERS_STORAGE_KEY, customers)
}

registerSeedStep(seedCustomers)
