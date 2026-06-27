import type { CalendarRoom } from '@/types/calendar'

export function getTodayJST(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
}

export function isResiding(checkinDate: string, checkoutDate: string | null, targetDay: Date): boolean {
  const checkin = new Date(checkinDate)
  const checkout = checkoutDate ? new Date(checkoutDate) : new Date('9999-12-31')
  return checkin <= targetDay && checkout >= targetDay
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export type BadgeStatus = 'left_this_month' | 'arriving' | 'leaving_soon' | 'active' | 'vacant'

export function getBadgeStatus(
  checkinDate: string, checkoutDate: string | null,
  today: Date, monthStart: Date, monthEnd: Date,
): BadgeStatus {
  const checkin = new Date(checkinDate)
  const checkout = checkoutDate ? new Date(checkoutDate) : null
  if (checkout && checkout >= monthStart && checkout <= monthEnd && checkout < today) return 'left_this_month'
  if (checkin > today && checkin >= monthStart && checkin <= monthEnd) return 'arriving'
  if (checkout && checkout >= monthStart && checkout <= monthEnd && checkout >= today) return 'leaving_soon'
  return 'active'
}

export function detectOverlapKeys(rooms: CalendarRoom[], year: number, month: number): Set<string> {
  const keys = new Set<string>()
  const days = daysInMonth(year, month)
  for (const room of rooms) {
    for (let d = 1; d <= days; d++) {
      const targetDay = new Date(year, month - 1, d)
      const count = room.residents.filter(r => isResiding(r.checkin_date, r.checkout_date, targetDay)).length
      if (count >= 2) keys.add(`${room.room_id}-${d}`)
    }
  }
  return keys
}
