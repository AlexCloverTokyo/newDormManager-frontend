import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useForm, type UseFormReturn } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { MSG_CREATED, MSG_UPDATED, MSG_REQUIRED, MSG_SELECT_REQUIRED, MSG_MIN_INT } from '@/constants/messages'
import { createDorm, updateDorm } from '@/api/dorms'
import { createRoom } from '@/api/rooms'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Textarea } from '@/components/ui/textarea'
import { useMasterItems } from '@/hooks/useMasters'
import type { Dorm, DormPayload, Room } from '@/types/dorm'
import type { MasterItem } from '@/types/master'
import { roomFormDefaultValues, roomSchema, type RoomFormValues } from '../rooms/roomSchema'

const GENDER_UNSET = 'unset'

const dormSchema = z.object({
  name: z.string().min(1, MSG_REQUIRED('寮名称')).max(100),
  address: z.string().min(1, MSG_REQUIRED('住所')).max(255),
  floor_plan: z.string().max(20).optional(),
  gender_type: z.string(),
  location: z.string().min(1, MSG_SELECT_REQUIRED('所在地')),
  note: z.string().max(500).optional(),
  planned_room_count: z.number().int().min(1, MSG_MIN_INT(1)),
})

type FormValues = z.infer<typeof dormSchema>

const NEW_DORM_DEFAULTS = {
  name: '',
  address: '',
  floor_plan: '',
  gender_type: GENDER_UNSET,
  note: '',
  planned_room_count: 1,
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editTarget?: Dorm | null
}

export function DormForm({ open, onOpenChange, editTarget }: Props) {
  const queryClient = useQueryClient()
  const isEdit = !!editTarget

  const locationItems = useMasterItems('location')
  const genderItems = useMasterItems('gender_type')
  const roomTypeItems = useMasterItems('room_type')
  const roomTypeLabelMap = useMemo(
    () => Object.fromEntries(roomTypeItems.map((i) => [i.code, i.label_ja])),
    [roomTypeItems],
  )

  const [step, setStep] = useState<1 | 2>(1)
  const [createdDorm, setCreatedDorm] = useState<Dorm | null>(null)
  const [registeredRooms, setRegisteredRooms] = useState<Room[]>([])
  const [frozenVersion, setFrozenVersion] = useState<number | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(dormSchema),
    defaultValues: NEW_DORM_DEFAULTS,
  })

  const roomForm = useForm<RoomFormValues>({
    resolver: zodResolver(roomSchema),
    defaultValues: roomFormDefaultValues,
  })

  useEffect(() => {
    if (open) {
      if (editTarget) {
        setFrozenVersion(editTarget.version)
        form.reset({
          name: editTarget.name,
          address: editTarget.address,
          floor_plan: editTarget.floor_plan,
          gender_type: editTarget.gender_type ?? GENDER_UNSET,
          location: editTarget.location,
          note: editTarget.note ?? '',
          planned_room_count: editTarget.planned_room_count,
        })
      } else {
        form.reset(NEW_DORM_DEFAULTS)
        roomForm.reset(roomFormDefaultValues)
        setStep(1)
        setCreatedDorm(null)
        setRegisteredRooms([])
      }
    }
    if (!open) {
      setFrozenVersion(null)
    }
  }, [open, editTarget, form, roomForm])

  const { mutate: submitDorm, isPending: isSavingDorm } = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: DormPayload = {
        name: values.name,
        address: values.address,
        floor_plan: values.floor_plan ?? '',
        gender_type: values.gender_type === GENDER_UNSET ? null : values.gender_type,
        location: values.location,
        note: values.note,
        planned_room_count: values.planned_room_count,
        ...(isEdit && frozenVersion != null ? { version: frozenVersion } : {}),
      }
      return isEdit ? updateDorm(editTarget!.dorm_id, payload) : createDorm(payload)
    },
    onSuccess: (dorm) => {
      queryClient.invalidateQueries({ queryKey: ['dorms'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      if (isEdit) {
        toast.success(MSG_UPDATED('寮情報'))
        onOpenChange(false)
      } else {
        toast.success(MSG_CREATED('寮'))
        setCreatedDorm(dorm)
        setStep(2)
      }
    },
  })

  const { mutate: submitRoom, isPending: isSavingRoom } = useMutation({
    mutationFn: (values: RoomFormValues) =>
      createRoom({ ...values, dorm_id: createdDorm!.dorm_id }),
    onSuccess: (room) => {
      setRegisteredRooms((prev) => [...prev, room])
      roomForm.reset(roomFormDefaultValues)
      queryClient.invalidateQueries({ queryKey: ['dorm-rooms', createdDorm!.dorm_id] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      toast.success(MSG_CREATED('部屋'))
    },
  })

  const onSubmitDorm = form.handleSubmit((values) => submitDorm(values))
  const onSubmitRoom = roomForm.handleSubmit((values) => submitRoom(values))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {isEdit ? (
          <>
            <DialogHeader>
              <DialogTitle>寮情報を編集</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmitDorm} className="space-y-4">
              <DormFormFields
                form={form}
                locationItems={locationItems}
                genderItems={genderItems}
                genderDisabled={editTarget?.gender_locked === true}
                genderHelpText={editTarget?.gender_locked === true ? '入居履歴が存在するため変更できません' : undefined}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  キャンセル
                </Button>
                <Button type="submit" disabled={isSavingDorm}>
                  {isSavingDorm ? '保存中...' : '保存'}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle>寮を新規登録（Step 1/2：寮情報を登録）</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmitDorm} className="space-y-4">
              <DormFormFields
                form={form}
                locationItems={locationItems}
                genderItems={genderItems}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  キャンセル
                </Button>
                <Button type="submit" disabled={isSavingDorm}>
                  {isSavingDorm ? '登録中...' : '次へ（寮を作成）'}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : createdDorm ? (
          <Step2RoomForm
            createdDorm={createdDorm}
            registeredRooms={registeredRooms}
            roomForm={roomForm}
            roomTypeItems={roomTypeItems}
            roomTypeLabelMap={roomTypeLabelMap}
            onSubmitRoom={onSubmitRoom}
            isSavingRoom={isSavingRoom}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function DormFormFields({
  form,
  locationItems,
  genderItems,
  genderDisabled,
  genderHelpText,
}: {
  form: UseFormReturn<FormValues>
  locationItems: MasterItem[]
  genderItems: MasterItem[]
  genderDisabled?: boolean
  genderHelpText?: string
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="name">寮名称 *</Label>
        <Input id="name" {...form.register('name')} placeholder="例：豊洲C寮" />
        {form.formState.errors.name && (
          <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="address">住所 *</Label>
        <Input id="address" {...form.register('address')} placeholder="例：東京都江東区豊洲1-1-1" />
        {form.formState.errors.address && (
          <p className="text-xs text-destructive">{form.formState.errors.address.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="floor_plan">間取り</Label>
          <Input id="floor_plan" {...form.register('floor_plan')} placeholder="例：3DK" />
          {form.formState.errors.floor_plan && (
            <p className="text-xs text-destructive">{form.formState.errors.floor_plan.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>所在地 *</Label>
          <Select
            value={form.watch('location')}
            onValueChange={(v) => form.setValue('location', v, { shouldValidate: true })}
          >
            <SelectTrigger>
              <SelectValue placeholder="選択" />
            </SelectTrigger>
            <SelectContent>
              {locationItems.map((item) => (
                <SelectItem key={item.code} value={item.code}>{item.label_ja}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.location && (
            <p className="text-xs text-destructive">{form.formState.errors.location.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>寮種別</Label>
        {genderHelpText && (
          <p className="text-xs text-muted-foreground">{genderHelpText}</p>
        )}
        <Select
          value={form.watch('gender_type')}
          onValueChange={(v) => form.setValue('gender_type', v, { shouldValidate: true })}
          disabled={genderDisabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="選択" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={GENDER_UNSET}>未定</SelectItem>
            {genderItems.map((item) => (
              <SelectItem key={item.code} value={item.code}>{item.label_ja}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.formState.errors.gender_type && (
          <p className="text-xs text-destructive">{form.formState.errors.gender_type.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="planned_room_count">予定部屋数 *</Label>
        <Input id="planned_room_count" type="number" min={1} step={1} {...form.register('planned_room_count', { valueAsNumber: true })} />
        {form.formState.errors.planned_room_count && (
          <p className="text-xs text-destructive">{form.formState.errors.planned_room_count.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="note">備考</Label>
        <Textarea id="note" {...form.register('note')} rows={2} placeholder="任意" />
      </div>
    </>
  )
}

function Step2RoomForm({
  createdDorm,
  registeredRooms,
  roomForm,
  roomTypeItems,
  roomTypeLabelMap,
  onSubmitRoom,
  isSavingRoom,
  onClose,
}: {
  createdDorm: Dorm
  registeredRooms: Room[]
  roomForm: UseFormReturn<RoomFormValues>
  roomTypeItems: MasterItem[]
  roomTypeLabelMap: Record<string, string>
  onSubmitRoom: () => void
  isSavingRoom: boolean
  onClose: () => void
}) {
  const reachedLimit = registeredRooms.length >= createdDorm.planned_room_count

  const areaVal = roomForm.watch('area_sqm')
  const unitVal = roomForm.watch('unit_price')

  useEffect(() => {
    const area = typeof areaVal === 'number' ? areaVal : 0
    const unit = typeof unitVal === 'number' ? unitVal : 0
    if (area > 0 && unit > 0) {
      roomForm.setValue('daily_rate', Math.round(area * unit), { shouldValidate: true })
    }
  }, [areaVal, unitVal, roomForm])

  const computedDaily = Math.round(
    (typeof areaVal === 'number' ? areaVal : 0) * (typeof unitVal === 'number' ? unitVal : 0),
  )

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          寮を新規登録（Step 2/2：部屋を登録） — 登録済み {registeredRooms.length} / 予定 {createdDorm.planned_room_count}
        </DialogTitle>
      </DialogHeader>

      {registeredRooms.length > 0 && (
        <div className="space-y-1">
          {registeredRooms.map((room) => (
            <p key={room.room_id} className="text-sm text-gray-600">
              ✓ {room.room_name}（{roomTypeLabelMap[room.room_type] ?? room.room_type}/{(room.daily_rate ?? room.unit_price * room.area_sqm).toLocaleString()}円/日/空調{room.equipment?.ac ? 'あり' : 'なし'}）
            </p>
          ))}
        </div>
      )}

      <form onSubmit={onSubmitRoom} className="space-y-4">
        {!reachedLimit && (
          <>
            <div className="text-sm font-medium text-gray-700">部屋を追加</div>

            <div className="space-y-1.5">
              <Label htmlFor="room_name">部屋名称 *</Label>
              <Input id="room_name" {...roomForm.register('room_name')} placeholder="例：洋室、手前洋室、中和室" />
              {roomForm.formState.errors.room_name && (
                <p className="text-xs text-destructive">{roomForm.formState.errors.room_name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>部屋種別 *</Label>
              <Select
                value={roomForm.watch('room_type')}
                onValueChange={(v) => roomForm.setValue('room_type', v, { shouldValidate: true })}
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
              {roomForm.formState.errors.room_type && (
                <p className="text-xs text-destructive">{roomForm.formState.errors.room_type.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="area_sqm">部屋面積（㎡）</Label>
                <Input id="area_sqm" type="number" step="0.5" {...roomForm.register('area_sqm', { valueAsNumber: true })} />
                {roomForm.formState.errors.area_sqm && (
                  <p className="text-xs text-destructive">{roomForm.formState.errors.area_sqm.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unit_price">単価計算用（円/㎡/日）</Label>
                <Input id="unit_price" type="number" step="0.1" {...roomForm.register('unit_price', { valueAsNumber: true })} />
                {roomForm.formState.errors.unit_price && (
                  <p className="text-xs text-destructive">{roomForm.formState.errors.unit_price.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="daily_rate">寮費（円/日）*</Label>
              <Input
                id="daily_rate"
                type="number"
                step="1"
                min="1"
                {...roomForm.register('daily_rate', { valueAsNumber: true })}
              />
              {computedDaily > 0 && (
                <p className="text-xs text-muted-foreground">
                  面積 × 単価 = {computedDaily.toLocaleString()}円/日（自動計算）
                </p>
              )}
              {roomForm.formState.errors.daily_rate && (
                <p className="text-xs text-destructive">{roomForm.formState.errors.daily_rate.message}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="equipment_ac"
                checked={roomForm.watch('equipment')?.ac === true}
                onCheckedChange={(checked: boolean | 'indeterminate') => {
                  const current = roomForm.getValues('equipment') ?? {}
                  roomForm.setValue('equipment', { ...current, ac: checked === true })
                }}
              />
              <Label htmlFor="equipment_ac">エアコンあり</Label>
            </div>
          </>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" className="bg-gray-700 text-white hover:bg-gray-800 hover:text-white" onClick={onClose}>
            完了
          </Button>
          {!reachedLimit && (
            <Button type="submit" disabled={isSavingRoom}>
              {isSavingRoom ? '保存中...' : `保存して次へ（${registeredRooms.length + 1}/${createdDorm.planned_room_count}）`}
            </Button>
          )}
        </DialogFooter>
      </form>
    </>
  )
}
