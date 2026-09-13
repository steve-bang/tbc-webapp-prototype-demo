/**
 * Mô phỏng một lớp gọi API thật (độ trễ mạng + tỉ lệ lỗi ngẫu nhiên) trong khi
 * dữ liệu thực chất vẫn đọc/ghi từ localStorage (xem `storage.ts`).
 *
 * Cùng tinh thần `mockClient.ts` / `mockRequest()` của App nhân viên
 * (thien-bao-car-app-prototype-demo): giữ chữ ký hàm bất đồng bộ giống một
 * lệnh gọi API thật, để sau này thay bằng `fetch` mà không phải viết lại UI.
 */

export type FakeRequestOptions = {
  /** Độ trễ giả lập (ms). Mặc định 250–450ms — đủ để thấy trạng thái loading. */
  delayMs?: number
  /** Tỉ lệ lỗi ngẫu nhiên (0–1). Mặc định 0 — chỉ bật khi muốn demo trạng thái lỗi. */
  failRate?: number
  /** Thông điệp lỗi hiển thị khi rơi vào failRate. */
  errorMessage?: string
}

function randomDelay(min: number, max: number): Promise<void> {
  const ms = Math.round(min + Math.random() * (max - min))
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fakeRequest<T>(fn: () => T, options: FakeRequestOptions = {}): Promise<T> {
  const { delayMs, failRate = 0, errorMessage = 'Có lỗi xảy ra, vui lòng thử lại.' } = options
  if (delayMs != null) {
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  } else {
    await randomDelay(250, 450)
  }
  if (failRate > 0 && Math.random() < failRate) {
    throw new Error(errorMessage)
  }
  return fn()
}
