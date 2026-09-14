import { addDays, addMonths, format, isSameMonth, parseISO, startOfWeek, subMonths } from 'date-fns'
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
import { formatDate } from '@/shared/lib/datetime'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { CalendarMonthGrid } from '../components/CalendarMonthGrid'
import { CalendarWeekGrid } from '../components/CalendarWeekGrid'
import { DayDetailDialog } from '../components/DayDetailDialog'
import { canOpenRentalQuickCreate, type QuickCreateRequest } from '../components/RentalQuickCreateGate'
import { VehicleBlockDetailDialog } from '../components/VehicleBlockDetailDialog'
import { VehicleBlockFormDialog } from '../components/VehicleBlockFormDialog'
import { useVehicleBlocks } from '../hooks'
import type { VehicleBlock } from '../model'

type CalendarView = 'week' | 'month'

interface DayDetailState {
  vehicle: Vehicle
  dateStr: string
  rentals: Rental[]
}

/**
 * `docs/CALENDAR-MANAGEMENT-PLAN.md` §5.1 — trang Lịch cho thuê (`RC`). Round
 * 2 = Week (mặc định, CR-2026-032) + Month (lưới xe×ngày, CR-2026-017/044) +
 * Vehicle Block CRUD + tạo nhanh. KHÔNG có Day/Agenda view, KHÔNG kéo-thả
 * (Round 3 — §0.3/§1.2 kế hoạch), KHÔNG có khu "Chưa xếp xe" (§0.2 — xung đột
 * với `RM-BR-02` đã DONE ở Round 1 của `rentals`).
 */
export function CalendarScreen() {
  const { can } = usePermission()
  const canCreateRental = can('RENTAL', 'CREATE')
  const canBlockVehicle = can('VEHICLE', 'BLOCK')

  const [view, setView] = useState<CalendarView>('week') // RC-BR-16 — mặc định Week
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [search, setSearch] = useState('')
  const [vehicleFilter, setVehicleFilter] = useState<string | undefined>(undefined)
  const [showCancelled, setShowCancelled] = useState(false) // RC-BR-08
  const [showNoShow, setShowNoShow] = useState(false) // §11 kế hoạch — quy ước hiển thị cùng nhóm CANCELLED
  const [showInactiveVehicles, setShowInactiveVehicles] = useState(false)

  const [quickCreateRequest, setQuickCreateRequest] = useState<QuickCreateRequest | null>(null)
  const [blockFormOpen, setBlockFormOpen] = useState(false)
  const [blockDetail, setBlockDetail] = useState<VehicleBlock | null>(null)
  const [dayDetail, setDayDetail] = useState<DayDetailState | null>(null)

  const { data: rentals = [] } = useRentals()
  const { data: vehicles = [] } = useVehicles()
  const { data: customers = [] } = useCustomers()
  const { data: blocks = [] } = useVehicleBlocks()

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

  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate])
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart])

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
    const matchDate = parseISO(earliest.pickupDateTime)
    setCurrentDate((prev) => {
      if (view === 'week') {
        const weekStartPrev = startOfWeek(prev, { weekStartsOn: 1 })
        const weekEndPrev = addDays(weekStartPrev, 6)
        return matchDate < weekStartPrev || matchDate > weekEndPrev ? matchDate : prev
      }
      return isSameMonth(matchDate, prev) ? prev : matchDate
    })
  }

  function goToday() {
    setCurrentDate(new Date())
  }
  function goPrev() {
    setCurrentDate((d) => (view === 'week' ? addDays(d, -7) : subMonths(d, 1)))
  }
  function goNext() {
    setCurrentDate((d) => (view === 'week' ? addDays(d, 7) : addMonths(d, 1)))
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
              <TabsTrigger value="week">{vi.calendar.viewWeek}</TabsTrigger>
              <TabsTrigger value="month">{vi.calendar.viewMonth}</TabsTrigger>
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

          {view === 'week' ? (
            <span className="text-muted-foreground text-sm">
              {formatDate(weekStart.toISOString())} → {formatDate(weekEnd.toISOString())}
            </span>
          ) : (
            <Input
              type="month"
              value={format(currentDate, 'yyyy-MM')}
              onChange={(e) => {
                if (!e.target.value) return
                setCurrentDate(new Date(`${e.target.value}-01T00:00:00`))
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

      {view === 'week' ? (
        <CalendarWeekGrid
          weekStart={weekStart}
          vehicles={gridVehicles}
          rentals={filteredRentals}
          showInactiveVehicles={showInactiveVehicles}
          highlightRentalIds={highlightRentalIds}
          customerById={customerById}
          onEmptyCellClick={attemptOpenQuickCreate}
        />
      ) : (
        <CalendarMonthGrid
          monthDate={currentDate}
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
