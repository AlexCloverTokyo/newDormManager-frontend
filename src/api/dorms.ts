import http from '@/lib/axios'
import type { Dorm, DormListParams, DormPayload, Room } from '@/types/dorm'
import type { PageResponse } from '@/types/common'

function wrap<T>(items: T[]): PageResponse<T> {
  return { items, total: items.length, page: 1, per_page: items.length }
}

export const getDormList = async (params?: DormListParams): Promise<PageResponse<Dorm>> => {
  const data = await http.get<Dorm[]>('/dorms', { params })
  return wrap(data as unknown as Dorm[])
}

export const getDorm = (id: string): Promise<Dorm> => http.get(`/dorms/${id}`)

export const getDormRooms = async (dormId: string): Promise<Room[]> => {
  const data = await http.get<Room[]>(`/dorms/${dormId}/rooms`)
  return data as unknown as Room[]
}

export const createDorm = (data: DormPayload): Promise<Dorm> =>
  http.post('/dorms', data)

export const updateDorm = (id: string, data: Partial<DormPayload>): Promise<Dorm> =>
  http.put(`/dorms/${id}`, data)

export const deleteDorm = (id: string, version: number): Promise<Dorm> =>
  http.delete(`/dorms/${id}`, { params: { version } })
