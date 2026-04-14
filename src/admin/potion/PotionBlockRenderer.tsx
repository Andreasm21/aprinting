import { useState, memo } from 'react'
import { GripVertical, MoreHorizontal, Trash2, ArrowUp, ArrowDown, Copy } from 'lucide-react'
import { usePotionStore } from '@/stores/potionStore'
import type { PotionBlock } from './types'
import PotionBlockEditor from './PotionBlockEditor'
import PotionTableBlock from './PotionTableBlock'

interface Props {
  block: PotionBlock
  pageId: string
  index: number
  totalBlocks: number
}

function PotionBlockRenderer({ block, pageId, index, totalBlocks }: Props) {
  const deleteBlock = usePotionStore((s) => s.deleteBlock)
  const moveBlock = usePotionStore((s) => s.moveBlock)
  const updateBlock = usePotionStore((s) => s.updateBlock)
  const [showMenu, setShowMenu] = useState(false)

  // Drag state
  const [isDragging, setIsDragging] = useState(false)
  const [dragOver, setDragOver] = useState<'top' | 'bottom' | null>(null)

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', String(index))
    e.dataTransfer.effectAllowed = 'move'
    setIsDragging(true)
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    setDragOver(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    setDragOver(e.clientY < midY ? 'top' : 'bottom')
  }

  const handleDragLeave = () => setDragOver(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'))
    const toIndex = dragOver === 'top' ? index : index + 1
    if (fromIndex !== toIndex && fromIndex !== toIndex - 1) {
      moveBlock(pageId, fromIndex, fromIndex < toIndex ? toIndex - 1 : toIndex)
    }
    setDragOver(null)
    setIsDragging(false)
  }

  // Count for numbered list
  const getListNumber = () => {
    const page = usePotionStore.getState().pages[pageId]
    if (!page) return 1
    let count = 0
    for (let i = 0; i <= index; i++) {
      const b = usePotionStore.getState().blocks[page.blockIds[i]]
      if (b?.type === 'numberedList') count++
      else if (i < index) count = 0
    }
    return count
  }

  // Divider block
  if (block.type === 'divider') {
    return (
      <div
        className={`group relative py-2 ${isDragging ? 'opacity-30' : ''}`}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {dragOver === 'top' && <div className="absolute top-0 left-0 right-0 h-0.5 bg-accent-amber rounded" />}
        <DragHandle onDragStart={handleDragStart} />
        <hr className="border-border my-2" />
        <BlockMenu
          show={showMenu}
          onToggle={() => setShowMenu(!showMenu)}
          onDelete={() => deleteBlock(pageId, block.id)}
          onMoveUp={index > 0 ? () => moveBlock(pageId, index, index - 1) : undefined}
          onMoveDown={index < totalBlocks - 1 ? () => moveBlock(pageId, index, index + 1) : undefined}
        />
        {dragOver === 'bottom' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-amber rounded" />}
      </div>
    )
  }

  // Table block
  if (block.type === 'table') {
    return (
      <div
        className={`group relative py-1 ${isDragging ? 'opacity-30' : ''}`}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {dragOver === 'top' && <div className="absolute top-0 left-0 right-0 h-0.5 bg-accent-amber rounded" />}
        <DragHandle onDragStart={handleDragStart} />
        <PotionTableBlock block={block} />
        <BlockMenu
          show={showMenu}
          onToggle={() => setShowMenu(!showMenu)}
          onDelete={() => deleteBlock(pageId, block.id)}
          onMoveUp={index > 0 ? () => moveBlock(pageId, index, index - 1) : undefined}
          onMoveDown={index < totalBlocks - 1 ? () => moveBlock(pageId, index, index + 1) : undefined}
        />
        {dragOver === 'bottom' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-amber rounded" />}
      </div>
    )
  }

  // Text-based blocks with special wrappers
  const renderWrapped = () => {
    const editor = <PotionBlockEditor block={block} pageId={pageId} />

    switch (block.type) {
      case 'bulletList':
        return (
          <div className="flex items-start gap-2 pl-4">
            <span className="text-accent-amber mt-1.5 text-xs shrink-0">•</span>
            <div className="flex-1">{editor}</div>
          </div>
        )
      case 'numberedList':
        return (
          <div className="flex items-start gap-2 pl-4">
            <span className="text-text-muted mt-0.5 text-xs font-mono shrink-0 w-4 text-right">{getListNumber()}.</span>
            <div className="flex-1">{editor}</div>
          </div>
        )
      case 'todoList':
        return (
          <div className="flex items-start gap-2 pl-4">
            <input
              type="checkbox"
              checked={block.checked || false}
              onChange={(e) => updateBlock(block.id, { checked: e.target.checked })}
              className="mt-1 shrink-0 w-4 h-4 rounded border-border bg-bg-tertiary accent-accent-amber cursor-pointer"
            />
            <div className={`flex-1 ${block.checked ? 'line-through text-text-muted' : ''}`}>{editor}</div>
          </div>
        )
      case 'callout':
        return (
          <div className="flex items-start gap-3 bg-accent-amber/5 border border-accent-amber/20 rounded-lg p-4">
            <span className="text-lg shrink-0 mt-0.5">{block.calloutEmoji || '💡'}</span>
            <div className="flex-1">{editor}</div>
          </div>
        )
      case 'quote':
        return (
          <div className="border-l-2 border-accent-amber pl-4">
            {editor}
          </div>
        )
      case 'code':
        return (
          <div className="bg-bg-tertiary rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-1.5 bg-bg-tertiary border-b border-border">
              <span className="text-[10px] font-mono text-text-muted uppercase">{block.language || 'code'}</span>
              <button
                type="button"
                onClick={() => {
                  const el = document.querySelector(`[data-block-id="${block.id}"]`)
                  if (el) navigator.clipboard.writeText(el.textContent || '')
                }}
                className="text-text-muted hover:text-text-primary p-0.5 rounded"
              >
                <Copy size={11} />
              </button>
            </div>
            <div className="p-4">{editor}</div>
          </div>
        )
      default:
        return editor
    }
  }

  return (
    <div
      className={`group relative py-0.5 ${isDragging ? 'opacity-30' : ''}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragOver === 'top' && <div className="absolute top-0 left-0 right-0 h-0.5 bg-accent-amber rounded" />}
      <DragHandle onDragStart={handleDragStart} />
      {renderWrapped()}
      <BlockMenu
        show={showMenu}
        onToggle={() => setShowMenu(!showMenu)}
        onDelete={() => deleteBlock(pageId, block.id)}
        onMoveUp={index > 0 ? () => moveBlock(pageId, index, index - 1) : undefined}
        onMoveDown={index < totalBlocks - 1 ? () => moveBlock(pageId, index, index + 1) : undefined}
      />
      {dragOver === 'bottom' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-amber rounded" />}
    </div>
  )
}

export default memo(PotionBlockRenderer)

/* ── Drag Handle ───────────────────────── */

function DragHandle({ onDragStart }: { onDragStart: (e: React.DragEvent) => void }) {
  return (
    <div
      className="absolute -left-8 top-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 rounded hover:bg-bg-tertiary text-text-muted"
      draggable
      onDragStart={onDragStart}
    >
      <GripVertical size={14} />
    </div>
  )
}

/* ── Block Action Menu ───────────────────── */

function BlockMenu({
  show,
  onToggle,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  show: boolean
  onToggle: () => void
  onDelete: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
}) {
  return (
    <div className="absolute -right-8 top-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        type="button"
        onClick={onToggle}
        className="p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-primary"
      >
        <MoreHorizontal size={14} />
      </button>
      {show && (
        <>
          <div className="fixed inset-0 z-40" onClick={onToggle} />
          <div className="absolute right-0 top-7 z-50 bg-bg-secondary border border-border rounded-lg shadow-xl py-1 min-w-[110px]">
            {onMoveUp && (
              <button type="button" onClick={() => { onMoveUp(); onToggle() }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-mono text-text-secondary hover:bg-bg-tertiary">
                <ArrowUp size={11} /> Move up
              </button>
            )}
            {onMoveDown && (
              <button type="button" onClick={() => { onMoveDown(); onToggle() }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-mono text-text-secondary hover:bg-bg-tertiary">
                <ArrowDown size={11} /> Move down
              </button>
            )}
            <button type="button" onClick={() => { onDelete(); onToggle() }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-mono text-red-400 hover:bg-red-500/10">
              <Trash2 size={11} /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}
