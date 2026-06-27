import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Building2, LayoutGrid, List, MapPin, Plus, RefreshCw, Search } from 'lucide-react'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { MSG_DELETED } from '@/constants/messages'
import { getDormList, deleteDorm } from '@/api/dorms'
import { getSummary } from '@/api/summary'
import { GenderBadge } from '@/components/GenderBadge'
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
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { DormForm } from './DormForm'
import type { Dorm, GenderType, Location } from '@/types/dorm'
import { usePageTitle } from '@/hooks/usePageTitle'

const colHelper = createColumnHelper<Dorm>()

type ViewMode = 'list' | 'board'

export default function DormList() {
  usePageTitle('寮管理')
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('dormViewMode') as ViewMode) ?? 'list'
  })
  const [filterGender, setFilterGender] = useState<GenderType | ''>('')
  const [filterLocation, setFilterLocation] = useState<Location | ''>('')
  const [searchText, setSearchText] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Dorm | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Dorm | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dorms', { gender_type: filterGender, location: filterLocation }],
    queryFn: () => getDormList({ gender_type: filterGender, location: filterLocation }),
  })

  const { data: summary } = useQuery({
    queryKey: ['summary'],
    queryFn: getSummary,
  })

  const vacancyMap = Object.fromEntries(
    (summary?.vacant_by_dorm ?? []).map((v) => [v.dorm_id, v])
  )

  const { mutate: removeDorm, isPending: isDeleting } = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => deleteDorm(id, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dorms'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      toast.success(MSG_DELETED('寮'))
      setDeleteTarget(null)
    },
  })

  const allDorms = data?.items ?? []
  const q = searchText.trim().toLowerCase()
  const dorms = q
    ? allDorms.filter((d) => d.name.toLowerCase().includes(q) || d.address.toLowerCase().includes(q))
    : allDorms

  const handleReset = () => {
    setSearchText('')
    setFilterGender('')
    setFilterLocation('')
  }

  const columns = [
    colHelper.accessor('name', {
      header: '寮名称',
      cell: (info) => (
        <Link
          to={`/dorms/${info.row.original.dorm_id}`}
          className="font-medium text-blue-600 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {info.getValue()}
        </Link>
      ),
    }),
    colHelper.accessor('gender_type', {
      header: '種別',
      cell: (info) => <GenderBadge gender={info.getValue()} />,
    }),
    colHelper.accessor('location', {
      header: '所在地',
      cell: (info) => (
        <span className="flex items-center gap-1 text-sm text-gray-600">
          <MapPin className="h-3 w-3 text-gray-400" />
          {info.getValue() === 'tokyo' ? '東京' : info.getValue() === 'osaka' ? '大阪' : 'その他'}
        </span>
      ),
    }),
    colHelper.accessor('floor_plan', {
      header: '間取り',
      cell: (info) => <span className="text-sm text-gray-700">{info.getValue()}</span>,
    }),
    colHelper.display({
      id: 'vacancy',
      header: '空き室',
      cell: (info) => {
        const d = info.row.original
        const v = vacancyMap[d.dorm_id]
        const vacant = v?.vacant_count ?? (d as { vacant_count?: number }).vacant_count ?? 0
        const total = v?.total_rooms ?? (d as { total_rooms?: number }).total_rooms ?? 0
        if (total === 0) {
          return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-400 ring-1 ring-inset ring-gray-200">
              部屋なし
            </span>
          )
        }
        return vacant > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            空き {vacant} / {total}室
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-600/20">
            満室
          </span>
        )
      },
    }),
    colHelper.accessor('address', {
      header: '住所',
      cell: (info) => <span className="text-sm text-gray-500">{info.getValue()}</span>,
    }),
    colHelper.display({
      id: 'actions',
      header: '操作',
      cell: (info) => {
        const dorm = info.row.original
        return (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2.5 text-xs text-gray-600"
              onClick={() => { setEditTarget(dorm); setFormOpen(true) }}
            >
              編集
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2.5 text-xs text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
              onClick={() => setDeleteTarget(dorm)}
            >
              削除
            </Button>
          </div>
        )
      },
    }),
  ]

  const table = useReactTable({
    data: dorms,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const toggleView = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem('dormViewMode', mode)
  }

  return (
    <div className="space-y-3">
      {/* ページタイトル */}
      <h1 className="text-2xl font-bold text-gray-900">寮管理</h1>

      {/* 検索フォームカード */}
      <div className="rounded-lg border border-gray-300 bg-white shadow-sm px-6 py-4">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">寮名称・住所</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <Input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="例：豊洲、東京都…"
                className="h-8 w-52 pl-8 text-sm"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">種別</label>
            <Select value={filterGender || 'all'} onValueChange={(v) => setFilterGender(v === 'all' ? '' : v as GenderType)}>
              <SelectTrigger className="h-8 w-32 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全て</SelectItem>
                <SelectItem value="male">♂ 男性寮</SelectItem>
                <SelectItem value="female">♀ 女性寮</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">所在地</label>
            <Select value={filterLocation || 'all'} onValueChange={(v) => setFilterLocation(v === 'all' ? '' : v as Location)}>
              <SelectTrigger className="h-8 w-32 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全て</SelectItem>
                <SelectItem value="tokyo">東京</SelectItem>
                <SelectItem value="osaka">大阪</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={handleReset} className="h-8 px-4 border-gray-300 text-gray-600 hover:border-gray-400">
              リセット
            </Button>
          </div>
        </div>
      </div>

      {/* テーブルカード */}
      {viewMode === 'list' && (
        <div className="mt-3 rounded-lg border border-gray-300 bg-white shadow-md overflow-hidden">
          {/* テーブルヘッダーバー */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-100">
            <span className="text-sm font-semibold text-gray-800">
              寮一覧
              <span className="ml-2 text-xs font-normal text-gray-400">{dorms.length} 件</span>
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                className="h-8 px-4 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm"
                onClick={() => { setEditTarget(null); setFormOpen(true) }}
              >
                <Plus className="h-4 w-4" />
                新規登録
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
              <div className="flex items-center border border-gray-200 rounded-md overflow-hidden">
                <button
                  className="p-1.5 bg-gray-100 text-gray-700"
                  onClick={() => toggleView('list')}
                  title="リスト表示"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
                <button
                  className="p-1.5 border-l border-gray-200 text-gray-400 hover:text-gray-600"
                  onClick={() => toggleView('board')}
                  title="ボード表示"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* テーブル本体 */}
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50/80">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((header) => (
                      <th key={header.id} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-gray-100">
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="py-16 text-center text-muted-foreground">
                      <Building2 className="mx-auto h-8 w-8 mb-2 opacity-30" />
                      <p className="text-sm">寮データがありません</p>
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-blue-50/30 transition-colors"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3 text-sm">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ボード表示 */}
      {viewMode === 'board' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-800">
              寮一覧
              <span className="ml-2 text-xs font-normal text-gray-400">{dorms.length} 件</span>
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                className="h-8 px-4 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm"
                onClick={() => { setEditTarget(null); setFormOpen(true) }}
              >
                <Plus className="h-4 w-4" />
                新規登録
              </Button>
              <div className="flex items-center border border-gray-200 rounded-md overflow-hidden">
                <button
                  className="p-1.5 text-gray-400 hover:text-gray-600"
                  onClick={() => toggleView('list')}
                  title="リスト表示"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
                <button
                  className="p-1.5 border-l border-gray-200 bg-gray-100 text-gray-700"
                  onClick={() => toggleView('board')}
                  title="ボード表示"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
          <BoardView dorms={dorms} isLoading={isLoading} vacancyMap={vacancyMap} />
        </div>
      )}

      {/* 寮登録・編集フォーム */}
      <DormForm
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditTarget(null) }}
        editTarget={editTarget}
      />

      {/* 削除確認 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>寮を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.name}」を論理削除します。入居中の社員がいる場合は削除できません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && removeDorm({ id: deleteTarget.dorm_id, version: deleteTarget.version })}
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

function BoardView({ dorms, isLoading, vacancyMap }: { dorms: Dorm[]; isLoading: boolean; vacancyMap: Record<string, { vacant_count: number; total_rooms: number }> }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
      </div>
    )
  }

  const maleDorms = dorms.filter((d) => d.gender_type === 'male')
  const femaleDorms = dorms.filter((d) => d.gender_type === 'female')
  const unsetDorms = dorms.filter((d) => d.gender_type !== 'male' && d.gender_type !== 'female')

  const DormSection = ({ label, dorms: sectionDorms }: { label: string; dorms: Dorm[] }) => (
    <div>
      <h2 className="mb-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sectionDorms.map((dorm) => (
          <Card key={dorm.dorm_id} className="hover:shadow-md transition-shadow border-gray-100">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Link to={`/dorms/${dorm.dorm_id}`} className="font-semibold text-blue-600 hover:underline">
                    {dorm.name}
                  </Link>
                  <div className="flex items-center gap-1 mt-1">
                    <GenderBadge gender={dorm.gender_type} />
                    <Badge variant="outline" className="text-xs">
                      <MapPin className="h-2.5 w-2.5 mr-0.5" />
                      {dorm.location === 'tokyo' ? '東京' : dorm.location === 'osaka' ? '大阪' : 'その他'}
                    </Badge>
                  </div>
                </div>
                <div className="text-right text-sm">
                  {(() => {
                    const v = vacancyMap[dorm.dorm_id]
                    const vacant = v?.vacant_count ?? (dorm as { vacant_count?: number }).vacant_count ?? 0
                    const total = v?.total_rooms ?? (dorm as { total_rooms?: number }).total_rooms ?? 0
                    if (total === 0) {
                      return (
                        <>
                          <div className="font-bold text-lg text-gray-300">—</div>
                          <div className="text-xs text-gray-300">部屋なし</div>
                        </>
                      )
                    }
                    return (
                      <>
                        <div className={`font-bold text-lg ${vacant > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          {vacant}
                        </div>
                        <div className="text-xs text-gray-400">空き / {total}</div>
                      </>
                    )
                  })()}
                </div>
              </div>
              <p className="text-xs text-gray-400">{dorm.address}</p>
              <p className="text-xs text-gray-400 mt-0.5">{dorm.floor_plan}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {maleDorms.length > 0 && <DormSection label="男性寮" dorms={maleDorms} />}
      {femaleDorms.length > 0 && <DormSection label="女性寮" dorms={femaleDorms} />}
      {unsetDorms.length > 0 && <DormSection label="性別未定" dorms={unsetDorms} />}
      {dorms.length === 0 && (
        <div className="py-16 text-center text-muted-foreground">
          <Building2 className="mx-auto h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">寮データがありません</p>
        </div>
      )}
    </div>
  )
}
