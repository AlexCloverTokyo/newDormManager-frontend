import http from '@/lib/axios'

export interface AlertRoom {
  room_id: string
  room_name: string
  dorm_name: string
  dorm_id: string
  status: string
  employee_name: string
  employee_id: string
  stay_id: string
  move_out_date: string | null
  days_remaining: number | null
}

export interface VacantByDorm {
  dorm_id: string
  dorm_name: string
  gender_type: string
  location: string
  vacant_count: number
  total_rooms: number
}

export interface DormSummary {
  total_dorms: number
  total_rooms: number
  vacant_count: number
  occupied_count: number
  reserved_count: number
  leaving_soon_count: number
  overdue_count: number
  alert_rooms: AlertRoom[]
  vacant_by_dorm: VacantByDorm[]
}

export const getSummary = (): Promise<DormSummary> => http.get('/summary')
