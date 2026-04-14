// ── Rich text inline segment ──
export interface PotionTextSpan {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  code?: boolean
  link?: string
}

// ── Block types ──
export type BlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bulletList'
  | 'numberedList'
  | 'todoList'
  | 'divider'
  | 'callout'
  | 'code'
  | 'quote'
  | 'table'

// ── Table data ──
export type TableColumnType = 'text' | 'number' | 'currency'

export interface TableColumn {
  id: string
  name: string
  type: TableColumnType
}

export interface TableRow {
  id: string
  cells: Record<string, string>
}

export interface TableData {
  columns: TableColumn[]
  rows: TableRow[]
}

// ── Block ──
export interface PotionBlock {
  id: string
  type: BlockType
  content: PotionTextSpan[]
  checked?: boolean
  language?: string
  calloutEmoji?: string
  tableData?: TableData
}

// ── Page ──
export interface PotionPage {
  id: string
  title: string
  icon?: string
  coverColor?: string
  parentId: string | null
  blockIds: string[]
  createdAt: string
  updatedAt: string
}
