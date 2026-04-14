import { create } from 'zustand'
import type { PotionPage, PotionBlock, BlockType, PotionTextSpan } from '@/admin/potion/types'
import { createBlock, createPage } from '@/admin/potion/utils/blockHelpers'

const STORAGE_KEY = 'aprinting_potion'

interface PotionData {
  pages: Record<string, PotionPage>
  blocks: Record<string, PotionBlock>
}

interface PotionState extends PotionData {
  activePageId: string | null

  // Page CRUD
  addPage: (title: string, parentId: string | null) => string
  updatePage: (id: string, updates: Partial<PotionPage>) => void
  deletePage: (id: string) => void
  reorderPage: (id: string, newParentId: string | null, index: number) => void

  // Block CRUD
  addBlock: (pageId: string, type: BlockType, afterBlockId?: string | null, content?: PotionTextSpan[]) => string
  updateBlock: (id: string, updates: Partial<PotionBlock>) => void
  deleteBlock: (pageId: string, blockId: string) => void
  moveBlock: (pageId: string, fromIndex: number, toIndex: number) => void

  // Navigation
  setActivePage: (id: string | null) => void

  // Getters
  getChildPages: (parentId: string | null) => PotionPage[]
  getPageBlocks: (pageId: string) => PotionBlock[]

  // Reset
  resetPotion: () => void
}

function seedDefault(): PotionData {
  const page = createPage('Welcome to Potion', null)
  page.icon = '✨'

  const b1 = createBlock('heading1', [{ text: 'Welcome to Potion' }])
  const b2 = createBlock('paragraph', [{ text: 'Your internal workspace for documentation, notes, and financial tracking.' }])
  const b3 = createBlock('callout', [{ text: 'Type ', bold: false }, { text: '/', bold: true, code: true }, { text: ' to insert different block types like headings, lists, tables, and more.' }])
  b3.calloutEmoji = '💡'
  const b4 = createBlock('heading2', [{ text: 'Getting Started' }])
  const b5 = createBlock('bulletList', [{ text: 'Create new pages from the sidebar' }])
  const b6 = createBlock('bulletList', [{ text: 'Organize pages in a tree hierarchy' }])
  const b7 = createBlock('bulletList', [{ text: 'Use slash commands to add different content types' }])
  const b8 = createBlock('bulletList', [{ text: 'Format text with the floating toolbar' }])
  const b9 = createBlock('todoList', [{ text: 'Try creating your first page' }])
  b9.checked = false
  const b10 = createBlock('todoList', [{ text: 'Add some notes or documentation' }])
  b10.checked = false
  const b11 = createBlock('divider')
  const b12 = createBlock('quote', [{ text: 'All data is saved to your browser\'s local storage automatically.' }])

  const blocks: Record<string, PotionBlock> = {}
  const allBlocks = [b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12]
  allBlocks.forEach((b) => { blocks[b.id] = b })
  page.blockIds = allBlocks.map((b) => b.id)

  return {
    pages: { [page.id]: page },
    blocks,
  }
}

function load(): PotionData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as PotionData
      if (parsed.pages && parsed.blocks) return parsed
    }
  } catch { /* ignore */ }
  return seedDefault()
}

function persist(data: PotionData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ pages: data.pages, blocks: data.blocks }))
}

export const usePotionStore = create<PotionState>((set, get) => {
  const initial = load()
  return {
    ...initial,
    activePageId: Object.keys(initial.pages)[0] || null,

    addPage: (title, parentId) => {
      const page = createPage(title, parentId)
      // Add a default empty paragraph
      const block = createBlock('paragraph')
      set((s) => {
        const pages = { ...s.pages, [page.id]: { ...page, blockIds: [block.id] } }
        const blocks = { ...s.blocks, [block.id]: block }
        persist({ pages, blocks })
        return { pages, blocks, activePageId: page.id }
      })
      return page.id
    },

    updatePage: (id, updates) => {
      set((s) => {
        const page = s.pages[id]
        if (!page) return s
        const pages = { ...s.pages, [id]: { ...page, ...updates, updatedAt: new Date().toISOString() } }
        persist({ pages, blocks: s.blocks })
        return { pages }
      })
    },

    deletePage: (id) => {
      set((s) => {
        // Collect all descendant page IDs
        const toDelete = new Set<string>()
        const collect = (pid: string) => {
          toDelete.add(pid)
          Object.values(s.pages).filter((p) => p.parentId === pid).forEach((p) => collect(p.id))
        }
        collect(id)

        const pages = { ...s.pages }
        const blocks = { ...s.blocks }

        toDelete.forEach((pid) => {
          const page = pages[pid]
          if (page) {
            page.blockIds.forEach((bid) => delete blocks[bid])
            delete pages[pid]
          }
        })

        const activePageId = s.activePageId && toDelete.has(s.activePageId)
          ? Object.keys(pages)[0] || null
          : s.activePageId

        persist({ pages, blocks })
        return { pages, blocks, activePageId }
      })
    },

    reorderPage: (id, newParentId, _index) => {
      set((s) => {
        const page = s.pages[id]
        if (!page) return s
        const pages = { ...s.pages, [id]: { ...page, parentId: newParentId } }
        persist({ pages, blocks: s.blocks })
        return { pages }
      })
    },

    addBlock: (pageId, type, afterBlockId, content) => {
      const block = createBlock(type, content)
      set((s) => {
        const page = s.pages[pageId]
        if (!page) return s
        const blockIds = [...page.blockIds]
        if (afterBlockId) {
          const idx = blockIds.indexOf(afterBlockId)
          blockIds.splice(idx + 1, 0, block.id)
        } else if (afterBlockId === null) {
          // Insert at start
          blockIds.unshift(block.id)
        } else {
          blockIds.push(block.id)
        }
        const pages = { ...s.pages, [pageId]: { ...page, blockIds, updatedAt: new Date().toISOString() } }
        const blocks = { ...s.blocks, [block.id]: block }
        persist({ pages, blocks })
        return { pages, blocks }
      })
      return block.id
    },

    updateBlock: (id, updates) => {
      set((s) => {
        const block = s.blocks[id]
        if (!block) return s
        const blocks = { ...s.blocks, [id]: { ...block, ...updates } }
        persist({ pages: s.pages, blocks })
        return { blocks }
      })
    },

    deleteBlock: (pageId, blockId) => {
      set((s) => {
        const page = s.pages[pageId]
        if (!page) return s
        const blockIds = page.blockIds.filter((id) => id !== blockId)
        const pages = { ...s.pages, [pageId]: { ...page, blockIds, updatedAt: new Date().toISOString() } }
        const blocks = { ...s.blocks }
        delete blocks[blockId]
        persist({ pages, blocks })
        return { pages, blocks }
      })
    },

    moveBlock: (pageId, fromIndex, toIndex) => {
      set((s) => {
        const page = s.pages[pageId]
        if (!page) return s
        const blockIds = [...page.blockIds]
        const [moved] = blockIds.splice(fromIndex, 1)
        blockIds.splice(toIndex, 0, moved)
        const pages = { ...s.pages, [pageId]: { ...page, blockIds, updatedAt: new Date().toISOString() } }
        persist({ pages, blocks: s.blocks })
        return { pages }
      })
    },

    setActivePage: (id) => set({ activePageId: id }),

    getChildPages: (parentId) => {
      return Object.values(get().pages)
        .filter((p) => p.parentId === parentId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    },

    getPageBlocks: (pageId) => {
      const page = get().pages[pageId]
      if (!page) return []
      return page.blockIds.map((id) => get().blocks[id]).filter(Boolean)
    },

    resetPotion: () => {
      const data = seedDefault()
      persist(data)
      set({ ...data, activePageId: Object.keys(data.pages)[0] || null })
    },
  }
})
