import { useState, useRef, useEffect } from 'react'
import { emojiCategories } from './utils/emojiList'

interface Props {
  onSelect: (emoji: string) => void
  onClose: () => void
  position?: { top: number; left: number }
}

export default function PotionEmojiPicker({ onSelect, onClose, position }: Props) {
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const filtered = search
    ? emojiCategories.map((c) => ({ ...c, emojis: c.emojis.filter(() => true) })) // emojis don't have text names, just show all when searching
    : emojiCategories

  return (
    <div
      ref={ref}
      className="absolute z-50 bg-bg-secondary border border-border rounded-lg shadow-xl p-3 w-72 max-h-64 overflow-y-auto"
      style={position ? { top: position.top, left: position.left } : undefined}
    >
      <input
        autoFocus
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search emoji..."
        className="w-full bg-bg-tertiary border border-border rounded px-2 py-1.5 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-amber mb-2"
      />
      {filtered.map((cat) => (
        <div key={cat.name} className="mb-2">
          <div className="text-[10px] font-mono uppercase text-text-muted mb-1">{cat.name}</div>
          <div className="flex flex-wrap gap-0.5">
            {cat.emojis.map((emoji, i) => (
              <button
                key={`${emoji}-${i}`}
                type="button"
                onClick={() => { onSelect(emoji); onClose() }}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-bg-tertiary text-base transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
