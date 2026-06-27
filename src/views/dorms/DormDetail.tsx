import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Building2, MapPin, Home, Pencil, Trash2, Plus, RefreshCw,
  DoorOpen,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { MSG_DELETED } from '@/constants/messages'
import { getDorm, getDormRooms, deleteDorm } from '@/api/dorms'
import { deleteRoom } from '@/api/rooms'
import { GenderBadge } from '@/components/GenderBadge'
import { RoomStatusBadge } from '@/components/RoomStatusBadge'
import { useMasterItems } from '@/hooks/useMasters'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DormForm } from './DormForm'
import { RoomForm } from '../rooms/RoomForm'
import type { Room } from '@/types/dorm'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function DormDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [dormFormOpen, setDormFormOpen] = useState(false)
  const [roomFormOpen, setRoomFormOpen] = useState(false)
  const [roomEditTarget, setRoomEditTarget] = useState<Room | null>(null)
  const [deleteDormOpen, setDeleteDormOpen] = useState(false)
  const [deleteRoomTarget, setDeleteRoomTarget] = useState<Room | null>(null)

  const { data: dorm, isLoading: dormLoading } = useQuery({
    queryKey: ['dorm', id],
    queryFn: () => getDorm(id!),
    enabled: !!id,
  })
  usePageTitle(dorm?.name ? `${dorm.name} — 寮詳細` : '寮詳細')

  const { data: rooms, isLoading: roomsLoading } = useQuery({
    queryKey: ['dorm-rooms', id],
    queryFn: () => getDormRooms(id!),
    enabled: !!id,
  })

  const roomTypeItems = useMasterItems('room_type')
  const roomTypeLabelMap = useMemo(
    () => Object.fromEntries(roomTypeItems.map((i) => [i.code, i.label_ja])),
    [roomTypeItems],
  )

  const { mutate: removeDorm, isPending: isDeletingDorm } = useMutation({
    mutationFn: () => deleteDorm(id!, dorm!.version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dorms'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      toast.success(MSG_DELETED('寮'))
      navigate('/dorms')
    },
  })

  const { mutate: removeRoom, isPending: isDeletingRoom } = useMutation({
    mutationFn: ({ roomId, version }: { roomId: string; version: number }) => deleteRoom(roomId, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dorm-rooms', id] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      toast.success(MSG_DELETED('部屋'))
      setDeleteRoomTarget(null)
    },
  })

  if (dormLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    )
  }

  if (!dorm) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">寮が見つかりません</p>
        <Button variant="link" onClick={() => navigate(-1)}>一覧に戻る</Button>
      </div>
    )
  }

  const vacantCount = rooms?.filter((r) => r.status === 'vacant').length ?? 0
  const occupiedCount = rooms?.filter((r) => r.status === 'occupied').length ?? 0
  const leavingSoonCount = rooms?.filter((r) => r.status === 'leaving_soon').length ?? 0
  const reservedCount = rooms?.filter((r) => r.status === 'reserved').length ?? 0
  const overdueCount = rooms?.filter((r) => r.status === 'overdue').length ?? 0

  return (
    <div className="space-y-6">
      {/* ブレッドクラム + ヘッダー */}
      <div className="space-y-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/dorms">寮管理</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{dorm.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{dorm.name}</h1>
              <GenderBadge gender={dorm.gender_type} />
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" />
              {dorm.address}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 border-gray-300 hover:border-gray-400" onClick={() => setDormFormOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> 編集
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-gray-300 text-gray-500 hover:border-red-300 hover:text-red-600 hover:bg-red-50"
              onClick={() => setDeleteDormOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" /> 削除
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* 基本情報 */}
        <Card className="col-span-1 bg-white border-gray-300 shadow-md">
          <CardHeader className="pb-3 bg-gray-100 border-b border-gray-200 rounded-t-lg">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Building2 className="h-4 w-4" /> 基本情報
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow label="寮名称" value={dorm.name} />
            <InfoRow label="住所" value={dorm.address} />
            <InfoRow label="間取り" value={dorm.floor_plan} />
            <InfoRow label="性別区分" value={<GenderBadge gender={dorm.gender_type} />} />
            <InfoRow
              label="立地"
              value={dorm.location === 'tokyo' ? '東京' : dorm.location === 'osaka' ? '大阪' : 'その他'}
            />
            <InfoRow label="予定部屋数" value={`${dorm.planned_room_count}件`} />
            {dorm.note && <InfoRow label="備考" value={dorm.note} />}
          </CardContent>
        </Card>

        {/* 部屋ステータス集計 */}
        <Card className="col-span-2 bg-white border-gray-300 shadow-md">
          <CardHeader className="pb-3 bg-gray-100 border-b border-gray-200 rounded-t-lg">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Home className="h-4 w-4" /> 部屋状況サマリー
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-3">
              <StatCard label="空き" value={vacantCount} accent="bg-green-400" />
              <StatCard label="予約済み" value={reservedCount} accent="bg-cyan-400" />
              <StatCard label="入居中" value={occupiedCount} accent="bg-blue-400" />
              <StatCard label="退寮予定" value={leavingSoonCount} accent="bg-amber-400" />
              <StatCard label="⚠ 超期" value={overdueCount} accent={overdueCount > 0 ? 'bg-red-500' : 'bg-gray-300'} isAlert />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 部屋一覧 */}
      <Card className="bg-white border-gray-200 shadow">
        <CardHeader className="flex flex-row items-center justify-between pb-3 bg-gray-100 border-b border-gray-200 rounded-t-lg">
          <span className="text-sm font-semibold text-gray-800">
            部屋一覧
            <span className="ml-2 text-xs font-normal text-gray-400">
              {rooms?.length ?? 0}件 / 予定 {dorm.planned_room_count}件
            </span>
            {(rooms?.length ?? 0) < dorm.planned_room_count && (
              <Badge variant="warning" className="ml-2">
                ⚠ 未登録 {dorm.planned_room_count - (rooms?.length ?? 0)}件
              </Badge>
            )}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm"
              disabled={(rooms?.length ?? 0) >= dorm.planned_room_count}
              title={(rooms?.length ?? 0) >= dorm.planned_room_count ? '予定部屋数に達しています。寮情報の編集で予定部屋数を増やしてください' : undefined}
              onClick={() => { setRoomEditTarget(null); setRoomFormOpen(true) }}
            >
              <Plus className="h-4 w-4" /> 新規登録
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-gray-600"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['dorm-rooms', id] })}
              title="更新"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {roomsLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : rooms?.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <DoorOpen className="mx-auto h-7 w-7 mb-2 opacity-30" />
              部屋が登録されていません
            </div>
          ) : (
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50/80">
                <tr>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">部屋名</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">タイプ</th>
                  <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">面積</th>
                  <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">単価（円/日）</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">空調</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">状態</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rooms?.map((room) => (
                  <tr key={room.room_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <Link to={`/dorms/${id}/rooms/${room.room_id}`} className="text-sm font-medium text-blue-600 hover:underline">
                        {room.room_name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">{roomTypeLabelMap[room.room_type] ?? room.room_type}</td>
                    <td className="px-5 py-3 text-right text-sm tabular-nums text-gray-700">{room.area_sqm}<span className="text-gray-400 ml-0.5">㎡</span></td>
                    <td className="px-5 py-3 text-right text-sm tabular-nums text-gray-700">{(room.daily_rate ?? room.unit_price * room.area_sqm).toLocaleString()}<span className="text-gray-400 ml-0.5 text-xs">円/日</span></td>
                    <td className="px-5 py-3 text-sm text-gray-600">{room.equipment?.ac ? 'あり' : 'なし'}</td>
                    <td className="px-5 py-3"><RoomStatusBadge status={room.status} /></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2.5 text-xs text-gray-600"
                          onClick={(e) => { e.stopPropagation(); setRoomEditTarget(room); setRoomFormOpen(true) }}
                        >
                          編集
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2.5 text-xs text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
                          onClick={(e) => { e.stopPropagation(); setDeleteRoomTarget(room) }}
                        >
                          削除
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* 寮編集 */}
      <DormForm open={dormFormOpen} onOpenChange={setDormFormOpen} editTarget={dorm} />

      {/* 部屋追加・編集 */}
      <RoomForm
        open={roomFormOpen}
        onOpenChange={(open) => { setRoomFormOpen(open); if (!open) setRoomEditTarget(null) }}
        dormId={id!}
        editTarget={roomEditTarget}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['dorm-rooms', id] })
          queryClient.invalidateQueries({ queryKey: ['summary'] })
          queryClient.invalidateQueries({ queryKey: ['calendar'] })
        }}
      />

      {/* 寮削除確認 */}
      <AlertDialog open={deleteDormOpen} onOpenChange={setDeleteDormOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>寮を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{dorm.name}」を論理削除します。入居中の社員がいる場合は削除できません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removeDorm()}
              disabled={isDeletingDorm}
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 部屋削除確認 */}
      <AlertDialog open={!!deleteRoomTarget} onOpenChange={(open) => !open && setDeleteRoomTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>部屋を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteRoomTarget?.room_name}」を論理削除します。入居中の場合は削除できません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteRoomTarget && removeRoom({ roomId: deleteRoomTarget.room_id, version: deleteRoomTarget.version })}
              disabled={isDeletingRoom}
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="w-20 shrink-0 text-sm text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-800">{value}</span>
    </div>
  )
}

function StatCard({ label, value, accent, isAlert = false }: { label: string; value: number; accent: string; isAlert?: boolean }) {
  const alertActive = isAlert && value > 0
  return (
    <div className={`rounded-lg overflow-hidden ${alertActive ? 'bg-red-50' : 'bg-gray-50'}`}>
      <div className={`h-1 ${accent}`} />
      <div className="p-3 text-center">
        <div className={`text-2xl font-bold tabular-nums ${alertActive ? 'text-red-600' : 'text-gray-900'}`}>{value}</div>
        <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      </div>
    </div>
  )
}
