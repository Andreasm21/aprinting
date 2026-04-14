import type { PotionBlock, PotionPage, BlockType, PotionTextSpan } from '../types'

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export function createBlock(type: BlockType, content?: PotionTextSpan[]): PotionBlock {
  const block: PotionBlock = {
    id: genId('block'),
    type,
    content: content || [],
  }
  if (type === 'callout') block.calloutEmoji = '💡'
  if (type === 'code') block.language = 'plaintext'
  if (type === 'todoList') block.checked = false
  if (type === 'table') {
    block.tableData = {
      columns: [
        { id: genId('col'), name: 'Column 1', type: 'text' },
        { id: genId('col'), name: 'Column 2', type: 'text' },
        { id: genId('col'), name: 'Column 3', type: 'number' },
      ],
      rows: [
        { id: genId('row'), cells: {} },
      ],
    }
  }
  return block
}

export function createPage(title: string, parentId: string | null): PotionPage {
  const now = new Date().toISOString()
  return {
    id: genId('page'),
    title,
    icon: undefined,
    coverColor: undefined,
    parentId,
    blockIds: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function createTextSpan(text: string, formatting?: Partial<PotionTextSpan>): PotionTextSpan {
  return { text, ...formatting }
}
