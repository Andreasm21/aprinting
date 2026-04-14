import type { PotionTextSpan } from '../types'

/** Convert PotionTextSpan[] → HTML string */
export function spansToHtml(spans: PotionTextSpan[]): string {
  if (spans.length === 0) return ''
  return spans.map((span) => {
    let html = escapeHtml(span.text)
    if (!html && spans.length === 1) return ''
    if (span.code) html = `<code class="px-1 py-0.5 bg-bg-tertiary rounded text-accent-amber text-[0.9em] font-mono">${html}</code>`
    if (span.bold) html = `<strong>${html}</strong>`
    if (span.italic) html = `<em>${html}</em>`
    if (span.underline) html = `<u>${html}</u>`
    if (span.strikethrough) html = `<s>${html}</s>`
    if (span.link) html = `<a href="${escapeHtml(span.link)}" class="text-accent-blue underline" target="_blank" rel="noopener">${html}</a>`
    return html
  }).join('')
}

/** Parse contentEditable DOM → PotionTextSpan[] */
export function htmlToSpans(element: HTMLElement): PotionTextSpan[] {
  const spans: PotionTextSpan[] = []

  function walk(node: Node, inherited: Partial<PotionTextSpan>) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || ''
      if (text) {
        spans.push({ text, ...inherited })
      }
      return
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()

    const fmt = { ...inherited }
    if (tag === 'strong' || tag === 'b') fmt.bold = true
    if (tag === 'em' || tag === 'i') fmt.italic = true
    if (tag === 'u') fmt.underline = true
    if (tag === 's' || tag === 'del' || tag === 'strike') fmt.strikethrough = true
    if (tag === 'code') fmt.code = true
    if (tag === 'a') fmt.link = (el as HTMLAnchorElement).href

    if (tag === 'br') {
      spans.push({ text: '\n', ...inherited })
      return
    }

    el.childNodes.forEach((child) => walk(child, fmt))
  }

  element.childNodes.forEach((child) => walk(child, {}))

  // Merge adjacent spans with identical formatting
  return mergeSpans(spans)
}

function mergeSpans(spans: PotionTextSpan[]): PotionTextSpan[] {
  if (spans.length === 0) return []
  const merged: PotionTextSpan[] = [{ ...spans[0] }]
  for (let i = 1; i < spans.length; i++) {
    const prev = merged[merged.length - 1]
    const curr = spans[i]
    if (
      !!prev.bold === !!curr.bold &&
      !!prev.italic === !!curr.italic &&
      !!prev.underline === !!curr.underline &&
      !!prev.strikethrough === !!curr.strikethrough &&
      !!prev.code === !!curr.code &&
      (prev.link || '') === (curr.link || '')
    ) {
      prev.text += curr.text
    } else {
      merged.push({ ...curr })
    }
  }
  return merged
}

/** Sanitize pasted HTML — keep only recognized inline formatting tags */
export function sanitizePastedHtml(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html

  function clean(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) return node.cloneNode()
    if (node.nodeType !== Node.ELEMENT_NODE) return null

    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()
    const allowed = ['strong', 'b', 'em', 'i', 'u', 's', 'del', 'code', 'a', 'br']

    const container = allowed.includes(tag)
      ? document.createElement(tag)
      : document.createDocumentFragment()

    if (tag === 'a' && container instanceof HTMLElement) {
      (container as HTMLAnchorElement).href = (el as HTMLAnchorElement).href
    }

    el.childNodes.forEach((child) => {
      const cleaned = clean(child)
      if (cleaned) container.appendChild(cleaned)
    })

    return container
  }

  const result = document.createElement('div')
  div.childNodes.forEach((child) => {
    const cleaned = clean(child)
    if (cleaned) result.appendChild(cleaned)
  })

  return result.innerHTML
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Get cursor offset (character count) within an element */
export function getCursorOffset(element: HTMLElement): number {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return 0
  const range = sel.getRangeAt(0)
  const preRange = document.createRange()
  preRange.selectNodeContents(element)
  preRange.setEnd(range.startContainer, range.startOffset)
  return preRange.toString().length
}

/** Set cursor at a character offset within an element */
export function setCursorOffset(element: HTMLElement, offset: number) {
  const sel = window.getSelection()
  if (!sel) return
  const range = document.createRange()

  let charCount = 0
  let found = false

  function walk(node: Node): boolean {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent || '').length
      if (charCount + len >= offset) {
        range.setStart(node, offset - charCount)
        range.collapse(true)
        found = true
        return true
      }
      charCount += len
      return false
    }
    for (let i = 0; i < node.childNodes.length; i++) {
      if (walk(node.childNodes[i])) return true
    }
    return false
  }

  walk(element)

  if (!found) {
    // Place at end
    range.selectNodeContents(element)
    range.collapse(false)
  }

  sel.removeAllRanges()
  sel.addRange(range)
}
