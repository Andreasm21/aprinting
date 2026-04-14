import { useState, useRef, useCallback } from 'react'
import { ImageIcon } from 'lucide-react'
import { usePotionStore } from '@/stores/potionStore'
import type { PotionPage } from './types'
import PotionBlockRenderer from './PotionBlockRenderer'
import PotionEmojiPicker from './PotionEmojiPicker'
import PotionToolbar from './PotionToolbar'

const COVER_COLORS = [
  'bg-gradient-to-r from-amber-600/30 to-orange-600/30',
  'bg-gradient-to-r from-blue-600/30 to-cyan-600/30',
  'bg-gradient-to-r from-purple-600/30 to-pink-600/30',
  'bg-gradient-to-r from-green-600/30 to-teal-600/30',
  'bg-gradient-to-r from-red-600/30 to-rose-600/30',
  'bg-gradient-to-r from-gray-600/30 to-slate-600/30',
]

interface Props {
  page: PotionPage
}

export default function PotionPageView({ page }: Props) {
  const updatePage = usePotionStore((s) => s.updatePage)
  const addBlock = usePotionStore((s) => s.addBlock)
  const getPageBlocks = usePotionStore((s) => s.getPageBlocks)

  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showCoverPicker, setShowCoverPicker] = useState(false)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const blocks = getPageBlocks(page.id)

  const handleTitleInput = useCallback(() => {
    if (titleRef.current) {
      const text = titleRef.current.textContent || ''
      updatePage(page.id, { title: text })
    }
  }, [page.id, updatePage])

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      // Focus first block or create one
      if (blocks.length === 0) {
        addBlock(page.id, 'paragraph')
      }
      // Focus first block
      const firstBlockEl = document.querySelector('[data-block-id]') as HTMLElement
      firstBlockEl?.focus()
    }
  }

  const handleAddBlock = () => {
    const lastBlockId = blocks.length > 0 ? blocks[blocks.length - 1].id : undefined
    const newId = addBlock(page.id, 'paragraph', lastBlockId)
    // Focus the new block
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-block-id="${newId}"]`) as HTMLElement
      el?.focus()
    })
  }

  return (
    <div className="max-w-3xl mx-auto px-8 py-6">
      {/* Cover */}
      {page.coverColor ? (
        <div className={`-mx-8 -mt-6 mb-6 h-32 ${page.coverColor} relative group`}>
          <button
            type="button"
            onClick={() => setShowCoverPicker(!showCoverPicker)}
            className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 text-[10px] font-mono text-text-muted bg-bg-secondary/80 px-2 py-1 rounded transition-opacity"
          >
            Change cover
          </button>
          <button
            type="button"
            onClick={() => updatePage(page.id, { coverColor: undefined })}
            className="absolute bottom-2 right-24 opacity-0 group-hover:opacity-100 text-[10px] font-mono text-text-muted bg-bg-secondary/80 px-2 py-1 rounded transition-opacity"
          >
            Remove
          </button>
          {showCoverPicker && (
            <div className="absolute bottom-10 right-2 bg-bg-secondary border border-border rounded-lg p-2 flex gap-1.5 z-20">
              {COVER_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => { updatePage(page.id, { coverColor: color }); setShowCoverPicker(false) }}
                  className={`w-8 h-8 rounded ${color} border border-border hover:ring-2 ring-accent-amber`}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Icon + Title Header */}
      <div className="mb-6 group">
        <div className="flex items-center gap-1 mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {!page.icon && (
            <button
              type="button"
              onClick={() => setShowEmojiPicker(true)}
              className="text-[11px] font-mono text-text-muted hover:bg-bg-tertiary px-2 py-0.5 rounded flex items-center gap-1"
            >
              😀 Add icon
            </button>
          )}
          {!page.coverColor && (
            <button
              type="button"
              onClick={() => updatePage(page.id, { coverColor: COVER_COLORS[0] })}
              className="text-[11px] font-mono text-text-muted hover:bg-bg-tertiary px-2 py-0.5 rounded flex items-center gap-1"
            >
              <ImageIcon size={11} /> Add cover
            </button>
          )}
        </div>

        {/* Emoji Icon */}
        {page.icon && (
          <div className="relative mb-2">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="text-5xl hover:bg-bg-tertiary rounded-lg p-1 transition-colors cursor-pointer"
            >
              {page.icon}
            </button>
            <button
              type="button"
              onClick={() => updatePage(page.id, { icon: undefined })}
              className="absolute -top-1 left-14 text-[10px] font-mono text-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Remove
            </button>
          </div>
        )}

        {showEmojiPicker && (
          <PotionEmojiPicker
            onSelect={(emoji) => updatePage(page.id, { icon: emoji })}
            onClose={() => setShowEmojiPicker(false)}
          />
        )}

        {/* Title */}
        <h1
          ref={titleRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleTitleInput}
          onKeyDown={handleTitleKeyDown}
          className="text-4xl font-bold font-mono text-text-primary outline-none border-none empty:before:content-['Untitled'] empty:before:text-text-muted/40 leading-tight"
          data-placeholder="Untitled"
        >
          {page.title}
        </h1>
      </div>

      {/* Floating Toolbar */}
      <PotionToolbar />

      {/* Blocks */}
      <div className="space-y-0.5">
        {blocks.map((block, index) => (
          <PotionBlockRenderer
            key={block.id}
            block={block}
            pageId={page.id}
            index={index}
            totalBlocks={blocks.length}
          />
        ))}
      </div>

      {/* Add block zone */}
      <div
        onClick={handleAddBlock}
        className="min-h-[30vh] cursor-text mt-2"
      >
        {blocks.length === 0 && (
          <p className="text-text-muted/40 text-sm font-mono">
            Press '/' for commands, or just start typing...
          </p>
        )}
      </div>
    </div>
  )
}
