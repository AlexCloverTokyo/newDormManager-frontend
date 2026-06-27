import http from '@/lib/axios'

export interface OperationLog {
  log_id: string
  user_email: string | null
  action: string
  target_type: string
  target_id: string | null
  detail: string | null
  created_at: string
}

export interface OperationLogPage {
  items: OperationLog[]
  total: number
  page: number
  size: number
}

export const getOperationLogs = (params?: {
  page?: number
  size?: number
  action?: string
  target_type?: string
  user_email?: string
}): Promise<OperationLogPage> => http.get('/operation-logs', { params })
