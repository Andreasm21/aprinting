import { useState, useEffect, useCallback } from 'react'
import { Bold, Italic, Underline, Strikethrough, Code, Link } from 'lucide-react'

export default function PotionToolbar() {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  const checkSelection = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setVisible(false)
      return
    }

    // Only show if selection is within a block editor
    const range = sel.getRangeAt(0)
    const container = range.commonAncestorContainer
    const blockEl = (container.nodeType === Node.ELEMENT_NODE ? container as HTMLElement : container.parentElement)?.closest('[data-block-id]')
    if (!blockEl) {
      setVisible(false)
      return
    }

    const rect = range.getBoundingClientRect()
    if (rect.width === 0) {
      setVisible(false)
      return
    }

    setPosition({
      top: rect.top - 44,
      left: rect.left + rect.width / 2 - 120,
    })
    setVisible(true)
  }, [])

  useEffect(() => {
    document.addEventListener('mouseup', checkSelection)
    document.addEventListener('keyup', checkSelection)
    document.addEventListener('mousedown', (e) => {
      // Hide if clicking outside toolbar
      const target = e.target as HTMLElement
      if (!target.closest('[data-potion-toolbar]')) {
        // Delay to allow button clicks to process
        setTimeout(() => {
          const sel = window.getSelection()
          if (!sel || sel.isCollapsed) setVisible(false)
        }, 200)
      }
    })
    return () => {
      document.removeEventListener('mouseup', checkSelection)
      document.removeEventListener('keyup', checkSelection)
    }
  }, [checkSelection])

  if (!visible) return null

  const execFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    // Re-check selection
    setTimeout(checkSelection, 10)
  }

  const handleLink = () => {
    const url = prompt('Enter URL:')
    if (url) execFormat('createLink', url)
  }

  const handleInlineCode = () => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
    const range = sel.getRangeAt(0)
    const text = range.toString()

    // Check if already wrapped in code
    const parent = range.commonAncestorContainer.parentElement
    if (parent?.tagName.toLowerCase() === 'code') {
      // Unwrap
      const textNode = document.createTextNode(text)
      parent.replaceWith(textNode)
      sel.removeAllRanges()
      const newRange = document.createRange()
      newRange.selectNode(textNode)
      sel.addRange(newRange)
    } else {
      const code = document.createElement('code')
      code.className = 'px-1 py-0.5 bg-bg-tertiary rounded text-accent-amber text-[0.9em] font-mono'
      code.textContent = text
      range.deleteContents()
      range.insertNode(code)
      sel.collapseToEnd()
    }
  }

  const buttons = [
    { icon: <Bold size={14} />, command: 'bold', label: 'Bold' },
    { icon: <Italic size={14} />, command: 'italic', label: 'Italic' },
    { icon: <Underline size={14} />, command: 'underline', label: 'Underline' },
    { icon: <Strikethrough size={14} />, command: 'strikeThrough', label: 'Strikethrough' },
    { icon: <Code size={14} />, command: 'code', label: 'Code' },
    { icon: <Link size={14} />, command: 'link', label: 'Link' },
  ]

  return (
    <div
      data-potion-toolbar
      className="fixed z-50 flex items-center bg-bg-secondary border border-border rounded-lg shadow-xl px-1 py-0.5 gap-0.5"
      style={{ top: Math.max(8, position.top), left: Math.max(8, position.left) }}
    >
      {buttons.map((btn) => (
        <button
          key={btn.command}
          type="button"
          title={btn.label}
          onMouseDown={(e) => {
            e.preventDefault()
            if (btn.command === 'code') handleInlineCode()
            else if (btn.command === 'link') handleLink()
            else execFormat(btn.command)
          }}
          className="p-1.5 rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
        >
          {btn.icon}
        </button>
      ))}
    </div>
  )
}
