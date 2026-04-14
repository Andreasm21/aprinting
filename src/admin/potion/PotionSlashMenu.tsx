import { useState, useEffect, useRef } from 'react'
import { Type, Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare, Minus, MessageSquare, Code, Quote, Table } from 'lucide-react'
import type { BlockType } from './types'

interface SlashMenuItem {
  label: string
  description: string
  type: BlockType
  icon: React.ReactNode
}

const MENU_ITEMS: SlashMenuItem[] = [
  { label: 'Text', description: 'Plain text paragraph', type: 'paragraph', icon: <Type size={16} /> },
  { label: 'Heading 1', description: 'Large section heading', type: 'heading1', icon: <Heading1 size={16} /> },
  { label: 'Heading 2', description: 'Medium section heading', type: 'heading2', icon: <Heading2 size={16} /> },
  { label: 'Heading 3', description: 'Small section heading', type: 'heading3', icon: <Heading3 size={16} /> },
  { label: 'Bullet List', description: 'Unordered list item', type: 'bulletList', icon: <List size={16} /> },
  { label: 'Numbered List', description: 'Ordered list item', type: 'numberedList', icon: <ListOrdered size={16} /> },
  { label: 'To-do', description: 'Checkbox task item', type: 'todoList', icon: <CheckSquare size={16} /> },
  { label: 'Divider', description: 'Visual separator', type: 'divider', icon: <Minus size={16} /> },
  { label: 'Callout', description: 'Highlighted info block', type: 'callout', icon: <MessageSquare size={16} /> },
  { label: 'Code', description: 'Code block', type: 'code', icon: <Code size={16} /> },
  { label: 'Quote', description: 'Block quotation', type: 'quote', icon: <Quote size={16} /> },
  { label: 'Table', description: 'Simple data table', type: 'table', icon: <Table size={16} /> },
]

interface Props {
  position: { top: number; left: number }
  filter: string
  onSelect: (type: BlockType) => void
  onClose: () => void
}

export default function PotionSlashMenu({ position, filter, onSelect, onClose }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const filtered = MENU_ITEMS.filter((item) =>
    item.label.toLowerCase().includes(filter.toLowerCase()) ||
    item.description.toLowerCase().includes(filter.toLowerCase())
  )

  useEffect(() => {
    setSelectedIndex(0)
  }, [filter])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filtered[selectedIndex]) {
          onSelect(filtered[selectedIndex].type)
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [filtered, selectedIndex, onSelect, onClose])

  useEffect(() => {
    // Scroll selected item into view
    const el = ref.current?.querySelector(`[data-slash-index="${selectedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (filtered.length === 0) {
    return (
      <div
        className="fixed z-50 bg-bg-secondary border border-border rounded-lg shadow-xl p-3"
        style={{ top: position.top, left: position.left }}
      >
        <p className="text-text-muted text-xs font-mono">No results</p>
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-bg-secondary border border-border rounded-lg shadow-xl py-1 w-64 max-h-72 overflow-y-auto"
      style={{ top: position.top, left: position.left }}
    >
      <div className="px-2 py-1 text-[10px] font-mono uppercase text-text-muted">Blocks</div>
      {filtered.map((item, i) => (
        <button
          key={item.type}
          data-slash-index={i}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onSelect(item.type) }}
          onMouseEnter={() => setSelectedIndex(i)}
          className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
            i === selectedIndex ? 'bg-accent-amber/10 text-accent-amber' : 'text-text-secondary hover:bg-bg-tertiary'
          }`}
        >
          <div className={`w-8 h-8 rounded-md flex items-center justify-center border ${
            i === selectedIndex ? 'border-accent-amber/30 bg-accent-amber/5' : 'border-border bg-bg-tertiary'
          }`}>
            {item.icon}
          </div>
          <div>
            <div className="text-xs font-mono font-medium">{item.label}</div>
            <div className="text-[10px] text-text-muted">{item.description}</div>
          </div>
        </button>
      ))}
    </div>
  )
}
