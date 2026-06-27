export interface MasterItem {
  item_id: string
  category: string
  code: string
  label_ja: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
  version: number
}

export type MastersMap = Record<string, MasterItem[]>

export interface MasterItemCreate {
  code: string
  label_ja: string
  sort_order?: number
}

export interface MasterItemUpdate {
  label_ja?: string
  sort_order?: number
  version: number
}
