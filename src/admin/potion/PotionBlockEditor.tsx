import { useRef, useEffect, useCallback, useState } from 'react'
import { usePotionStore } from '@/stores/potionStore'
import type { PotionBlock, BlockType } from './types'
import { spansToHtml, htmlToSpans, sanitizePastedHtml, getCursorOffset, setCursorOffset } from './utils/richText'
import PotionSlashMenu from './PotionSlashMenu'

interface Props {
  block: PotionBlock
  pageId: string
}

export default function PotionBlockEditor({ block, pageId }: Props) {
  const updateBlock = usePotionStore((s) => s.updateBlock)
  const addBlock = usePotionStore((s) => s.addBlock)
  const deleteBlock = usePotionStore((s) => s.deleteBlock)
  const pages = usePotionStore((s) => s.pages)
  const blocks = usePotionStore((s) => s.blocks)

  const ref = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastHtmlRef = useRef<string>('')
  const [slashMenu, setSlashMenu] = useState<{ position: { top: number; left: number }; filter: string } | null>(null)
  const slashStartRef = useRef<number | null>(null)

  // Sync content from store → DOM (only when block changes externally)
  useEffect(() => {
    if (!ref.current) return
    const html = spansToHtml(block.content)
    if (lastHtmlRef.current !== html && ref.current.innerHTML !== html) {
      ref.current.innerHTML = html
      lastHtmlRef.current = html
    }
  }, [block.content])

  // Parse DOM → store (debounced)
  const syncToStore = useCallback(() => {
    if (!ref.current) return
    const spans = htmlToSpans(ref.current)
    lastHtmlRef.current = ref.current.innerHTML
    updateBlock(block.id, { content: spans })
  }, [block.id, updateBlock])

  const handleInput = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(syncToStore, 300)

    // Update slash menu filter
    if (slashStartRef.current !== null && ref.current) {
      const offset = getCursorOffset(ref.current)
      const text = ref.current.textContent || ''
      const filter = text.slice(slashStartRef.current + 1, offset)
      if (filter.includes(' ') || offset <= slashStartRef.current) {
        setSlashMenu(null)
        slashStartRef.current = null
      } else {
        setSlashMenu((prev) => prev ? { ...prev, filter } : null)
      }
    }
  }, [syncToStore])

  const getBlockIds = useCallback(() => {
    const page = pages[pageId]
    return page?.blockIds || []
  }, [pages, pageId])

  const focusBlock = useCallback((blockId: string, atEnd = false) => {
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement
      if (el) {
        el.focus()
        if (atEnd) setCursorOffset(el, (el.textContent || '').length)
        else setCursorOffset(el, 0)
      }
    })
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const text = el.textContent || ''
    const offset = getCursorOffset(el)
    const blockIds = getBlockIds()
    const myIndex = blockIds.indexOf(block.id)

    // Slash command trigger
    if (e.key === '/' && (offset === 0 || text[offset - 1] === ' ' || text[offset - 1] === '\n')) {
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        slashStartRef.current = offset
        setSlashMenu({
          position: { top: rect.bottom + 4, left: rect.left },
          filter: '',
        })
      }
      return
    }

    // Escape closes slash menu
    if (e.key === 'Escape' && slashMenu) {
      setSlashMenu(null)
      slashStartRef.current = null
      return
    }

    // If slash menu is open, let it handle arrow keys and enter
    if (slashMenu && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter')) {
      return // handled by PotionSlashMenu
    }

    // Enter — split block
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // Flush any pending input
      if (debounceRef.current) { clearTimeout(debounceRef.current); syncToStore() }

      const spans = htmlToSpans(el)
      // Find split point in spans
      let charCount = 0
      let splitSpanIndex = spans.length
      let splitCharIndex = 0
      for (let i = 0; i < spans.length; i++) {
        const spanLen = spans[i].text.length
        if (charCount + spanLen >= offset) {
          splitSpanIndex = i
          splitCharIndex = offset - charCount
          break
        }
        charCount += spanLen
      }

      // Content before cursor stays, content after goes to new block
      const beforeSpans = spans.slice(0, splitSpanIndex)
      if (splitSpanIndex < spans.length && splitCharIndex > 0) {
        beforeSpans.push({ ...spans[splitSpanIndex], text: spans[splitSpanIndex].text.slice(0, splitCharIndex) })
      }

      const afterSpans: typeof spans = []
      if (splitSpanIndex < spans.length) {
        const remaining = spans[splitSpanIndex].text.slice(splitCharIndex)
        if (remaining) afterSpans.push({ ...spans[splitSpanIndex], text: remaining })
        afterSpans.push(...spans.slice(splitSpanIndex + 1))
      }

      // Update current block with before content
      updateBlock(block.id, { content: beforeSpans })
      el.innerHTML = spansToHtml(beforeSpans)
      lastHtmlRef.current = el.innerHTML

      // Create new paragraph with after content
      const newId = addBlock(pageId, 'paragraph', block.id, afterSpans.length > 0 ? afterSpans : undefined)
      focusBlock(newId, false)
      return
    }

    // Backspace at start — merge or delete
    if (e.key === 'Backspace' && offset === 0) {
      if (text.length === 0 && blockIds.length > 1) {
        // Delete empty block, focus previous
        e.preventDefault()
        deleteBlock(pageId, block.id)
        if (myIndex > 0) focusBlock(blockIds[myIndex - 1], true)
        return
      }
      if (myIndex > 0 && offset === 0 && text.length > 0) {
        // Merge with previous block
        e.preventDefault()
        if (debounceRef.current) { clearTimeout(debounceRef.current); syncToStore() }
        const prevBlockId = blockIds[myIndex - 1]
        const prevBlock = blocks[prevBlockId]
        if (!prevBlock || prevBlock.type === 'divider' || prevBlock.type === 'table') return

        const prevText = prevBlock.content.map((s) => s.text).join('')
        const mergedContent = [...prevBlock.content, ...htmlToSpans(el)]
        updateBlock(prevBlockId, { content: mergedContent })
        deleteBlock(pageId, block.id)

        // Focus previous at merge point
        requestAnimationFrame(() => {
          const prevEl = document.querySelector(`[data-block-id="${prevBlockId}"]`) as HTMLElement
          if (prevEl) {
            prevEl.innerHTML = spansToHtml(mergedContent)
            prevEl.focus()
            setCursorOffset(prevEl, prevText.length)
          }
        })
        return
      }
    }

    // Markdown shortcuts on Space
    if (e.key === ' ' && offset <= 4) {
      const prefix = text.slice(0, offset)
      let newType: BlockType | null = null

      if (prefix === '#') newType = 'heading1'
      else if (prefix === '##') newType = 'heading2'
      else if (prefix === '###') newType = 'heading3'
      else if (prefix === '-' || prefix === '*') newType = 'bulletList'
      else if (prefix === '1.') newType = 'numberedList'
      else if (prefix === '[]') newType = 'todoList'
      else if (prefix === '>') newType = 'quote'
      else if (prefix === '```') newType = 'code'

      if (newType) {
        e.preventDefault()
        if (debounceRef.current) clearTimeout(debounceRef.current)

        const remaining = text.slice(offset)
        const content = remaining ? [{ text: remaining }] : []
        updateBlock(block.id, { type: newType, content, checked: newType === 'todoList' ? false : undefined })

        requestAnimationFrame(() => {
          if (ref.current) {
            ref.current.innerHTML = spansToHtml(content)
            lastHtmlRef.current = ref.current.innerHTML
            ref.current.focus()
            setCursorOffset(ref.current, 0)
          }
        })
        return
      }
    }

    // Arrow up at start → focus previous block
    if (e.key === 'ArrowUp' && offset === 0 && myIndex > 0) {
      e.preventDefault()
      focusBlock(blockIds[myIndex - 1], true)
      return
    }

    // Arrow down at end → focus next block
    if (e.key === 'ArrowDown' && offset >= text.length && myIndex < blockIds.length - 1) {
      e.preventDefault()
      focusBlock(blockIds[myIndex + 1], false)
      return
    }

    // Formatting shortcuts
    if (e.metaKey || e.ctrlKey) {
      if (e.key === 'b') { e.preventDefault(); document.execCommand('bold'); syncToStore(); return }
      if (e.key === 'i') { e.preventDefault(); document.execCommand('italic'); syncToStore(); return }
      if (e.key === 'u') { e.preventDefault(); document.execCommand('underline'); syncToStore(); return }
      if (e.key === 'e') { e.preventDefault(); wrapInlineCode(); return }
      if (e.shiftKey && e.key === 'S') { e.preventDefault(); document.execCommand('strikeThrough'); syncToStore(); return }
      if (e.key === 'k') {
        e.preventDefault()
        const url = prompt('Enter URL:')
        if (url) { document.execCommand('createLink', false, url); syncToStore() }
        return
      }
    }

    // Tab in code blocks
    if (e.key === 'Tab' && block.type === 'code') {
      e.preventDefault()
      document.execCommand('insertText', false, '  ')
      return
    }
  }, [block, pageId, getBlockIds, syncToStore, addBlock, deleteBlock, updateBlock, focusBlock, slashMenu, blocks])

  const wrapInlineCode = () => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
    const range = sel.getRangeAt(0)
    const text = range.toString()
    const code = document.createElement('code')
    code.className = 'px-1 py-0.5 bg-bg-tertiary rounded text-accent-amber text-[0.9em] font-mono'
    code.textContent = text
    range.deleteContents()
    range.insertNode(code)
    sel.collapseToEnd()
    syncToStore()
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const html = e.clipboardData.getData('text/html')
    const text = e.clipboardData.getData('text/plain')

    if (html) {
      const clean = sanitizePastedHtml(html)
      document.execCommand('insertHTML', false, clean)
    } else if (text) {
      document.execCommand('insertText', false, text)
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(syncToStore, 100)
  }

  const handleSlashSelect = (type: BlockType) => {
    setSlashMenu(null)
    if (slashStartRef.current === null) return

    const el = ref.current
    if (!el) return

    // Remove the slash and filter text
    const text = el.textContent || ''
    const offset = getCursorOffset(el)
    const before = text.slice(0, slashStartRef.current)
    const after = text.slice(offset)

    slashStartRef.current = null

    if (type === 'divider' || type === 'table') {
      // If block has other content, keep it and insert new block after
      if (before.trim() || after.trim()) {
        const content = (before + after).trim() ? [{ text: before + after }] : []
        updateBlock(block.id, { content })
        el.innerHTML = spansToHtml(content)
        lastHtmlRef.current = el.innerHTML
        addBlock(pageId, type, block.id)
      } else {
        // Convert this block
        updateBlock(block.id, { type, content: [] })
        el.innerHTML = ''
        lastHtmlRef.current = ''
      }
    } else {
      // Convert current block type, keep remaining content
      const content = (before + after).trim() ? [{ text: before + after }] : []
      updateBlock(block.id, {
        type,
        content,
        checked: type === 'todoList' ? false : undefined,
        calloutEmoji: type === 'callout' ? '💡' : undefined,
      })

      requestAnimationFrame(() => {
        if (ref.current) {
          ref.current.innerHTML = spansToHtml(content)
          lastHtmlRef.current = ref.current.innerHTML
          ref.current.focus()
          setCursorOffset(ref.current, before.length)
        }
      })
    }
  }

  // Determine element and styling based on block type
  const baseClasses = 'outline-none w-full min-h-[1.5em] empty:before:text-text-muted/30 empty:before:content-[attr(data-placeholder)]'

  const typeClasses: Record<string, string> = {
    paragraph: 'text-text-primary text-sm leading-relaxed',
    heading1: 'text-3xl font-bold font-mono text-text-primary leading-tight',
    heading2: 'text-2xl font-bold font-mono text-text-primary leading-tight',
    heading3: 'text-xl font-semibold font-mono text-text-primary leading-tight',
    bulletList: 'text-text-primary text-sm leading-relaxed',
    numberedList: 'text-text-primary text-sm leading-relaxed',
    todoList: 'text-text-primary text-sm leading-relaxed',
    code: 'font-mono text-xs text-accent-green bg-bg-tertiary rounded-lg p-4 whitespace-pre-wrap',
    quote: 'text-text-secondary text-sm italic leading-relaxed',
    callout: 'text-text-primary text-sm leading-relaxed',
  }

  const placeholders: Record<string, string> = {
    paragraph: "Type '/' for commands...",
    heading1: 'Heading 1',
    heading2: 'Heading 2',
    heading3: 'Heading 3',
    bulletList: 'List item',
    numberedList: 'List item',
    todoList: 'To-do',
    code: 'Code',
    quote: 'Quote',
    callout: 'Type something...',
  }

  return (
    <>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-block-id={block.id}
        data-placeholder={placeholders[block.type] || ''}
        className={`${baseClasses} ${typeClasses[block.type] || typeClasses.paragraph}`}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
      />
      {slashMenu && (
        <PotionSlashMenu
          position={slashMenu.position}
          filter={slashMenu.filter}
          onSelect={handleSlashSelect}
          onClose={() => { setSlashMenu(null); slashStartRef.current = null }}
        />
      )}
    </>
  )
}
