import http from '@/lib/axios'
import type { Room, RoomPayload, StayHistory } from '@/types/dorm'
import type { PageResponse } from '@/types/common'

function wrap<T>(items: T[]): PageResponse<T> {
  return { items, total: items.length, page: 1, per_page: items.length }
}

export const getRoomList = async (params?: { dorm_id?: string }): Promise<PageResponse<Room>> => {
  const data = await http.get<Room[]>('/rooms', { params })
  return wrap(data as unknown as Room[])
}

export const getRoom = (id: string): Promise<Room> => http.get(`/rooms/${id}`)

export const getRoomStatus = async (id: string): Promise<{ status: Room['status'] }> => {
  const data = await http.get<PageResponse<StayHistory>>('/stays', {
    params: { room_id: id, active_only: true },
  }) as unknown as PageResponse<StayHistory>
  const status: Room['status'] = data.items.length > 0 ? 'occupied' : 'vacant'
  return { status }
}

export const getRoomStayHistory = (id: string): Promise<PageResponse<StayHistory>> =>
  http.get('/stays', { params: { room_id: id } })

export const createRoom = (data: RoomPayload): Promise<Room> =>
  http.post('/rooms', data)

export const updateRoom = (id: string, data: Partial<RoomPayload>): Promise<Room> =>
  http.put(`/rooms/${id}`, data)

export const deleteRoom = (id: string, version: number): Promise<Room> =>
  http.delete(`/rooms/${id}`, { params: { version } })
