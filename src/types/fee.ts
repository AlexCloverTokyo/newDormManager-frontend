export type FeeStatus = 'draft' | 'confirmed'

export interface DormFee {
  fee_id: string
  employee_id: string
  stay_id: string
  employee_name: string
  target_month: string
  room_name: string
  dorm_name: string
  amount: number
  basis_unit_price: number
  basis_area_sqm: number
  basis_days: number
  adjustment_amount: number
  adjustment_note: string | null
  status: FeeStatus
  calculated_amount: number
  final_amount: number
  version: number
}

export interface FeeGroup {
  key: string
  employee_id: string
  employee_name: string
  target_month: string
  items: DormFee[]
  total_final_amount: number
  group_status: FeeStatus
  is_multi: boolean
}
