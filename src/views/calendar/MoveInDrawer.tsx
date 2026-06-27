import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ja } from 'react-day-picker/locale'
import { CalendarIcon, X, AlertTriangle, Check, ChevronsUpDown } from 'lucide-react'
import { toast } from 'sonner'
import { MSG_MOVE_IN_COMPLETE } from '@/constants/messages'
import { getEmployeeList } from '@/api/employees'
import { createStay } from '@/api/stays'
import type { MoveInContext } from '@/types/calendar'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

interface MoveInDrawerProps {
  open: boolean
  context: MoveInContext | null
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function MoveInDrawer({ open, context, onOpenChange, onSuccess }: MoveInDrawerProps) {
  const queryClient = useQueryClient()
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [selectedEmployeeName, setSelectedEmployeeName] = useState('')
  const [comboOpen, setComboOpen] = useState(false)
  const [moveOutDate, setMoveOutDate] = useState<Date | null>(null)

  const hasNextOccupied = !!context?.nextOccupiedDate
  const moveOutRequired = hasNextOccupied

  const { data: employeeData, isLoading: employeesLoading } = useQuery({
    queryKey: ['employees', { living_status: 'not_in_dorm' }],
    queryFn: () => getEmployeeList({ living_status: 'not_in_dorm', page_size: 1000 }),
    enabled: open,
  })

  const employees = employeeData?.items ?? []

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      if (!context) throw new Error('No context')
      return createStay({
        employee_id: selectedEmployeeId,
        room_id: context.roomId,
        move_in_date: context.moveInDate,
        move_out_date: moveOutDate ? format(moveOutDate, 'yyyy-MM-dd') : undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      queryClient.invalidateQueries({ queryKey: ['stays'] })
      toast.success(MSG_MOVE_IN_COMPLETE)
      resetForm()
      onSuccess()
    },
    // onError is handled by the global axios interceptor (lib/axios.ts)
    // which already shows toast.error with the backend msg.
    // Drawer stays open because we only close in onSuccess.
  })

  function resetForm() {
    setSelectedEmployeeId('')
    setSelectedEmployeeName('')
    setMoveOutDate(null)
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm()
    onOpenChange(next)
  }

  const canSubmit = selectedEmployeeId && (!moveOutRequired || moveOutDate) && !isPending
  const moveInDateObj = context ? new Date(context.moveInDate + 'T00:00:00') : new Date()

  const maxMoveOutDate = context?.nextOccupiedDate
    ? new Date(context.nextOccupiedDate + 'T00:00:00')
    : undefined

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-[400px] sm:w-[440px]">
        <SheetHeader>
          <SheetTitle>入居登録</SheetTitle>
        </SheetHeader>

        {context && (
          <div className="mt-6 space-y-5">
            {/* Read-only context */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-1.5 text-sm">
              <div className="flex"><span className="text-gray-500 w-16 shrink-0">寮</span><span className="font-medium">{context.dormName}</span></div>
              <div className="flex"><span className="text-gray-500 w-16 shrink-0">部屋</span><span className="font-medium">{context.roomName}</span></div>
              <div className="flex"><span className="text-gray-500 w-16 shrink-0">入居日</span><span className="font-medium">{context.moveInDate}</span></div>
            </div>

            {/* Warning banner for nextOccupiedDate */}
            {hasNextOccupied && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>この部屋は {context.nextOccupiedDate} に次の入居予定があります。退寮予定日の設定が必要です。</span>
              </div>
            )}

            {/* Employee Combobox */}
            <div className="space-y-1.5">
              <Label>社員 *</Label>
              <Popover open={comboOpen} onOpenChange={setComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboOpen}
                    className="w-full justify-between font-normal"
                  >
                    {selectedEmployeeName || '名前・社員番号で検索...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[360px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="名前・社員番号で検索..." />
                    <CommandList>
                      <CommandEmpty>
                        {employeesLoading ? '読み込み中...' : '該当する社員が見つかりません'}
                      </CommandEmpty>
                      <CommandGroup>
                        {employees.map(emp => (
                          <CommandItem
                            key={emp.employee_id}
                            value={`${emp.name} ${emp.employee_code}`}
                            onSelect={() => {
                              setSelectedEmployeeId(emp.employee_id)
                              setSelectedEmployeeName(`${emp.name}（${emp.employee_code}）`)
                              setComboOpen(false)
                            }}
                          >
                            <Check className={cn('mr-2 h-4 w-4', selectedEmployeeId === emp.employee_id ? 'opacity-100' : 'opacity-0')} />
                            {emp.name}（{emp.employee_code}）
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-gray-400">※ 現在入居中でない社員のみ表示されます</p>
            </div>

            {/* Move-out date (optional or required based on nextOccupiedDate) */}
            <div className="space-y-1.5">
              <Label>退寮予定日{moveOutRequired ? ' *' : '（任意）'}</Label>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn('flex-1 justify-start text-left font-normal', !moveOutDate && 'text-muted-foreground')}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {moveOutDate ? format(moveOutDate, 'yyyy/MM/dd') : '日付を選択'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={moveOutDate ?? undefined}
                      onSelect={(date) => setMoveOutDate(date ?? null)}
                      locale={ja}
                      disabled={(date) => {
                        if (date <= moveInDateObj) return true
                        if (maxMoveOutDate && date >= maxMoveOutDate) return true
                        return false
                      }}
                    />
                  </PopoverContent>
                </Popover>
                {moveOutDate && (
                  <button
                    type="button"
                    onClick={() => setMoveOutDate(null)}
                    className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                    aria-label="退寮予定日をクリア"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {moveOutRequired && !moveOutDate && (
                <p className="text-xs text-destructive">次の入居予定があるため、退寮予定日は必須です</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)} className="border-gray-300">
                キャンセル
              </Button>
              <Button
                onClick={() => mutate()}
                disabled={!canSubmit}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isPending ? '登録中...' : '入居登録'}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
