import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, CalendarIcon, DoorOpen, History, RefreshCw, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { differenceInCalendarDays, format } from 'date-fns'
import { ja } from 'react-day-picker/locale'
import { toast } from 'sonner'
import { z } from 'zod'
import { MSG_MOVE_OUT_COMPLETE, MSG_TRANSFER_COMPLETE, MSG_REQUIRED, MSG_SELECT_REQUIRED } from '@/constants/messages'
import { usePageTitle } from '@/hooks/usePageTitle'
import { getStay, getStayChangeLogs, processLeave, transfer } from '@/api/stays'
import { formatChangeLogAction, formatChangeLogDiff, getNewStayId } from './changeLogHelper'
import { getDormList, getDormRooms } from '@/api/dorms'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatDate } from '@/lib/utils'

const leaveSchema = z.object({
  move_out_date: z.date({ error: MSG_REQUIRED('退寮日') }),
  move_out_reason: z.string().max(200).optional(),
})
type LeaveValues = z.infer<typeof leaveSchema>

const transferSchema = z.object({
  new_dorm_id: z.string().min(1, MSG_SELECT_REQUIRED('寮')),
  new_room_id: z.string().min(1, MSG_SELECT_REQUIRED('部屋')),
  transfer_date: z.date({ error: MSG_REQUIRED('換房日') }),
})
type TransferValues = z.infer<typeof transferSchema>

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-24 shrink-0 text-sm text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-800">{value}</span>
    </div>
  )
}

function DatePickerField({
  label,
  value,
  onChange,
  error,
}: {
  label: string
  value: Date | undefined
  onChange: (date: Date) => void
  error?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label} *</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn('w-full justify-start text-left font-normal', !value && 'text-muted-foreground')}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, 'yyyy/MM/dd', { locale: ja }) : '日付を選択'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={value} onSelect={(d) => d && onChange(d)} locale={ja} />
        </PopoverContent>
      </Popover>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export default function StayDetail() {
  usePageTitle('入居詳細')
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [frozenVersion, setFrozenVersion] = useState<number | null>(null)

  const { data: stay, isLoading } = useQuery({
    queryKey: ['stay', id],
    queryFn: () => getStay(id!),
    enabled: !!id,
  })

  const { data: changeLogs = [] } = useQuery({
    queryKey: ['stay-change-logs', id],
    queryFn: () => getStayChangeLogs(id!),
    enabled: !!id,
  })

  useEffect(() => {
    if ((leaveOpen || transferOpen) && stay?.version != null) {
      setFrozenVersion(stay.version)
    }
    if (!leaveOpen && !transferOpen) {
      setFrozenVersion(null)
    }
  }, [leaveOpen, transferOpen, stay?.version])

  const leaveForm = useForm<LeaveValues>({
    resolver: zodResolver(leaveSchema),
    defaultValues: { move_out_date: new Date(), move_out_reason: '' },
  })

  const { mutate: doLeave, isPending } = useMutation({
    mutationFn: (values: LeaveValues) =>
      processLeave(id!, {
        move_out_date: format(values.move_out_date, 'yyyy-MM-dd'),
        move_out_reason: values.move_out_reason,
        version: frozenVersion!,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stay', id] })
      queryClient.invalidateQueries({ queryKey: ['stays'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      queryClient.invalidateQueries({ queryKey: ['stay-change-logs', id] })
      toast.success(MSG_MOVE_OUT_COMPLETE)
      setLeaveOpen(false)
    },
  })

  const transferForm = useForm<TransferValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: { new_dorm_id: '', new_room_id: '', transfer_date: new Date() },
  })
  const selectedDormId = transferForm.watch('new_dorm_id')

  const { data: dormListData } = useQuery({
    queryKey: ['dorms'],
    queryFn: () => getDormList(),
    enabled: transferOpen,
  })
  const { data: availableRooms } = useQuery({
    queryKey: ['dorms', selectedDormId, 'rooms'],
    queryFn: () => getDormRooms(selectedDormId),
    enabled: transferOpen && !!selectedDormId,
  })
  const vacantRooms = (availableRooms ?? []).filter((r) => r.status === 'vacant')

  const { mutate: doTransfer, isPending: isTransferring } = useMutation({
    mutationFn: (values: TransferValues) =>
      transfer(id!, {
        new_room_id: values.new_room_id,
        transfer_date: format(values.transfer_date, 'yyyy-MM-dd'),
        version: frozenVersion!,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stay', id] })
      queryClient.invalidateQueries({ queryKey: ['stays'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      queryClient.invalidateQueries({ queryKey: ['stay-change-logs', id] })
      toast.success(MSG_TRANSFER_COMPLETE)
      setTransferOpen(false)
      transferForm.reset()
      navigate(-1)
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!stay) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        <p>入居情報が見つかりません</p>
        <Button variant="link" onClick={() => navigate(-1)}>一覧に戻る</Button>
      </div>
    )
  }

  const isCurrent = !stay.move_out_date

  const stayDays = stay.move_in_date
    ? differenceInCalendarDays(
        stay.move_out_date ? new Date(stay.move_out_date) : new Date(),
        new Date(stay.move_in_date),
      )
    : null

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/stays">入居履歴</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>詳細</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">入居詳細</h1>
            {isCurrent ? (
              <Badge variant="success">入居中</Badge>
            ) : (
              <Badge variant="gray">退寮済み</Badge>
            )}
          </div>
          {isCurrent && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-gray-300 text-gray-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50"
                onClick={() => setTransferOpen(true)}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                換房
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-gray-300 text-gray-600 hover:border-red-300 hover:text-red-600 hover:bg-red-50"
                onClick={() => setLeaveOpen(true)}
              >
                <DoorOpen className="h-3.5 w-3.5" />
                退寮処理
              </Button>
            </div>
          )}
        </div>
      </div>

      <Card className="bg-white border-gray-300 shadow-md">
        <CardHeader className="pb-3 bg-gray-100 border-b border-gray-200 rounded-t-lg">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <User className="h-4 w-4" /> 入居情報
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <InfoRow label="社員名" value={stay.employee_name} />
          <InfoRow
            label="寮"
            value={
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-gray-400" />
                {stay.dorm_name}
              </span>
            }
          />
          <InfoRow label="部屋" value={stay.room_name} />
          <InfoRow label="入居日" value={formatDate(stay.move_in_date)} />
          <InfoRow
            label="退寮日"
            value={stay.move_out_date ? formatDate(stay.move_out_date) : '在籍中'}
          />
          <InfoRow
            label="在籍日数"
            value={stayDays !== null ? `${stayDays} 日` : '—'}
          />
        </CardContent>
      </Card>

      {/* 変更履歴 */}
      <Card className="bg-white border-gray-300 shadow-md overflow-hidden">
        <CardHeader className="pb-3 bg-gray-100 border-b border-gray-200 rounded-t-lg">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <History className="h-4 w-4" /> 変更履歴 {changeLogs.length > 0 && `${changeLogs.length}件`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {changeLogs.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">変更履歴はありません</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2 text-left font-medium text-gray-600 w-[160px]">日時</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600 w-[100px]">操作</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">変更内容</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600 w-[160px]">操作者</th>
                </tr>
              </thead>
              <tbody>
                {changeLogs.map((log) => {
                  const diffs = formatChangeLogDiff(log)
                  const newStayId = getNewStayId(log)
                  return (
                    <tr key={log.log_id} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors">
                      <td className="px-4 py-2.5 align-top text-gray-600 whitespace-nowrap">
                        {format(new Date(log.changed_at), 'yyyy/MM/dd HH:mm')}
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <Badge variant={log.action === 'move_in' ? 'success' : log.action === 'move_out' ? 'gray' : 'outline'}>
                          {formatChangeLogAction(log.action)}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <div className="space-y-0.5">
                          {diffs.map((d, i) => (
                            <div key={i} className="text-gray-700">
                              <span className="text-gray-400">{d.label}: </span>
                              {d.oldValue ? (
                                <>
                                  <span className="text-gray-400">{d.oldValue}</span>
                                  <span className="text-gray-400"> → </span>
                                  <span className="font-medium">{d.newValue}</span>
                                </>
                              ) : (
                                <span className="font-medium">{d.newValue}</span>
                              )}
                            </div>
                          ))}
                          {newStayId && (
                            <div className="mt-1">
                              <Link to={`/stays/${newStayId}`} className="text-blue-600 hover:underline text-xs">
                                → 新しい入居記録を表示
                              </Link>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 align-top text-gray-600 truncate max-w-[160px]">
                        {log.operator_email ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* 換房ダイアログ */}
      <Dialog open={transferOpen} onOpenChange={(open) => { setTransferOpen(open); if (!open) transferForm.reset() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>換房</DialogTitle>
          </DialogHeader>
          <form onSubmit={transferForm.handleSubmit((v) => doTransfer(v))} className="space-y-4">
            <div className="space-y-1.5">
              <Label>新しい寮 *</Label>
              <Select
                value={transferForm.watch('new_dorm_id')}
                onValueChange={(v) => {
                  transferForm.setValue('new_dorm_id', v, { shouldValidate: true })
                  transferForm.setValue('new_room_id', '')
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="寮を選択" />
                </SelectTrigger>
                <SelectContent>
                  {(dormListData?.items ?? []).map((d) => (
                    <SelectItem key={d.dorm_id} value={d.dorm_id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {transferForm.formState.errors.new_dorm_id && (
                <p className="text-xs text-destructive">{transferForm.formState.errors.new_dorm_id.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>新しい部屋 *</Label>
              <Select
                value={transferForm.watch('new_room_id')}
                onValueChange={(v) => transferForm.setValue('new_room_id', v, { shouldValidate: true })}
                disabled={!selectedDormId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedDormId ? '部屋を選択' : '先に寮を選択してください'} />
                </SelectTrigger>
                <SelectContent>
                  {vacantRooms.map((r) => (
                    <SelectItem key={r.room_id} value={r.room_id}>
                      {r.room_name}（{(r.daily_rate ?? r.unit_price * r.area_sqm).toLocaleString()}円/日）
                    </SelectItem>
                  ))}
                  {selectedDormId && vacantRooms.length === 0 && (
                    <div className="px-4 py-2 text-xs text-gray-400">空き室がありません</div>
                  )}
                </SelectContent>
              </Select>
              {transferForm.formState.errors.new_room_id && (
                <p className="text-xs text-destructive">{transferForm.formState.errors.new_room_id.message}</p>
              )}
            </div>
            <DatePickerField
              label="換房日"
              value={transferForm.watch('transfer_date')}
              onChange={(d) => transferForm.setValue('transfer_date', d, { shouldValidate: true })}
              error={transferForm.formState.errors.transfer_date?.message}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTransferOpen(false)}>キャンセル</Button>
              <Button type="submit" disabled={isTransferring}>
                {isTransferring ? '処理中...' : '換房'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 退寮処理ダイアログ */}
      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>退寮処理</DialogTitle>
          </DialogHeader>
          <form onSubmit={leaveForm.handleSubmit((v) => doLeave(v))} className="space-y-4">
            <DatePickerField
              label="退寮日"
              value={leaveForm.watch('move_out_date')}
              onChange={(d) => leaveForm.setValue('move_out_date', d, { shouldValidate: true })}
              error={leaveForm.formState.errors.move_out_date?.message}
            />
            <div className="space-y-1.5">
              <Label htmlFor="move_out_reason">退寮理由</Label>
              <Input
                id="move_out_reason"
                {...leaveForm.register('move_out_reason')}
                placeholder="例：退職、転勤、自己都合…"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLeaveOpen(false)}>
                キャンセル
              </Button>
              <Button type="submit" disabled={isPending} className="bg-red-600 hover:bg-red-700 text-white">
                {isPending ? '処理中...' : '退寮処理'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
