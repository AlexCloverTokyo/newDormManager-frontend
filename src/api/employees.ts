import http from '@/lib/axios'
import type { Employee, EmployeeListParams } from '@/types/employee'
import type { PageResponse } from '@/types/common'

export interface EmployeeListPageParams extends EmployeeListParams {
  page?: number
  page_size?: number
}

export const getEmployeeList = async (params?: EmployeeListPageParams): Promise<PageResponse<Employee>> => {
  const raw = await http.get<unknown>('/employees', {
    params: {
      q: params?.q,
      department: params?.department,
      employee_type: params?.employee_type,
    },
  })
  let items = raw as unknown as Employee[]

  // living_status is not supported by backend — filter client-side
  if (params?.living_status === 'in_dorm') {
    items = items.filter((e) => e.is_living_in_dorm)
  } else if (params?.living_status === 'not_in_dorm') {
    items = items.filter((e) => !e.is_living_in_dorm)
  }

  const page = params?.page ?? 1
  const pageSize = params?.page_size ?? 20
  const total = items.length
  const start = (page - 1) * pageSize
  const pagedItems = items.slice(start, start + pageSize)

  return { items: pagedItems, total, page, per_page: pageSize }
}

export const getEmployee = (id: string): Promise<Employee> =>
  http.get(`/employees/${id}`)

export interface EmployeePayload {
  employee_code: string
  name: string
  employee_type: string
  gender_type: string
  department?: string
  first_use_date?: string
  version?: number
}

export const createEmployee = (data: EmployeePayload): Promise<Employee> =>
  http.post('/employees', data)

export const updateEmployee = (id: string, data: Partial<EmployeePayload>): Promise<Employee> =>
  http.put(`/employees/${id}`, data)

export const deleteEmployee = (id: string, version: number): Promise<void> =>
  http.delete(`/employees/${id}`, { params: { version } })
