export type GenderType = 'male' | 'female'
export type Location = 'tokyo' | 'osaka' | 'other'
export type RoomStatus = 'vacant' | 'reserved' | 'occupied' | 'leaving_soon' | 'overdue'
export type RoomType = 'western' | 'japanese' | 'small'

export interface Dorm {
  dorm_id: string
  name: string
  address: string
  floor_plan: string
  gender_type: GenderType | null
  location: Location
  note: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
  vacant_count?: number
  total_rooms?: number
  planned_room_count: number
  gender_locked?: boolean
  version: number
}

export interface DormListParams {
  gender_type?: string
  location?: string
  page?: number
  per_page?: number
}

export interface DormPayload {
  name: string
  address: string
  floor_plan: string
  gender_type: string | null
  location: string
  note?: string
  planned_room_count: number
  version?: number
}

export interface Room {
  room_id: string
  dorm_id: string
  dorm_name?: string
  room_name: string
  room_type: RoomType
  area_sqm: number
  unit_price: number
  equipment: Record<string, boolean>
  daily_rate?: number | null
  is_deleted: boolean
  created_at: string
  updated_at: string
  version: number
  status?: RoomStatus
  current_resident?: {
    stay_id: string
    employee_id: string
    employee_name: string
    move_in_date: string
    move_out_date: string | null
  } | null
  reserved_by?: {
    employee_name: string
    move_in_date: string
  } | null
}

export interface RoomPayload {
  dorm_id: string
  room_name: string
  room_type: string
  area_sqm: number
  unit_price: number
  equipment: Record<string, boolean>
  daily_rate?: number | null
  version?: number
}

export interface StayHistory {
  stay_id: string
  employee_id: string
  employee_name: string
  room_id: string
  room_name: string
  dorm_name: string
  move_in_date: string
  move_out_date: string | null
  move_out_reason: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
  version: number
}
