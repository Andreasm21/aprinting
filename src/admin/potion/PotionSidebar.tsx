import { Plus, BookOpen } from 'lucide-react'
import { usePotionStore } from '@/stores/potionStore'
import PotionPageTree from './PotionPageTree'

export default function PotionSidebar() {
  const getChildPages = usePotionStore((s) => s.getChildPages)
  const addPage = usePotionStore((s) => s.addPage)

  const rootPages = getChildPages(null)

  return (
    <div className="w-56 shrink-0 bg-bg-secondary border-r border-border flex flex-col h-full min-h-screen">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen size={16} className="text-accent-amber" />
          <span className="font-mono text-sm font-bold text-text-primary">Potion</span>
        </div>
        <button
          onClick={() => addPage('Untitled', null)}
          className="w-full flex items-center justify-center gap-1.5 text-xs font-mono text-accent-amber border border-accent-amber/30 rounded-md px-2 py-1.5 hover:bg-accent-amber/5 transition-colors"
        >
          <Plus size={12} /> New Page
        </button>
      </div>

      {/* Page Tree */}
      <div className="flex-1 overflow-y-auto py-2 px-1 space-y-0.5">
        {rootPages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-text-muted text-[11px] font-mono">No pages yet</p>
          </div>
        ) : (
          rootPages.map((page) => (
            <PotionPageTree key={page.id} pageId={page.id} depth={0} />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-border">
        <p className="text-[10px] text-text-muted font-mono text-center">
          {rootPages.length} pages · Auto-saved
        </p>
      </div>
    </div>
  )
}
