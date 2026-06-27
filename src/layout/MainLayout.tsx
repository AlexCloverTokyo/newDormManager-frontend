import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Toaster } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'

const ROUTE_TITLES: Record<string, string> = {
  '/': '寮割カレンダー',
  '/dashboard': 'ダッシュボード',
  '/analytics': 'データ分析',
  '/dorms': '寮管理',
  '/employees': '社員管理',
  '/stays': '入居履歴',
  '/stays/new': '入居登録',
  '/fees': '寮費管理',
  '/alerts': 'アラート一覧',
  '/import': 'Excel インポート',
  '/admin/users': 'ユーザー管理',
  '/admin/settings': 'システム設定',
  '/admin/masters': 'マスタ値管理',
  '/admin/logs': '操作履歴',
}

function getPageTitle(pathname: string): string {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname]
  if (/^\/dorms\/[^/]+\/rooms\/[^/]+$/.test(pathname)) return '部屋詳細'
  if (/^\/dorms\/[^/]+$/.test(pathname)) return '寮詳細'
  if (/^\/stays\/[^/]+$/.test(pathname)) return '入居詳細'
  return ''
}

export function MainLayout() {
  const { user } = useAuth()
  const { pathname } = useLocation()

  return (
    <div className="flex h-screen overflow-hidden bg-gray-200 print:hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b bg-white px-6 shadow-sm">
          <span className="text-sm font-medium text-gray-700">{getPageTitle(pathname)}</span>
          <span className="text-sm text-muted-foreground">{user?.email ?? ''}</span>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      <Toaster richColors position="top-right" />
    </div>
  )
}
