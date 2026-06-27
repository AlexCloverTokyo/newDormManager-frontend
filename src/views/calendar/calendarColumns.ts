import type { CalendarRoom, CalendarResident } from '@/types/calendar'
import type { BadgeStatus } from './calendarHelpers'

export interface ColumnContext {
  roomTypeLabels: Record<string, string>
  divisionLabels: Record<string, string>
  stationLabels: Record<string, string>
}

export interface CalendarColumnDef {
  key: string
  label: string
  getValue: (row: { room: CalendarRoom; resident?: CalendarResident; status?: BadgeStatus }, ctx: ColumnContext) => string
  type: 'badge' | 'text' | 'date'
  defaultVisible: boolean
}

export const TOGGLEABLE_COLUMNS: CalendarColumnDef[] = [
  {
    key: 'roomDetail',
    label: '部屋詳細',
    getValue: ({ room }, ctx) => (room.room_type && ctx.roomTypeLabels[room.room_type]) || room.room_type || '—',
    type: 'text',
    defaultVisible: false,
  },
  {
    key: 'aircon',
    label: 'エアコン',
    getValue: ({ room }) => room.equipment?.ac ? 'あり' : 'なし',
    type: 'text',
    defaultVisible: false,
  },
  {
    key: 'fee',
    label: '寮費',
    getValue: ({ room }) => room.effective_daily_rate != null ? `${room.effective_daily_rate}円/日` : '—',
    type: 'text',
    defaultVisible: false,
  },
  {
    key: 'division',
    label: '事業部',
    getValue: ({ resident }, ctx) =>
      (resident?.division && ctx.divisionLabels[resident.division]) || resident?.division || '',
    type: 'text',
    defaultVisible: false,
  },
  {
    key: 'nearestStation',
    label: '最寄駅',
    getValue: ({ resident }, ctx) =>
      (resident?.nearest_station && ctx.stationLabels[resident.nearest_station]) || resident?.nearest_station || '',
    type: 'text',
    defaultVisible: false,
  },
  {
    key: 'firstCheckin',
    label: '初回入寮日',
    getValue: ({ resident }) => resident?.first_checkin_date ?? '—',
    type: 'date',
    defaultVisible: false,
  },
  {
    key: 'checkinDate',
    label: '入寮日',
    getValue: ({ resident }) => resident?.checkin_date ?? '',
    type: 'date',
    defaultVisible: true,
  },
  {
    key: 'checkoutDate',
    label: '退寮日',
    getValue: ({ resident }) => resident?.checkout_date ?? '—',
    type: 'date',
    defaultVisible: true,
  },
  {
    key: 'status',
    label: '状態',
    getValue: ({ status }) => status ?? '',
    type: 'badge',
    defaultVisible: true,
  },
]

const STORAGE_KEY = 'dormCalendar.visibleColumns'

export function getDefaultVisibleKeys(): string[] {
  return TOGGLEABLE_COLUMNS.filter(c => c.defaultVisible).map(c => c.key)
}

export function loadVisibleColumns(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as string[]
      const validKeys = new Set(TOGGLEABLE_COLUMNS.map(c => c.key))
      const filtered = parsed.filter(k => validKeys.has(k))
      if (filtered.length > 0) return filtered
    }
  } catch { /* ignore */ }
  return getDefaultVisibleKeys()
}

export function saveVisibleColumns(keys: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys))
}
