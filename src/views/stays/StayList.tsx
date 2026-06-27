import { useQuery } from '@tanstack/react-query'
import { differenceInCalendarDays } from 'date-fns'
import { ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Download, RefreshCw, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { exportStaysCsv, getStayList } from '@/api/stays'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDate } from '@/lib/utils'

type StatusFilter = 'all' | 'current' | 'past'

const PAGE_SIZE = 20

export default function StayList() {
  usePageTitle('入居履歴')
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [appliedQ, setAppliedQ] = useState('')
  const [appliedStatus, setAppliedStatus] = useState<StatusFilter>('all')

  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page') ?? '1')

  const setPage = (p: number) => {
    setSearchParams((prev) => { prev.set('page', String(p)); return prev })
  }

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['stays', { q: appliedQ, status: appliedStatus, page }],
    queryFn: () =>
      getStayList({
        q: appliedQ || undefined,
        status: appliedStatus === 'all' ? undefined : appliedStatus,
        page,
        page_size: PAGE_SIZE,
      }),
  })

  const stays = data?.items ?? []

  const handleSearch = () => {
    setAppliedQ(searchText.trim())
    setAppliedStatus(statusFilter)
    // フィルター変更時はページを 1 にリセット
    setSearchParams((prev) => { prev.set('page', '1'); return prev })
  }

  const handleExport = async (exportAll: boolean) => {
    try {
      await exportStaysCsv(
        exportAll
          ? undefined
          : {
              q: appliedQ || undefined,
              status: appliedStatus === 'all' ? undefined : appliedStatus,
            },
      )
    } catch {
      // interceptor handles error toast
    }
  }

  const handleReset = () => {
    setSearchText('')
    setStatusFilter('all')
    setAppliedQ('')
    setAppliedStatus('all')
    setSearchParams((prev) => { prev.set('page', '1'); return prev })
  }

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold text-gray-900">入居履歴</h1>

      {/* 検索フォーム */}
      <div className="rounded-lg border border-gray-300 bg-white shadow-sm px-6 py-4">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">社員名・寮名・部屋名</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <Input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="例：山田、豊洲C寮…"
                className="h-8 w-60 pl-8 text-sm"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">状態</label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <SelectTrigger className="h-8 w-32 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全て</SelectItem>
                <SelectItem value="current">入居中</SelectItem>
                <SelectItem value="past">退寮済み</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="h-8 px-4 border-gray-300 text-gray-600 hover:border-gray-400"
            >
              リセット
            </Button>
            <Button
              size="sm"
              className="h-8 px-5 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleSearch}
            >
              検索
            </Button>
          </div>
        </div>
      </div>

      {/* テーブルカード */}
      <div className="rounded-lg border border-gray-300 bg-white shadow-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-100">
          <span className="text-sm font-semibold text-gray-800">
            入居履歴一覧 {stays.length}件
            <span className="ml-1 text-xs font-normal text-gray-400">（全 {data?.total ?? 0}件）</span>
          </span>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  CSVエクスポート
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport(false)}>
                  現在の条件でエクスポート
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport(true)}>
                  すべてエクスポート
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-gray-600"
              onClick={() => refetch()}
              title="更新"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : stays.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <ClipboardList className="mx-auto h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">入居履歴がありません</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50/80">
              <tr>
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">社員名</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">寮</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">部屋</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">入居日</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">退寮日</th>
                <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">在籍日数</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">状態</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stays.map((stay) => (
                <tr key={stay.stay_id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-5 py-3 text-sm font-medium">
                    <Link to={`/stays/${stay.stay_id}`} className="text-blue-600 hover:underline">
                      {stay.employee_name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600">{stay.dorm_name}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{stay.room_name}</td>
                  <td className="px-5 py-3 text-sm tabular-nums text-gray-600">
                    {formatDate(stay.move_in_date)}
                  </td>
                  <td className="px-5 py-3 text-sm tabular-nums text-gray-600">
                    {formatDate(stay.move_out_date)}
                  </td>
                  <td className="px-5 py-3 text-sm tabular-nums text-gray-600 text-right">
                    {stay.move_in_date
                      ? `${differenceInCalendarDays(stay.move_out_date ? new Date(stay.move_out_date) : new Date(), new Date(stay.move_in_date))} 日`
                      : '—'}
                  </td>
                  <td className="px-5 py-3">
                    {!stay.move_out_date ? (
                      <Badge variant="success">入居中</Badge>
                    ) : (
                      <Badge variant="gray">退寮済み</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <Button variant="outline" size="sm" className="h-6 px-2.5 text-xs text-gray-600" asChild>
                      <Link to={`/stays/${stay.stay_id}`}>詳細</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ページネーション */}
        {data && data.total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-400">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.total)} / 全 {data.total} 件
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                前へ
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={page * PAGE_SIZE >= data.total}
                onClick={() => setPage(page + 1)}
              >
                次へ
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
