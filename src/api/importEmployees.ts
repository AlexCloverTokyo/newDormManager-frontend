import http from '@/lib/axios'

// ─── Preview 型 ───────────────────────────────────────────────
export interface EmployeeImportRow {
  employee_code: string
  employee_id: string | null
  is_new_employee: boolean
  name: string
  gender_type: string
  employee_type: string
  department: string | null
  room_id: string
  dorm_name: string
  room_name: string
  move_in_date: string
  move_out_date: string | null
  move_out_reason: string | null
  is_responsible: boolean
  warnings: string[]
}

export interface EmployeeImportInvalidRow {
  row_number: number
  employee_code: string | null
  errors: string[]
}

export interface EmployeeImportSummary {
  new_employees: number
  existing_employees: number
  total_stays: number
  invalid_rows: number
}

export interface EmployeeImportPreviewResponse {
  valid_rows: EmployeeImportRow[]
  invalid_rows: EmployeeImportInvalidRow[]
  summary: EmployeeImportSummary
}

export interface EmployeeImportExecuteResponse {
  imported_employees: number
  skipped_employees: number
  added_stays: number
  skipped_stays: number
}

// ─── API 関数 ─────────────────────────────────────────────────
export const getEmployeeImportTemplate = (config?: { skipErrorToast?: boolean }): Promise<Blob> =>
  http.get('/import/employees/template', { responseType: 'blob', ...config })

export const previewEmployeeImport = (file: File, config?: { skipErrorToast?: boolean }): Promise<EmployeeImportPreviewResponse> => {
  const formData = new FormData()
  formData.append('file', file)
  return http.post('/import/employees/preview', formData, config)
}

export const executeEmployeeImport = (
  rows: EmployeeImportRow[],
  config?: { skipErrorToast?: boolean },
): Promise<EmployeeImportExecuteResponse> =>
  http.post('/import/employees/execute', { rows }, config)
