import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { MSG_TEMPLATE_DOWNLOAD_FAILED, MSG_PREVIEW_FAILED, MSG_IMPORT_FAILED } from '@/constants/messages'
import { Button } from '@/components/ui/button'
import {
  getDormImportTemplate,
  previewDormImport,
  executeDormImport,
} from '@/api/importDorms'
import type {
  DormImportPreviewResponse,
  DormImportExecuteResponse,
} from '@/api/importDorms'
import {
  getEmployeeImportTemplate,
  previewEmployeeImport,
  executeEmployeeImport,
} from '@/api/importEmployees'
import type {
  EmployeeImportPreviewResponse,
  EmployeeImportExecuteResponse,
} from '@/api/importEmployees'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useMasterItems } from '@/hooks/useMasters'

// ── ステップインジケーター ──────────────────────────────
type Step = 'upload' | 'preview' | 'result'

function StepIndicator({ current }: { current: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: 'upload', label: 'アップロード' },
    { id: 'preview', label: 'プレビュー' },
    { id: 'result', label: '完了' },
  ]
  const currentIdx = steps.findIndex((s) => s.id === current)
  return (
    <div className="rounded-lg border border-gray-300 bg-white shadow-sm px-6 py-4">
      <div className="flex items-center gap-0">
        {steps.map((step, i) => {
          const isActive = step.id === current
          const isDone = i < currentIdx
          return (
            <div key={step.id} className="flex items-center">
              <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-colors
                ${isActive ? 'bg-blue-600 text-white' : isDone ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                <span className={`flex items-center justify-center h-4 w-4 rounded-full text-xs font-bold
                  ${isActive ? 'bg-white/20 text-white' : isDone ? 'bg-green-200 text-green-700' : 'bg-gray-200 text-gray-400'}`}>
                  {isDone ? '✓' : i + 1}
                </span>
                {step.label}
              </div>
              {i < steps.length - 1 && (
                <div className={`h-0.5 w-8 mx-1 ${isDone ? 'bg-green-300' : 'bg-gray-200'}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 社員・入居履歴タブ ────────────────────────────────────
function EmployeeImportWizard() {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [previewData, setPreviewData] = useState<EmployeeImportPreviewResponse | null>(null)
  const [result, setResult] = useState<EmployeeImportExecuteResponse | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) setFile(f)
  }
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setFile(f)
    e.target.value = ''
  }

  const handleDownloadTemplate = async () => {
    try {
      const blob = await getEmployeeImportTemplate({ skipErrorToast: true })
      const url = URL.createObjectURL(blob as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'employee_import_template.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error(MSG_TEMPLATE_DOWNLOAD_FAILED)
    }
  }

  const handlePreview = async () => {
    if (!file) return
    setIsLoading(true)
    try {
      const data = await previewEmployeeImport(file, { skipErrorToast: true })
      setPreviewData(data)
      setStep('preview')
    } catch {
      toast.error(MSG_PREVIEW_FAILED)
    } finally {
      setIsLoading(false)
    }
  }

  const handleExecute = async () => {
    if (!previewData) return
    setIsLoading(true)
    try {
      const data = await executeEmployeeImport(previewData.valid_rows, { skipErrorToast: true })
      setResult(data)
      setStep('result')
    } catch {
      toast.error(MSG_IMPORT_FAILED)
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setStep('upload')
    setFile(null)
    setPreviewData(null)
    setResult(null)
  }

  const hasBlockingErrors = (previewData?.invalid_rows.length ?? 0) > 0

  const empTypeLabel = (t: string) =>
    t === 'japanese' ? '日本社員' : t === 'chinese' ? '中国出張社員' : t

  return (
    <div className="space-y-3">
      <StepIndicator current={step} />

      {step === 'upload' && (
        <div className="rounded-lg border border-gray-300 bg-white shadow-md overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 bg-gray-100">
            <span className="text-sm font-semibold text-gray-800">ファイルのアップロード</span>
          </div>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="h-8 gap-1.5 border-gray-300 text-gray-600"
                onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4" />テンプレートをダウンロード
              </Button>
              <span className="text-xs text-gray-400">
                テンプレートに必要事項を記入してからアップロードしてください
              </span>
            </div>
            <div onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors
                ${dragOver ? 'border-blue-400 bg-blue-50' : file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}`}>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileSelect} />
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileSpreadsheet className="h-10 w-10 text-green-500" />
                  <p className="text-sm font-medium text-green-700">{file.name}</p>
                  <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-10 w-10 text-gray-300" />
                  <p className="text-sm font-medium text-gray-500">.xlsx ファイルをドロップ、またはクリックして選択</p>
                  <p className="text-xs text-gray-400">最大 10MB</p>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <Button size="sm" className="h-8 px-5 bg-blue-600 hover:bg-blue-700 text-white"
                disabled={!file || isLoading} onClick={handlePreview}>
                {isLoading ? '解析中...' : '次へ'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 'preview' && previewData && (
        <div className="space-y-3">
          {/* サマリーバー */}
          <div className="rounded-lg border border-gray-300 bg-white shadow-sm px-5 py-3">
            <div className="flex flex-wrap gap-6 text-sm">
              {previewData.summary.new_employees > 0 && (
                <span className="text-gray-600">新規社員 <strong className="text-gray-900">{previewData.summary.new_employees}</strong> 件</span>
              )}
              {previewData.summary.existing_employees > 0 && (
                <span className="text-amber-600">既存社員 <strong>{previewData.summary.existing_employees}</strong> 件（入居履歴のみ追加）</span>
              )}
              <span className="text-gray-600">入居履歴 <strong className="text-gray-900">{previewData.summary.total_stays}</strong> 件</span>
              {previewData.summary.invalid_rows > 0 && (
                <span className="text-red-600">エラー行 <strong>{previewData.summary.invalid_rows}</strong> 件</span>
              )}
            </div>
          </div>

          {/* エラー行 */}
          {previewData.invalid_rows.length > 0 && (
            <div className="rounded-lg border border-gray-300 bg-white shadow-md overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 bg-gray-100">
                <span className="text-sm font-semibold text-gray-800">エラー行</span>
              </div>
              <table className="w-full">
                <thead className="border-b border-gray-200 bg-gray-50/80">
                  <tr>
                    {['行番号', '社員番号', 'エラー内容'].map((h) => (
                      <th key={h} className="px-5 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {previewData.invalid_rows.map((row, i) => (
                    <tr key={i} className="bg-red-50">
                      <td className="px-5 py-2.5 text-xs tabular-nums font-mono">{row.row_number}</td>
                      <td className="px-5 py-2.5 text-xs font-mono text-gray-600">{row.employee_code ?? '—'}</td>
                      <td className="px-5 py-2.5 text-xs text-gray-700">{row.errors.join('、')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 有効行プレビュー */}
          {previewData.valid_rows.length > 0 && (
            <div className="rounded-lg border border-gray-300 bg-white shadow-md overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 bg-gray-100">
                <span className="text-sm font-semibold text-gray-800">取込プレビュー</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-gray-200 bg-gray-50/80">
                    <tr>
                      {['社員番号', '氏名', '区分', '寮名', '部屋名', '入居日', '退寮日', '責任者', '備考'].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewData.valid_rows.slice(0, 50).map((row, i) => (
                      <tr key={i} className={row.warnings.length > 0 ? 'bg-amber-50/60' : 'hover:bg-blue-50/20'}>
                        <td className="px-4 py-2 text-xs font-mono">{row.employee_code}</td>
                        <td className="px-4 py-2 text-xs">{row.name}</td>
                        <td className="px-4 py-2 text-xs">{empTypeLabel(row.employee_type)}</td>
                        <td className="px-4 py-2 text-xs">{row.dorm_name}</td>
                        <td className="px-4 py-2 text-xs">{row.room_name}</td>
                        <td className="px-4 py-2 text-xs tabular-nums">{row.move_in_date}</td>
                        <td className="px-4 py-2 text-xs tabular-nums">{row.move_out_date ?? '—'}</td>
                        <td className="px-4 py-2 text-xs">{row.is_responsible ? '✓' : ''}</td>
                        <td className="px-4 py-2 text-xs text-amber-600">
                          {row.warnings.length > 0 ? row.warnings[0] : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 border-gray-300 text-gray-600"
              onClick={() => setStep('upload')}>
              <ArrowLeft className="h-4 w-4" />戻る
            </Button>
            <div className="flex items-center gap-3">
              {hasBlockingErrors && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  エラーを修正してから再アップロードしてください
                </p>
              )}
              <Button size="sm" className="h-8 px-5 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40"
                disabled={hasBlockingErrors || previewData.valid_rows.length === 0 || isLoading} onClick={handleExecute}>
                {isLoading ? '取込中...' : '取込実行'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 'result' && result && (
        <div className="rounded-lg border border-gray-300 bg-white shadow-md overflow-hidden">
          <div className="p-10 flex flex-col items-center gap-5">
            <CheckCircle2 className="h-14 w-14 text-green-500" />
            <p className="text-lg font-semibold text-gray-900">取込が完了しました</p>
            <div className="flex gap-8 text-center">
              <div className="flex flex-col items-center gap-1">
                <span className="text-3xl font-bold tabular-nums text-blue-600">{result.imported_employees}</span>
                <span className="text-xs text-gray-500">社員 新規</span>
              </div>
              {result.skipped_employees > 0 && (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-3xl font-bold tabular-nums text-amber-500">{result.skipped_employees}</span>
                  <span className="text-xs text-gray-500">既存社員</span>
                </div>
              )}
              <div className="flex flex-col items-center gap-1">
                <span className="text-3xl font-bold tabular-nums text-blue-600">{result.added_stays}</span>
                <span className="text-xs text-gray-500">入居履歴 追加</span>
              </div>
            </div>
            <Button variant="outline" size="sm" className="mt-2 h-8 border-gray-300 text-gray-600"
              onClick={handleReset}>最初に戻る</Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 寮・部屋マスタタブ ────────────────────────────────────
function DormImportWizard() {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [previewData, setPreviewData] = useState<DormImportPreviewResponse | null>(null)
  const [result, setResult] = useState<DormImportExecuteResponse | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const roomTypeItems = useMasterItems('room_type')
  const roomTypeLabel = (code: string) =>
    roomTypeItems.find((m) => m.code === code)?.label_ja ?? code

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && f.name.endsWith('.xlsx')) setFile(f)
  }
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setFile(f)
    e.target.value = ''
  }

  const handleDownloadTemplate = async () => {
    try {
      const blob = await getDormImportTemplate({ skipErrorToast: true })
      const url = URL.createObjectURL(blob as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'dorm_master_template.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error(MSG_TEMPLATE_DOWNLOAD_FAILED)
    }
  }

  const handlePreview = async () => {
    if (!file) return
    setIsLoading(true)
    try {
      const data = await previewDormImport(file, { skipErrorToast: true })
      setPreviewData(data)
      setStep('preview')
    } catch {
      toast.error(MSG_PREVIEW_FAILED)
    } finally {
      setIsLoading(false)
    }
  }

  const handleExecute = async () => {
    if (!previewData) return
    setIsLoading(true)
    try {
      const data = await executeDormImport(previewData.valid_rows, { skipErrorToast: true })
      setResult(data)
      setStep('result')
    } catch {
      toast.error(MSG_IMPORT_FAILED)
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setStep('upload')
    setFile(null)
    setPreviewData(null)
    setResult(null)
  }

  const hasBlockingErrors = (previewData?.invalid_rows.length ?? 0) > 0

  return (
    <div className="space-y-3">
      <StepIndicator current={step} />

      {step === 'upload' && (
        <div className="rounded-lg border border-gray-300 bg-white shadow-md overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 bg-gray-100">
            <span className="text-sm font-semibold text-gray-800">ファイルのアップロード</span>
          </div>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="h-8 gap-1.5 border-gray-300 text-gray-600" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4" />テンプレートをダウンロード
              </Button>
              <span className="text-xs text-gray-400">テンプレートに必要事項を記入してからアップロードしてください</span>
            </div>
            <div onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors
                ${dragOver ? 'border-blue-400 bg-blue-50' : file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}`}>
              <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleFileSelect} />
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileSpreadsheet className="h-10 w-10 text-green-500" />
                  <p className="text-sm font-medium text-green-700">{file.name}</p>
                  <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-10 w-10 text-gray-300" />
                  <p className="text-sm font-medium text-gray-500">.xlsx ファイルをドロップ、またはクリックして選択</p>
                  <p className="text-xs text-gray-400">最大 10MB</p>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <Button size="sm" className="h-8 px-5 bg-blue-600 hover:bg-blue-700 text-white"
                disabled={!file || isLoading} onClick={handlePreview}>
                {isLoading ? '解析中...' : '次へ'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 'preview' && previewData && (
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-300 bg-white shadow-sm px-5 py-3">
            <div className="flex flex-wrap gap-6 text-sm">
              <span className="text-gray-600">新規寮 <strong className="text-gray-900">{previewData.summary.new_dorms}</strong> 件</span>
              <span className="text-gray-600">既存寮 <strong className="text-gray-900">{previewData.summary.existing_dorms}</strong> 件</span>
              <span className="text-gray-600">部屋 <strong className="text-gray-900">{previewData.summary.total_rooms}</strong> 件</span>
              {previewData.summary.skip_rooms > 0 && <span className="text-amber-600">スキップ <strong>{previewData.summary.skip_rooms}</strong> 件</span>}
              {previewData.invalid_rows.length > 0 && <span className="text-red-600">エラー行 <strong>{previewData.invalid_rows.length}</strong> 件</span>}
            </div>
          </div>

          {previewData.invalid_rows.length > 0 && (
            <div className="rounded-lg border border-gray-300 bg-white shadow-md overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 bg-gray-100">
                <span className="text-sm font-semibold text-gray-800">エラー行</span>
              </div>
              <table className="w-full">
                <thead className="border-b border-gray-200 bg-gray-50/80">
                  <tr>
                    {['行番号', '寮名', '部屋名', 'エラー内容'].map((h) => (
                      <th key={h} className="px-5 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {previewData.invalid_rows.map((row, i) => (
                    <tr key={i} className="bg-red-50">
                      <td className="px-5 py-2.5 text-xs tabular-nums font-mono">{row.row_number}</td>
                      <td className="px-5 py-2.5 text-xs text-gray-600">{row.dorm_name ?? '—'}</td>
                      <td className="px-5 py-2.5 text-xs text-gray-600">{row.room_name ?? '—'}</td>
                      <td className="px-5 py-2.5 text-xs text-gray-700">{row.errors.join('、')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {previewData.valid_rows.length > 0 && (
            <div className="rounded-lg border border-gray-300 bg-white shadow-md overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 bg-gray-100">
                <span className="text-sm font-semibold text-gray-800">取込プレビュー</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-gray-200 bg-gray-50/80">
                    <tr>
                      {['寮名', '部屋名', '部屋タイプ', '単価(円/日)', '空調'].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewData.valid_rows.slice(0, 50).map((row, i) => (
                      <tr key={i} className="hover:bg-blue-50/20">
                        <td className="px-4 py-2 text-xs">{row.dorm_name}</td>
                        <td className="px-4 py-2 text-xs">{row.room_name}</td>
                        <td className="px-4 py-2 text-xs">{row.room_type ? roomTypeLabel(row.room_type) : '—'}</td>
                        <td className="px-4 py-2 text-xs tabular-nums">{(row.daily_rate ?? (row.unit_price ?? 0) * (row.area_sqm ?? 0)).toLocaleString()}</td>
                        <td className="px-4 py-2 text-xs">{row.equipment?.ac ? 'YES' : 'NO'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 border-gray-300 text-gray-600" onClick={() => setStep('upload')}>
              <ArrowLeft className="h-4 w-4" />戻る
            </Button>
            <div className="flex items-center gap-3">
              {hasBlockingErrors && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />エラーを修正してから再アップロードしてください
                </p>
              )}
              <Button size="sm" className="h-8 px-5 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40"
                disabled={hasBlockingErrors || isLoading} onClick={handleExecute}>
                {isLoading ? '取込中...' : '取込実行'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 'result' && result && (
        <div className="rounded-lg border border-gray-300 bg-white shadow-md overflow-hidden">
          <div className="p-10 flex flex-col items-center gap-5">
            <CheckCircle2 className="h-14 w-14 text-green-500" />
            <p className="text-lg font-semibold text-gray-900">データの取込が完了しました</p>
            <div className="flex gap-10 text-center">
              <div className="flex flex-col items-center gap-1">
                <span className="text-3xl font-bold tabular-nums text-blue-600">{result.created_dorms}</span>
                <span className="text-xs text-gray-500">寮 登録</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-3xl font-bold tabular-nums text-blue-600">{result.added_rooms}</span>
                <span className="text-xs text-gray-500">部屋 登録</span>
              </div>
              {result.skipped_rooms > 0 && (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-3xl font-bold tabular-nums text-gray-400">{result.skipped_rooms}</span>
                  <span className="text-xs text-gray-500">スキップ</span>
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" className="mt-2 h-8 border-gray-300 text-gray-600" onClick={handleReset}>最初に戻る</Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── メインページ ──────────────────────────────────────────
type TabKey = 'employee' | 'dorm'

export default function ImportPage() {
  usePageTitle('Excel インポート')
  const [activeTab, setActiveTab] = useState<TabKey>('employee')

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'employee', label: '👥 社員・入居履歴' },
    { key: 'dorm',     label: '🏢 寮・部屋マスタ' },
  ]

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold text-gray-900">Excel インポート</h1>

      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'employee' ? <EmployeeImportWizard /> : <DormImportWizard />}
    </div>
  )
}
