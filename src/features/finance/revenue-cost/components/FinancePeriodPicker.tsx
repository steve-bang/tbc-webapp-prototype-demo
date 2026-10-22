import { vi } from '@/shared/i18n/vi'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { FINANCE_PERIOD_PRESETS, resolvePeriodPreset, type FinancePeriodPreset, type PeriodSelection } from '../model'

/** Bộ chọn kỳ phân tích dùng chung (màn Chi phí vận hành + 3 tab xe). Kỳ tính theo ngày địa phương, gồm cả 2 đầu. */
export function FinancePeriodPicker({ value, onChange }: { value: PeriodSelection; onChange: (next: PeriodSelection) => void }) {
  function handlePresetChange(next: string) {
    const preset = next as FinancePeriodPreset
    // `CUSTOM` giữ khoảng đang hiển thị để người dùng chỉnh tiếp thay vì nhảy về tháng này.
    onChange({ preset, period: preset === 'CUSTOM' ? value.period : resolvePeriodPreset(preset) })
  }

  function handleDateChange(field: 'from' | 'to', next: string) {
    if (!next) return
    const period = { ...value.period, [field]: next }
    if (period.from > period.to) return
    onChange({ preset: 'CUSTOM', period })
  }

  return (
    <div className="flex min-w-0 flex-wrap items-end gap-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label>{vi.finance.revenueCost.periodLabel}</Label>
        <Select value={value.preset} onValueChange={handlePresetChange}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FINANCE_PERIOD_PRESETS.map((preset) => (
              <SelectItem key={preset} value={preset}>
                {vi.finance.revenueCost.periodPresets[preset]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {value.preset === 'CUSTOM' && (
        <>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="period-from">{vi.finance.revenueCost.periodFrom}</Label>
            <Input id="period-from" type="date" value={value.period.from} max={value.period.to} onChange={(e) => handleDateChange('from', e.target.value)} className="w-full sm:w-40" />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="period-to">{vi.finance.revenueCost.periodTo}</Label>
            <Input id="period-to" type="date" value={value.period.to} min={value.period.from} onChange={(e) => handleDateChange('to', e.target.value)} className="w-full sm:w-40" />
          </div>
        </>
      )}
    </div>
  )
}
