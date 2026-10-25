import { ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { useMemo, useState } from 'react'
import { usePermission } from '@/features/auth'
// `customers`/`vehicles` chưa export `useCustomers`/`useVehicles` qua barrel —
// import thẳng, cùng tinh thần `rentals/components/RentalFormSheet.tsx`.
import { useCustomers } from '@/features/customers/hooks'
import { useRentals } from '@/features/rentals'
import type { Rental } from '@/features/rentals'
import { RentalFormSheet } from '@/features/rentals/components/RentalFormSheet'
import { useVehicles } from '@/features/vehicles/hooks'
import type { Vehicle } from '@/features/vehicles'
import { vi } from '@/shared/i18n/vi'
import { PageHeader } from '@/shared/layout/PageHeader'
import { formatDate, formatWeekdayShort, toDateKey, toMonthKey, todayKey } from '@/shared/lib/datetime'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { CalendarAgendaList } from '../components/CalendarAgendaList'
import { CalendarDayGrid } from '../components/CalendarDayGrid'
import { CalendarMonthGrid } from '../components/CalendarMonthGrid'
import { CalendarWeekGrid } from '../components/CalendarWeekGrid'
import { DayDetailDialog } from '../components/DayDetailDialog'
import { canOpenRentalQuickCreate, type QuickCreateRequest } from '../components/RentalQuickCreateGate'
import { VehicleBlockDetailDialog } from '../components/VehicleBlockDetailDialog'
import { VehicleBlockFormDialog } from '../components/VehicleBlockFormDialog'
import { useVehicleBlocks } from '../hooks'
import { shiftAnchor, viewRange, type CalendarView, type VehicleBlock } from '../model'
import { useCalendarPrefsStore } from '../store'

interface DayDetailState {
  vehicle: Vehicle
  dateStr: string
  rentals: Rental[]
}

/**
 * `docs/CALENDAR-MANAGEMENT-PLAN.md` §5.1 — trang Lịch cho thuê (`RC`). Week
 * (mặc định, CR-2026-032) + Month (lưới xe×ngày, CR-2026-017/044) + Vehicle
 * Block CRUD + tạo nhanh; `docs/CALENDAR-ROUND3-PLAN.md` Round A thêm Day
 * (lưới xe × trục giờ) + Agenda (danh sách theo ngày) và nhớ chế độ xem + bộ
 * lọc (`store.ts`). Chưa kéo-thả (Round B2), KHÔNG có khu "Chưa xếp xe"
 * (§0.2 — xung đột với `RM-BR-02` đã DONE ở Round 1 của `rentals`).
 */
export function CalendarScreen() {
  const { can } = usePermission()
  const canCreateRental = can('RENTAL', 'CREATE')
  const canBlockVehicle = can('VEHICLE', 'BLOCK')

  // RC §8 — chế độ xem + bộ lọc được nhớ giữa các lần mở (`store.ts`); mốc điều hướng + tìm kiếm thì không.
  const {
    view,
    vehicleFilter: storedVehicleFilter,
    showCancelled,
    showNoShow,
    showInactiveVehicles,
    setView,
    setVehicleFilter,
    setShowCancelled,
    setShowNoShow,
    setShowInactiveVehicles,
  } = useCalendarPrefsStore()
  // N8 — mốc điều hướng là date key +07 (không phải Date theo giờ trình duyệt)
  const [anchorKey, setAnchorKey] = useState(() => todayKey())
  const [search, setSearch] = useState('')

  const [quickCreateRequest, setQuickCreateRequest] = useState<QuickCreateRequest | null>(null)
  const [blockFormOpen, setBlockFormOpen] = useState(false)
  const [blockDetail, setBlockDetail] = useState<VehicleBlock | null>(null)
  const [dayDetail, setDayDetail] = useState<DayDetailState | null>(null)

  const { data: rentals = [] } = useRentals()
  const { data: vehicles = [] } = useVehicles()
  const { data: customers = [] } = useCustomers()
  const { data: blocks = [] } = useVehicleBlocks()

  // Bộ lọc xe đã lưu nhưng xe không còn tồn tại → coi như "Tất cả xe" (không để lịch trống khó hiểu).
  const vehicleFilter = storedVehicleFilter && vehicles.some((v) => v.id === storedVehicleFilter) ? storedVehicleFilter : undefined

  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers])
  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles])

  const filteredRentals = useMemo(
    () =>
      rentals.filter((r) => {
        if (!showCancelled && r.status === 'CANCELLED') return false
        if (!showNoShow && r.status === 'NO_SHOW') return false
        if (vehicleFilter && r.vehicleId !== vehicleFilter) return false
        return true
      }),
    [rentals, showCancelled, showNoShow, vehicleFilter],
  )

  const gridVehicles = useMemo(
    () => (vehicleFilter ? vehicles.filter((v) => v.id === vehicleFilter) : vehicles),
    [vehicles, vehicleFilter],
  )

  // Tìm kiếm → highlight (§5.1) — tên khách/SĐT/biển số.
  const matchesQuery = useMemo(
    () => (r: Rental, q: string) => {
      const customer = customerById.get(r.customerId)
      const vehicle = vehicleById.get(r.vehicleId)
      const haystack = [customer?.fullName, customer?.phone, vehicle?.plate].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(q)
    },
    [customerById, vehicleById],
  )

  const matchedRentals = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return filteredRentals.filter((r) => matchesQuery(r, q)).sort((a, b) => a.pickupDateTime.localeCompare(b.pickupDateTime))
  }, [search, filteredRentals, matchesQuery])
  const highlightRentalIds = useMemo(() => new Set(matchedRentals.map((r) => r.id)), [matchedRentals])

  const range = useMemo(() => viewRange(anchorKey, view), [anchorKey, view])

  /**
   * Tìm kiếm → nhảy tới (§5.1) — chạy trực tiếp trong sự kiện `onChange` của ô
   * tìm kiếm (không dùng `useEffect` theo dõi kết quả tìm kiếm để tránh
   * `setState` bên trong effect gây cascading render — oxlint
   * `react(set-state-in-effect)`).
   */
  function handleSearchChange(value: string) {
    setSearch(value)
    const q = value.trim().toLowerCase()
    if (!q) return
    const matches = filteredRentals.filter((r) => matchesQuery(r, q)).sort((a, b) => a.pickupDateTime.localeCompare(b.pickupDateTime))
    const earliest = matches[0]
    if (!earliest) return
    const matchKey = toDateKey(earliest.pickupDateTime)
    // Ngoài phạm vi đang xem (Ngày / Tuần / Tháng / Danh sách) → nhảy tới ngày khớp.
    setAnchorKey((prev) => {
      const { fromKey, toKey } = viewRange(prev, view)
      return matchKey < fromKey || matchKey > toKey ? matchKey : prev
    })
  }

  function goToday() {
    setAnchorKey(todayKey())
  }
  function goPrev() {
    setAnchorKey((k) => shiftAnchor(k, view, -1))
  }
  function goNext() {
    setAnchorKey((k) => shiftAnchor(k, view, 1))
  }

  function attemptOpenQuickCreate(vehicleId: string, pickupDateTime: string) {
    if (!canCreateRental) return
    if (!canOpenRentalQuickCreate(blocks, { vehicleId, pickupDateTime })) return
    setQuickCreateRequest({ vehicleId, pickupDateTime })
  }

  return (
    <div>
      <PageHeader
        title={vi.calendar.title}
        description={vi.calendar.description}
        actions={
          view === 'month' && canBlockVehicle ? (
            <Button onClick={() => setBlockFormOpen(true)}>
              <Lock className="size-4" />
              <span className="hidden sm:inline">{vi.calendar.blockButton}</span>
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as CalendarView)}>
            <TabsList>
              <TabsTrigger value="day">{vi.calendar.viewDay}</TabsTrigger>
              <TabsTrigger value="week">{vi.calendar.viewWeek}</TabsTrigger>
              <TabsTrigger value="month">{vi.calendar.viewMonth}</TabsTrigger>
              <TabsTrigger value="agenda">{vi.calendar.viewAgenda}</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={goPrev} aria-label={vi.calendar.prevPeriod}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToday}>
              {vi.calendar.today}
            </Button>
            <Button variant="outline" size="icon" onClick={goNext} aria-label={vi.calendar.nextPeriod}>
              <ChevronRight className="size-4" />
            </Button>
          </div>

          {view === 'day' ? (
            <span className="text-foreground text-sm font-medium">
              {vi.calendar.dayTitle(formatWeekdayShort(anchorKey), formatDate(anchorKey))}
            </span>
          ) : view === 'week' || view === 'agenda' ? (
            <span className="text-foreground text-sm font-medium">
              {formatDate(range.fromKey)} → {formatDate(range.toKey)}
            </span>
          ) : (
            <Input
              type="month"
              value={toMonthKey(anchorKey)}
              onChange={(e) => {
                if (!e.target.value) return
                setAnchorKey(`${e.target.value}-01`)
              }}
              className="w-36"
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={vi.calendar.searchPlaceholder}
            className="max-w-xs flex-1"
          />
          <Select value={vehicleFilter ?? '__all__'} onValueChange={(v) => setVehicleFilter(v === '__all__' ? undefined : v)}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder={vi.calendar.filterAllVehicles} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{vi.calendar.filterAllVehicles}</SelectItem>
              {vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.plate} — {v.brand} {v.model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <label className="flex items-center gap-1.5 text-sm">
            <Switch checked={showCancelled} onCheckedChange={setShowCancelled} />
            {vi.calendar.filterShowCancelled}
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <Switch checked={showNoShow} onCheckedChange={setShowNoShow} />
            {vi.calendar.filterShowNoShow}
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <Switch checked={showInactiveVehicles} onCheckedChange={setShowInactiveVehicles} />
            {vi.calendar.filterShowInactiveVehicles}
          </label>
        </div>
      </div>

      {view === 'day' ? (
        <CalendarDayGrid
          dateKey={anchorKey}
          vehicles={gridVehicles}
          rentals={filteredRentals}
          blocks={blocks}
          showInactiveVehicles={showInactiveVehicles}
          highlightRentalIds={highlightRentalIds}
          customerById={customerById}
          onEmptyCellClick={attemptOpenQuickCreate}
        />
      ) : view === 'agenda' ? (
        <CalendarAgendaList
          rentals={filteredRentals}
          fromKey={range.fromKey}
          toKey={range.toKey}
          vehicleById={vehicleById}
          customerById={customerById}
          highlightRentalIds={highlightRentalIds}
        />
      ) : view === 'week' ? (
        <CalendarWeekGrid
          anchorKey={anchorKey}
          vehicles={gridVehicles}
          rentals={filteredRentals}
          showInactiveVehicles={showInactiveVehicles}
          highlightRentalIds={highlightRentalIds}
          customerById={customerById}
          onEmptyCellClick={attemptOpenQuickCreate}
        />
      ) : (
        <CalendarMonthGrid
          monthKey={toMonthKey(anchorKey)}
          vehicles={gridVehicles}
          rentals={filteredRentals}
          blocks={blocks}
          showInactiveVehicles={showInactiveVehicles}
          highlightRentalIds={highlightRentalIds}
          onEmptyCellClick={attemptOpenQuickCreate}
          onBlockedCellClick={(block) => setBlockDetail(block)}
          onDayCellClick={(vehicle, dateStr, rentalsForCell) => setDayDetail({ vehicle, dateStr, rentals: rentalsForCell })}
        />
      )}

      {canCreateRental && (
        <RentalFormSheet
          open={!!quickCreateRequest}
          onOpenChange={(open) => !open && setQuickCreateRequest(null)}
          defaultValues={quickCreateRequest ?? undefined}
        />
      )}

      {canBlockVehicle && (
        <VehicleBlockFormDialog
          vehicles={vehicles}
          blocks={blocks}
          rentals={rentals}
          customers={customers}
          preselectedVehicleId={vehicleFilter}
          open={blockFormOpen}
          onOpenChange={setBlockFormOpen}
        />
      )}

      <VehicleBlockDetailDialog
        block={blockDetail}
        vehicle={blockDetail ? vehicleById.get(blockDetail.vehicleId) : undefined}
        rentals={rentals}
        customers={customers}
        open={!!blockDetail}
        onOpenChange={(open) => !open && setBlockDetail(null)}
      />

      <DayDetailDialog
        vehicle={dayDetail?.vehicle}
        dateIso={dayDetail?.dateStr ?? null}
        rentals={dayDetail?.rentals ?? []}
        customers={customers}
        open={!!dayDetail}
        onOpenChange={(open) => !open && setDayDetail(null)}
      />
    </div>
  )
}
