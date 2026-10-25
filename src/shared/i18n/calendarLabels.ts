/**
 * Nhãn riêng của hộp thoại Dời lịch / Đổi xe trước giao và 2 nút ở popover Lịch (CALENDAR-ROUND3-PLAN.md §14.2 mục 10). Tách khỏi
 * `vi.ts` (mẫu `auditLabels.ts`/`platformLabels.ts` — D12) để chuỗi nằm trong chunk Lịch tải lười, không phình chunk chính.
 * CHỈ `features/calendar` (chunk Lịch) được import file này; thông điệp lỗi/cảnh báo theo mã mà API dùng vẫn ở `vi.rentals`.
 */
export const calendarLabels = {
  rescheduleAction: 'Dời lịch',
  changeVehicleAction: 'Đổi xe',
  scheduleDialogTitleReschedule: 'Dời lịch lượt thuê',
  scheduleDialogTitleChangeVehicle: 'Đổi xe lượt thuê',
  scheduleDialogDescription: 'Chỉ áp dụng cho lượt chưa giao. Giá, Allowed KM và hạng xe đã chốt KHÔNG tự đổi.',
  scheduleCurrent: 'Hiện tại',
  scheduleProposed: 'Sau thay đổi',
  scheduleFieldVehicle: 'Xe',
  scheduleFieldPickup: 'Giờ giao',
  scheduleFieldReturn: 'Giờ trả',
  scheduleFieldDays: 'Số ngày thuê',
  scheduleDaysValue: (days: number) => `${days} ngày`,
  scheduleNewVehicle: 'Xe mới',
  scheduleNewVehiclePlaceholder: 'Chọn xe',
  scheduleNewPickup: 'Giờ giao mới',
  scheduleNewReturn: 'Giờ trả mới',
  scheduleErrorsTitle: 'Không thể thực hiện',
  scheduleWarningsTitle: 'Cảnh báo',
  scheduleConflictingRentals: 'Lượt thuê gây xung đột',
  scheduleConflictingBlocks: 'Khoá lịch gây xung đột',
  scheduleBlockLine: (id: string, startDate: string, endDate?: string) =>
    `${id} (${startDate} → ${endDate ?? 'vô thời hạn'})`,
  scheduleOpenRental: 'Mở lượt thuê',
  scheduleOverrideReasonLabel: 'Lý do ghi đè vùng đệm quay đầu',
  scheduleOverrideReasonPlaceholder: 'VD: Khách chấp nhận nhận xe sớm hơn / xe đã sẵn sàng',
  scheduleVersionLabel: 'Dữ liệu lượt thuê cập nhật lần cuối',
  scheduleChecking: 'Đang kiểm tra lịch…',
  scheduleConfirm: 'Xác nhận',
  scheduleSuccess: 'Đã cập nhật lịch lượt thuê.',
  scheduleVehicleSuccess: 'Đã đổi xe cho lượt thuê.',
  scheduleAssignmentConflictToast: 'Giờ phân công mới trùng lịch của nhân viên (EA-BR-10) — vui lòng kiểm tra phân công.',
  scheduleError: 'Không thể cập nhật lịch, vui lòng thử lại.',
}
