import { useState } from 'react'
import { ChevronRight, FileText, MoreHorizontal, Plus, Trash2, Pencil } from 'lucide-react'
import { usePotionStore } from '@/stores/potionStore'

interface Props {
  pageId: string
  depth: number
}

export default function PotionPageTree({ pageId, depth }: Props) {
  const page = usePotionStore((s) => s.pages[pageId])
  const activePageId = usePotionStore((s) => s.activePageId)
  const setActivePage = usePotionStore((s) => s.setActivePage)
  const getChildPages = usePotionStore((s) => s.getChildPages)
  const addPage = usePotionStore((s) => s.addPage)
  const updatePage = usePotionStore((s) => s.updatePage)
  const deletePage = usePotionStore((s) => s.deletePage)

  const [expanded, setExpanded] = useState(true)
  const [showMenu, setShowMenu] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')

  if (!page) return null

  const children = getChildPages(pageId)
  const hasChildren = children.length > 0
  const isActive = activePageId === pageId

  const handleRename = () => {
    if (renameValue.trim()) {
      updatePage(pageId, { title: renameValue.trim() })
    }
    setRenaming(false)
  }

  return (
    <div>
      <div
        className={`group flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer text-sm transition-all ${
          isActive
            ? 'bg-accent-amber/10 text-accent-amber'
            : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => setActivePage(pageId)}
      >
        {/* Expand toggle */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
          className={`p-0.5 rounded hover:bg-bg-tertiary shrink-0 transition-transform ${expanded ? 'rotate-90' : ''} ${hasChildren ? 'opacity-100' : 'opacity-0'}`}
        >
          <ChevronRight size={12} />
        </button>

        {/* Icon */}
        <span className="shrink-0 text-sm w-5 text-center">
          {page.icon || <FileText size={14} className="text-text-muted mx-auto" />}
        </span>

        {/* Title */}
        {renaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false) }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 bg-bg-tertiary border border-accent-amber rounded px-1 py-0 text-xs text-text-primary focus:outline-none"
          />
        ) : (
          <span className="flex-1 min-w-0 truncate text-xs font-mono">{page.title || 'Untitled'}</span>
        )}

        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); addPage('Untitled', pageId); setExpanded(true) }}
            className="p-0.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-accent-amber"
            title="Add subpage"
          >
            <Plus size={12} />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu) }}
              className="p-0.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-primary"
            >
              <MoreHorizontal size={12} />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-6 z-50 bg-bg-secondary border border-border rounded-lg shadow-xl py-1 min-w-[120px]">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setRenameValue(page.title); setRenaming(true); setShowMenu(false) }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-mono text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                  >
                    <Pencil size={11} /> Rename
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); deletePage(pageId); setShowMenu(false) }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-mono text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 size={11} /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {children.map((child) => (
            <PotionPageTree key={child.id} pageId={child.id} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}
