/**
 * 前端メッセージ定数（成功 toast + 入力バリデーション）
 *
 * ■ 三層分離モデルにおける本ファイルの位置づけ:
 *   - 成功通知（Success Toast）  → 本ファイルの MSG_CREATED 等
 *   - 入力校驗（Validation）     → 本ファイルの MSG_REQUIRED 等（Zod スキーマ用）
 *   - 業務報錯（Error）          → 後端が返す。interceptor が自動 toast する
 *                                  前端では定義しない（後端の責務）
 *
 *   前端 onError で toast.error() を呼ぶと interceptor と二重表示になる。
 *   原則として onError は省略し、interceptor に委譲すること。
 *   try-catch パターン（ImportPage 等）では skipErrorToast: true を axios config に付与して
 *   interceptor の自動 toast を抑制し、catch 側の fallback toast だけを表示する。
 */

// ── Toast（成功） ──────────────────────────────────────────
export const MSG_CREATED = (entity: string) => `${entity}を登録しました`
export const MSG_UPDATED = (entity: string) => `${entity}を更新しました`
export const MSG_DELETED = (entity: string) => `${entity}を削除しました`
export const MSG_MOVE_IN_COMPLETE = '入居登録が完了しました'
export const MSG_MOVE_OUT_COMPLETE = '退寮処理を完了しました'
export const MSG_TRANSFER_COMPLETE = '換房処理を完了しました'

// ── Toast（エラー fallback） ──────────────────────────────
// interceptor で捕捉できないケース（ネットワーク断・blob parse 失敗等）専用。
// useMutation の onError では使わないこと（interceptor と二重表示になる）。
export const MSG_DELETE_FAILED = '削除に失敗しました'
export const MSG_OPERATION_FAILED = '操作に失敗しました'
export const MSG_TEMPLATE_DOWNLOAD_FAILED = 'テンプレートのダウンロードに失敗しました'
export const MSG_PREVIEW_FAILED = 'プレビューに失敗しました'
export const MSG_IMPORT_FAILED = '取込に失敗しました'
export const MSG_INVITE_FAILED = '招待に失敗しました'

// ── Zod バリデーション ──────────────────────────────────────
export const MSG_REQUIRED = (field: string) => `${field}は必須です`
export const MSG_SELECT_REQUIRED = (field: string) => `${field}を選択してください`
export const MSG_POSITIVE_NUMBER = '0より大きい値を入力してください'
export const MSG_MIN_INT = (min: number) => `${min}以上の整数を入力してください`
