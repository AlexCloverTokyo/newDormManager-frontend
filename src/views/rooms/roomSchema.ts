import { z } from 'zod'
import { MSG_REQUIRED, MSG_SELECT_REQUIRED, MSG_POSITIVE_NUMBER } from '@/constants/messages'

export const roomSchema = z.object({
  room_name: z.string().min(1, MSG_REQUIRED('部屋名称')).max(50),
  room_type: z.string().min(1, MSG_SELECT_REQUIRED('部屋種別')),
  area_sqm: z.number().catch(0).pipe(z.number().min(0).max(1000)),
  unit_price: z.number().catch(0).pipe(z.number().min(0)),
  equipment: z.record(z.string(), z.boolean()),
  daily_rate: z.number().positive(MSG_POSITIVE_NUMBER),
})

export type RoomFormValues = z.infer<typeof roomSchema>

export const roomFormDefaultValues: RoomFormValues = {
  room_name: '',
  room_type: '',
  area_sqm: 0,
  unit_price: 0,
  equipment: {},
  daily_rate: 0,
}
