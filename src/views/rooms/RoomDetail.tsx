import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { differenceInCalendarDays } from 'date-fns'
import { DoorOpen, User, Calendar, Pencil, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { MSG_DELETED } from '@/constants/messages'
import { getRoom, getRoomStayHistory, deleteRoom } from '@/api/rooms'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { RoomStatusBadge } from '@/components/RoomStatusBadge'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useMasterItems } from '@/hooks/useMasters'
import { RoomForm } from './RoomForm'
import { formatDate } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function RoomDetail() {
  const { id: dormId, roomId } = useParams<{ id: string; roomId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: () => deleteRoom(roomId!, room!.version),
    onSuccess: () => {
      toast.success(MSG_DELETED('部屋'))
      queryClient.invalidateQueries({ queryKey: ['dorm-rooms', dormId] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      navigate(`/dorms/${dormId}`)
    },
  })

  const { data: room, isLoading } = useQuery({
    queryKey: ['room', roomId],
    queryFn: () => getRoom(roomId!),
    enabled: !!roomId,
  })
  usePageTitle(room?.room_name ? `${room.room_name} — 部屋詳細` : '部屋詳細')

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['room-history', roomId],
    queryFn: () => getRoomStayHistory(roomId!),
    enabled: !!roomId,
  })

  const histories: import('@/types/dorm').StayHistory[] = historyData?.items ?? []

  const roomTypeItems = useMasterItems('room_type')
  const roomTypeLabelMap = useMemo(
    () => Object.fromEntries(roomTypeItems.map((i) => [i.code, i.label_ja])),
    [roomTypeItems],
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!room) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        <p>部屋が見つかりません</p>
        <Button variant="link" onClick={() => navigate(-1)}>戻る</Button>
      </div>
    )
  }

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
              <BreadcrumbLink asChild>
                <Link to={`/dorms/${dormId}`}>{room.dorm_name}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{room.room_name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{room.room_name}</h1>
            <RoomStatusBadge status={room.status} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 border-gray-300 hover:border-gray-400" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> 編集
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-gray-300 text-gray-500 hover:border-red-300 hover:text-red-600 hover:bg-red-50"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" /> 削除
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* 基本情報 */}
        <Card className="bg-white border-gray-300 shadow-md">
          <CardHeader className="pb-3 bg-gray-100 border-b border-gray-200 rounded-t-lg">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <DoorOpen className="h-4 w-4" /> 部屋情報
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow label="部屋種別" value={roomTypeLabelMap[room.room_type] ?? room.room_type} />
            <InfoRow label="部屋面積" value={`${room.area_sqm} ㎡`} />
            <InfoRow label="単価（円/日）" value={<span className="tabular-nums">{(room.daily_rate ?? room.unit_price * room.area_sqm).toLocaleString()} 円/日</span>} />
            <InfoRow label="単価計算用（円/㎡/日）" value={<span className="tabular-nums">{room.unit_price.toFixed(1)} 円/㎡/日</span>} />
            <InfoRow label="エアコン" value={room.equipment?.ac ? 'あり' : 'なし'} />
          </CardContent>
        </Card>

        {/* 現在の入居者 */}
        <Card className="col-span-2 bg-white border-gray-300 shadow-md">
          <CardHeader className="pb-3 bg-gray-100 border-b border-gray-200 rounded-t-lg">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <User className="h-4 w-4" /> 現在の入居状況
            </CardTitle>
          </CardHeader>
          <CardContent>
            {room.status === 'vacant' && (
              <div className="py-6 text-center text-muted-foreground">
                <DoorOpen className="mx-auto h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">現在、この部屋は空き室です</p>
                <Button size="sm" className="mt-3" asChild>
                  <Link to={`/stays/new?roomId=${room.room_id}`}>入居登録</Link>
                </Button>
              </div>
            )}
            {room.status === 'reserved' && room.reserved_by && (
              <div className="space-y-2 text-sm">
                <Badge variant="cyan" className="mb-2">予約済み</Badge>
                <InfoRow label="入居予定者" value={room.reserved_by.employee_name} />
                <InfoRow label="入居予定日" value={formatDate(room.reserved_by.move_in_date)} />
              </div>
            )}
            {room.current_resident && (
              <div className="space-y-2 text-sm">
                <InfoRow label="入居者" value={
                  <span className="font-medium">{room.current_resident.employee_name}</span>
                } />
                <InfoRow label="入居日" value={formatDate(room.current_resident.move_in_date)} />
                {room.current_resident.move_out_date && (
                  <InfoRow label="退寮予定日" value={
                    <span className="text-yellow-600">{formatDate(room.current_resident.move_out_date)}</span>
                  } />
                )}
                <div className="pt-2 flex gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/stays/${room.current_resident.stay_id}`}>詳細</Link>
                  </Button>
                  <Button size="sm" variant="destructive" asChild>
                    <Link to={`/stays/${room.current_resident.stay_id}?action=leave`}>退寮処理</Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 入居履歴 */}
      <Card className="bg-white border-gray-300 shadow-md">
        <CardHeader className="pb-3 bg-gray-100 border-b border-gray-200 rounded-t-lg">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Calendar className="h-4 w-4" /> 入居履歴
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {historyLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : histories.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">入居履歴がありません</div>
          ) : (
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50/80">
                <tr>
                  {['社員名', '入居日', '退寮日', '在籍日数', '状態'].map((h) => (
                    <th key={h} className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {histories.map((h) => {
                  const days = differenceInCalendarDays(
                    h.move_out_date ? new Date(h.move_out_date) : new Date(),
                    new Date(h.move_in_date),
                  )
                  return (
                    <tr key={h.stay_id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-5 py-3 text-sm">
                        <span className="font-medium">{h.employee_name}</span>
                      </td>
                      <td className="px-5 py-3 text-sm tabular-nums text-gray-700">{formatDate(h.move_in_date)}</td>
                      <td className="px-5 py-3 text-sm tabular-nums text-gray-700">{h.move_out_date ? formatDate(h.move_out_date) : '—'}</td>
                      <td className="px-5 py-3 text-sm tabular-nums text-gray-700">{days} 日</td>
                      <td className="px-5 py-3">
                        {!h.move_out_date
                          ? <Badge variant="success" className="text-xs">在住中</Badge>
                          : <Badge variant="gray" className="text-xs">退寮済み</Badge>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <RoomForm
        open={editOpen}
        onOpenChange={setEditOpen}
        dormId={dormId!}
        editTarget={room}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['room', roomId] })
          queryClient.invalidateQueries({ queryKey: ['dorm-rooms', dormId] })
        }}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>部屋を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{room.room_name}」を削除します。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteMutation.mutate()}
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
