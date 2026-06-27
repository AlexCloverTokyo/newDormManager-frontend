import http from '@/lib/axios'
import type { DormFee } from '@/types/fee'
import type { PageResponse } from '@/types/common'

export interface FeeListParams {
  month?: string
  target_month?: string
  status?: string
  page?: number
  page_size?: number
}

export const getFeeList = async (params?: FeeListParams): Promise<PageResponse<DormFee>> => {
  const raw = await http.get<unknown>('/fees', {
    params: { target_month: params?.month || params?.target_month },
  })
  let items = raw as unknown as DormFee[]
  if (params?.status) {
    items = items.filter((f) => f.status === params.status)
  }
  const page = params?.page ?? 1
  const pageSize = params?.page_size ?? 20
  const total = items.length
  const start = (page - 1) * pageSize
  return { items: items.slice(start, start + pageSize), total, page, per_page: pageSize }
}

export const calculateFees = (
  target_month: string,
): Promise<{ created: number; skipped: number; target_month: string }> =>
  http.post('/fees/calculate', { target_month })

export const confirmFee = (fee_id: string, version: number): Promise<DormFee> =>
  http.put(`/fees/${fee_id}/confirm`, null, { params: { version } })

export const revertFee = (fee_id: string, version: number): Promise<DormFee> =>
  http.put(`/fees/${fee_id}/revert`, null, { params: { version } })

export const adjustFee = (
  fee_id: string,
  data: { adjustment_amount: number; adjustment_note?: string | null; version: number },
): Promise<DormFee> => http.patch(`/fees/${fee_id}/adjustment`, data)

export const confirmBulk = (target_month: string): Promise<{ confirmed: number }> =>
  http.post('/fees/confirm-bulk', { target_month })

export const updateFee = (
  fee_id: string,
  data: {
    status?: 'draft' | 'confirmed'
    adjustment_amount?: number
    adjustment_note?: string | null
    version: number
  },
): Promise<DormFee> => {
  if (data.status === 'confirmed') return confirmFee(fee_id, data.version)
  if (data.status === 'draft') return revertFee(fee_id, data.version)
  return adjustFee(fee_id, {
    adjustment_amount: data.adjustment_amount ?? 0,
    adjustment_note: data.adjustment_note,
    version: data.version,
  })
}

export const exportFeesCsv = async (params?: { target_month?: string }): Promise<void> => {
  const blob: Blob = await http.get('/fees/export', {
    params,
    responseType: 'blob',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `寮費_${params?.target_month ?? '全期間'}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
