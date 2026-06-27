import { AlertTriangle, Clock, DoorOpen, User, CalendarCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { RoomStatus } from '@/types/dorm'

interface Props {
  status: RoomStatus | undefined
}

export function RoomStatusBadge({ status }: Props) {
  switch (status) {
    case 'vacant':
      return (
        <Badge variant="gray">
          <DoorOpen className="h-3 w-3" /> 空き
        </Badge>
      )
    case 'reserved':
      return (
        <Badge variant="cyan">
          <CalendarCheck className="h-3 w-3" /> 予約済み
        </Badge>
      )
    case 'occupied':
      return (
        <Badge variant="success">
          <User className="h-3 w-3" /> 入居中
        </Badge>
      )
    case 'leaving_soon':
      return (
        <Badge variant="warning">
          <Clock className="h-3 w-3" /> 退寮予定
        </Badge>
      )
    case 'overdue':
      return (
        <Badge variant="orange">
          <AlertTriangle className="h-3 w-3" /> ⚠ 超期占用
        </Badge>
      )
    default:
      return <Badge variant="gray">—</Badge>
  }
}
