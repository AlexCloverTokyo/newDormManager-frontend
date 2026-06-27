import { useQuery } from '@tanstack/react-query'
import { getMasters } from '@/api/masters'
import type { MasterItem } from '@/types/master'

export function useMasters() {
  return useQuery({
    queryKey: ['masters'],
    queryFn: getMasters,
    staleTime: 5 * 60 * 1000,
  })
}

export function useMasterItems(category: string): MasterItem[] {
  const { data } = useMasters()
  return data?.[category] ?? []
}
