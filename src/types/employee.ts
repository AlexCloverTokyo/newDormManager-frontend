export type GenderType = 'male' | 'female'
export type EmployeeType = 'japanese' | 'chinese'
export type LivingStatus = 'in_dorm' | 'not_in_dorm' | ''

export interface CurrentStay {
  stay_id: string
  room_id: string
  room_name: string
  dorm_name: string
  move_in_date: string
  move_out_date: string | null
}

export interface Employee {
  employee_id: string
  employee_code: string
  name: string
  gender_type: GenderType
  employee_type: EmployeeType
  department: string | null
  division?: string | null
  nearest_station?: string | null
  first_use_date: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
  is_living_in_dorm: boolean
  has_stay_history: boolean
  current_stay: CurrentStay | null
  version: number
}

export interface EmployeeListParams {
  q?: string
  department?: string
  living_status?: LivingStatus
  employee_type?: string
}
