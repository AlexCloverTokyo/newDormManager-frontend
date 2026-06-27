import {
  AlertTriangle,
  Banknote,
  BarChart2,
  Building2,
  CalendarDays,
  Database,
  DoorOpen,
  Home,
  Users,
  FileSpreadsheet,
  ClipboardList,
  ScrollText,
  Settings,
  UserCog,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
  adminOnly?: boolean
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'ダッシュボード',
    items: [
      { label: '寮割カレンダー', path: '/', icon: <CalendarDays className="h-4 w-4" /> },
      { label: 'ダッシュボード', path: '/dashboard', icon: <Home className="h-4 w-4" /> },
      { label: 'データ分析', path: '/analytics', icon: <BarChart2 className="h-4 w-4" /> },
    ],
  },
  {
    label: 'マスタ管理',
    items: [
      { label: '寮管理', path: '/dorms', icon: <Building2 className="h-4 w-4" /> },
{ label: '社員管理', path: '/employees', icon: <Users className="h-4 w-4" /> },
    ],
  },
  {
    label: '入退寮管理',
    items: [
      { label: '入居登録', path: '/stays/new', icon: <DoorOpen className="h-4 w-4" /> },
      { label: '入居履歴', path: '/stays', icon: <ClipboardList className="h-4 w-4" /> },
    ],
  },
  {
    label: '月次業務',
    items: [{ label: '寮費管理', path: '/fees', icon: <Banknote className="h-4 w-4" /> }],
  },
  {
    label: 'アラート',
    items: [{ label: 'アラート一覧', path: '/alerts', icon: <AlertTriangle className="h-4 w-4" /> }],
  },
  {
    label: '管理者',
    items: [
      { label: 'Excel インポート', path: '/import', icon: <FileSpreadsheet className="h-4 w-4" />, adminOnly: true },
      { label: 'マスタ値管理', path: '/admin/masters', icon: <Database className="h-4 w-4" />, adminOnly: true },
      { label: 'ユーザー管理', path: '/admin/users', icon: <UserCog className="h-4 w-4" />, adminOnly: true },
      { label: '操作履歴', path: '/admin/logs', icon: <ScrollText className="h-4 w-4" />, adminOnly: true },
      { label: 'システム設定', path: '/admin/settings', icon: <Settings className="h-4 w-4" />, adminOnly: true },
    ],
  },
]

export function Sidebar() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  return (
    <aside className="flex h-full w-56 flex-col bg-slate-900 text-slate-100">
      <div className="flex h-14 items-center px-4 border-b border-slate-700">
        <span className="text-sm font-semibold text-white">寮管理システム</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((item) => !item.adminOnly || isAdmin)
          if (visibleItems.length === 0) return null
          return (
            <div key={group.label} className="mb-4">
              <div className="px-4 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {group.label}
              </div>
              {visibleItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 py-2 text-sm transition-colors border-l-[3px] pl-[13px] pr-4',
                      isActive
                        ? 'bg-slate-700/70 text-white border-blue-400'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white border-transparent',
                    )
                  }
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
