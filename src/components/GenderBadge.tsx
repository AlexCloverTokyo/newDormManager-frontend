import { Badge } from '@/components/ui/badge'

interface Props {
  gender: string | null | undefined
}

export function GenderBadge({ gender }: Props) {
  if (gender === 'male') {
    return <Badge variant="blue">♂ 男性寮</Badge>
  }
  if (gender === 'female') {
    return <Badge variant="pink">♀ 女性寮</Badge>
  }
  return <Badge variant="gray">未定</Badge>
}
