export interface PageResponse<T> {
  items: T[]
  total: number
  page: number
  per_page: number
}

export interface ApiError {
  detail: string
  code: string
}
