// Center pane — selected thread's messages.
//
// Phase 2 is read-only. The composer + reply flow lives at the bottom as
// a placeholder pointing to Phase 3.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Mail, Archive, ArchiveRestore, ChevronDown, ChevronUp, Paperclip, Download } from 'lucide-react'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { useEmailsStore, type EmailMessage } from '@/stores/emailsStore'

const EMPTY_MESSAGES: EmailMessage[] = []

interface Props {
  threadId: string
}

function initials(name: string | undefined, email: string): string {
  const source = name?.trim() || email
  return source.split(/[\s@.]/).filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Strip the quoted-reply tail from inbound HTML so we don't show the full
 *  thread again in every message. Looks for "On {date}, X wrote:" markers. */
function stripQuotedReply(html: string): { visible: string; hasQuoted: boolean } {
  // Common patterns: <div class="gmail_quote">, blockquote with type=cite,
  // "On Mon, Jan 1, 2026 at …, X wrote:" preceded by <br> or <div>
  const markers = [
    /<div class=["']gmail_quote/i,
    /<blockquote[^>]*type=["']cite["']/i,
    /^On .{2,80} wrote:$/m,
  ]
  for (const re of markers) {
    const idx = html.search(re)
    if (idx > 0) return { visible: html.slice(0, idx), hasQuoted: true }
  }
  return { visible: html, hasQuoted: false }
}

export default function ThreadView({ threadId }: Props) {
  const thread = useEmailsStore((s) => s.byId(threadId))
  const messages = useEmailsStore((s) => s.messagesByThread.get(threadId) ?? EMPTY_MESSAGES)
  const setArchived = useEmailsStore((s) => s.setArchived)
  const allUsers = useAdminAuthStore((s) => s.users)
  const usersById = useMemo(() => new Map(allUsers.map((u) => [u.id, u])), [allUsers])
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages arrive
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  if (!thread) return null

  return (
    <div className="card-base flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-bg-tertiary/40 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-text-primary truncate font-mono">{thread.subject}</h2>
          <p className="text-[10px] text-text-muted mt-0.5 font-mono">
            {thread.messageCount} message{thread.messageCount === 1 ? '' : 's'}
            {' · '}with{' '}
            <span className="text-accent-amber">
              {thread.participantName || thread.participantEmail}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => void setArchived(thread.id, !thread.archived)}
          className="text-[10px] uppercase tracking-wider px-2.5 py-1.5 rounded border border-border hover:border-accent-amber text-text-secondary hover:text-accent-amber flex items-center gap-1 font-mono"
        >
          {thread.archived ? (
            <>
              <ArchiveRestore size={11} /> Unarchive
            </>
          ) : (
            <>
              <Archive size={11} /> Archive
            </>
          )}
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 font-mono">
        {messages.length === 0 ? (
          <p className="text-text-muted text-xs text-center py-8">Loading messages…</p>
        ) : (
          messages.map((m) => {
            const isOutbound = m.direction === 'outbound'
            const author = isOutbound ? usersById.get(m.sentByAdminId ?? '') : null
            return <MessageItem key={m.id} message={m} authorName={author?.displayName} isOutbound={isOutbound} threadParticipantName={thread.participantName ?? thread.participantEmail} />
          })
        )}
      </div>

      {/* Reply composer placeholder */}
      <div className="border-t border-border bg-bg-tertiary/30 p-3 text-center">
        <p className="text-text-muted text-[11px] font-mono italic">
          Composer ships in Phase 3 (rich-text editor + signature + threading headers + attachments).
        </p>
      </div>
    </div>
  )
}

function MessageItem({
  message, authorName, isOutbound, threadParticipantName,
}: { message: EmailMessage; authorName?: string; isOutbound: boolean; threadParticipantName: string }) {
  const [showQuoted, setShowQuoted] = useState(false)
  const html = message.bodyHtml
  const stripped = html ? stripQuotedReply(html) : null

  return (
    <div className={`rounded-lg border p-3 ${
      isOutbound
        ? 'border-accent-amber/30 bg-accent-amber/5 ml-6'
        : 'border-border bg-bg-tertiary/40 mr-6'
    }`}>
      {/* Header */}
      <div className="flex items-start gap-2.5 mb-2">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${
          isOutbound
            ? 'bg-accent-amber/20 text-accent-amber'
            : 'bg-bg-tertiary text-text-secondary'
        }`}>
          {initials(isOutbound ? authorName : message.fromName, message.fromEmail)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs">
            <span className={`font-bold ${isOutbound ? 'text-accent-amber' : 'text-text-primary'}`}>
              {isOutbound ? (authorName ?? 'Admin') : (message.fromName ?? threadParticipantName)}
            </span>
            <span className="text-text-muted ml-1.5 text-[10px]">
              &lt;{message.fromEmail}&gt;
            </span>
          </p>
          <p className="text-[10px] text-text-muted mt-0.5">
            to {message.toEmails.join(', ')} · {formatTime(message.createdAt)}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="text-text-secondary text-xs leading-relaxed">
        {html && stripped ? (
          <>
            <div dangerouslySetInnerHTML={{ __html: stripped.visible }} className="prose-invert max-w-none" />
            {stripped.hasQuoted && (
              <button
                type="button"
                onClick={() => setShowQuoted((v) => !v)}
                className="text-[10px] text-text-muted hover:text-accent-amber mt-2 flex items-center gap-1 font-mono"
              >
                {showQuoted ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                {showQuoted ? 'Hide' : 'Show'} quoted reply
              </button>
            )}
            {showQuoted && stripped.hasQuoted && (
              <div
                dangerouslySetInnerHTML={{ __html: html.slice(stripped.visible.length) }}
                className="mt-2 pl-3 border-l-2 border-border opacity-70 prose-invert max-w-none"
              />
            )}
          </>
        ) : (
          <pre className="whitespace-pre-wrap font-mono text-xs">{message.bodyText ?? '(no body)'}</pre>
        )}
      </div>

      {/* Attachments */}
      {message.attachments && message.attachments.length > 0 && (
        <div className="mt-3 pt-2 border-t border-border space-y-1">
          <p className="text-[10px] uppercase text-text-muted tracking-wider flex items-center gap-1">
            <Paperclip size={10} /> {message.attachments.length} attachment{message.attachments.length === 1 ? '' : 's'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {message.attachments.map((a) => (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                download={a.filename}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-bg-tertiary border border-border hover:border-accent-amber text-[10px] text-text-secondary hover:text-accent-amber"
              >
                <Download size={10} />
                <span className="truncate max-w-[160px]">{a.filename}</span>
                <span className="text-text-muted">{formatBytes(a.size)}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Read indicator (outbound only) */}
      {isOutbound && message.readAt && (
        <p className="text-[9px] text-emerald-400 mt-1.5 flex items-center gap-1">
          <Mail size={9} /> Read at {formatTime(message.readAt)}
        </p>
      )}
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
