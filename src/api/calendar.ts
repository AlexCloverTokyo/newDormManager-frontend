// frontend/src/api/calendar.ts
import http from '@/lib/axios'
import type { CalendarResponse } from '@/types/calendar'

export interface CalendarParams {
  month: string          // 'YYYY-MM'
  location?: string      // master_items.code, undefined = all
  division?: string
  nearest_station?: string
}

export const getCalendar = (params: CalendarParams): Promise<CalendarResponse> =>
  http.get('/calendar', { params })
