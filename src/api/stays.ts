import http from '@/lib/axios'
import type { StayHistory } from '@/types/dorm'
import type { PageResponse } from '@/types/common'

export interface StayListParams {
  q?: string
  room_id?: string
  employee_id?: string
  status?: 'current' | 'past' | ''
  active_only?: boolean
  dorm_id?: string
  page?: number
  page_size?: number
}

export const getStayList = (params?: StayListParams): Promise<PageResponse<StayHistory>> =>
  http.get('/stays', { params })

export const getStay = (id: string): Promise<StayHistory> =>
  http.get(`/stays/${id}`)

export const createStay = (data: {
  employee_id: string
  room_id: string
  move_in_date: string
  move_out_date?: string
}): Promise<StayHistory> => http.post('/stays', data)

export const processLeave = (
  id: string,
  data: { move_out_date: string; move_out_reason?: string; version: number },
): Promise<StayHistory> =>
  http.put(`/stays/${id}/move-out`, {
    move_out_date: data.move_out_date,
    reason: data.move_out_reason,
    version: data.version,
  })

export const transfer = (
  id: string,
  data: { new_room_id: string; transfer_date: string; version: number },
): Promise<StayHistory> =>
  http.post(`/stays/${id}/transfer`, data)

export interface StayChangeLog {
  log_id: string
  stay_id: string
  action: 'move_in' | 'move_out' | 'transfer'
  before_data: Record<string, unknown> | null
  after_data: Record<string, unknown>
  operator_email: string | null
  changed_at: string
}

export const getStayChangeLogs = (stayId: string): Promise<StayChangeLog[]> =>
  http.get(`/stays/${stayId}/change-logs`)

export const exportStaysCsv = async (params?: { q?: string; status?: string }): Promise<void> => {
  const blob: Blob = await http.get('/stays/export', {
    params,
    responseType: 'blob',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '入居履歴.csv'
  a.click()
  URL.revokeObjectURL(url)
}
