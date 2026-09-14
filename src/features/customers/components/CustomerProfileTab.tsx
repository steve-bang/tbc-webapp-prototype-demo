import { formatDate } from '@/shared/lib/datetime'
import { vi } from '@/shared/i18n/vi'
import type { Customer, CustomerGender, CustomerIdType } from '../model'

const GENDER_LABELS: Record<CustomerGender, string> = {
  MALE: vi.customers.genderMale,
  FEMALE: vi.customers.genderFemale,
  OTHER: vi.customers.genderOther,
}

const ID_TYPE_LABELS: Record<CustomerIdType, string> = {
  ID_CARD: vi.customers.idTypeIdCard,
  PASSPORT: vi.customers.idTypePassport,
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm">{value || vi.customers.noValue}</span>
    </div>
  )
}

function dateOrUndefined(value?: string): string | undefined {
  return value ? formatDate(value) : undefined
}

/** Tab "Hồ sơ" — read-only, `UC-CM-04`. Nút Sửa mở lại `CustomerFormSheet` ở header của Detail screen. */
export function CustomerProfileTab({ customer }: { customer: Customer }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold">{vi.customers.sectionPersonal}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={vi.customers.fullName} value={customer.fullName} />
          <Field label={vi.customers.dob} value={dateOrUndefined(customer.dob)} />
          <Field label={vi.customers.gender} value={customer.gender ? GENDER_LABELS[customer.gender] : undefined} />
          <Field label={vi.customers.phone} value={customer.phone} />
          <Field label={vi.customers.email} value={customer.email} />
          <Field label={vi.customers.address} value={customer.address} />
        </div>
        <Field label={vi.customers.note} value={customer.note} />
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold">{vi.customers.sectionIdentity}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={vi.customers.idType} value={customer.idType ? ID_TYPE_LABELS[customer.idType] : undefined} />
          <Field label={vi.customers.idNumber} value={customer.idNumber} />
          <Field label={vi.customers.idIssueDate} value={dateOrUndefined(customer.idIssueDate)} />
          <Field label={vi.customers.idIssuePlace} value={customer.idIssuePlace} />
          <Field label={vi.customers.idExpiryDate} value={dateOrUndefined(customer.idExpiryDate)} />
        </div>

        <h3 className="mt-2 border-t pt-4 text-sm font-semibold">{vi.customers.sectionLicense}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={vi.customers.licenseNumber} value={customer.licenseNumber} />
          <Field label={vi.customers.licenseClass} value={customer.licenseClass} />
          <Field label={vi.customers.licenseIssueDate} value={dateOrUndefined(customer.licenseIssueDate)} />
          <Field label={vi.customers.licenseExpiryDate} value={dateOrUndefined(customer.licenseExpiryDate)} />
        </div>
      </div>
    </div>
  )
}
