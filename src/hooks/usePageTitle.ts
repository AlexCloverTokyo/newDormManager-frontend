import { useEffect } from 'react'

const SUFFIX = '寮管理システム'

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} — ${SUFFIX}` : SUFFIX
  }, [title])
}
