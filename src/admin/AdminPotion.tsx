import { usePotionStore } from '@/stores/potionStore'
import PotionSidebar from './potion/PotionSidebar'
import PotionPageView from './potion/PotionPageView'

export default function AdminPotion() {
  const activePageId = usePotionStore((s) => s.activePageId)
  const page = usePotionStore((s) => activePageId ? s.pages[activePageId] : null)

  return (
    <div className="flex -mx-6 lg:-mx-10 -my-6 lg:-my-10 min-h-[calc(100vh-0px)]">
      {/* Potion Sidebar */}
      <PotionSidebar />

      {/* Page Content */}
      <div className="flex-1 min-h-screen overflow-y-auto">
        {page ? (
          <PotionPageView page={page} />
        ) : (
          <div className="flex items-center justify-center h-full min-h-[60vh]">
            <div className="text-center">
              <div className="text-5xl mb-4 opacity-30">📝</div>
              <p className="text-text-muted font-mono text-sm">Select a page or create a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
