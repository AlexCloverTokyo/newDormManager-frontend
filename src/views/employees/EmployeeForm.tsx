import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { MSG_CREATED, MSG_UPDATED, MSG_REQUIRED, MSG_SELECT_REQUIRED } from '@/constants/messages'
import { createEmployee, updateEmployee } from '@/api/employees'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { ChevronsUpDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Employee } from '@/types/employee'
import { useMasterItems } from '@/hooks/useMasters'

const schema = z.object({
  employee_code: z.string().min(1, MSG_REQUIRED('社員番号')).max(50),
  name: z.string().min(1, MSG_REQUIRED('氏名')).max(100),
  employee_type: z.string().min(1, MSG_SELECT_REQUIRED('社員区分')),
  gender_type: z.string().min(1, MSG_SELECT_REQUIRED('性別区分')),
  department: z.string().optional(),
  division: z.string().optional(),
  nearest_station: z.string().optional(),
  first_use_date: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editTarget?: Employee | null
}

export function EmployeeForm({ open, onOpenChange, editTarget }: Props) {
  const queryClient = useQueryClient()
  const departments = useMasterItems('department')
  const divisions = useMasterItems('division')
  const stations = useMasterItems('nearest_station')
  const [stationOpen, setStationOpen] = useState(false)
  const isEdit = !!editTarget
  const [frozenVersion, setFrozenVersion] = useState<number | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { employee_code: '', name: '', employee_type: '', gender_type: '', department: '', division: '', nearest_station: '', first_use_date: '' },
  })

  useEffect(() => {
    if (open) {
      if (editTarget) {
        setFrozenVersion(editTarget.version)
        form.reset({
          employee_code: editTarget.employee_code,
          name: editTarget.name,
          employee_type: editTarget.employee_type,
          gender_type: editTarget.gender_type,
          department: editTarget.department ?? '',
          division: editTarget.division ?? '',
          nearest_station: editTarget.nearest_station ?? '',
          first_use_date: editTarget.first_use_date ?? '',
        })
      } else {
        form.reset({ employee_code: '', name: '', employee_type: '', gender_type: '', department: '', division: '', nearest_station: '', first_use_date: '' })
      }
    }
    if (!open) {
      setFrozenVersion(null)
    }
  }, [open, editTarget, form])

  const { mutate, isPending } = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        ...values,
        department: values.department || undefined,
        division: values.division || undefined,
        nearest_station: values.nearest_station || undefined,
        first_use_date: values.first_use_date || undefined,
        ...(isEdit && frozenVersion != null ? { version: frozenVersion } : {}),
      }
      return isEdit
        ? updateEmployee(editTarget!.employee_id, payload)
        : createEmployee(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast.success(isEdit ? MSG_UPDATED('社員情報') : MSG_CREATED('社員'))
      onOpenChange(false)
    },
  })

  const field = (key: keyof FormValues) => form.formState.errors[key]?.message

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? '社員情報を編集' : '社員を新規登録'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit((v) => mutate(v))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="employee_code">社員番号 *</Label>
              <Input id="employee_code" {...form.register('employee_code')} placeholder="例：EMP001" />
              {field('employee_code') && <p className="text-xs text-destructive">{field('employee_code')}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">氏名 *</Label>
              <Input id="name" {...form.register('name')} placeholder="例：山田 太郎" />
              {field('name') && <p className="text-xs text-destructive">{field('name')}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>社員区分 *</Label>
              <Select
                value={form.watch('employee_type')}
                onValueChange={(v) => form.setValue('employee_type', v, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="japanese">日本社員</SelectItem>
                  <SelectItem value="chinese">中国出張社員</SelectItem>
                </SelectContent>
              </Select>
              {field('employee_type') && <p className="text-xs text-destructive">{field('employee_type')}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>性別区分 *</Label>
              <Select
                value={form.watch('gender_type')}
                onValueChange={(v) => form.setValue('gender_type', v, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">男性</SelectItem>
                  <SelectItem value="female">女性</SelectItem>
                </SelectContent>
              </Select>
              {field('gender_type') && <p className="text-xs text-destructive">{field('gender_type')}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>部署</Label>
              <Select
                value={form.watch('department') || 'none'}
                onValueChange={(v) => form.setValue('department', v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選択（任意）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.code} value={d.code}>{d.label_ja}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="first_use_date">初回使用日</Label>
              <Input id="first_use_date" type="date" {...form.register('first_use_date')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>事業部</Label>
              <Select
                value={form.watch('division') || 'none'}
                onValueChange={(v) => form.setValue('division', v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選択（任意）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {divisions.filter(d => d.is_active).map((d) => (
                    <SelectItem key={d.code} value={d.code}>{d.label_ja}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>現場最寄駅</Label>
              <Popover open={stationOpen} onOpenChange={setStationOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={stationOpen}
                    className="w-full justify-between font-normal">
                    {form.watch('nearest_station')
                      ? stations.find(s => s.code === form.watch('nearest_station'))?.label_ja ?? form.watch('nearest_station')
                      : '選択（任意）'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                  <Command>
                    <CommandInput placeholder="駅名を検索..." />
                    <CommandList>
                      <CommandEmpty>見つかりません</CommandEmpty>
                      <CommandGroup>
                        <CommandItem value="__none__" onSelect={() => { form.setValue('nearest_station', ''); setStationOpen(false) }}>
                          <Check className={cn("mr-2 h-4 w-4", !form.watch('nearest_station') ? "opacity-100" : "opacity-0")} />
                          —
                        </CommandItem>
                        {stations.filter(s => s.is_active).map(s => (
                          <CommandItem key={s.code} value={s.label_ja} onSelect={() => { form.setValue('nearest_station', s.code); setStationOpen(false) }}>
                            <Check className={cn("mr-2 h-4 w-4", form.watch('nearest_station') === s.code ? "opacity-100" : "opacity-0")} />
                            {s.label_ja}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
