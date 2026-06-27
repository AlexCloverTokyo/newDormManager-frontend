import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { MSG_CREATED, MSG_UPDATED } from '@/constants/messages'
import { useMasters } from '@/hooks/useMasters'
import { addMasterItem, updateMasterItem, deleteMasterItem } from '@/api/masters'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
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
import { usePageTitle } from '@/hooks/usePageTitle'
import type { MasterItem } from '@/types/master'

const CATEGORIES = [
  { key: 'location',      label: '立地',      protected: false },
  { key: 'room_type',     label: '部屋タイプ', protected: false },
  { key: 'employee_type', label: '社員区分',   protected: false },
  { key: 'department',    label: '部署',       protected: false },
  { key: 'gender_type',   label: '性別区分',   protected: true  },
]

interface ItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: string
  editTarget?: MasterItem | null
}

function ItemDialog({ open, onOpenChange, category, editTarget }: ItemDialogProps) {
  const queryClient = useQueryClient()
  const isEdit = !!editTarget
  const [code, setCode] = useState('')
  const [labelJa, setLabelJa] = useState('')
  const [sortOrder, setSortOrder] = useState('0')
  const [frozenVersion, setFrozenVersion] = useState<number | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      isEdit
        ? updateMasterItem(category, editTarget!.code, { label_ja: labelJa, sort_order: Number(sortOrder), version: frozenVersion! })
        : addMasterItem(category, { code, label_ja: labelJa, sort_order: Number(sortOrder) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['masters'] })
      toast.success(isEdit ? MSG_UPDATED('マスタ値') : MSG_CREATED('マスタ値'))
      onOpenChange(false)
    },
  })

  useEffect(() => {
    if (!open) {
      setFrozenVersion(null)
      return
    }
    if (editTarget) {
      setFrozenVersion(editTarget.version)
      setCode(editTarget.code)
      setLabelJa(editTarget.label_ja)
      setSortOrder(String(editTarget.sort_order))
    } else {
      setCode('')
      setLabelJa('')
      setSortOrder('0')
    }
  }, [open, editTarget])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? '値を編集' : '値を追加'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!isEdit && (
            <div className="space-y-1.5">
              <Label>コード *</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="例: nagoya" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>表示名 (日本語) *</Label>
            <Input value={labelJa} onChange={(e) => setLabelJa(e.target.value)} placeholder="例: 名古屋" />
          </div>
          <div className="space-y-1.5">
            <Label>並び順</Label>
            <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>キャンセル</Button>
          <Button onClick={() => mutate()} disabled={isPending || (!isEdit && !code) || !labelJa}>
            {isPending ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function MasterSettings() {
  usePageTitle('マスタ値管理')
  const [activeTab, setActiveTab] = useState('location')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<MasterItem | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<MasterItem | null>(null)
  const { data: masters, isLoading } = useMasters()
  const queryClient = useQueryClient()

  const activeCat = CATEGORIES.find((c) => c.key === activeTab)!
  const items = masters?.[activeTab] ?? []

  const { mutate: deactivate } = useMutation({
    mutationFn: ({ category, code, version }: { category: string; code: string; version: number }) =>
      deleteMasterItem(category, code, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['masters'] })
      toast.success('無効化しました')
      setDeactivateTarget(null)
    },
  })

  const openAdd = () => {
    setEditTarget(null)
    setDialogOpen(true)
  }

  const openEdit = (item: MasterItem) => {
    setEditTarget(item)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink asChild><Link to="/admin/settings">管理</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>マスタ値管理</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="text-2xl font-bold text-gray-900">マスタ値管理</h1>
      </div>

      {/* タブ */}
      <div className="flex gap-1 border-b border-gray-200">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveTab(cat.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === cat.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {cat.label}
            {cat.protected && <span className="ml-1 text-xs text-gray-400">(固定)</span>}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-gray-300 bg-white shadow-md overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 bg-gray-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-800">{activeCat.label}</span>
          {!activeCat.protected && (
            <Button size="sm" className="h-7 gap-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={openAdd}>
              <Plus className="h-3.5 w-3.5" />
              追加
            </Button>
          )}
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">読み込み中...</div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50/80">
              <tr>
                {['コード', '表示名', '並び順', '状態', '操作'].map((h) => (
                  <th key={h} className="px-5 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.item_id} className="hover:bg-blue-50/20">
                  <td className="px-5 py-2.5 text-xs font-mono text-gray-500">{item.code}</td>
                  <td className="px-5 py-2.5 text-sm">{item.label_ja}</td>
                  <td className="px-5 py-2.5 text-xs tabular-nums text-gray-500">{item.sort_order}</td>
                  <td className="px-5 py-2.5">
                    {item.is_active
                      ? <Badge variant="success">有効</Badge>
                      : <Badge variant="gray">無効</Badge>}
                  </td>
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2.5 text-xs text-gray-600"
                        onClick={() => openEdit(item)}
                      >
                        編集
                      </Button>
                      {!activeCat.protected && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2.5 text-xs text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
                          onClick={() => setDeactivateTarget(item)}
                          disabled={!item.is_active}
                        >
                          無効化
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={activeTab}
        editTarget={editTarget}
      />

      <AlertDialog open={!!deactivateTarget} onOpenChange={(open) => !open && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>「{deactivateTarget?.label_ja}」を無効にしますか？</AlertDialogTitle>
            <AlertDialogDescription>
              無効化したマスタ値は新規登録時に選択できなくなります。既存データには影響しません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deactivateTarget && deactivate({ category: activeTab, code: deactivateTarget.code, version: deactivateTarget.version })}
            >
              無効化
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
