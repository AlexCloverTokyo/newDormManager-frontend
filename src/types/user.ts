export type UserRole = 'admin' | 'staff'
export type UserStatus = 'active' | 'pending' | 'disabled'

export interface AppUser {
  user_id: string
  email: string
  name: string
  role: UserRole
  status: UserStatus
  created_at: string
  last_login_at: string | null
  version: number
}
