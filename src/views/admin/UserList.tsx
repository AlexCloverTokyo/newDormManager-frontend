import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Plus, RefreshCw, UserCog } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { changeUserRole, toggleUserStatus, getUserList, inviteUser } from '@/api/users'
import { MSG_INVITE_FAILED } from '@/constants/messages'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { usePageTitle } from '@/hooks/usePageTitle'
import type { UserRole } from '@/types/user'

export default function UserList() {
  usePageTitle('ユーザー管理')
  const qc = useQueryClient()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [form, setForm] = useState({ email: '', role: 'staff' as UserRole })
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: getUserList,
  })
  const users = data?.items ?? []

  const inviteMutation = useMutation({
    mutationFn: () => inviteUser(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setInviteOpen(false)
      setForm({ email: '', role: 'staff' })
      setError(null)
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { msg?: string } } }
      setError(e?.response?.data?.msg ?? MSG_INVITE_FAILED)
    },
  })

  const roleMutation = useMutation({
    mutationFn: ({ user_id, role, version }: { user_id: string; role: UserRole; version: number }) =>
      changeUserRole(user_id, role, version),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const toggleStatusMutation = useMutation({
    mutationFn: ({ user_id, version }: { user_id: string; version: number }) =>
      toggleUserStatus(user_id, version),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const handleInviteOpen = () => {
    setForm({ email: '', role: 'staff' })
    setError(null)
    setInviteOpen(true)
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink asChild><Link to="/admin/settings">管理</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>ユーザー管理</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="text-2xl font-bold text-gray-900">ユーザー管理</h1>
      </div>

      <div className="rounded-lg border border-gray-300 bg-white shadow-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-100">
          <span className="text-sm font-semibold text-gray-800">
            ユーザー一覧
            <span className="ml-2 text-xs font-normal text-gray-400">{users.length} 件</span>
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-8 px-4 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm"
              onClick={handleInviteOpen}
            >
              <Plus className="h-4 w-4" />
              招待
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-gray-600"
              onClick={() => refetch()}
              title="更新"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50/80">
              <tr>
                {['メールアドレス', '権限', 'ステータス', '操作'].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => (
                <tr
                  key={user.user_id}
                  className={`hover:bg-blue-50/30 transition-colors ${user.status === 'disabled' ? 'opacity-50' : ''}`}
                >
                  <td className="px-5 py-3 text-sm font-mono text-gray-600">{user.email}</td>
                  <td className="px-5 py-3">
                    <Badge variant={user.role === 'admin' ? 'blue' : 'gray'}>
                      {user.role === 'admin' ? '管理者' : 'スタッフ'}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant={user.status === 'active' ? 'success' : user.status === 'pending' ? 'warning' : 'gray'}>
                      {user.status === 'active' ? '有効' : user.status === 'pending' ? '招待中' : '無効'}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="text-xs text-gray-500 hover:text-gray-700 hover:underline flex items-center gap-0.5"
                            disabled={user.status === 'disabled' || roleMutation.isPending}
                          >
                            権限変更 <ChevronDown className="h-3 w-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => roleMutation.mutate({ user_id: user.user_id, role: 'admin', version: user.version })}
                            disabled={user.role === 'admin'}
                          >
                            管理者に変更
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => roleMutation.mutate({ user_id: user.user_id, role: 'staff', version: user.version })}
                            disabled={user.role === 'staff'}
                          >
                            スタッフに変更
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {(user.status === 'active' || user.status === 'disabled') && (
                        <button
                          className={`text-xs hover:underline ${user.status === 'active' ? 'text-red-400 hover:text-red-600' : 'text-blue-600 hover:text-blue-800'}`}
                          onClick={() => toggleStatusMutation.mutate({ user_id: user.user_id, version: user.version })}
                          disabled={toggleStatusMutation.isPending}
                        >
                          {user.status === 'active' ? '無効化' : '有効化'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 招待ダイアログ */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <UserCog className="h-4 w-4" />
              ユーザーを招待
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">メールアドレス</Label>
              <Input
                type="email"
                placeholder="user@company.co.jp"
                value={form.email}
                onChange={(e) => {
                  setForm((f) => ({ ...f, email: e.target.value }))
                  setError(null)
                }}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">ロール</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm((f) => ({ ...f, role: v as UserRole }))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">スタッフ</SelectItem>
                  <SelectItem value="admin">管理者</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="border-gray-300 text-gray-600"
              onClick={() => setInviteOpen(false)}
            >
              キャンセル
            </Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => inviteMutation.mutate()}
              disabled={!form.email || inviteMutation.isPending}
            >
              {inviteMutation.isPending ? '送信中...' : '招待する'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
