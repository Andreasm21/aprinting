// Generic right-click context menu.
//
// Imperative usage:
//   const [menu, setMenu] = useState<{ x, y, items } | null>(null)
//   <div onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, items: [...] }) }}>
//   {menu && <ContextMenu {...menu} onClose={() => setMenu(null)} />}
//
// Closes on outside click, Esc, or when an item is invoked.

import { useEffect, useRef } from 'react'

export interface ContextMenuItem {
  label: string
  onClick: () => void
  icon?: React.ComponentType<{ size?: number; className?: string }>
  destructive?: boolean
  disabled?: boolean
}

interface Props {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export default function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    window.addEventListener('contextmenu', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
      window.removeEventListener('contextmenu', onClick)
    }
  }, [onClose])

  // Clamp position so the menu stays on screen
  const ESTIMATED_WIDTH = 180
  const ESTIMATED_HEIGHT = items.length * 32 + 8
  const clampedX = Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 1024) - ESTIMATED_WIDTH - 8)
  const clampedY = Math.min(y, (typeof window !== 'undefined' ? window.innerHeight : 768) - ESTIMATED_HEIGHT - 8)

  return (
    <div
      ref={ref}
      className="fixed z-[70] min-w-[180px] py-1 rounded-lg bg-bg-secondary border border-border shadow-2xl font-mono"
      style={{ left: clampedX, top: clampedY }}
      role="menu"
    >
      {items.map((item, i) => {
        const Icon = item.icon
        return (
          <button
            key={i}
            type="button"
            disabled={item.disabled}
            onClick={() => { if (!item.disabled) { item.onClick(); onClose() } }}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-left transition-colors disabled:opacity-40 ${
              item.destructive
                ? 'text-red-400 hover:bg-red-500/10'
                : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
            }`}
            role="menuitem"
          >
            {Icon && <Icon size={12} className={item.destructive ? 'text-red-400' : 'text-text-muted'} />}
            <span className="flex-1">{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}
