import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Settings } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { getSettings, updateSettings } from '@/api/settings'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'

export default function SystemSettings() {
  usePageTitle('システム設定')
  const qc = useQueryClient()
  const [leavingSoonDays, setLeavingSoonDays] = useState('')
  const [overdueDays, setOverdueDays] = useState('')
  const [allowSameDay, setAllowSameDay] = useState(true)
  const [sameDayFeeBearer, setSameDayFeeBearer] = useState<string>('move_out')
  const [saved, setSaved] = useState(false)
  const frozenVersionRef = useRef<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  })

  useEffect(() => {
    if (data) {
      setLeavingSoonDays(String(data.leaving_soon_threshold_days))
      setOverdueDays(String(data.overdue_threshold_days))
      setAllowSameDay(data.allow_same_day_move_in_out ?? true)
      setSameDayFeeBearer(data.same_day_fee_bearer ?? 'move_out')
      frozenVersionRef.current = data.version
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: () =>
      updateSettings({
        leaving_soon_threshold_days: parseInt(leavingSoonDays),
        overdue_threshold_days: parseInt(overdueDays),
        allow_same_day_move_in_out: allowSameDay,
        same_day_fee_bearer: sameDayFeeBearer as 'move_out' | 'move_in' | 'half',
        version: frozenVersionRef.current!,
      }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      frozenVersionRef.current = result.version
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const isDirty = data
    ? String(data.leaving_soon_threshold_days) !== leavingSoonDays ||
      String(data.overdue_threshold_days) !== overdueDays ||
      (data.allow_same_day_move_in_out ?? true) !== allowSameDay ||
      (data.same_day_fee_bearer ?? 'move_out') !== sameDayFeeBearer
    : false

  useUnsavedChanges(isDirty)

  const isValid =
    !!leavingSoonDays && parseInt(leavingSoonDays) >= 1 &&
    !!overdueDays && parseInt(overdueDays) >= 0

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold text-gray-900">システム設定</h1>

      {isLoading ? (
        <Skeleton className="h-48 w-full max-w-xl" />
      ) : (
        <Card className="bg-white border-gray-300 shadow-md max-w-xl">
          <CardHeader className="pb-3 bg-gray-100 border-b border-gray-200 rounded-t-lg">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Settings className="h-4 w-4" />
              アラート設定
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">
                退寮予定アラート閾値
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={leavingSoonDays}
                  onChange={(e) => { setLeavingSoonDays(e.target.value); setSaved(false) }}
                  className="h-9 w-32 text-sm"
                />
                <span className="text-sm text-gray-500">日</span>
              </div>
              <p className="text-xs text-gray-400">退寮予定日まで この日数以内になるとアラート表示します</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">
                超過滞在アラート閾値
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  value={overdueDays}
                  onChange={(e) => { setOverdueDays(e.target.value); setSaved(false) }}
                  className="h-9 w-32 text-sm"
                />
                <span className="text-sm text-gray-500">日</span>
              </div>
              <p className="text-xs text-gray-400">退寮予定日を超えて この日数以上在籍するとアラート表示します</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">
                入退寮の同日許可
              </Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="allowSameDay"
                  checked={allowSameDay}
                  onCheckedChange={(v) => { setAllowSameDay(v === true); setSaved(false) }}
                />
                <label htmlFor="allowSameDay" className="text-sm text-gray-700 cursor-pointer">
                  同じ日に退寮と入寮を許可する
                </label>
              </div>
              <p className="text-xs text-gray-400">オンの場合、前の入居者の退寮日と新しい入居者の入寮日が同日でも登録できます</p>
            </div>

            {allowSameDay && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  同日入退寮の寮費負担
                </Label>
                <div className="space-y-2">
                  {[
                    { value: 'move_out', label: '退寮者が負担' },
                    { value: 'move_in', label: '入寮者が負担' },
                    { value: 'half', label: '退寮者・入寮者で折半' },
                  ].map((opt) => (
                    <div key={opt.value} className="flex items-center gap-2">
                      <input
                        type="radio"
                        id={`fee-${opt.value}`}
                        name="sameDayFeeBearer"
                        value={opt.value}
                        checked={sameDayFeeBearer === opt.value}
                        onChange={(e) => { setSameDayFeeBearer(e.target.value); setSaved(false) }}
                        className="h-4 w-4 text-blue-600"
                      />
                      <label htmlFor={`fee-${opt.value}`} className="text-sm text-gray-700 cursor-pointer">
                        {opt.label}
                      </label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400">同日に退寮・入寮がある場合、その日の寮費をどちらが負担するか設定します</p>
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <Button
                size="sm"
                className="h-8 px-5 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => saveMutation.mutate()}
                disabled={!isDirty || saveMutation.isPending || !isValid}
              >
                {saveMutation.isPending ? '保存中...' : '保存'}
              </Button>
              {saved && (
                <span className="text-xs text-green-600 font-medium">✓ 保存しました</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
