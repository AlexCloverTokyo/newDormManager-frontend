import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getOperationLogs } from '@/api/operationLogs'
import { Button } from '@/components/ui/button'
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Skeleton } from '@/components/ui/skeleton'

const PAGE_SIZE = 50

const ACTION_LABELS: Record<string, string> = {
  login: 'ログイン',
  move_in: '入居',
  move_out: '退寮',
  transfer: '換房',
  calculate: '寮費計算',
  bulk_confirm: '一括確定',
  import: 'インポート',
  update: '更新',
  create: '作成',
  delete: '削除',
}

const TARGET_LABELS: Record<string, string> = {
  auth: '認証',
  stay: '入居',
  fee: '寮費',
  dorm: '寮',
  room: '部屋',
  employee: '社員',
  dorm_room: '寮・部屋',
  settings: '設定',
  master: 'マスタ',
  user: 'ユーザー',
}

export default function OperationLogs() {
  usePageTitle('操作履歴')
  const [page, setPage] = useState(1)
  const [actionFilter, setActionFilter] = useState('')
  const [targetFilter, setTargetFilter] = useState('')
  const [emailFilter, setEmailFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['operation-logs', { page, action: actionFilter, target_type: targetFilter, user_email: emailFilter }],
    queryFn: () => getOperationLogs({
      page,
      size: PAGE_SIZE,
      action: actionFilter || undefined,
      target_type: targetFilter || undefined,
      user_email: emailFilter || undefined,
    }),
  })

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink asChild><Link to="/admin/settings">管理</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>操作履歴</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="text-2xl font-bold text-gray-900">操作履歴</h1>
      </div>

      <div className="rounded-lg border border-gray-300 bg-white shadow-sm px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">操作</label>
            <Select value={actionFilter || 'all'} onValueChange={v => { setActionFilter(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="h-8 w-32 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全て</SelectItem>
                {Object.entries(ACTION_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">対象</label>
            <Select value={targetFilter || 'all'} onValueChange={v => { setTargetFilter(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="h-8 w-32 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全て</SelectItem>
                {Object.entries(TARGET_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">ユーザー</label>
            <Input
              className="h-8 w-48 text-sm"
              placeholder="メールアドレス"
              value={emailFilter}
              onChange={e => { setEmailFilter(e.target.value); setPage(1) }}
            />
          </div>
          {(actionFilter || targetFilter || emailFilter) && (
            <div className="flex items-end">
              <Button variant="outline" size="sm" onClick={() => { setActionFilter(''); setTargetFilter(''); setEmailFilter(''); setPage(1) }} className="h-8 px-4 border-gray-300 text-gray-600 hover:border-gray-400">
                リセット
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-300 bg-white shadow-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-100">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <FileText className="h-4 w-4" />
            操作履歴 {data && <span className="text-gray-400 font-normal">{data.total}件</span>}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>{page} / {totalPages || 1}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase">
                <th className="px-5 py-2.5 text-left font-medium">日時</th>
                <th className="px-5 py-2.5 text-left font-medium">ユーザー</th>
                <th className="px-5 py-2.5 text-left font-medium">操作</th>
                <th className="px-5 py-2.5 text-left font-medium">対象</th>
                <th className="px-5 py-2.5 text-left font-medium">詳細</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map(log => (
                <tr key={log.log_id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                  <td className="px-5 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('ja-JP')}
                  </td>
                  <td className="px-5 py-2.5 text-sm text-gray-700">{log.user_email ?? '—'}</td>
                  <td className="px-5 py-2.5 text-sm">
                    <span className="rounded bg-blue-50 text-blue-700 px-2 py-0.5 text-xs font-medium">
                      {ACTION_LABELS[log.action] ?? log.action}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-sm text-gray-600">
                    {TARGET_LABELS[log.target_type] ?? log.target_type}
                  </td>
                  <td className="px-5 py-2.5 text-xs text-gray-500 max-w-xs truncate" title={log.detail ?? ''}>
                    {log.detail ?? '—'}
                  </td>
                </tr>
              ))}
              {data?.items.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-400">操作履歴はありません</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
