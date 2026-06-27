import http from '@/lib/axios'
import type { Employee } from '@/types/employee'

export interface OccupancyPoint {
  month: string
  occupancy_rate: number
  occupied: number
  total: number
}

export interface RevenuePoint {
  month: string
  revenue: number
}

export const getOccupancy = (): Promise<OccupancyPoint[]> =>
  http.get('/analytics/occupancy')

export const getFeeRevenue = (): Promise<RevenuePoint[]> =>
  http.get('/analytics/fee-revenue')

/** 社員全件取得（getEmployeeList はクライアント側でページネーションするため使用不可） */
export const getAllEmployeesRaw = (): Promise<Employee[]> =>
  http.get('/employees')
