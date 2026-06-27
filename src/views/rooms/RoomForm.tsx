import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { MSG_CREATED, MSG_UPDATED } from '@/constants/messages'
import { createRoom, updateRoom } from '@/api/rooms'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useMasterItems } from '@/hooks/useMasters'
import { Checkbox } from '@/components/ui/checkbox'
import type { Room } from '@/types/dorm'
import { roomFormDefaultValues, roomSchema, type RoomFormValues } from './roomSchema'

type FormValues = RoomFormValues

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  dormId: string
  editTarget?: Room | null
  onSuccess?: () => void
}

export function RoomForm({ open, onOpenChange, dormId, editTarget, onSuccess }: Props) {
  const isEdit = !!editTarget
  const [frozenVersion, setFrozenVersion] = useState<number | null>(null)

  const roomTypeItems = useMasterItems('room_type')

  const form = useForm<FormValues>({
    resolver: zodResolver(roomSchema),
    defaultValues: roomFormDefaultValues,
  })

  const watchedArea = form.watch('area_sqm')
  const watchedUnit = form.watch('unit_price')

  // Create mode: auto-fill daily_rate when area × unit is valid
  useEffect(() => {
    if (isEdit) return
    const area = typeof watchedArea === 'number' ? watchedArea : 0
    const unit = typeof watchedUnit === 'number' ? watchedUnit : 0
    if (area > 0 && unit > 0) {
      form.setValue('daily_rate', Math.round(area * unit), { shouldValidate: true })
    }
  }, [watchedArea, watchedUnit, isEdit, form])

  const computedDaily = Math.round(
    (typeof watchedArea === 'number' ? watchedArea : 0) *
    (typeof watchedUnit === 'number' ? watchedUnit : 0),
  )

  useEffect(() => {
    if (open) {
      if (editTarget) {
        setFrozenVersion(editTarget.version)
        form.reset({
          room_name: editTarget.room_name,
          room_type: editTarget.room_type,
          area_sqm: editTarget.area_sqm,
          unit_price: editTarget.unit_price,
          equipment: editTarget.equipment ?? {},
          daily_rate: editTarget.daily_rate ?? 0,
        })
      } else {
        form.reset(roomFormDefaultValues)
      }
    }
    if (!open) {
      setFrozenVersion(null)
    }
  }, [open, editTarget, form])

  const { mutate, isPending } = useMutation({
    mutationFn: (values: FormValues) =>
      isEdit
        ? updateRoom(editTarget!.room_id, { ...values, version: frozenVersion! })
        : createRoom({ ...values, dorm_id: dormId }),
    onSuccess: () => {
      toast.success(isEdit ? MSG_UPDATED('部屋情報') : MSG_CREATED('部屋'))
      onSuccess?.()
      onOpenChange(false)
    },
  })

  const onSubmit = form.handleSubmit((values) => mutate(values))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? '部屋情報を編集' : '部屋を追加'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="room_name">部屋名称 *</Label>
            <Input id="room_name" {...form.register('room_name')} placeholder="例：洋室、手前洋室、中和室" />
            {form.formState.errors.room_name && (
              <p className="text-xs text-destructive">{form.formState.errors.room_name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>部屋種別 *</Label>
            <Select
              value={form.watch('room_type')}
              onValueChange={(v) => form.setValue('room_type', v, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="選択" />
              </SelectTrigger>
              <SelectContent>
                {roomTypeItems.map((item) => (
                  <SelectItem key={item.code} value={item.code}>{item.label_ja}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.room_type && (
              <p className="text-xs text-destructive">{form.formState.errors.room_type.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="area_sqm">部屋面積（㎡）</Label>
              <Input id="area_sqm" type="number" step="0.5" {...form.register('area_sqm', { valueAsNumber: true })} />
              {form.formState.errors.area_sqm && (
                <p className="text-xs text-destructive">{form.formState.errors.area_sqm.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit_price">単価計算用（円/㎡/日）</Label>
              <Input id="unit_price" type="number" step="0.1" {...form.register('unit_price', { valueAsNumber: true })} />
              {form.formState.errors.unit_price && (
                <p className="text-xs text-destructive">{form.formState.errors.unit_price.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label htmlFor="daily_rate">寮費（円/日）*</Label>
              {isEdit && computedDaily > 0 && (
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:underline"
                  onClick={() => form.setValue('daily_rate', computedDaily, { shouldValidate: true })}
                >
                  面積×単価で計算
                </button>
              )}
            </div>
            <Input
              id="daily_rate"
              type="number"
              step="1"
              min="1"
              {...form.register('daily_rate', { valueAsNumber: true })}
            />
            {!isEdit && computedDaily > 0 && (
              <p className="text-xs text-muted-foreground">
                面積 × 単価 = {computedDaily.toLocaleString()}円/日（自動計算）
              </p>
            )}
            {form.formState.errors.daily_rate && (
              <p className="text-xs text-destructive">{form.formState.errors.daily_rate.message}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="equipment_ac"
              checked={form.watch('equipment')?.ac === true}
              onCheckedChange={(checked: boolean | 'indeterminate') => {
                const current = form.getValues('equipment') ?? {}
                form.setValue('equipment', { ...current, ac: checked === true })
              }}
            />
            <Label htmlFor="equipment_ac">エアコンあり</Label>
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
