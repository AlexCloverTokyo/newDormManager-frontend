import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

export type PaperSize = 'a4' | 'a3'

export interface PrintColumnDef {
  key: string
  label: string
  defaultOn: boolean
  locked: boolean
}

export interface PrintConfig {
  paperSize: PaperSize
  columns: string[]
}

const COLUMN_DEFS: PrintColumnDef[] = [
  { key: 'room',       label: '部屋',         defaultOn: true,  locked: true },
  { key: 'name',       label: '氏名',         defaultOn: true,  locked: true },
  { key: 'affiliation',label: '所属',         defaultOn: true,  locked: false },
  { key: 'checkin',    label: '入寮日',       defaultOn: true,  locked: false },
  { key: 'checkout',   label: '退寮日',       defaultOn: true,  locked: false },
  { key: 'status',     label: '状態',         defaultOn: true,  locked: false },
  { key: 'roomType',   label: '部屋種別',     defaultOn: false, locked: false },
  { key: 'ac',         label: 'エアコン',     defaultOn: false, locked: false },
  { key: 'fee',        label: '寮費（円/日）', defaultOn: false, locked: false },
  { key: 'responsible',label: '責任者',       defaultOn: false, locked: false },
]

interface PrintSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (config: PrintConfig) => void
  currentMonth: string
  currentRegion: string
}

export function PrintSettingsDialog({ open, onOpenChange, onConfirm, currentMonth, currentRegion }: PrintSettingsDialogProps) {
  const [paperSize, setPaperSize] = useState<PaperSize>('a4')
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    () => new Set(COLUMN_DEFS.filter(c => c.defaultOn).map(c => c.key))
  )

  function toggleColumn(key: string) {
    setSelectedColumns(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function handleConfirm() {
    onConfirm({
      paperSize,
      columns: COLUMN_DEFS.filter(c => selectedColumns.has(c.key)).map(c => c.key),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>印刷設定</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* 対象情報（読み取り専用） */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted-foreground">対象月：</span>{currentMonth}</div>
            <div><span className="text-muted-foreground">対象地域：</span>{currentRegion}</div>
          </div>

          {/* 用紙サイズ */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">用紙サイズ</Label>
            <RadioGroup value={paperSize} onValueChange={(v) => setPaperSize(v as PaperSize)} className="flex gap-6">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="a4" id="paper-a4" />
                <Label htmlFor="paper-a4" className="font-normal cursor-pointer">A4 横</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="a3" id="paper-a3" />
                <Label htmlFor="paper-a3" className="font-normal cursor-pointer">A3 横</Label>
              </div>
            </RadioGroup>
          </div>

          {/* 表示列 */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">表示列</Label>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {COLUMN_DEFS.map(col => (
                <div key={col.key} className="flex items-center gap-2">
                  <Checkbox
                    id={`col-${col.key}`}
                    checked={selectedColumns.has(col.key)}
                    onCheckedChange={() => toggleColumn(col.key)}
                    disabled={col.locked}
                  />
                  <Label htmlFor={`col-${col.key}`} className={`font-normal cursor-pointer ${col.locked ? 'text-muted-foreground' : ''}`}>
                    {col.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* 注記 */}
          <p className="text-xs text-muted-foreground">
            ※ 印刷プレビュー画面が開いた後、ブラウザ側の用紙サイズ・向きが上記の設定と一致していることを確認してください。
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>キャンセル</Button>
          <Button onClick={handleConfirm}>印刷プレビュー</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { COLUMN_DEFS }
