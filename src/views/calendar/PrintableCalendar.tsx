import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { CalendarDorm, CalendarRoom, CalendarResident } from '@/types/calendar'
import type { PrintConfig } from './PrintSettingsDialog'
import { COLUMN_DEFS } from './PrintSettingsDialog'
import { isResiding, daysInMonth, getBadgeStatus, detectOverlapKeys, getTodayJST } from './calendarHelpers'
import type { BadgeStatus } from './calendarHelpers'
import { useMasterItems } from '@/hooks/useMasters'
import { X } from 'lucide-react'

interface PrintableCalendarProps {
  config: PrintConfig
  dorms: CalendarDorm[]
  year: number
  month: number
  regionLabel: string
  onClose: () => void
}

const COL_WEIGHTS: Record<string, number> = {
  room: 18, name: 22, affiliation: 16, checkin: 18, checkout: 18,
  status: 14, roomType: 14, ac: 10, fee: 18, responsible: 10,
}
const DAY_COL_WEIGHT = 5

const STATUS_LABELS: Record<BadgeStatus, string> = {
  active: '在籍中', leaving_soon: '退寮予定', arriving: '入寮予定',
  left_this_month: '退寮済', vacant: '空室',
}

function formatCurrency(value: number): string {
  return `¥${Math.round(value).toLocaleString()}/日`
}

export function PrintableCalendar({ config, dorms, year, month, regionLabel, onClose }: PrintableCalendarProps) {
  const timerRef = useRef<number | null>(null)
  const roomTypeItems = useMasterItems('room_type')
  const roomTypeMap = Object.fromEntries(roomTypeItems.map(i => [i.code, i.label_ja]))
  const masterReady = !config.columns.includes('roomType') || roomTypeItems.length > 0

  useEffect(() => {
    if (!masterReady) return
    const frame = requestAnimationFrame(() => {
      const timer = window.setTimeout(() => {
        window.print()
      }, 300)
      timerRef.current = timer
    })
    return () => {
      cancelAnimationFrame(frame)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [masterReady])

  const days = daysInMonth(year, month)
  const dayCols = Array.from({ length: days }, (_, i) => i + 1)
  const selectedCols = COLUMN_DEFS.filter(c => config.columns.includes(c.key))
  const totalColCount = selectedCols.length + days

  // Column width calculation (percentages)
  const infoWeight = selectedCols.reduce((sum, c) => sum + (COL_WEIGHTS[c.key] ?? 14), 0)
  const totalWeight = infoWeight + DAY_COL_WEIGHT * days
  function colPct(weight: number): string {
    return `${(weight / totalWeight * 100).toFixed(2)}%`
  }
  const dayPct = colPct(DAY_COL_WEIGHT)

  function dayHeaderClass(d: number): string {
    const dt = new Date(year, month - 1, d)
    const dow = dt.getDay()
    if (dow === 0) return 'text-red-500'
    if (dow === 6) return 'text-blue-500'
    return ''
  }

  function renderDorm(dorm: CalendarDorm) {
    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month - 1, days)
    const today = getTodayJST()
    const overlapKeys = detectOverlapKeys(dorm.rooms, year, month)

    // Build row data
    type RowItem =
      | { kind: 'empty'; room: CalendarRoom; roomSpan: number }
      | { kind: 'resident'; room: CalendarRoom; resident: CalendarResident; status: BadgeStatus; roomSpan: number }

    const roomGroups: RowItem[][] = []
    for (const room of dorm.rooms) {
      const group: RowItem[] = []
      if (room.residents.length === 0) {
        group.push({ kind: 'empty', room, roomSpan: 1 })
      } else {
        room.residents.forEach((resident, idx) => {
          group.push({
            kind: 'resident',
            room,
            resident,
            status: getBadgeStatus(resident.checkin_date, resident.checkout_date, today, monthStart, monthEnd),
            roomSpan: idx === 0 ? room.residents.length : 0,
          })
        })
      }
      roomGroups.push(group)
    }

    // Summary stats
    const allResidents = dorm.rooms.flatMap(r => r.residents)
    const currentCount = allResidents.filter(r => isResiding(r.checkin_date, r.checkout_date, today)).length
    const movingOutCount = allResidents.filter(r => {
      if (!r.checkout_date) return false
      const co = new Date(r.checkout_date)
      return co >= monthStart && co <= monthEnd
    }).length
    const movingInCount = allResidents.filter(r => {
      const ci = new Date(r.checkin_date)
      return ci >= monthStart && ci <= monthEnd
    }).length
    const vacantRoomNames = dorm.rooms
      .filter(r => !r.residents.some(res => isResiding(res.checkin_date, res.checkout_date, today)))
      .map(r => r.room_name)

    function cellBg(resident: CalendarResident, d: number, roomId: string): React.CSSProperties {
      const targetDay = new Date(year, month - 1, d)
      if (overlapKeys.has(`${roomId}-${d}`)) return { background: '#fca5a5' }
      if (!isResiding(resident.checkin_date, resident.checkout_date, targetDay)) return {}
      return { background: '#FAC775' }
    }

    function renderInfoCells(row: RowItem) {
      const cells: React.ReactNode[] = []
      for (const col of selectedCols) {
        const isRoomCol = ['room', 'roomType', 'ac', 'fee'].includes(col.key)
        if (isRoomCol && row.roomSpan === 0) continue

        let content: React.ReactNode = ''
        if (row.kind === 'empty') {
          if (col.key === 'room') content = row.room.room_name
          else if (col.key === 'name') content = '—'
          else if (col.key === 'status') content = '空室'
          else if (col.key === 'roomType') content = roomTypeMap[row.room.room_type ?? ''] ?? ''
          else if (col.key === 'ac') content = row.room.equipment?.ac ? '○' : '×'
          else if (col.key === 'fee') content = formatCurrency(row.room.effective_daily_rate ?? 0)
          else content = ''
        } else {
          const { resident, room } = row
          switch (col.key) {
            case 'room': content = room.room_name; break
            case 'name': content = resident.name; break
            case 'affiliation': content = resident.affiliation; break
            case 'checkin': content = resident.checkin_date; break
            case 'checkout': content = resident.checkout_date ?? '—'; break
            case 'status': content = STATUS_LABELS[row.status]; break
            case 'roomType': content = roomTypeMap[room.room_type ?? ''] ?? ''; break
            case 'ac': content = room.equipment?.ac ? '○' : '×'; break
            case 'fee': content = formatCurrency(room.effective_daily_rate ?? 0); break
            case 'responsible': content = resident.is_responsible ? '★' : ''; break
          }
        }

        const span = isRoomCol ? row.roomSpan : undefined
        cells.push(
          <td key={col.key} rowSpan={span && span > 0 ? span : undefined}
              className="border border-gray-300 px-1">
            {content}
          </td>
        )
      }
      return cells
    }

    return (
      <section key={dorm.dorm_id} className="dorm-page">
        <table className="w-full max-w-full table-fixed border-collapse">
          <colgroup>
            {selectedCols.map(c => (
              <col key={c.key} style={{ width: colPct(COL_WEIGHTS[c.key] ?? 14) }} />
            ))}
            {dayCols.map(d => (
              <col key={`d${d}`} style={{ width: dayPct }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th colSpan={totalColCount} className="dorm-header text-left py-1 px-2 border border-gray-300 bg-gray-100 font-bold">
                {dorm.name} — {regionLabel} / {dorm.address} — {year}年{month}月
              </th>
            </tr>
            <tr>
              {selectedCols.map(c => (
                <th key={c.key} className="border border-gray-300 bg-gray-50 px-1 text-center font-semibold">
                  {c.label}
                </th>
              ))}
              {dayCols.map(d => (
                <th key={d} className={`day-col border border-gray-300 bg-gray-50 px-0 text-center ${dayHeaderClass(d)}`}>
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          {roomGroups.map((group, gi) => (
            <tbody key={gi} className="break-inside-avoid">
              {group.map((row, ri) => (
                <tr key={ri}>
                  {renderInfoCells(row)}
                  {dayCols.map(d => {
                    if (row.kind === 'empty') {
                      return <td key={d} className="border border-gray-300" />
                    }
                    return (
                      <td key={d} className="border border-gray-300"
                          style={cellBg(row.resident, d, row.room.room_id)} />
                    )
                  })}
                </tr>
              ))}
            </tbody>
          ))}
          <tfoot>
            <tr>
              <td colSpan={totalColCount} className="border border-gray-300 px-2 py-1 text-xs text-gray-600 bg-gray-50">
                現在{currentCount}名在籍 / 今月退寮{movingOutCount}名 / 今月入寮{movingInCount}名
                {vacantRoomNames.length > 0 && ` / 空室: ${vacantRoomNames.join(', ')}`}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>
    )
  }

  // createPortal で document.body 直下にレンダリング
  // MainLayout の print:hidden / h-screen overflow-hidden の制約外に脱出させる
  return createPortal(
    <>
      {/* afterprint fallback: screen-only exit button */}
      <button
        onClick={onClose}
        className="fixed top-4 right-4 z-50 print:hidden flex items-center gap-1.5 bg-white border border-gray-300 rounded-lg shadow-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <X className="h-4 w-4" />
        印刷モードを終了
      </button>

      <div className="print-calendar" data-paper={config.paperSize}>
        <style>{`
          @page {
            size: ${config.paperSize === 'a4' ? 'A4' : 'A3'} landscape;
            margin: 10mm;
          }
        `}</style>
        {dorms.map(dorm => renderDorm(dorm))}
      </div>
    </>,
    document.body
  )
}
