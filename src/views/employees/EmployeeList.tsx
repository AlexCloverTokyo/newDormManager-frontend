import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus, RefreshCw, Search, Users } from 'lucide-react'
import { useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { MSG_DELETED } from '@/constants/messages'
import { getEmployeeList, deleteEmployee } from '@/api/employees'
import { useAuth } from '@/contexts/AuthContext'
import type { Employee, LivingStatus } from '@/types/employee'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useMasterItems } from '@/hooks/useMasters'
import { EmployeeForm } from './EmployeeForm'
import { usePageTitle } from '@/hooks/usePageTitle'
const PAGE_SIZE = 20

function LivingBadge({ isLiving, moveOutDate, hasStayHistory }: { isLiving: boolean; moveOutDate?: string | null; hasStayHistory?: boolean }) {
  if (!isLiving) return <Badge variant="gray">{hasStayHistory ? '退寮済み' : '未入居'}</Badge>
  if (moveOutDate) {
    const today = new Date()
    const out = new Date(moveOutDate)
    const days = Math.ceil((out.getTime() - today.getTime()) / 86400000)
    if (days < 0) return <Badge variant="orange">超過滞在</Badge>
    if (days <= 30) return <Badge variant="warning">退寮予定</Badge>
  }
  return <Badge variant="success">入居中</Badge>
}

export default function EmployeeList() {
  usePageTitle('社員管理')
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const departments = useMasterItems('department')
  const divisionItems = useMasterItems('division')
  const divisionLabels = useMemo(() => Object.fromEntries(divisionItems.map(i => [i.code, i.label_ja])), [divisionItems])
  const [searchText, setSearchText] = useState('')
  const [department, setDepartment] = useState('')
  const [livingStatus, setLivingStatus] = useState<LivingStatus | 'all'>('all')
  const [appliedQ, setAppliedQ] = useState('')
  const [appliedDept, setAppliedDept] = useState('')
  const [appliedLiving, setAppliedLiving] = useState<LivingStatus>('')
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Employee | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null)

  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page') ?? '1')

  const setPage = (p: number) => {
    setSearchParams((prev) => { prev.set('page', String(p)); return prev })
  }

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['employees', { q: appliedQ, department: appliedDept, living_status: appliedLiving, page }],
    queryFn: () =>
      getEmployeeList({
        q: appliedQ || undefined,
        department: appliedDept || undefined,
        living_status: appliedLiving || undefined,
        page,
        page_size: PAGE_SIZE,
      }),
  })

  const employees = data?.items ?? []

  const handleSearch = () => {
    setAppliedQ(searchText.trim())
    setAppliedDept(department)
    setAppliedLiving(livingStatus === 'all' ? '' : (livingStatus as LivingStatus))
    // フィルター変更時はページを 1 にリセット
    setSearchParams((prev) => { prev.set('page', '1'); return prev })
  }

  const handleReset = () => {
    setSearchText('')
    setDepartment('')
    setLivingStatus('all')
    setAppliedQ('')
    setAppliedDept('')
    setAppliedLiving('')
    setSearchParams((prev) => { prev.set('page', '1'); return prev })
  }

  const { mutate: removeEmployee, isPending: isDeleting } = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => deleteEmployee(id, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast.success(MSG_DELETED('社員'))
      setDeleteTarget(null)
    },
  })

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold text-gray-900">社員管理</h1>

      {/* 検索フォーム */}
      <div className="rounded-lg border border-gray-300 bg-white shadow-sm px-6 py-4">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">氏名・社員番号</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <Input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="例：山田、EMP001…"
                className="h-8 w-52 pl-8 text-sm"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">部署</label>
            <Select value={department || 'all'} onValueChange={(v) => setDepartment(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-8 w-32 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全て</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.code} value={d.code}>
                    {d.label_ja}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">在籍状態</label>
            <Select
              value={livingStatus}
              onValueChange={(v) => setLivingStatus(v as LivingStatus | 'all')}
            >
              <SelectTrigger className="h-8 w-32 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全て</SelectItem>
                <SelectItem value="in_dorm">入居中</SelectItem>
                <SelectItem value="not_in_dorm">未入居</SelectItem>
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
            社員一覧 {employees.length}件
            <span className="ml-1 text-xs font-normal text-gray-400">（全 {data?.total ?? 0}件）</span>
          </span>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-4 gap-1.5 border-gray-300 text-gray-700"
                onClick={() => { setEditTarget(null); setFormOpen(true) }}
              >
                <Plus className="h-4 w-4" />新規社員
              </Button>
            )}
            <Button
              size="sm"
              className="h-8 px-4 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm"
              asChild
            >
              <Link to="/stays/new"><Plus className="h-4 w-4" />入居登録</Link>
            </Button>
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
        ) : employees.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Users className="mx-auto h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">社員データがありません</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50/80">
              <tr>
                {['社員番号', '氏名', '社員区分', '部署', '事業部', '在籍状態', '入居先', '操作'].map((h) => (
                  <th key={h} className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employees.map((emp) => (
                <tr key={emp.employee_id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-5 py-3 text-sm text-gray-500 tabular-nums">{emp.employee_code}</td>
                  <td className="px-5 py-3 text-sm font-medium text-gray-800">{emp.name}</td>
                  <td className="px-5 py-3">
                    <Badge variant={emp.employee_type === 'japanese' ? 'default' : 'warning'}>
                      {emp.employee_type === 'japanese' ? '日本社員' : '中国出張社員'}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600">{emp.department ?? '—'}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{emp.division ? (divisionLabels[emp.division] ?? emp.division) : '—'}</td>
                  <td className="px-5 py-3">
                    <LivingBadge isLiving={emp.is_living_in_dorm} moveOutDate={emp.current_stay?.move_out_date} hasStayHistory={emp.has_stay_history} />
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600">
                    {emp.current_stay
                      ? <span>{emp.current_stay.dorm_name} / {emp.current_stay.room_name}</span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-5 py-3">
                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2.5 text-xs text-gray-600"
                          onClick={() => { setEditTarget(emp); setFormOpen(true) }}
                        >
                          編集
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2.5 text-xs text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
                          onClick={() => setDeleteTarget(emp)}
                        >
                          削除
                        </Button>
                      </div>
                    )}
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

      <EmployeeForm
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditTarget(null) }}
        editTarget={editTarget}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>社員を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.name}」を論理削除します。入居中の場合は退寮処理を先に行ってください。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && removeEmployee({ id: deleteTarget.employee_id, version: deleteTarget.version })}
              disabled={isDeleting}
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
