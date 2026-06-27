import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ja } from 'react-day-picker/locale'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { MSG_MOVE_IN_COMPLETE, MSG_SELECT_REQUIRED, MSG_REQUIRED } from '@/constants/messages'
import { CalendarIcon, X } from 'lucide-react'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { getDormList } from '@/api/dorms'
import { getEmployeeList } from '@/api/employees'
import { createStay } from '@/api/stays'
import { getDormRooms } from '@/api/dorms'
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
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const baseSchema = z.object({
  employee_id: z.string().min(1, MSG_SELECT_REQUIRED('社員')),
  dorm_id: z.string().min(1, MSG_SELECT_REQUIRED('寮')),
  room_id: z.string().min(1, MSG_SELECT_REQUIRED('部屋')),
  move_in_date: z.date({ error: MSG_REQUIRED('入居日') }),
  move_out_date: z.date().nullable().optional(),
})

const schema = baseSchema.refine(
  (data) => !data.move_out_date || data.move_out_date > data.move_in_date,
  { message: '退寮予定日は入居日より後の日付を選択してください', path: ['move_out_date'] },
)

type FormValues = z.infer<typeof baseSchema>

export default function NewStay() {
  usePageTitle('入居登録')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const preDormId = searchParams.get('dormId') ?? ''
  const preRoomId = searchParams.get('roomId') ?? ''

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      employee_id: '',
      dorm_id: preDormId,
      room_id: preRoomId,
      move_in_date: new Date(),
      move_out_date: null,
    },
  })

  useUnsavedChanges(form.formState.isDirty)

  const selectedDormId = form.watch('dorm_id')

  const { data: dormData } = useQuery({
    queryKey: ['dorms'],
    queryFn: () => getDormList(),
  })

  const { data: employeeData } = useQuery({
    queryKey: ['employees', { living_status: 'not_in_dorm' }],
    queryFn: () => getEmployeeList({ living_status: 'not_in_dorm', page_size: 1000 }),
  })

  const { data: roomData } = useQuery({
    queryKey: ['dorm-rooms', selectedDormId],
    queryFn: () => getDormRooms(selectedDormId),
    enabled: !!selectedDormId,
  })

  const vacantRooms = roomData?.filter((r) => !r.status || r.status === 'vacant') ?? []

  useEffect(() => {
    if (!preRoomId) {
      form.setValue('room_id', '')
    }
  }, [selectedDormId, preRoomId, form])

  const { mutate, isPending } = useMutation({
    mutationFn: (values: FormValues) => {
      return createStay({
        employee_id: values.employee_id,
        room_id: values.room_id,
        move_in_date: format(values.move_in_date, 'yyyy-MM-dd'),
        move_out_date: values.move_out_date ? format(values.move_out_date, 'yyyy-MM-dd') : undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stays'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      toast.success(MSG_MOVE_IN_COMPLETE)
      navigate(-1)
    },
  })

  const moveInDate = form.watch('move_in_date')
  const moveOutDate = form.watch('move_out_date')

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
              <BreadcrumbPage>入居登録</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="text-2xl font-bold text-gray-900">入居登録</h1>
      </div>

      <Card className="max-w-2xl mx-auto bg-white border-gray-300 shadow-md">
        <CardHeader className="pb-3 bg-gray-100 border-b border-gray-200 rounded-t-lg">
          <CardTitle className="text-sm">入居情報を入力</CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <form
            onSubmit={form.handleSubmit((v) => mutate(v))}
            className="space-y-5"
          >
            {/* 社員選択 */}
            <div className="space-y-1.5">
              <Label>社員 *</Label>
              <Select
                value={form.watch('employee_id')}
                onValueChange={(v) => form.setValue('employee_id', v, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="社員を選択" />
                </SelectTrigger>
                <SelectContent>
                  {(employeeData?.items ?? []).map((e) => (
                    <SelectItem key={e.employee_id} value={e.employee_id}>
                      {e.name}（{e.employee_code}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400">※ 現在入居中でない社員のみ表示されます</p>
              {form.formState.errors.employee_id && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.employee_id.message}
                </p>
              )}
            </div>

            {/* 寮選択 */}
            <div className="space-y-1.5">
              <Label>寮 *</Label>
              <Select
                value={form.watch('dorm_id')}
                onValueChange={(v) => {
                  form.setValue('dorm_id', v, { shouldValidate: true })
                  form.setValue('room_id', '')
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="寮を選択" />
                </SelectTrigger>
                <SelectContent>
                  {(dormData?.items ?? []).map((d) => (
                    <SelectItem key={d.dorm_id} value={d.dorm_id}>
                      {d.name}（空き {d.vacant_count ?? 0} 室）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.dorm_id && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.dorm_id.message}
                </p>
              )}
            </div>

            {/* 部屋選択 */}
            <div className="space-y-1.5">
              <Label>部屋 *</Label>
              <Select
                value={form.watch('room_id')}
                onValueChange={(v) => form.setValue('room_id', v, { shouldValidate: true })}
                disabled={!selectedDormId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedDormId ? '部屋を選択' : '寮を先に選択してください'} />
                </SelectTrigger>
                <SelectContent>
                  {vacantRooms.map((r) => (
                    <SelectItem key={r.room_id} value={r.room_id}>
                      {r.room_name}（{(r.daily_rate ?? r.unit_price * r.area_sqm).toLocaleString()}円/日）
                    </SelectItem>
                  ))}
                  {selectedDormId && vacantRooms.length === 0 && (
                    <SelectItem value="__none__" disabled>
                      空き室がありません
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {form.formState.errors.room_id && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.room_id.message}
                </p>
              )}
            </div>

            {/* 入居日 */}
            <div className="space-y-1.5">
              <Label>入居日 *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !moveInDate && 'text-muted-foreground',
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {moveInDate
                      ? format(moveInDate, 'yyyy/MM/dd', { locale: ja })
                      : '日付を選択'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={moveInDate}
                    onSelect={(date) =>
                      form.setValue('move_in_date', date!, { shouldValidate: true })
                    }
                    locale={ja}
                  />
                </PopoverContent>
              </Popover>
              {form.formState.errors.move_in_date && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.move_in_date.message}
                </p>
              )}
            </div>

            {/* 退寮予定日（任意） */}
            <div className="space-y-1.5">
              <Label>退寮予定日（任意）</Label>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'flex-1 justify-start text-left font-normal',
                        !moveOutDate && 'text-muted-foreground',
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {moveOutDate
                        ? format(moveOutDate, 'yyyy/MM/dd', { locale: ja })
                        : '日付を選択'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={moveOutDate ?? undefined}
                      onSelect={(date) =>
                        form.setValue('move_out_date', date ?? null, { shouldValidate: true })
                      }
                      locale={ja}
                      disabled={(date) => date <= moveInDate}
                    />
                  </PopoverContent>
                </Popover>
                {moveOutDate && (
                  <button
                    type="button"
                    onClick={() => form.setValue('move_out_date', null, { shouldValidate: true })}
                    className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                    aria-label="退寮予定日をクリア"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {form.formState.errors.move_out_date && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.move_out_date.message}
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
                className="border-gray-300"
              >
                キャンセル
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isPending ? '登録中...' : '入居登録'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
