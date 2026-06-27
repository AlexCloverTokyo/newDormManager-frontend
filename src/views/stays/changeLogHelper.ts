import type { StayChangeLog } from '@/api/stays'

const FIELD_LABELS: Record<string, string> = {
  move_in_date: '入居日',
  move_out_date: '退寮日',
  move_out_reason: '退寮理由',
  room_name: '部屋',
  dorm_name: '寮',
  employee_name: '社員名',
  is_responsible: '責任者',
}

const ACTION_LABELS: Record<string, string> = {
  move_in: '入居登録',
  move_out: '退寮処理',
  transfer: '部屋変更',
}

const DISPLAY_FIELDS = [
  'move_in_date', 'move_out_date', 'move_out_reason',
  'dorm_name', 'room_name', 'employee_name', 'is_responsible',
]

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'はい' : 'いいえ'
  return String(value)
}

export function formatChangeLogAction(action: string): string {
  return ACTION_LABELS[action] ?? action
}

export interface ChangeLogDiffEntry {
  label: string
  oldValue: string
  newValue: string
}

export function formatChangeLogDiff(log: StayChangeLog): ChangeLogDiffEntry[] {
  const { action, before_data, after_data } = log

  if (action === 'move_in' || !before_data) {
    return DISPLAY_FIELDS
      .filter((key) => after_data[key] !== null && after_data[key] !== undefined)
      .map((key) => ({
        label: FIELD_LABELS[key] ?? key,
        oldValue: '',
        newValue: formatValue(after_data[key]),
      }))
  }

  const entries: ChangeLogDiffEntry[] = []
  for (const key of DISPLAY_FIELDS) {
    const oldVal = before_data[key]
    const newVal = after_data[key]
    if (formatValue(oldVal) !== formatValue(newVal)) {
      entries.push({
        label: FIELD_LABELS[key] ?? key,
        oldValue: formatValue(oldVal),
        newValue: formatValue(newVal),
      })
    }
  }

  if (action === 'transfer' && after_data.new_stay_id) {
    const dormName = after_data.new_dorm_name ?? ''
    const roomName = after_data.new_room_name ?? ''
    entries.push({
      label: '転居先',
      oldValue: '',
      newValue: `${dormName} ${roomName}`,
    })
  }

  return entries
}

export function getNewStayId(log: StayChangeLog): string | null {
  if (log.action === 'transfer' && log.after_data?.new_stay_id) {
    return String(log.after_data.new_stay_id)
  }
  return null
}
