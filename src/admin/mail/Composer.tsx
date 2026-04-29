// Reply composer for the mail client.
//
// Plain-text textarea by design — no rich-text editor in this phase. Output
// is converted to HTML on submit (paragraph wrapping + nl2br) and the
// admin's saved signature is appended unless they untick the toggle.
//
// Send wires through emailsStore.sendReply, which handles threading
// headers (In-Reply-To / References built from the latest inbound), the
// optimistic insert into the message list, and the DB persist.

import { useEffect, useRef, useState } from 'react'
import { Send, Loader2, Pen, X } from 'lucide-react'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { useEmailsStore } from '@/stores/emailsStore'

const DEFAULT_FROM = 'team@axiomcreate.com'  // matches EMAIL_FROM env on Vercel

interface Props {
  threadId: string
}

export default function Composer({ threadId }: Props) {
  const currentUser = useAdminAuthStore((s) => s.currentUser)
  const sendReply = useEmailsStore((s) => s.sendReply)
  const thread = useEmailsStore((s) => s.byId(threadId))

  const [body, setBody] = useState('')
  const [includeSig, setIncludeSig] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  // Reset on thread change
  useEffect(() => {
    setBody('')
    setError(null)
    taRef.current?.focus()
  }, [threadId])

  // Auto-grow up to ~12 lines
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 280)}px`
  }, [body])

  if (!currentUser || !thread) return null

  const sigHtml = includeSig && currentUser.emailSignatureHtml
    ? `<p>${linebreaksToHtml(currentUser.emailSignatureHtml)}</p>`
    : ''

  const submit = async () => {
    setError(null)
    const trimmed = body.trim()
    if (!trimmed) return
    setSending(true)
    try {
      const result = await sendReply({
        threadId,
        bodyHtml: composeHtml(trimmed) + (sigHtml ? `<br><br>${sigHtml}` : ''),
        bodyText: composeText(trimmed, includeSig ? currentUser.emailSignatureHtml : undefined),
        sentByAdminId: currentUser.id,
        fromName: currentUser.displayName,
        fromEmail: DEFAULT_FROM,
      })
      if (!result.ok) {
        setError(result.error ?? 'Failed to send')
        return
      }
      setBody('')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl + Enter sends
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      void submit()
    }
  }

  const sigPreview = currentUser.emailSignatureHtml
    ? stripHtml(currentUser.emailSignatureHtml).slice(0, 60)
    : null

  return (
    <div className="border-t border-border bg-bg-tertiary/30 p-3 font-mono">
      {/* Reply target info */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[10px] text-text-muted">
          Reply to <span className="text-text-secondary">{thread.participantName ?? thread.participantEmail}</span>
        </p>
        {error && (
          <p className="text-red-400 text-[10px] flex items-center gap-1">
            <X size={10} /> {error}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 bg-bg-tertiary rounded-lg border border-border focus-within:border-accent-amber transition-colors p-2">
        <textarea
          ref={taRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          placeholder={`Reply to ${thread.participantName ?? thread.participantEmail}…\n\n⌘+Enter to send`}
          className="w-full bg-transparent resize-none outline-none text-text-primary text-xs leading-relaxed font-mono placeholder:text-text-muted/60"
          disabled={sending}
        />

        {/* Signature preview / toggle */}
        {sigPreview && (
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
            <label className="flex items-center gap-1.5 text-[10px] text-text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={includeSig}
                onChange={(e) => setIncludeSig(e.target.checked)}
                className="accent-amber-500"
              />
              <Pen size={10} />
              Append signature
              {includeSig && <span className="italic opacity-70 truncate max-w-[200px]">— {sigPreview}…</span>}
            </label>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!body.trim() || sending}
              className="bg-accent-amber text-bg-primary font-bold text-[11px] px-3 py-1.5 rounded disabled:opacity-50 hover:bg-accent-amber/90 flex items-center gap-1.5"
            >
              {sending ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        )}

        {/* If no signature configured, just show the send button */}
        {!sigPreview && (
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
            <a
              href="/admin/team"
              className="text-[10px] text-text-muted hover:text-accent-amber italic"
            >
              No signature set — add one in /admin/team
            </a>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!body.trim() || sending}
              className="bg-accent-amber text-bg-primary font-bold text-[11px] px-3 py-1.5 rounded disabled:opacity-50 hover:bg-accent-amber/90 flex items-center gap-1.5"
            >
              {sending ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Body conversion helpers ───────────────────────

/** Convert plain-text input to safe HTML: escape, wrap paragraphs, nl→br within paragraph. */
function composeHtml(text: string): string {
  const paragraphs = text.split(/\n{2,}/)  // double-newline = new paragraph
  return paragraphs
    .map((p) => `<p>${linebreaksToHtml(escapeHtml(p))}</p>`)
    .join('')
}

/** Build a plain-text version that mirrors the HTML (signature appended as text). */
function composeText(body: string, signatureHtml?: string): string {
  if (!signatureHtml) return body
  const sigText = stripHtml(signatureHtml)
  return `${body}\n\n${sigText}`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function linebreaksToHtml(s: string): string {
  return s.replace(/\n/g, '<br>')
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}
