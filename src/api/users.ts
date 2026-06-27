import http from '@/lib/axios'
import type { AppUser, UserRole } from '@/types/user'
import type { PageResponse } from '@/types/common'

export const getUserList = async (): Promise<PageResponse<AppUser>> => {
  const raw = await http.get<unknown>('/users')
  const items = raw as unknown as AppUser[]
  return { items, total: items.length, page: 1, per_page: items.length }
}

export const inviteUser = (data: {
  email: string
  role: UserRole
}): Promise<AppUser> => http.post('/auth/invite', data)

export const changeUserRole = (user_id: string, role: UserRole, version: number): Promise<AppUser> =>
  http.patch(`/users/${user_id}/role`, { role, version })

export const toggleUserStatus = (user_id: string, version: number): Promise<AppUser> =>
  http.patch(`/users/${user_id}/toggle-status`, null, { params: { version } })
