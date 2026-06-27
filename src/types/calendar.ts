// frontend/src/types/calendar.ts

export interface CalendarResident {
  stay_id: string
  name: string
  affiliation: string
  is_responsible: boolean
  checkin_date: string   // 'YYYY-MM-DD'
  checkout_date: string | null
  division?: string | null
  nearest_station?: string | null
  first_checkin_date?: string | null
}

export interface CalendarRoom {
  room_id: string
  room_name: string
  residents: CalendarResident[]
  room_type?: string
  equipment?: Record<string, boolean>
  effective_daily_rate?: number
}

export interface CalendarDorm {
  dorm_id: string
  name: string
  region: string    // master_items.code 例: 'tokyo'（フロントで label に変換）
  address: string
  rooms: CalendarRoom[]
}

export interface CalendarResponse {
  month: string        // 'YYYY-MM'
  dorms: CalendarDorm[]
}

export interface MoveInContext {
  dormId: string
  dormName: string
  roomId: string
  roomName: string
  moveInDate: string           // 'YYYY-MM-DD'
  nextOccupiedDate?: string    // 'YYYY-MM-DD'
}
