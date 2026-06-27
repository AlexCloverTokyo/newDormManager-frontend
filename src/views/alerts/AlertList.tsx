import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Clock, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getDormList } from '@/api/dorms'
import { getSummary } from '@/api/summary'
import type { AlertRoom } from '@/api/summary'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDate } from '@/lib/utils'

type FilterStatus = 'all' | 'overdue' | 'leaving_soon'

function DaysCell({ days }: { days: number | null }) {
  if (days === null) return <span className="text-gray-400">—</span>
  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-xs font-semibold text-red-600 ring-1 ring-inset ring-red-200">
        <AlertTriangle className="h-3 w-3" />
        {Math.abs(days)}日超過
      </span>
    )
  }
  if (days <= 7) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-xs font-semibold text-red-500 ring-1 ring-inset ring-red-200">
        {days}日後
      </span>
    )
  }
  if (days <= 30) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-xs font-semibold text-amber-600 ring-1 ring-inset ring-amber-200">
        {days}日後
      </span>
    )
  }
  return (
    <span className="text-xs text-gray-500">{days}日後</span>
  )
}

export default function AlertList() {
  usePageTitle('アラート一覧')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterDorm, setFilterDorm] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['summary'],
    queryFn: getSummary,
  })

  const { data: dormData } = useQuery({
    queryKey: ['dorms'],
    queryFn: () => getDormList(),
  })

  const allAlerts: AlertRoom[] = data?.alert_rooms ?? []

  let alerts = allAlerts
  if (filterStatus !== 'all') alerts = alerts.filter((a) => a.status === filterStatus)
  if (filterDorm) alerts = alerts.filter((a) => a.dorm_id === filterDorm)

  const overdueCount = allAlerts.filter((a) => a.status === 'overdue').length
  const leavingSoonCount = allAlerts.filter((a) => a.status === 'leaving_soon').length

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold text-gray-900">アラート一覧</h1>

      {/* サマリーバッジ */}
      <div className="flex items-center gap-3">
        {overdueCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-700 ring-1 ring-inset ring-red-200">
            <AlertTriangle className="h-3.5 w-3.5" />
            超過滞在 {overdueCount} 件
          </span>
        )}
        {leavingSoonCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
            <Clock className="h-3.5 w-3.5" />
            退寮予定 {leavingSoonCount} 件
          </span>
        )}
        {allAlerts.length === 0 && !isLoading && (
          <span className="text-sm text-gray-500">現在アラートはありません</span>
        )}
      </div>

      {/* 検索フォーム */}
      <div className="rounded-lg border border-gray-300 bg-white shadow-sm px-6 py-4">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">種別</label>
            <Select
              value={filterStatus}
              onValueChange={(v) => setFilterStatus(v as FilterStatus)}
            >
              <SelectTrigger className="h-8 w-36 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全て</SelectItem>
                <SelectItem value="overdue">超過滞在</SelectItem>
                <SelectItem value="leaving_soon">退寮予定</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">寮</label>
            <Select value={filterDorm || 'all'} onValueChange={(v) => setFilterDorm(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-8 w-40 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全て</SelectItem>
                {dormData?.items.map((d) => (
                  <SelectItem key={d.dorm_id} value={d.dorm_id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {(filterStatus !== 'all' || filterDorm !== '') && (
              <Button variant="outline" size="sm" onClick={() => { setFilterStatus('all'); setFilterDorm('') }} className="h-8 px-4 border-gray-300 text-gray-600 hover:border-gray-400">
                リセット
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="h-8 gap-1.5 border-gray-300 text-gray-600"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              更新
            </Button>
          </div>
        </div>
      </div>

      {/* テーブルカード */}
      <div className="rounded-lg border border-gray-300 bg-white shadow-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-100">
          <span className="text-sm font-semibold text-gray-800">
            アラート
            <span className="ml-2 text-xs font-normal text-gray-400">{alerts.length} 件</span>
          </span>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <AlertTriangle className="mx-auto h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">該当するアラートはありません</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50/80">
              <tr>
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  寮名
                </th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  部屋名
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
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  種別
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {alerts.map((alert) => (
                <tr
                  key={alert.room_id}
                  className={`hover:bg-gray-50 transition-colors ${alert.status === 'overdue' ? 'bg-red-50/30' : ''}`}
                >
                  <td className="px-5 py-3 text-sm text-gray-700">{alert.dorm_name}</td>
                  <td className="px-5 py-3 text-sm">
                    <Link
                      to={`/dorms/${alert.dorm_id}/rooms/${alert.room_id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {alert.room_name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-800">{alert.employee_name}</td>
                  <td className="px-5 py-3 text-sm tabular-nums text-gray-600">
                    {formatDate(alert.move_out_date)}
                  </td>
                  <td className="px-5 py-3">
                    <DaysCell days={alert.days_remaining} />
                  </td>
                  <td className="px-5 py-3">
                    {alert.status === 'overdue' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        <AlertTriangle className="h-3 w-3" /> 超過滞在
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        <Clock className="h-3 w-3" /> 退寮予定
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
