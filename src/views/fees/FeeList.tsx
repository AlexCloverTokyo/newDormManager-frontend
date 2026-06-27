import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Banknote, Calculator, ChevronDown, ChevronLeft, ChevronRight, Download, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { calculateFees, confirmBulk, exportFeesCsv, getFeeList, updateFee } from '@/api/fees'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useAuth } from '@/contexts/AuthContext'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import type { DormFee, FeeGroup, FeeStatus } from '@/types/fee'

function groupFees(fees: DormFee[]): FeeGroup[] {
  const map = new Map<string, DormFee[]>()
  for (const fee of fees) {
    const key = `${fee.employee_id}-${fee.target_month}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(fee)
  }
  return Array.from(map.entries()).map(([key, items]) => ({
    key,
    employee_id: items[0].employee_id,
    employee_name: items[0].employee_name,
    target_month: items[0].target_month,
    items,
    total_final_amount: items.reduce((s, f) => s + f.final_amount, 0),
    group_status: items.some((f) => f.status === 'draft')
      ? ('draft' as FeeStatus)
      : ('confirmed' as FeeStatus),
    is_multi: items.length > 1,
  }))
}

type LocalEdit = { amount: string; note: string }

const PAGE_SIZE = 20

export default function FeeList() {
  usePageTitle('寮費管理')
  const qc = useQueryClient()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const currentMonth = new Date().toISOString().slice(0, 7)

  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [statusFilter, setStatusFilter] = useState('all')
  const [appliedMonth, setAppliedMonth] = useState(currentMonth)
  const [appliedStatus, setAppliedStatus] = useState('all')
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const [revertTarget, setRevertTarget] = useState<{ fee_id: string; version: number } | null>(null)
  const [localEdits, setLocalEdits] = useState<Record<string, LocalEdit>>({})

  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page') ?? '1')

  const setPage = (p: number) => {
    setSearchParams((prev) => { prev.set('page', String(p)); return prev })
  }

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['fees', { month: appliedMonth, status: appliedStatus, page }],
    queryFn: () =>
      getFeeList({
        month: appliedMonth,
        status: appliedStatus === 'all' ? undefined : appliedStatus,
        page,
        page_size: PAGE_SIZE,
      }),
  })

  const fees = data?.items ?? []
  const groups = useMemo(() => groupFees(fees), [fees])
  const draftCount = fees.filter((f) => f.status === 'draft').length

  const confirmMutation = useMutation({
    mutationFn: ({ fee_id, version }: { fee_id: string; version: number }) =>
      updateFee(fee_id, { status: 'confirmed', version }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fees'] }),
  })

  const revertMutation = useMutation({
    mutationFn: ({ fee_id, version }: { fee_id: string; version: number }) =>
      updateFee(fee_id, { status: 'draft', version }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fees'] })
      setRevertTarget(null)
    },
  })

  const adjustMutation = useMutation({
    mutationFn: ({ fee_id, amount, note, version }: { fee_id: string; amount: number; note: string; version: number }) =>
      updateFee(fee_id, { adjustment_amount: amount, adjustment_note: note || null, version }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fees'] })
    },
  })

  const bulkMutation = useMutation({
    mutationFn: () => confirmBulk(appliedMonth),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fees'] }),
  })

  const calcMutation = useMutation({
    mutationFn: () => calculateFees(appliedMonth),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fees'] }),
  })

  const handleSearch = () => {
    setAppliedMonth(selectedMonth)
    setAppliedStatus(statusFilter)
    // フィルター変更時はページを 1 にリセット
    setSearchParams((prev) => { prev.set('page', '1'); return prev })
  }

  const handleReset = () => {
    setSelectedMonth(currentMonth)
    setStatusFilter('all')
    setAppliedMonth(currentMonth)
    setAppliedStatus('all')
    setSearchParams((prev) => { prev.set('page', '1'); return prev })
  }

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const getEdit = (fee: DormFee): LocalEdit =>
    localEdits[fee.fee_id] ?? {
      amount: String(fee.adjustment_amount),
      note: fee.adjustment_note ?? '',
    }

  const setEdit = (fee_id: string, patch: Partial<LocalEdit>) => {
    setLocalEdits((prev) => ({
      ...prev,
      [fee_id]: { ...(prev[fee_id] ?? { amount: '0', note: '' }), ...patch },
    }))
  }

  const saveEdit = (fee: DormFee) => {
    const edit = getEdit(fee)
    const amount = parseInt(edit.amount) || 0
    adjustMutation.mutate({ fee_id: fee.fee_id, amount, note: edit.note, version: fee.version })
    setLocalEdits((prev) => {
      const next = { ...prev }
      delete next[fee.fee_id]
      return next
    })
  }

  const localFinal = (fee: DormFee): number => {
    const edit = localEdits[fee.fee_id]
    if (edit) return fee.calculated_amount + (parseInt(edit.amount) || 0)
    return fee.final_amount
  }

  const AdjustCell = ({ fee }: { fee: DormFee }) => {
    if (fee.status !== 'draft') {
      return (
        <span
          className={`text-xs ${fee.adjustment_amount !== 0 ? 'text-amber-600 font-medium' : 'text-gray-400'}`}
        >
          {fee.adjustment_amount !== 0 ? `¥${fee.adjustment_amount.toLocaleString()}` : '—'}
        </span>
      )
    }
    const edit = getEdit(fee)
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={edit.amount}
            onChange={(e) => setEdit(fee.fee_id, { amount: e.target.value })}
            onBlur={() => saveEdit(fee)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit(fee)
            }}
            className="h-7 w-24 text-xs text-right"
            placeholder="0"
          />
          <span className="text-xs text-gray-400">円</span>
        </div>
        <Input
          value={edit.note}
          onChange={(e) => setEdit(fee.fee_id, { note: e.target.value })}
          onBlur={() => saveEdit(fee)}
          className="h-7 w-36 text-xs"
          placeholder="調整理由"
        />
      </div>
    )
  }

  const ActionCell = ({ fee }: { fee: DormFee }) => (
    <div className="flex items-center gap-2">
      {fee.status === 'draft' && (
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2.5 text-xs text-gray-600"
          onClick={() => confirmMutation.mutate({ fee_id: fee.fee_id, version: fee.version })}
          disabled={confirmMutation.isPending}
        >
          確定
        </Button>
      )}
      {fee.status === 'confirmed' && isAdmin && (
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2.5 text-xs text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
          onClick={() => setRevertTarget({ fee_id: fee.fee_id, version: fee.version })}
        >
          草稿に戻す
        </Button>
      )}
    </div>
  )

  const tableRows = groups.flatMap((group) => {
    const summaryRow = (
      <tr key={group.key} className="hover:bg-blue-50/30 transition-colors">
        <td className="px-3 py-3 w-8">
          {group.is_multi && (
            <button
              onClick={() => toggleExpand(group.key)}
              className="flex items-center justify-center h-5 w-5 rounded hover:bg-gray-200 text-gray-400"
            >
              {expandedKeys.has(group.key) ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </td>
        <td className="px-4 py-3 text-sm font-medium text-gray-800 whitespace-nowrap">{group.employee_name}</td>
        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
          {group.is_multi ? (
            <span className="text-xs text-amber-600 font-medium">換房（{group.items.length} 件）</span>
          ) : (
            `${group.items[0].dorm_name} ${group.items[0].room_name}`
          )}
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 tabular-nums whitespace-nowrap">
          {group.items.reduce((s, f) => s + f.basis_days, 0)} 日
        </td>
        <td className="px-4 py-3 text-sm text-gray-800 tabular-nums text-right whitespace-nowrap">
          ¥{group.items.reduce((s, f) => s + f.calculated_amount, 0).toLocaleString()}
        </td>
        <td className="px-4 py-3">
          {!group.is_multi ? (
            <AdjustCell fee={group.items[0]} />
          ) : (
            <span className="text-xs text-gray-400">内訳を展開</span>
          )}
        </td>
        <td className="px-4 py-3 text-sm font-semibold text-gray-900 tabular-nums text-right whitespace-nowrap">
          ¥
          {(group.is_multi
            ? group.total_final_amount
            : localFinal(group.items[0])
          ).toLocaleString()}
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <Badge variant={group.group_status === 'confirmed' ? 'success' : 'warning'}>
            {group.group_status === 'confirmed' ? '確定' : '仮'}
          </Badge>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          {!group.is_multi && <ActionCell fee={group.items[0]} />}
        </td>
      </tr>
    )

    if (!group.is_multi || !expandedKeys.has(group.key)) return [summaryRow]

    const detailRows = group.items.map((fee) => (
      <tr key={fee.fee_id} className="bg-blue-50/20 hover:bg-blue-50/40 transition-colors">
        <td className="px-3 py-2" />
        <td className="px-4 py-2 text-xs text-gray-400 pl-8">↳</td>
        <td className="px-4 py-2 text-xs text-gray-600 whitespace-nowrap">
          {fee.dorm_name} {fee.room_name}
        </td>
        <td className="px-4 py-2 text-xs text-gray-600 tabular-nums whitespace-nowrap">{fee.basis_days} 日</td>
        <td className="px-4 py-2 text-xs text-gray-800 tabular-nums text-right whitespace-nowrap">
          ¥{fee.calculated_amount.toLocaleString()}
        </td>
        <td className="px-4 py-2">
          <AdjustCell fee={fee} />
        </td>
        <td className="px-4 py-2 text-xs font-medium text-gray-900 tabular-nums text-right whitespace-nowrap">
          ¥{localFinal(fee).toLocaleString()}
        </td>
        <td className="px-4 py-2 whitespace-nowrap">
          <Badge
            variant={fee.status === 'confirmed' ? 'success' : 'warning'}
            className="text-xs"
          >
            {fee.status === 'confirmed' ? '確定' : '仮'}
          </Badge>
        </td>
        <td className="px-4 py-2 whitespace-nowrap">
          <ActionCell fee={fee} />
        </td>
      </tr>
    ))

    return [summaryRow, ...detailRows]
  })

  const handleExport = async (allData: boolean) => {
    try {
      await exportFeesCsv(allData ? undefined : { target_month: appliedMonth })
    } catch {
      // エラー toast は lib/axios.ts のインターセプターが表示済み
    }
  }

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold text-gray-900">寮費管理</h1>

      {/* 検索フォーム */}
      <div className="rounded-lg border border-gray-300 bg-white shadow-sm px-6 py-4">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">対象年月</label>
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-8 w-36 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">ステータス</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-28 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全て</SelectItem>
                <SelectItem value="draft">仮</SelectItem>
                <SelectItem value="confirmed">確定</SelectItem>
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
              onClick={handleSearch}
              className="h-8 px-5 bg-blue-600 hover:bg-blue-700 text-white"
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
            寮費一覧
            <span className="ml-2 text-xs font-normal text-gray-400">{data?.total ?? 0} 件</span>
          </span>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button
                size="sm"
                className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700 text-white"
                onClick={() => calcMutation.mutate()}
                disabled={calcMutation.isPending}
              >
                <Calculator className="h-3.5 w-3.5 mr-1" />
                {calcMutation.isPending ? '計算中...' : '計算'}
              </Button>
            )}
            {draftCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 text-xs border-blue-300 text-blue-600 hover:bg-blue-50"
                onClick={() => bulkMutation.mutate()}
                disabled={bulkMutation.isPending}
              >
                仮 {draftCount} 件を一括確定
              </Button>
            )}
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
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Banknote className="mx-auto h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">データがありません</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="border-b border-gray-200 bg-gray-50/80">
              <tr>
                <th className="px-3 py-2.5 w-8" />
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                  社員名
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                  部屋
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                  在籍日数
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                  算出金額
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                  調整額 / 理由
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                  確定金額
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                  ステータス
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">{tableRows}</tbody>
          </table>
          </div>
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

      {/* 計算式説明 */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm px-5 py-3">
        <p className="text-xs text-gray-400">
          <Calculator className="inline h-3.5 w-3.5 mr-1 mb-0.5" />
          確定金額 ={' '}
          <code className="bg-gray-100 px-1 rounded">単価（円/日） × 在籍日数</code>{' '}
          または{' '}
          <code className="bg-gray-100 px-1 rounded">単価（円/㎡/日） × 面積（㎡） × 在籍日数</code> +
          調整額（円未満切り捨て）
        </p>
      </div>

      {/* 草稿に戻す 確認ダイアログ */}
      <AlertDialog
        open={revertTarget !== null}
        onOpenChange={(open) => !open && setRevertTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              寮費を草稿に戻す
            </AlertDialogTitle>
            <AlertDialogDescription>
              この操作は確定済みの寮費を取り消します。財務処理済みの場合は必ず経理担当に確認してください。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => revertTarget && revertMutation.mutate(revertTarget)}
              disabled={revertMutation.isPending}
            >
              草稿に戻す
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
