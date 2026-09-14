import { readJson, writeJson } from '@/shared/lib/storage'

/**
 * Tăng số này mỗi khi đổi cấu trúc seed data khi đang phát triển — dữ liệu cũ
 * trong localStorage của trình duyệt sẽ tự động được seed lại thay vì gây lỗi
 * do lệch schema.
 */
const SEED_VERSION = 7
const SEED_META_KEY = 'seedMeta'

interface SeedMeta {
  version: number
  seededAt: string
}

/**
 * Danh sách hàm seed của từng feature — mỗi feature tự chịu trách nhiệm sinh
 * dữ liệu mẫu của chính nó (liên kết chéo qua id đã seed trước đó). Thêm dòng
 * import + gọi hàm khi feature đó có `seed.ts`.
 */
const seedSteps: Array<() => void> = []

export function registerSeedStep(step: () => void): void {
  seedSteps.push(step)
}

function runSeed(): void {
  for (const step of seedSteps) step()
  const meta: SeedMeta = { version: SEED_VERSION, seededAt: new Date().toISOString() }
  writeJson(SEED_META_KEY, meta)
}

/** Gọi một lần khi app khởi động — chỉ seed nếu chưa có dữ liệu hoặc seed version đã đổi. */
export function seedIfNeeded(): void {
  const meta = readJson<SeedMeta>(SEED_META_KEY)
  if (meta?.version === SEED_VERSION) return
  runSeed()
}

export function forceReseed(): void {
  runSeed()
}
