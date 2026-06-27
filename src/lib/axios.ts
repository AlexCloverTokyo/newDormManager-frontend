import axios from 'axios'
import { toast } from 'sonner'

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  timeout: 10000,
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

http.interceptors.response.use(
  (res) => {
    if (res.data && typeof res.data === 'object' && 'data' in res.data) {
      return res.data.data
    }
    return res.data
  },
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
      return Promise.reject(err)
    }
    const skipToast = (err.config as Record<string, unknown>)?.skipErrorToast
    if (!skipToast) {
      const rawDetail = err.response?.data?.detail
      const detailMsg = Array.isArray(rawDetail)
        ? rawDetail
            .map((e: { loc: string[]; msg: string }) => `${e.loc[e.loc.length - 1]}: ${e.msg}`)
            .join('\n')
        : rawDetail
      const message = err.response?.data?.msg ?? detailMsg ?? 'リクエストに失敗しました'
      toast.error(message)
    }
    return Promise.reject(err)
  },
)

export default http
