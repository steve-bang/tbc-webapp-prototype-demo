// TODO(OQ: RevenueCost-BRD.md §28 Q14/Q15/Q16 — danh mục báo cáo, KPI, người xem chưa chốt; dựng theo BRD §16)
import { useMemo, useState } from 'react'
import { usePermission } from '@/features/auth'
import { useVehicleBlocks } from '@/features/calendar'
import { useCustomers } from '@/features/customers/hooks'
import { useIncidents } from '@/features/incidents'
import { useRentals } from '@/features/rentals'
// Deep-import `hooks.ts` theo tiền lệ `CostRecordsScreen` — cấm import giá trị runtime từ barrel `vehicles` (vòng barrel).
import { useVehicles } from '@/features/vehicles/hooks'
import { OWNERSHIP_TYPE_LABELS, REVENUE_RECOGNITION_POLICY_LABELS, VEHICLE_CLASS_LABELS, vi } from '@/shared/i18n/vi'
import { PageHeader } from '@/shared/layout/PageHeader'
import { formatVnd } from '@/shared/lib/money'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { CostBreakdownPanel } from '../components/CostBreakdownPanel'
import { CustomerReportPanel } from '../components/CustomerReportPanel'
import { FinanceKpiCards, type FinanceKpiValues } from '../components/FinanceKpiCards'
import { FinancePeriodPicker } from '../components/FinancePeriodPicker'
import { FinanceTrendChart } from '../components/FinanceTrendChart'
import { IncidentReportPanel } from '../components/IncidentReportPanel'
import { ReconciliationPanel } from '../components/ReconciliationPanel'
import { ReportExportButton } from '../components/ReportExportButton'
import { RevenueReportPanel } from '../components/RevenueReportPanel'
import { VehicleFinanceSheet } from '../components/VehicleFinanceSheet'
import { VehiclePerformanceTable } from '../components/VehiclePerformanceTable'
import { useCashEntries, useCostEntries, usePaymentRequests, usePostSettlementCharges, useRevenueLines, useSettlements, useTransactions } from '../hooks'
import {
  REVENUE_RECOGNITION_POLICY,
  bucketDisplayLabel,
  buildTimeSeries,
  buildVehiclePerformance,
  calcChangeRatio,
  comparisonPeriodOf,
  countCompletedSettlements,
  deriveCustomerBalances,
  formatChangeText,
  formatPercentText,
  initialPeriodSelection,
  isPscOnHold,
  selectReportVehicleRows,
  sortVehicleRows,
  suggestGranularity,
  sumFutureDatedCost,
  sumRevenueCash,
  sumVehicleRows,
  summarizePeriod,
  type CashEntry,
  type CostEntry,
  type CsvSection,
  type FinancePeriod,
  type PeriodSelection,
  type ReportGranularity,
  type RevenueLine,
  type Settlement,
  type VehicleSortKey,
} from '../model'

const GRANULARITIES: ReportGranularity[] = ['DAY', 'WEEK', 'MONTH']
const SORT_KEYS: VehicleSortKey[] = ['PROFIT', 'REVENUE', 'UTILIZATION']

/** Bộ KPI của một kỳ — chỉ ghép kết quả của các hàm thuần (`summarizePeriod`, `sumRevenueCash`, `countCompletedSettlements`). */
function buildKpiValues(input: { revenueLines: RevenueLine[]; costEntries: CostEntry[]; cashEntries: CashEntry[]; settlements: Settlement[]; period: FinancePeriod }): FinanceKpiValues {
  const summary = summarizePeriod(input.revenueLines, input.costEntries, input.period)
  return {
    revenue: summary.revenue,
    cash: sumRevenueCash(input.cashEntries, input.period),
    directCost: summary.directCost,
    operatingProfit: summary.operatingProfit,
    indirectCost: summary.indirectCost,
    afterIndirect: summary.afterIndirect,
    completedCount: countCompletedSettlements(input.settlements, input.period),
  }
}

/**
 * `WebappQuanTri.md` §11.2 — Báo cáo tài chính (`/finance/reports`): Tổng quan · Doanh thu (Report 01) · Hiệu quả xe (Report 02) ·
 * Chi phí (Report 05) · Khách hàng (Report 03) · Sự cố (Report 04) · Đối chiếu & dòng tiền (BRD §15 + Report 06). Mỗi tab có nút Xuất CSV
 * (UC-RV-13) dựng từ chính dữ liệu đang hiển thị. AC-RV-012: thiếu `FINANCE_REPORT.VIEW` chỉ thấy thông điệp không có quyền, không tải dữ liệu nào.
 */
export function FinanceReportScreen() {
  const { can } = usePermission()
  if (!can('FINANCE_REPORT', 'VIEW')) {
    return (
      <div>
        <PageHeader title={vi.finance.reports.title} description={vi.finance.reports.description} />
        <p className="text-muted-foreground text-sm">{vi.finance.reports.noPermission}</p>
      </div>
    )
  }
  return <FinanceReportContent />
}

function FinanceReportContent() {
  const t = vi.finance.reports
  const { can } = usePermission()
  const canDrillDown = can('VEHICLE', 'EXPORT')

  const revenueQuery = useRevenueLines()
  const costQuery = useCostEntries()
  const cashQuery = useCashEntries()
  const settlementQuery = useSettlements()
  const rentalQuery = useRentals()
  const incidentQuery = useIncidents()
  const blockQuery = useVehicleBlocks()
  const vehicleQuery = useVehicles()
  const customerQuery = useCustomers()
  const pscQuery = usePostSettlementCharges()
  const requestQuery = usePaymentRequests()
  const txnQuery = useTransactions()

  const revenueLines = useMemo(() => revenueQuery.data ?? [], [revenueQuery.data])
  const costEntries = useMemo(() => costQuery.data ?? [], [costQuery.data])
  const cashEntries = useMemo(() => cashQuery.data ?? [], [cashQuery.data])
  const settlements = useMemo(() => settlementQuery.data ?? [], [settlementQuery.data])
  const rentals = useMemo(() => rentalQuery.data ?? [], [rentalQuery.data])
  const incidents = useMemo(() => incidentQuery.data ?? [], [incidentQuery.data])
  const blocks = useMemo(() => blockQuery.data ?? [], [blockQuery.data])
  const vehicles = useMemo(() => vehicleQuery.data ?? [], [vehicleQuery.data])
  const customers = useMemo(() => customerQuery.data ?? [], [customerQuery.data])
  const pscs = useMemo(() => pscQuery.data ?? [], [pscQuery.data])
  const requests = useMemo(() => requestQuery.data ?? [], [requestQuery.data])
  const txns = useMemo(() => txnQuery.data ?? [], [txnQuery.data])
  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles])

  const queries = [revenueQuery, costQuery, cashQuery, settlementQuery, rentalQuery, incidentQuery, blockQuery, vehicleQuery, customerQuery, pscQuery, requestQuery, txnQuery]
  const isLoading = queries.some((q) => q.isLoading)
  const isError = queries.some((q) => q.isError)

  const today = useMemo(() => new Date(), [])
  const [selection, setSelection] = useState<PeriodSelection>(() => initialPeriodSelection('THIS_MONTH'))
  const [granularity, setGranularity] = useState<ReportGranularity>(() => suggestGranularity(initialPeriodSelection('THIS_MONTH').period))
  const [excludeUnusual, setExcludeUnusual] = useState(false)
  const [sortKey, setSortKey] = useState<VehicleSortKey>('PROFIT')
  const [sheetVehicleId, setSheetVehicleId] = useState<string | null>(null)

  const period = selection.period
  const comparison = useMemo(() => comparisonPeriodOf(selection), [selection])

  function handlePeriodChange(next: PeriodSelection) {
    setSelection(next)
    setGranularity(suggestGranularity(next.period))
  }

  // EX-04 — công tắc "Loại chi phí bất thường" xử lý MỘT lần ở đây, rồi truyền vào mọi hàm (KPI, biểu đồ, Hiệu quả xe, Chi phí).
  const reportCostEntries = useMemo(() => (excludeUnusual ? costEntries.filter((c) => !c.isUnusual) : costEntries), [costEntries, excludeUnusual])

  const kpiCurrent = useMemo(
    () => buildKpiValues({ revenueLines, costEntries: reportCostEntries, cashEntries, settlements, period }),
    [revenueLines, reportCostEntries, cashEntries, settlements, period],
  )
  const kpiPrevious = useMemo(
    () => buildKpiValues({ revenueLines, costEntries: reportCostEntries, cashEntries, settlements, period: comparison }),
    [revenueLines, reportCostEntries, cashEntries, settlements, comparison],
  )
  const series = useMemo(
    () => buildTimeSeries({ revenueLines, costEntries: reportCostEntries, cashEntries, settlements, period, granularity }),
    [revenueLines, reportCostEntries, cashEntries, settlements, period, granularity],
  )
  const vehicleRows = useMemo(
    () =>
      selectReportVehicleRows(
        buildVehiclePerformance({ vehicles, rentals, settlements, revenueLines, costEntries: reportCostEntries, incidents, blocks, period, today }),
        vehicles,
      ),
    [vehicles, rentals, settlements, revenueLines, reportCostEntries, incidents, blocks, period, today],
  )
  const overviewRows = useMemo(() => sortVehicleRows(vehicleRows, 'PROFIT'), [vehicleRows])
  const sortedRows = useMemo(() => sortVehicleRows(vehicleRows, sortKey), [vehicleRows, sortKey])
  const hasConsignedVehicle = vehicleRows.some((r) => vehicleById.get(r.vehicleId)?.ownershipType === 'CONSIGNED')

  // Report 03 — số dư HIỆN TẠI tính y như màn Công nợ khách hàng (cùng tham số) để `Σ Còn phải thu` khớp thẻ "Đang nợ".
  const onHoldPscIds = useMemo(() => new Set(pscs.filter((p) => isPscOnHold(p, incidents)).map((p) => p.id)), [pscs, incidents])
  const onHoldByRental = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of pscs) {
      if (onHoldPscIds.has(p.id) && p.type === 'RECEIVABLE') map.set(p.rentalId, (map.get(p.rentalId) ?? 0) + p.amount)
    }
    return map
  }, [pscs, onHoldPscIds])
  const balances = useMemo(
    () => deriveCustomerBalances({ customers, rentals, settlements, pscs, requests, txns, onHoldPscIds }),
    [customers, rentals, settlements, pscs, requests, txns, onHoldPscIds],
  )

  // Nợ (e) — chú thích chi phí phân bổ ngày sau hôm nay (dùng đúng danh sách chi phí đang tính, sau công tắc "bất thường").
  const futureCost = useMemo(() => sumFutureDatedCost(reportCostEntries, period, today), [reportCostEntries, period, today])

  const sheetVehicle = sheetVehicleId ? (vehicleById.get(sheetVehicleId) ?? null) : null
  function handleSelectVehicle(vehicleId: string) {
    setSheetVehicleId(vehicleId)
  }
  const onSelectVehicle = canDrillDown ? handleSelectVehicle : undefined

  const sortLabels: Record<VehicleSortKey, string> = { PROFIT: t.sortProfit, REVENUE: t.sortRevenue, UTILIZATION: t.sortUtilization }

  // ---- Xuất CSV: sections dựng từ chính các biến đang render bảng (kpiCurrent/kpiPrevious/series/overviewRows/sortedRows). ----
  const granularityFilterLabel = t.exportFilterGranularity.replace('{value}', t.granularity[granularity])
  const excludeUnusualLabels = excludeUnusual ? [t.exportFilterExcludeUnusual] : []
  const plateOf = (id: string) => vehicleById.get(id)?.plate ?? id

  function getOverviewSections(): CsvSection[] {
    const kpiRows: { label: string; key: keyof FinanceKpiValues }[] = [
      { label: t.kpiRevenue, key: 'revenue' },
      { label: t.kpiCash, key: 'cash' },
      { label: t.kpiDirectCost, key: 'directCost' },
      { label: t.kpiOperatingProfit, key: 'operatingProfit' },
      { label: t.kpiIndirectCost, key: 'indirectCost' },
      { label: t.kpiAfterIndirect, key: 'afterIndirect' },
      { label: t.kpiCompletedCount, key: 'completedCount' },
    ]
    return [
      {
        title: t.overviewKpiSection,
        headers: [t.overviewKpiColumnMetric, t.overviewKpiColumnCurrent, t.overviewKpiColumnPrevious, t.overviewKpiColumnChange],
        rows: kpiRows.map((k) => [k.label, kpiCurrent[k.key], kpiPrevious[k.key], formatChangeText(calcChangeRatio(kpiCurrent[k.key], kpiPrevious[k.key]), t.compareNone)]),
      },
      {
        title: t.overviewSeriesSection,
        headers: [t.revenueColumnBucket, t.revenueColumnRevenue, t.chartDirectCost, t.overviewSeriesColumnProfit],
        rows: series.map((p) => [bucketDisplayLabel(p.bucket, granularity, t.weekPrefix), p.revenue, p.directCost, p.operatingProfit]),
      },
      {
        title: t.vehiclesTableTitle,
        headers: [t.vehicleColumnPlate, t.vehicleColumnUtilization, t.vehicleColumnRevenue, t.vehicleColumnDirectCost, t.vehicleColumnProfit],
        rows: overviewRows.map((r) => [plateOf(r.vehicleId), formatPercentText(r.utilization, ''), r.revenue, r.directCost, r.estimatedProfit]),
      },
    ]
  }

  function getVehicleSections(): CsvSection[] {
    const total = sumVehicleRows(sortedRows)
    return [
      {
        title: t.vehiclesTableTitle,
        headers: [
          t.vehicleColumnPlate,
          t.vehicleColumnClass,
          t.vehicleColumnOwnership,
          t.vehicleColumnRentalCount,
          t.vehicleColumnRentalDays,
          t.vehicleColumnAvailableDays,
          t.vehicleColumnUtilization,
          t.vehicleColumnRevenue,
          t.vehicleColumnDirectCost,
          t.vehicleColumnProfit,
          t.vehicleColumnIncidents,
        ],
        rows: sortedRows.map((r) => {
          const vehicle = vehicleById.get(r.vehicleId)
          return [
            plateOf(r.vehicleId),
            vehicle ? VEHICLE_CLASS_LABELS[vehicle.vehicleClass] : '',
            vehicle ? OWNERSHIP_TYPE_LABELS[vehicle.ownershipType] : '',
            r.rentalCount,
            r.rentalDays,
            r.availableDays,
            formatPercentText(r.utilization, ''),
            r.revenue,
            r.directCost,
            r.estimatedProfit,
            r.incidentCount,
          ]
        }),
        totalRow: [t.vehicleTotalRow, '', '', total.rentalCount, total.rentalDays, total.availableDays, formatPercentText(total.utilization, ''), total.revenue, total.directCost, total.estimatedProfit, total.incidentCount],
      },
    ]
  }

  return (
    <div>
      <PageHeader title={t.title} description={t.description} />

      <div className="mb-4 flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 flex-wrap items-end gap-3">
          <FinancePeriodPicker value={selection} onChange={handlePeriodChange} />
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label>{t.granularityLabel}</Label>
            <Select value={granularity} onValueChange={(value) => setGranularity(value as ReportGranularity)}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GRANULARITIES.map((g) => (
                  <SelectItem key={g} value={g}>
                    {t.granularity[g]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pb-2">
            <Switch id="report-exclude-unusual" checked={excludeUnusual} onCheckedChange={setExcludeUnusual} />
            <Label htmlFor="report-exclude-unusual" title={t.excludeUnusualHint}>
              {t.excludeUnusualLabel}
            </Label>
          </div>
        </div>
        <div className="text-muted-foreground flex flex-col gap-0.5 text-xs">
          <p>
            {vi.finance.revenueCost.recognitionNote} ({REVENUE_RECOGNITION_POLICY_LABELS[REVENUE_RECOGNITION_POLICY]})
          </p>
          {/* TODO(OQ: RevenueCost-BRD.md §28 Q11/Q13 — chưa làm Period Close, số liệu luôn sống) */}
          <p>{t.notClosedNote}</p>
          <p>{vi.finance.revenueCost.estimateNote}</p>
        </div>
      </div>

      {isError ? (
        <p className="text-destructive text-sm">{t.loadError}</p>
      ) : isLoading ? (
        <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
      ) : (
        <Tabs defaultValue="overview" className="min-w-0">
          <TabsList className="max-w-full">
            <TabsTrigger value="overview">{t.tabOverview}</TabsTrigger>
            <TabsTrigger value="revenue">{t.tabRevenue}</TabsTrigger>
            <TabsTrigger value="vehicles">{t.tabVehicles}</TabsTrigger>
            <TabsTrigger value="costs">{t.tabCosts}</TabsTrigger>
            <TabsTrigger value="customers">{t.tabCustomer}</TabsTrigger>
            <TabsTrigger value="incidents">{t.tabIncident}</TabsTrigger>
            <TabsTrigger value="reconciliation">{t.tabReconciliation}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex min-w-0 flex-col gap-5 pt-2">
            <div className="flex justify-end">
              <ReportExportButton
                reportKey="OVERVIEW"
                period={period}
                filters={{ granularity, excludeUnusual }}
                filterLabels={[granularityFilterLabel, ...excludeUnusualLabels]}
                getSections={getOverviewSections}
              />
            </div>
            <FinanceKpiCards current={kpiCurrent} previous={kpiPrevious} comparison={comparison} />
            {futureCost > 0 && <p className="text-muted-foreground -mt-3 text-xs">{t.futureCostNote.replace('{amount}', formatVnd(futureCost))}</p>}
            <section className="flex min-w-0 flex-col gap-2">
              <h3 className="text-sm font-semibold">{t.chartTitleOverview}</h3>
              <FinanceTrendChart data={series.map((p) => ({ bucket: p.bucket, revenue: p.revenue, directCost: p.directCost, profit: p.operatingProfit }))} granularity={granularity} />
            </section>
            <section className="flex min-w-0 flex-col gap-2">
              <h3 className="text-sm font-semibold">{t.vehiclesTableTitle}</h3>
              {canDrillDown && <p className="text-muted-foreground text-xs">{t.vehicleRowHint}</p>}
              {overviewRows.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t.vehiclesEmpty}</p>
              ) : (
                <VehiclePerformanceTable rows={overviewRows} vehicleById={vehicleById} variant="compact" onSelect={onSelectVehicle} />
              )}
            </section>
          </TabsContent>

          <TabsContent value="revenue" className="pt-2">
            <RevenueReportPanel revenueLines={revenueLines} settlements={settlements} vehicles={vehicles} customers={customers} period={period} granularity={granularity} />
          </TabsContent>

          <TabsContent value="vehicles" className="flex min-w-0 flex-col gap-3 pt-2">
            <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
              <p className="text-muted-foreground text-xs">{t.vehiclesNote}</p>
              <div className="flex min-w-0 flex-wrap items-end gap-3">
                <ReportExportButton
                  reportKey="VEHICLE_PERFORMANCE"
                  period={period}
                  filters={{ sortKey, excludeUnusual }}
                  filterLabels={[t.exportFilterSort.replace('{value}', sortLabels[sortKey]), ...excludeUnusualLabels]}
                  getSections={getVehicleSections}
                />
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Label>{t.sortLabel}</Label>
                  <Select value={sortKey} onValueChange={(value) => setSortKey(value as VehicleSortKey)}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_KEYS.map((key) => (
                        <SelectItem key={key} value={key}>
                          {sortLabels[key]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            {/* TODO(Phase 5): gộp CONSIGNMENT_PAYOUT khi có features/consignment.
                TODO(OQ: RevenueCost-BRD.md §28 Q18 — xe ký gửi 1 hay 2 góc nhìn; chỉ nhắc chưa gồm chi trả chủ xe) */}
            {hasConsignedVehicle && (
              <p className="border-status-info/40 bg-status-info/10 text-status-info rounded-md border p-3 text-sm">{vi.finance.revenueCost.profitConsignmentBanner}</p>
            )}
            {canDrillDown && <p className="text-muted-foreground text-xs">{t.vehicleRowHint}</p>}
            {sortedRows.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t.vehiclesEmpty}</p>
            ) : (
              <VehiclePerformanceTable rows={sortedRows} vehicleById={vehicleById} variant="full" onSelect={onSelectVehicle} />
            )}
          </TabsContent>

          <TabsContent value="costs" className="pt-2">
            <CostBreakdownPanel costEntries={reportCostEntries} period={period} today={today} excludeUnusual={excludeUnusual} />
          </TabsContent>

          <TabsContent value="customers" className="pt-2">
            <CustomerReportPanel
              revenueLines={revenueLines}
              settlements={settlements}
              cashEntries={cashEntries}
              incidents={incidents}
              rentals={rentals}
              balances={balances}
              customers={customers}
              period={period}
            />
          </TabsContent>

          <TabsContent value="incidents" className="pt-2">
            <IncidentReportPanel incidents={incidents} vehicles={vehicles} period={period} />
          </TabsContent>

          <TabsContent value="reconciliation" className="pt-2">
            <ReconciliationPanel
              revenueLines={revenueLines}
              cashEntries={cashEntries}
              costEntries={reportCostEntries}
              customers={customers}
              period={period}
              granularity={granularity}
              excludeUnusual={excludeUnusual}
              onHoldByRental={onHoldByRental}
            />
          </TabsContent>
        </Tabs>
      )}

      <VehicleFinanceSheet vehicle={sheetVehicle} selection={selection} open={sheetVehicle !== null} onOpenChange={(open) => !open && setSheetVehicleId(null)} />
    </div>
  )
}
