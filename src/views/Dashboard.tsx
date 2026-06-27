import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Building2, ClipboardList, Clock, DoorOpen, Home, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getSummary } from '@/api/summary'
import type { AlertRoom } from '@/api/summary'
import { getStayList } from '@/api/stays'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'

function StatTile({
  label,
  value,
  icon,
  accent,
  alert,
}: {
  label: string
  value: number
  icon: React.ReactNode
  accent: string
  alert?: boolean
}) {
  const isAlert = alert && value > 0
  return (
    <div
      className={`rounded-lg overflow-hidden border shadow-sm ${isAlert ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}
    >
      <div className={`h-1 ${accent}`} />
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500">{label}</span>
          <span className={`opacity-60 ${isAlert ? 'text-red-500' : 'text-gray-400'}`}>{icon}</span>
        </div>
        <div
          className={`text-3xl font-bold tabular-nums ${isAlert ? 'text-red-600' : 'text-gray-900'}`}
        >
          {value}
        </div>
      </div>
    </div>
  )
}

function DaysChip({ days }: { days: number | null }) {
  if (days === null) return <span className="text-gray-400">—</span>
  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
        <AlertTriangle className="h-3 w-3" />
        {Math.abs(days)}日超過
      </span>
    )
  }
  if (days <= 7) {
    return (
      <span className="text-xs font-semibold text-red-500">{days}日後</span>
    )
  }
  if (days <= 30) {
    return (
      <span className="text-xs font-semibold text-amber-600">{days}日後</span>
    )
  }
  return <span className="text-xs text-gray-500">{days}日後</span>
}

function AlertTable({ rows }: { rows: AlertRoom[] }) {
  if (rows.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-gray-400">
        アラート対象の部屋はありません
      </div>
    )
  }
  return (
    <table className="w-full">
      <thead className="border-b border-gray-200 bg-gray-50/80">
        <tr>
          <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
            寮 / 部屋
          </th>
          <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
            入居者
          </th>
          <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
            退寮予定日
          </th>
          <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
            残日数
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {rows.map((row) => (
          <tr key={row.room_id} className="hover:bg-gray-50 transition-colors">
            <td className="px-5 py-3 text-sm">
              <Link
                to={`/dorms/${row.dorm_id}/rooms/${row.room_id}`}
                className="font-medium text-blue-600 hover:underline"
              >
                {row.dorm_name} / {row.room_name}
              </Link>
            </td>
            <td className="px-5 py-3 text-sm text-gray-700">{row.employee_name}</td>
            <td className="px-5 py-3 text-sm text-gray-600 tabular-nums">
              {formatDate(row.move_out_date)}
            </td>
            <td className="px-5 py-3">
              <DaysChip days={row.days_remaining} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function Dashboard() {
  usePageTitle('ダッシュボード')
  const { data, isLoading } = useQuery({
    queryKey: ['summary'],
    queryFn: getSummary,
  })

  const { data: staysData } = useQuery({
    queryKey: ['stays', { limit: 'dashboard' }],
    queryFn: () => getStayList({ page_size: 5 }),
    staleTime: 60_000,
  })

  const recentStays = (staysData?.items ?? [])
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="col-span-2 h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  const stats = data ?? {
    total_dorms: 0,
    total_rooms: 0,
    vacant_count: 0,
    occupied_count: 0,
    reserved_count: 0,
    leaving_soon_count: 0,
    overdue_count: 0,
    alert_rooms: [],
    vacant_by_dorm: [],
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>

      {/* 統計タイル */}
      <div className="grid grid-cols-6 gap-3">
        <StatTile
          label="寮数"
          value={stats.total_dorms}
          icon={<Building2 className="h-5 w-5" />}
          accent="bg-slate-400"
        />
        <StatTile
          label="総部屋数"
          value={stats.total_rooms}
          icon={<Home className="h-5 w-5" />}
          accent="bg-slate-400"
        />
        <StatTile
          label="空き室"
          value={stats.vacant_count}
          icon={<DoorOpen className="h-5 w-5" />}
          accent="bg-green-400"
        />
        <StatTile
          label="入居中"
          value={stats.occupied_count}
          icon={<Users className="h-5 w-5" />}
          accent="bg-blue-400"
        />
        <StatTile
          label="退寮予定"
          value={stats.leaving_soon_count}
          icon={<Clock className="h-5 w-5" />}
          accent="bg-amber-400"
          alert
        />
        <StatTile
          label="超過滞在"
          value={stats.overdue_count}
          icon={<AlertTriangle className="h-5 w-5" />}
          accent={stats.overdue_count > 0 ? 'bg-red-500' : 'bg-gray-300'}
          alert
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* アラート */}
        <Card className={`col-span-2 shadow-md ${stats.alert_rooms.length > 0 ? 'bg-amber-50/50 border-amber-300' : 'bg-white border-gray-300'}`}>
          <CardHeader className={`pb-3 border-b rounded-t-lg flex flex-row items-center justify-between ${stats.alert_rooms.length > 0 ? 'bg-amber-100/60 border-amber-200' : 'bg-gray-100 border-gray-200'}`}>
            <CardTitle className="text-sm flex items-center gap-1.5">
              <AlertTriangle className={`h-4 w-4 ${stats.alert_rooms.length > 0 ? 'text-amber-600' : 'text-amber-500'}`} />
              アラート（退寮予定 / 超過滞在）
              {stats.alert_rooms.length > 0 && (
                <Badge variant="warning" className="ml-1 text-xs">
                  {stats.alert_rooms.length} 件
                </Badge>
              )}
            </CardTitle>
            <Link to="/alerts" className="text-xs text-blue-600 hover:underline">
              すべて見る
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <AlertTable rows={stats.alert_rooms} />
          </CardContent>
        </Card>

        {/* 空き室状況 */}
        <Card className="bg-white border-gray-300 shadow-md">
          <CardHeader className="pb-3 bg-gray-100 border-b border-gray-200 rounded-t-lg">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <DoorOpen className="h-4 w-4" />
              寮別 空き室状況
            </CardTitle>
          </CardHeader>
          <CardContent className="py-3 space-y-3">
            {stats.vacant_by_dorm.map((d) => {
              const pct = d.total_rooms > 0 ? (d.vacant_count / d.total_rooms) * 100 : 0
              return (
                <div key={d.dorm_id}>
                  <div className="flex items-center justify-between mb-1">
                    <Link
                      to={`/dorms/${d.dorm_id}`}
                      className="text-sm font-medium text-blue-600 hover:underline truncate max-w-[130px]"
                    >
                      {d.dorm_name}
                    </Link>
                    <span className="text-sm tabular-nums text-gray-700 shrink-0 ml-2">
                      <span
                        className={`font-semibold ${d.vacant_count > 0 ? 'text-green-600' : 'text-gray-400'}`}
                      >
                        {d.vacant_count}
                      </span>
                      <span className="text-gray-400"> / {d.total_rooms}</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct > 0 ? 'bg-green-400' : 'bg-gray-200'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* 最近の入居履歴 */}
      <Card className="bg-white border-gray-300 shadow-md">
        <CardHeader className="pb-3 bg-gray-100 border-b border-gray-200 rounded-t-lg flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <ClipboardList className="h-4 w-4" />
            最近の入居履歴
          </CardTitle>
          <Link to="/stays" className="text-xs text-blue-600 hover:underline">
            すべて見る
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {recentStays.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">入居履歴がありません</div>
          ) : (
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50/80">
                <tr>
                  {['社員名', '寮・部屋', '入居日', '状態'].map((h) => (
                    <th key={h} className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentStays.map((stay) => (
                  <tr key={stay.stay_id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-gray-800">{stay.employee_name}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">
                      {stay.dorm_name} / {stay.room_name}
                    </td>
                    <td className="px-5 py-3 text-sm tabular-nums text-gray-500">
                      {formatDate(stay.move_in_date)}
                    </td>
                    <td className="px-5 py-3">
                      {!stay.move_out_date
                        ? <Badge variant="success">入居中</Badge>
                        : <Badge variant="gray">退寮済み</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
