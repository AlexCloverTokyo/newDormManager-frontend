import { useMemo } from 'react'
import type { CalendarDorm, CalendarRoom, CalendarResident, MoveInContext } from '@/types/calendar'
import { isResiding, daysInMonth, getBadgeStatus, detectOverlapKeys } from './calendarHelpers'
import type { BadgeStatus } from './calendarHelpers'
import { TOGGLEABLE_COLUMNS } from './calendarColumns'
import type { CalendarColumnDef, ColumnContext } from './calendarColumns'

// --- Badge コンポーネント ---
function StatusBadge({ status }: { status: BadgeStatus }) {
  const config: Record<BadgeStatus, { label: string; className: string }> = {
    active:          { label: '在籍中',   className: 'bg-green-100 text-green-800' },
    leaving_soon:    { label: '退寮予定', className: 'bg-red-100 text-red-800' },
    arriving:        { label: '入寮予定', className: 'bg-gray-100 text-gray-600' },
    left_this_month: { label: '退寮済',   className: 'bg-gray-100 text-gray-400' },
    vacant:          { label: '空室',     className: 'bg-green-100 text-green-700' },
  }
  const { label, className } = config[status]
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${className}`}>
      {label}
    </span>
  )
}

function highlightMatch(text: string, query: string) {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query)
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

// --- 行データ型（左右テーブル共通） ---
type RowItem =
  | { kind: 'empty'; key: string; room: CalendarRoom; roomSpan: number }
  | { kind: 'resident'; key: string; room: CalendarRoom; resident: CalendarResident; status: BadgeStatus; roomSpan: number }

// --- メインコンポーネント ---
interface DormCardProps {
  dorm: CalendarDorm
  year: number
  month: number
  today: Date
  searchQuery: string
  regionLabel?: string
  onCellClick?: (context: MoveInContext) => void
  visibleColumnKeys: string[]
  columnContext: ColumnContext
}

export function DormCard({ dorm, year, month, today, searchQuery, regionLabel, onCellClick, visibleColumnKeys, columnContext }: DormCardProps) {
  const days = daysInMonth(year, month)
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month - 1, days)
  const overlapKeys = detectOverlapKeys(dorm.rooms, year, month)

  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const roomAvailMap = useMemo(() => {
    const map: Record<string, Set<number>> = {}
    for (const room of dorm.rooms) {
      const avail = new Set<number>()
      for (let d = 1; d <= days; d++) {
        const target = new Date(year, month - 1, d)
        if (target < todayDate) continue
        if (overlapKeys.has(`${room.room_id}-${d}`)) continue
        const occupied = room.residents.some(r =>
          isResiding(r.checkin_date, r.checkout_date, target))
        if (!occupied) avail.add(d)
      }
      map[room.room_id] = avail
    }
    return map
  }, [dorm.rooms, days, year, month, todayDate.getTime(), overlapKeys])

  function handleCellClick(room: CalendarRoom, day: number) {
    if (!onCellClick) return
    const clickedDate = new Date(year, month - 1, day)
    let earliestFutureCheckin: Date | undefined
    for (const r of room.residents) {
      const ci = new Date(r.checkin_date)
      if (ci > clickedDate && (!earliestFutureCheckin || ci < earliestFutureCheckin)) {
        earliestFutureCheckin = ci
      }
    }
    const pad = (n: number) => String(n).padStart(2, '0')
    onCellClick({
      dormId: dorm.dorm_id,
      dormName: dorm.name,
      roomId: room.room_id,
      roomName: room.room_name,
      moveInDate: `${year}-${pad(month)}-${pad(day)}`,
      nextOccupiedDate: earliestFutureCheckin
        ? `${earliestFutureCheckin.getFullYear()}-${pad(earliestFutureCheckin.getMonth()+1)}-${pad(earliestFutureCheckin.getDate())}`
        : undefined,
    })
  }

  function cellTitle(room: CalendarRoom, day: number, isAvail: boolean, row: RowItem): string {
    if (!isAvail || !onCellClick) return ''
    const base = `${room.room_name} — ${month}/${day} 入居登録`
    if (row.kind === 'resident' && row.status === 'left_this_month') {
      return `${base}（この部屋はこの日に入居登録できます）`
    }
    return base
  }

  function overlapTooltip(room: CalendarRoom, day: number): string {
    const targetDay = new Date(year, month - 1, day)
    const overlapping = room.residents.filter(r =>
      isResiding(r.checkin_date, r.checkout_date, targetDay))
    if (overlapping.length < 2) return ''
    const names = overlapping.map(r => r.name).join('、')
    return `⚠ 部屋重複（${room.room_name} ${month}/${day}）: ${names}`
  }

  const allResidents = dorm.rooms.flatMap(r => r.residents)
  const currentCount = allResidents.filter(r =>
    isResiding(r.checkin_date, r.checkout_date, today)
  ).length
  const movingOutCount = allResidents.filter(r => {
    if (!r.checkout_date) return false
    const co = new Date(r.checkout_date)
    return co >= monthStart && co <= monthEnd
  }).length
  const movingInCount = allResidents.filter(r => {
    const ci = new Date(r.checkin_date)
    return ci >= monthStart && ci <= monthEnd
  }).length
  const totalRooms = dorm.rooms.length
  const occupiedRooms = dorm.rooms.filter(r =>
    r.residents.some(res => isResiding(res.checkin_date, res.checkout_date, today))
  ).length
  const vacantRooms = totalRooms - occupiedRooms

  const overlapWarnings: string[] = []
  for (const room of dorm.rooms) {
    for (let d = 1; d <= days; d++) {
      if (overlapKeys.has(`${room.room_id}-${d}`)) {
        const existing = overlapWarnings.find(w => w.includes(room.room_name))
        if (!existing) overlapWarnings.push(`${room.room_name} — ${month}/${d}`)
      }
    }
  }

  function dayHeaderClass(d: number): string {
    const dt = new Date(year, month - 1, d)
    const dow = dt.getDay()
    const isToday = dt.toDateString() === today.toDateString()
    if (isToday) return 'bg-blue-600 text-white font-bold'
    if (dow === 0) return 'text-red-500'
    if (dow === 6) return 'text-blue-500'
    return 'text-slate-500'
  }

  function cellStyle(
    resident: CalendarResident,
    d: number,
    roomId: string,
  ): React.CSSProperties {
    const targetDay = new Date(year, month - 1, d)
    const isOverlap = overlapKeys.has(`${roomId}-${d}`)
    if (isOverlap) return { background: '#fca5a5' }

    if (!isResiding(resident.checkin_date, resident.checkout_date, targetDay)) return {}
    const isToday = targetDay.toDateString() === today.toDateString()
    if (isToday) return { background: '#DDD6FE' }
    return { background: '#FAC775' }
  }

  function dayColBg(d: number): React.CSSProperties {
    const dt = new Date(year, month - 1, d)
    if (dt.toDateString() === today.toDateString()) return {}
    const dow = dt.getDay()
    if (dow === 0) return { background: 'rgba(220,38,38,0.04)' }
    if (dow === 6) return { background: 'rgba(37,99,235,0.04)' }
    return {}
  }

  function isCurrentMonth(dateStr: string): boolean {
    const d2 = new Date(dateStr)
    return d2 >= monthStart && d2 <= monthEnd
  }

  // --- 行データ生成（部屋を起点に1回だけ走査） ---
  const normalizedQuery = searchQuery.trim().toLowerCase()

  const rows: RowItem[] = []
  for (const room of dorm.rooms) {
    if (room.residents.length === 0) {
      if (normalizedQuery) continue
      rows.push({ kind: 'empty', key: room.room_id, room, roomSpan: 1 })
      continue
    }
    const matching = normalizedQuery
      ? room.residents.filter(r => r.name.toLowerCase().includes(normalizedQuery))
      : room.residents
    if (matching.length === 0) continue
    matching.forEach((resident, idx) => {
      rows.push({
        kind: 'resident',
        key: resident.stay_id,
        room,
        resident,
        status: getBadgeStatus(resident.checkin_date, resident.checkout_date, today, monthStart, monthEnd),
        roomSpan: idx === 0 ? matching.length : 0,
      })
    })
  }

  if (normalizedQuery && rows.length === 0) return null

  const COL_W = { room: 80, name: 110, affil: 90 }
  const FIXED_COLS_WIDTH = COL_W.room + COL_W.name + COL_W.affil
  const DAY_W = 24
  const dayCols = Array.from({ length: days }, (_, i) => i + 1)

  const visibleColumns: CalendarColumnDef[] = useMemo(
    () => TOGGLEABLE_COLUMNS.filter(c => visibleColumnKeys.includes(c.key)),
    [visibleColumnKeys],
  )

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shrink-0">
      {/* カードヘッダー（寮情報） */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 border-b border-gray-200">
        <span className="font-bold text-sm shrink-0 max-w-[240px] truncate">{dorm.name}</span>
        <span className="rounded-full bg-blue-100 text-blue-700 text-[11px] font-semibold px-2 py-0.5 shrink-0 whitespace-nowrap">
          {regionLabel ?? dorm.region}
        </span>
        <span className="text-[11px] text-gray-500 min-w-0 flex-1 truncate">{dorm.address}</span>
        <div className="ml-auto flex items-center gap-3 text-xs shrink-0 whitespace-nowrap pl-2">
          <span>{currentCount}名在籍</span>
          <span>部屋数 {totalRooms}</span>
          {vacantRooms > 0
            ? <span className="text-green-600 font-semibold">空き{vacantRooms}</span>
            : <span className="text-red-500 font-semibold">満室</span>
          }
        </div>
      </div>

      {/* テーブル領域：固定列テーブル（部屋+氏名+所属）+ スクロール可能テーブル（利用情報+日付グリッド） */}
      <div className="flex">
        {/* 左：固定列テーブル（部屋・氏名・所属のみ） */}
        <table style={{ width: FIXED_COLS_WIDTH }} className="border-collapse table-fixed shrink-0 whitespace-nowrap text-xs">
          <thead>
            <tr>
              <th style={{ width: COL_W.room, minWidth: COL_W.room }}
                  rowSpan={2}
                  className="border border-gray-200 bg-gray-50 px-1.5 h-7 text-center font-semibold text-[11px]">部屋</th>
              <th colSpan={2}
                  className="border border-gray-200 border-r-0 bg-amber-50 px-1 h-5 text-center font-semibold text-[11px] text-amber-800">入居者情報</th>
            </tr>
            <tr>
              <th style={{ width: COL_W.name, minWidth: COL_W.name }}
                  className="border border-gray-200 bg-gray-50 px-1.5 h-6 text-center font-semibold text-[11px]">氏名</th>
              <th style={{ width: COL_W.affil, minWidth: COL_W.affil }}
                  className="border border-gray-200 border-r-0 bg-gray-50 px-1.5 h-6 text-center font-semibold text-[11px]">所属</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              if (row.kind === 'empty') {
                return (
                  <tr key={row.key}>
                    <td rowSpan={row.roomSpan}
                        className="border border-gray-200 px-1.5 h-7 overflow-hidden text-ellipsis font-medium">
                      {row.room.room_name}
                    </td>
                    <td className="border border-gray-200 px-1 h-7 text-gray-400">—</td>
                    <td className="border border-gray-200 border-r-0 px-1 h-7"></td>
                  </tr>
                )
              }
              const { resident, room, roomSpan } = row
              return (
                <tr key={row.key}>
                  {roomSpan > 0 && (
                    <td rowSpan={roomSpan}
                        className="border border-gray-200 px-1.5 h-7 overflow-hidden text-ellipsis font-medium">
                      {room.room_name}
                    </td>
                  )}
                  <td className="border border-gray-200 px-1.5 h-7 overflow-hidden text-ellipsis">
                    {highlightMatch(resident.name, normalizedQuery)}{resident.is_responsible && <span className="text-amber-400 ml-0.5">★</span>}
                  </td>
                  <td className="border border-gray-200 border-r-0 px-1 h-7 overflow-hidden text-ellipsis">
                    {resident.affiliation}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* 右：可変情報列（自動幅）+ 日付グリッド（固定幅）— 横スクロール */}
        <div className="overflow-x-auto min-w-0 flex-1">
          <table className="border-collapse whitespace-nowrap text-xs">
            <thead>
              <tr>
                {visibleColumns.length > 0 && (
                  <th colSpan={visibleColumns.length}
                      className="border border-gray-200 bg-cyan-50 px-1 h-5 text-center font-semibold text-[11px] text-cyan-800">詳細情報</th>
                )}
                <th colSpan={days}
                    className="border border-gray-200 bg-gray-50 px-1 h-5 text-center font-semibold text-[11px]">{year}年{month}月</th>
              </tr>
              <tr>
                {visibleColumns.map(col => (
                  <th key={col.key}
                      className="border border-gray-200 bg-gray-50 px-3 h-6 text-center font-semibold text-[11px]">{col.label}</th>
                ))}
                {dayCols.map(d => {
                  const dayStyle = { width: DAY_W, minWidth: DAY_W, maxWidth: DAY_W, ...dayColBg(d) }
                  return (
                    <th key={d}
                        style={dayStyle}
                        className={`border border-gray-200 px-0 h-6 text-center text-[11px] ${dayHeaderClass(d)}`}>
                      {d}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const rowData = row.kind === 'resident'
                  ? { room: row.room, resident: row.resident, status: row.status }
                  : { room: row.room }
                return (
                  <tr key={row.key}>
                    {visibleColumns.map(col => {
                      const val = col.getValue(rowData, columnContext)
                      if (col.type === 'badge') {
                        return (
                          <td key={col.key} className="border border-gray-200 px-2 h-7 text-center">
                            {row.kind === 'empty'
                              ? <StatusBadge status="vacant" />
                              : val ? <StatusBadge status={val as BadgeStatus} /> : null}
                          </td>
                        )
                      }
                      const isCheckin = col.key === 'checkinDate' && row.kind === 'resident' && isCurrentMonth(val)
                      const isCheckout = col.key === 'checkoutDate' && row.kind === 'resident' && val !== '—' && isCurrentMonth(val)
                      const dateClass = isCheckin ? 'text-green-600 font-semibold' : isCheckout ? 'text-red-500 font-semibold' : ''
                      return (
                        <td key={col.key} className={`border border-gray-200 px-3 h-7 ${dateClass}`}>
                          {val}
                        </td>
                      )
                    })}
                    {dayCols.map(d => {
                      if (row.kind === 'empty') {
                        const avail = onCellClick && roomAvailMap[row.room.room_id]?.has(d)
                        const oTitle = overlapKeys.has(`${row.room.room_id}-${d}`) ? overlapTooltip(row.room, d) : ''
                        return (
                          <td key={d}
                              style={{ width: DAY_W, minWidth: DAY_W, maxWidth: DAY_W, ...dayColBg(d), ...(oTitle ? { background: '#fca5a5' } : {}), ...(avail ? { background: 'rgba(34,197,94,0.06)' } : {}) }}
                              className={`border border-gray-200 h-7 ${avail ? 'hover:!bg-[rgba(34,197,94,0.15)] cursor-pointer' : ''}`}
                              title={oTitle || (avail ? cellTitle(row.room, d, true, row) : '')}
                              onClick={avail ? () => handleCellClick(row.room, d) : undefined}
                          />
                        )
                      }
                      const { resident, room } = row
                      const baseStyle: React.CSSProperties = { width: DAY_W, minWidth: DAY_W, maxWidth: DAY_W, ...dayColBg(d), ...cellStyle(resident, d, room.room_id) }
                      const avail = onCellClick && roomAvailMap[room.room_id]?.has(d)
                      const hasResidentColor = isResiding(resident.checkin_date, resident.checkout_date, new Date(year, month - 1, d))
                      const showAvail = avail && !hasResidentColor
                      const oTitle = overlapKeys.has(`${room.room_id}-${d}`) ? overlapTooltip(room, d) : ''
                      return (
                        <td key={d}
                            style={{ ...baseStyle, ...(showAvail ? { background: 'rgba(34,197,94,0.06)' } : {}) }}
                            className={`border border-gray-200 h-7 ${showAvail ? 'hover:!bg-[rgba(34,197,94,0.15)] cursor-pointer' : ''}`}
                            title={oTitle || (showAvail ? cellTitle(room, d, true, row) : '')}
                            onClick={showAvail ? () => handleCellClick(room, d) : undefined}
                        />
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* サマリーバー */}
      <div className="flex items-center gap-5 px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-slate-500">
        <span>現在 <strong className="text-slate-800">{currentCount}名</strong>在籍</span>
        <span>今月退寮 <strong className="text-slate-800">{movingOutCount}名</strong></span>
        <span>今月入寮 <strong className="text-slate-800">{movingInCount}名</strong></span>
        {overlapWarnings.map((w, i) => (
          <span key={i} className="bg-amber-100 text-amber-700 font-semibold rounded px-2 py-0.5">
            ⚠️ 部屋重複あり 要確認（{w}）
          </span>
        ))}
      </div>
    </div>
  )
}
