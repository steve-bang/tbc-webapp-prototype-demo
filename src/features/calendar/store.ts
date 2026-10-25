import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CalendarView } from './model'

/**
 * `docs/CALENDAR-ROUND3-PLAN.md` §13.2 mục 6 — nhớ chế độ xem + bộ lọc giữa các lần mở (`RentalCalendar-BRD.md` §8 "Yêu cầu chung").
 * UI state thuần (CONVENTIONS §5). CHỈ lưu 5 trường dưới đây: KHÔNG lưu `anchorKey` (mở lại luôn về hôm nay) và KHÔNG lưu `search`.
 */
interface CalendarPrefsState {
  view: CalendarView
  /** `undefined` = tất cả xe. */
  vehicleFilter: string | undefined
  showCancelled: boolean
  showNoShow: boolean
  showInactiveVehicles: boolean
  setView: (view: CalendarView) => void
  setVehicleFilter: (vehicleId: string | undefined) => void
  setShowCancelled: (value: boolean) => void
  setShowNoShow: (value: boolean) => void
  setShowInactiveVehicles: (value: boolean) => void
}

export const useCalendarPrefsStore = create<CalendarPrefsState>()(
  persist(
    (set) => ({
      view: 'week', // RC-BR-16 — mặc định Week
      vehicleFilter: undefined,
      showCancelled: false, // RC-BR-08
      showNoShow: false, // quy ước hiển thị cùng nhóm CANCELLED
      showInactiveVehicles: false,
      setView: (view) => set({ view }),
      setVehicleFilter: (vehicleFilter) => set({ vehicleFilter }),
      setShowCancelled: (showCancelled) => set({ showCancelled }),
      setShowNoShow: (showNoShow) => set({ showNoShow }),
      setShowInactiveVehicles: (showInactiveVehicles) => set({ showInactiveVehicles }),
    }),
    {
      name: 'tbc_admin:calendarPrefs',
      partialize: (state) => ({
        view: state.view,
        vehicleFilter: state.vehicleFilter,
        showCancelled: state.showCancelled,
        showNoShow: state.showNoShow,
        showInactiveVehicles: state.showInactiveVehicles,
      }),
    },
  ),
)
