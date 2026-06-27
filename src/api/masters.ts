import http from '@/lib/axios'
import type { MasterItem, MasterItemCreate, MasterItemUpdate, MastersMap } from '@/types/master'

export const getMasters = (): Promise<MastersMap> => http.get('/masters')

export const getMastersByCategory = (category: string): Promise<MasterItem[]> =>
  http.get(`/masters/${category}`)

export const addMasterItem = (
  category: string,
  data: MasterItemCreate
): Promise<MasterItem> => http.post(`/masters/${category}`, data)

export const updateMasterItem = (
  category: string,
  code: string,
  data: MasterItemUpdate
): Promise<MasterItem> => http.patch(`/masters/${category}/${code}`, data)

export const deleteMasterItem = (
  category: string,
  code: string,
  version: number
): Promise<MasterItem> => http.delete(`/masters/${category}/${code}`, { params: { version } })
