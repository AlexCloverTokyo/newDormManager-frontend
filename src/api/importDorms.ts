import http from '@/lib/axios'

// ─── Preview 型 ───────────────────────────────────────────────
export interface DormImportRow {
  dorm_name: string
  is_new_dorm: boolean
  address: string | null
  floor_plan: string | null
  gender_type: string | null
  location: string | null
  note: string | null
  room_name: string
  room_type: string | null
  area_sqm: number | null
  unit_price: number | null
  daily_rate: number
  equipment: Record<string, boolean>
  warnings: string[]
}

export interface DormImportInvalidRow {
  row_number: number
  dorm_name: string | null
  room_name: string | null
  errors: string[]
}

export interface DormImportSummary {
  new_dorms: number
  existing_dorms: number
  total_rooms: number
  skip_rooms: number
}

export interface DormImportPreviewResponse {
  valid_rows: DormImportRow[]
  invalid_rows: DormImportInvalidRow[]
  summary: DormImportSummary
}

export interface DormImportExecuteResponse {
  created_dorms: number
  added_rooms: number
  skipped_rooms: number
}

// ─── API 関数 ─────────────────────────────────────────────────
export const getDormImportTemplate = (config?: { skipErrorToast?: boolean }): Promise<Blob> =>
  http.get('/import/dorms-rooms/template', { responseType: 'blob', ...config })

export const previewDormImport = (file: File, config?: { skipErrorToast?: boolean }): Promise<DormImportPreviewResponse> => {
  const formData = new FormData()
  formData.append('file', file)
  return http.post('/import/dorms-rooms/preview', formData, config)
}

export const executeDormImport = (
  rows: DormImportRow[],
  config?: { skipErrorToast?: boolean },
): Promise<DormImportExecuteResponse> =>
  http.post('/import/dorms-rooms/execute', { rows }, config)
