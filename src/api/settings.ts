import http from '@/lib/axios'

export interface SystemSettings {
  leaving_soon_threshold_days: number
  overdue_threshold_days: number
  allow_same_day_move_in_out: boolean
  same_day_fee_bearer: 'move_out' | 'move_in' | 'half'
  version: number
}

export const getSettings = (): Promise<SystemSettings> => http.get('/settings')

export const updateSettings = (data: Partial<SystemSettings>): Promise<SystemSettings> =>
  http.patch('/settings', data)
