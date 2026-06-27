import { createContext, useContext, useEffect, useState } from 'react'
import http from '@/lib/axios'

interface AuthUser {
  user_id: string
  email: string
  role: string
}

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setIsLoading(false)
      return
    }
    http
      .get<AuthUser>('/auth/me')
      .then((data) => setUser(data as unknown as AuthUser))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setIsLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const data = await http.post<{ access_token: string }>('/auth/login', {
      email,
      password,
    })
    const token = (data as unknown as { access_token: string }).access_token
    localStorage.setItem('token', token)
    const me = await http.get<AuthUser>('/auth/me')
    setUser(me as unknown as AuthUser)
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
