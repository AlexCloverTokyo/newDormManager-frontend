import { useState, useMemo, useDeferredValue, useRef, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, CalendarDays, Search, X, Printer, Columns3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { PrintSettingsDialog } from './PrintSettingsDialog'
import type { PrintConfig } from './PrintSettingsDialog'
import { PrintableCalendar } from './PrintableCalendar'
import { getCalendar } from '@/api/calendar'
import { useMasterItems } from '@/hooks/useMasters'
import { useAuth } from '@/contexts/AuthContext'
import type { MoveInContext } from '@/types/calendar'
import { DormCard } from './DormCard'
import { MoveInDrawer } from './MoveInDrawer'
import { getTodayJST } from './calendarHelpers'
import { TOGGLEABLE_COLUMNS, loadVisibleColumns, saveVisibleColumns } from './calendarColumns'
import type { ColumnContext } from './calendarColumns'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function CalendarView() {
  usePageTitle('寮割カレンダー')
  const { user } = useAuth()
  const today = getTodayJST()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [locationCode, setLocationCode] = useState('')
  const [divisionCode, setDivisionCode] = useState('')
  const [stationCode, setStationCode] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const deferredQuery = useDeferredValue(searchQuery)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [moveInContext, setMoveInContext] = useState<MoveInContext | null>(null)
  const [printDialogOpen, setPrintDialogOpen] = useState(false)
  const [printConfig, setPrintConfig] = useState<PrintConfig | null>(null)
  const printStartedAt = useRef<number>(0)
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(loadVisibleColumns)

  function toggleColumn(key: string) {
    setVisibleColumnKeys(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      saveVisibleColumns(next)
      return next
    })
  }

  useEffect(() => {
    function handleAfterPrint() {
      // Guard: ignore afterprint if fired within 500ms of print start
      // (some browsers fire it immediately when the dialog opens)
      if (Date.now() - printStartedAt.current < 500) return
      setPrintConfig(null)
    }
    window.addEventListener('afterprint', handleAfterPrint)
    return () => window.removeEventListener('afterprint', handleAfterPrint)
  }, [])

  function handlePrintConfirm(config: PrintConfig) {
    printStartedAt.current = Date.now()
    setPrintDialogOpen(false)
    setPrintConfig(config)
  }

  const locationItems = useMasterItems('location')
  const roomTypeItems = useMasterItems('room_type')
  const divisionItems = useMasterItems('division')
  const stationItems = useMasterItems('nearest_station')

  const columnContext: ColumnContext = useMemo(
    () => ({
      roomTypeLabels: Object.fromEntries(roomTypeItems.map(i => [i.code, i.label_ja])),
      divisionLabels: Object.fromEntries(divisionItems.map(i => [i.code, i.label_ja])),
      stationLabels: Object.fromEntries(stationItems.map(i => [i.code, i.label_ja])),
    }),
    [roomTypeItems, divisionItems, stationItems],
  )

  const monthStr = `${year}-${String(month).padStart(2, '0')}`
  const { data, isLoading, isError } = useQuery({
    queryKey: ['calendar', monthStr, locationCode, divisionCode, stationCode],
    queryFn: () => getCalendar({
      month: monthStr,
      location: locationCode || undefined,
      division: divisionCode || undefined,
      nearest_station: stationCode || undefined,
    }),
    staleTime: 60_000,
  })

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const regionLabelMap = useMemo(
    () => Object.fromEntries(locationItems.map(i => [i.code, i.label_ja])),
    [locationItems],
  )
  const activeLocationItems = useMemo(
    () => locationItems.filter(i => i.is_active),
    [locationItems],
  )

  const currentMonthLabel = `${year}年${month}月`
  const currentRegionLabel = locationCode ? (regionLabelMap[locationCode] ?? locationCode) : 'すべて'

  const matchCount = useMemo(() => {
    if (!deferredQuery || !data) return 0
    const q = deferredQuery.trim().toLowerCase()
    if (!q) return 0
    return data.dorms.reduce((sum, dorm) =>
      sum + dorm.rooms.reduce((rSum, room) =>
        rSum + room.residents.filter(r => r.name.toLowerCase().includes(q)).length, 0), 0)
  }, [data, deferredQuery])

  // 地域タブの横スクロール制御
  const tabScrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateTabScrollState = useCallback(() => {
    const el = tabScrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    updateTabScrollState()
    window.addEventListener('resize', updateTabScrollState)
    return () => window.removeEventListener('resize', updateTabScrollState)
  }, [updateTabScrollState, activeLocationItems.length])

  function scrollTabs(direction: 1 | -1) {
    tabScrollRef.current?.scrollBy({ left: direction * 120, behavior: 'smooth' })
  }

  function handleCellClick(ctx: MoveInContext) {
    // Permission gate: only admins can move in residents
    if (user?.role !== 'admin') return
    setMoveInContext(ctx)
    setDrawerOpen(true)
  }

  return (
    <div className="flex flex-col h-full">
      {/* TOPBAR */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        {/* Row 1: 月ナビ + 地域タブ + フィルタ + 検索 */}
        <div className="px-4 py-2 flex items-center gap-3 flex-wrap">
          {/* 月ナビ */}
          <div className="flex items-center gap-1">
            <button onClick={prevMonth}
                    className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="font-bold text-sm min-w-[90px] text-center">
              {year}年{month}月
            </span>
            <button onClick={nextMonth}
                    className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="w-px h-6 bg-gray-200 shrink-0" />

          {/* 地域タブ（動的・横スクロール対応） */}
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <button
              onClick={() => scrollTabs(-1)}
              disabled={!canScrollLeft}
              aria-label="左へスクロール"
              className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 disabled:opacity-0 disabled:pointer-events-none"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <div className="relative min-w-0 flex-1">
              {canScrollLeft && (
                <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-white to-transparent z-10" />
              )}
              <div
                ref={tabScrollRef}
                onScroll={updateTabScrollState}
                className="flex gap-1 overflow-x-auto scrollbar-thin"
              >
                <button
                  onClick={() => setLocationCode('')}
                  className={`shrink-0 px-3 py-1 rounded text-xs border whitespace-nowrap ${
                    locationCode === ''
                      ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                      : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}>
                  すべて
                </button>
                {activeLocationItems.map(item => (
                  <button
                    key={item.code}
                    onClick={() => setLocationCode(item.code)}
                    className={`shrink-0 px-3 py-1 rounded text-xs border whitespace-nowrap ${
                      locationCode === item.code
                        ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                    }`}>
                    {item.label_ja}
                  </button>
                ))}
              </div>
              {canScrollRight && (
                <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white to-transparent z-10" />
              )}
            </div>
            <button
              onClick={() => scrollTabs(1)}
              disabled={!canScrollRight}
              aria-label="右へスクロール"
              className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 disabled:opacity-0 disabled:pointer-events-none"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="w-px h-6 bg-gray-200 shrink-0" />

          {/* 事業部フィルタ */}
          <Select value={divisionCode || 'all'} onValueChange={v => setDivisionCode(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue placeholder="事業部" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全事業部</SelectItem>
              {divisionItems.filter(i => i.is_active).map(item => (
                <SelectItem key={item.code} value={item.code}>{item.label_ja}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 最寄駅フィルタ */}
          <Select value={stationCode || 'all'} onValueChange={v => setStationCode(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue placeholder="最寄駅" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全駅</SelectItem>
              {stationItems.filter(i => i.is_active).map(item => (
                <SelectItem key={item.code} value={item.code}>{item.label_ja}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="w-px h-6 bg-gray-200 shrink-0" />

          {/* 氏名検索 */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <Input
                type="text"
                placeholder="氏名で検索..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-7 pr-7 h-8 text-xs w-48"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  aria-label="検索をクリア"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {deferredQuery && matchCount > 0 && (
              <span className="text-xs text-gray-400 whitespace-nowrap">{matchCount}件</span>
            )}
          </div>
        </div>

        {/* Row 2: ツール + 凡例 */}
        <div className="px-4 py-1.5 flex items-center gap-3 border-t border-gray-100 bg-gray-50/50">
          {/* 列設定 */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs flex items-center gap-1.5">
                <Columns3 className="h-3.5 w-3.5" />
                列設定
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-52 p-3">
              <p className="text-xs font-semibold text-gray-500 mb-2">表示する列</p>
              <div className="flex flex-col gap-2">
                {TOGGLEABLE_COLUMNS.map(col => (
                  <label key={col.key} className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox
                      checked={visibleColumnKeys.includes(col.key)}
                      onCheckedChange={() => toggleColumn(col.key)}
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* 印刷ボタン */}
          <Button variant="outline" size="sm" onClick={() => setPrintDialogOpen(true)} className="h-7 text-xs flex items-center gap-1.5">
            <Printer className="h-3.5 w-3.5" />
            印刷
          </Button>

          {/* 凡例 */}
          <div className="ml-auto flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm border border-gray-200" style={{ background: '#FAC775' }} />
              在籍日
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm border border-gray-200" style={{ background: '#DDD6FE' }} />
              今日
            </span>
            {user?.role === 'admin' && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm border border-gray-200" style={{ background: 'rgba(34,197,94,0.12)' }} />
                空室（クリックで入居登録）
              </span>
            )}
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {isLoading && (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
            <CalendarDays className="h-5 w-5 mr-2" /> 読み込み中...
          </div>
        )}
        {isError && (
          <div className="text-red-500 text-sm text-center py-8">
            データの取得に失敗しました。再読み込みしてください。
          </div>
        )}
        {deferredQuery && matchCount === 0 && data && (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <Search className="h-10 w-10 text-gray-300 mb-2" />
            <span className="text-sm">「{deferredQuery}」に一致する社員が見つかりませんでした</span>
          </div>
        )}
        {(!deferredQuery || matchCount > 0) && data?.dorms.map(dorm => (
          <DormCard
            key={dorm.dorm_id}
            dorm={dorm}
            year={year}
            month={month}
            today={today}
            searchQuery={deferredQuery}
            regionLabel={regionLabelMap[dorm.region]}
            onCellClick={user?.role === 'admin' ? handleCellClick : undefined}
            visibleColumnKeys={visibleColumnKeys}
            columnContext={columnContext}
          />
        ))}
        {!deferredQuery && data && data.dorms.length === 0 && (
          <div className="text-gray-400 text-sm text-center py-8">
            対象の宿舎が見つかりませんでした
          </div>
        )}
      </div>

      <MoveInDrawer
        open={drawerOpen}
        context={moveInContext}
        onOpenChange={setDrawerOpen}
        onSuccess={() => setDrawerOpen(false)}
      />

      <PrintSettingsDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        onConfirm={handlePrintConfirm}
        currentMonth={currentMonthLabel}
        currentRegion={currentRegionLabel}
      />

      {printConfig && data && (
        <PrintableCalendar
          config={printConfig}
          dorms={data.dorms}
          year={year}
          month={month}
          regionLabel={currentRegionLabel}
          onClose={() => setPrintConfig(null)}
        />
      )}
    </div>
  )
}
