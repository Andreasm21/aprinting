// /admin/conversations — full-page client-chat reader.
//
// Two-pane layout: thread list on the left (open / closed tabs, sorted by
// most recent activity), conversation on the right (message stream + reply
// composer). Closing or assigning a thread is a single click in the header.
//
// Realtime: every thread + message change streams in via the
// adminClientChatStore subscription; new visitor replies bump the badge
// without needing to refresh.

import { useEffect, useMemo, useState } from 'react'
import { MessageSquare, Send, X, CheckCircle, RotateCcw, User, Mail, Clock, Filter } from 'lucide-react'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { useAdminClientChatStore } from '@/stores/adminClientChatStore'

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 2)
}

function relativeTime(iso: string): string {
  const date = new Date(iso)
  const diff = Date.now() - date.getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function AdminConversations() {
  const currentUser = useAdminAuthStore((s) => s.currentUser)
  const allUsers = useAdminAuthStore((s) => s.users)
  const threads = useAdminClientChatStore((s) => s.threads)
  const messagesByThread = useAdminClientChatStore((s) => s.messagesByThread)
  const load = useAdminClientChatStore((s) => s.load)
  const hasLoaded = useAdminClientChatStore((s) => s.hasLoaded)
  const schemaMissing = useAdminClientChatStore((s) => s.schemaMissing)
  const activeThreadId = useAdminClientChatStore((s) => s.activeThreadId)
  const setActiveThread = useAdminClientChatStore((s) => s.setActiveThread)
  const sendReply = useAdminClientChatStore((s) => s.sendReply)
  const closeThread = useAdminClientChatStore((s) => s.closeThread)
  const reopenThread = useAdminClientChatStore((s) => s.reopenThread)
  const assign = useAdminClientChatStore((s) => s.assign)
  const unreadInThread = useAdminClientChatStore((s) => s.unreadInThread)

  const [filter, setFilter] = useState<'open' | 'closed' | 'all'>('open')
  const [reply, setReply] = useState('')

  useEffect(() => { if (!hasLoaded) void load() }, [hasLoaded, load])

  // Auto-select the first thread in view when nothing is selected
  useEffect(() => {
    if (activeThreadId) return
    const filtered = threads.filter((t) => filter === 'all' ? true : t.status === filter)
    if (filtered.length > 0) setActiveThread(filtered[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads, filter, activeThreadId])

  if (!currentUser) return null

  if (schemaMissing) {
    return (
      <div className="card-base p-6 max-w-xl">
        <h1 className="font-mono text-lg font-bold text-text-primary mb-2 flex items-center gap-2">
          <MessageSquare size={18} className="text-accent-amber" /> Customer chats
        </h1>
        <p className="text-text-secondary text-sm mb-3">The client-chat schema isn't installed yet.</p>
        <code className="block bg-bg-tertiary border border-border rounded px-3 py-2 text-xs text-accent-amber select-all">
          supabase/migrations/20260428_client_chat.sql
        </code>
      </div>
    )
  }

  const visibleThreads = threads
    .filter((t) => filter === 'all' ? true : t.status === filter)
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))

  const activeThread = threads.find((t) => t.id === activeThreadId) ?? null
  const activeMessages = activeThreadId ? (messagesByThread.get(activeThreadId) ?? []) : []
  const usersById = useMemo(() => new Map(allUsers.map((u) => [u.id, u])), [allUsers])

  const handleSend = async () => {
    if (!activeThreadId || !reply.trim()) return
    const body = reply
    setReply('')
    await sendReply(activeThreadId, currentUser.id, body)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <div>
          <h1 className="font-mono text-2xl font-bold text-text-primary flex items-center gap-2">
            <MessageSquare size={24} className="text-accent-amber" /> Customer chats
          </h1>
          <p className="text-text-secondary text-sm">Live chat from visitors on the public site</p>
        </div>
        <div className="flex items-center gap-1 bg-bg-tertiary rounded-lg p-1 font-mono text-xs">
          <Filter size={12} className="text-text-muted ml-1.5 mr-0.5" />
          {(['open', 'closed', 'all'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded transition-colors capitalize ${
                filter === f ? 'bg-accent-amber text-bg-primary font-bold' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 mt-6">
        {/* Thread list */}
        <div className="card-base p-2 max-h-[70vh] overflow-y-auto">
          {visibleThreads.length === 0 ? (
            <div className="px-3 py-10 text-center text-text-muted text-xs font-mono">
              {filter === 'open' ? 'No open conversations.' : 'Nothing here.'}
            </div>
          ) : (
            <ul className="space-y-1">
              {visibleThreads.map((t) => {
                const isActive = t.id === activeThreadId
                const unread = unreadInThread(t.id)
                const lastMessage = (messagesByThread.get(t.id) ?? []).slice(-1)[0]
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setActiveThread(t.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-accent-amber/10 border border-accent-amber/30'
                          : 'border border-transparent hover:bg-bg-tertiary/60'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-accent-amber/10 flex items-center justify-center text-accent-amber font-bold text-[10px] flex-shrink-0">
                          {initials(t.visitorName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-text-primary text-xs font-bold truncate">{t.visitorName}</p>
                            {unread > 0 && (
                              <span className="bg-accent-amber text-bg-primary text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                {unread}
                              </span>
                            )}
                          </div>
                          <p className="text-text-muted text-[10px] truncate">
                            {lastMessage?.body ?? 'No messages'}
                          </p>
                          <p className="text-text-muted text-[9px] mt-0.5">{relativeTime(t.lastMessageAt)}</p>
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Conversation */}
        <div className="card-base flex flex-col h-[70vh] overflow-hidden">
          {!activeThread ? (
            <div className="flex-1 flex items-center justify-center text-text-muted text-xs font-mono">
              Select a conversation to read.
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-text-primary font-bold text-sm">{activeThread.visitorName}</p>
                    <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      activeThread.status === 'open'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-text-muted/10 text-text-muted'
                    }`}>
                      {activeThread.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-text-muted font-mono">
                    <a href={`mailto:${activeThread.visitorEmail}`} className="hover:text-accent-amber flex items-center gap-1">
                      <Mail size={9} /> {activeThread.visitorEmail}
                    </a>
                    <span className="flex items-center gap-1">
                      <Clock size={9} /> Started {relativeTime(activeThread.createdAt)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <select
                    value={activeThread.assignedAdminId ?? ''}
                    onChange={(e) => void assign(activeThread.id, e.target.value || null)}
                    className="text-[10px] font-mono px-2 py-1.5 bg-bg-tertiary border border-border rounded text-text-secondary hover:border-accent-amber focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {allUsers.map((u) => (
                      <option key={u.id} value={u.id}>Assigned · {u.displayName}</option>
                    ))}
                  </select>
                  {activeThread.status === 'open' ? (
                    <button
                      type="button"
                      onClick={() => void closeThread(activeThread.id)}
                      className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1.5 rounded border border-border hover:border-emerald-500/50 hover:text-emerald-400 text-text-secondary flex items-center gap-1"
                    >
                      <CheckCircle size={11} /> Close
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void reopenThread(activeThread.id)}
                      className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1.5 rounded border border-border hover:border-accent-amber hover:text-accent-amber text-text-secondary flex items-center gap-1"
                    >
                      <RotateCcw size={11} /> Reopen
                    </button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono">
                {activeMessages.length === 0 && (
                  <p className="text-text-muted text-xs text-center py-8">Loading messages…</p>
                )}
                {activeMessages.map((m) => {
                  const isAdmin = m.authorKind === 'admin'
                  const isSystem = m.authorKind === 'system'
                  if (isSystem) {
                    return (
                      <div key={m.id} className="text-center text-text-muted text-[10px] italic">
                        {m.body}
                      </div>
                    )
                  }
                  const author = isAdmin ? usersById.get(m.authorId ?? '') : undefined
                  return (
                    <div key={m.id} className={`flex gap-2.5 ${isAdmin ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] flex-shrink-0 ${
                        isAdmin ? 'bg-accent-amber/10 text-accent-amber' : 'bg-bg-tertiary text-text-secondary'
                      }`}>
                        {isAdmin ? initials(author?.displayName ?? 'AX') : initials(activeThread.visitorName)}
                      </div>
                      <div className={`max-w-[75%] min-w-0 ${isAdmin ? 'text-right' : 'text-left'}`}>
                        <div className="flex items-baseline gap-2 mb-0.5 text-[10px] text-text-muted">
                          <span className={isAdmin ? 'order-2' : ''}>
                            {isAdmin ? (author?.displayName ?? 'Admin') : activeThread.visitorName}
                          </span>
                          <span>·</span>
                          <span>{formatTime(m.createdAt)}</span>
                          {isAdmin && m.readAt && <span className="text-emerald-400">· read</span>}
                        </div>
                        <div className={`inline-block px-3 py-2 rounded-2xl text-xs leading-relaxed break-words whitespace-pre-wrap ${
                          isAdmin
                            ? 'bg-accent-amber/15 text-text-primary rounded-tr-sm'
                            : 'bg-bg-tertiary text-text-primary rounded-tl-sm'
                        }`}>
                          {m.body}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Composer */}
              {activeThread.status === 'open' ? (
                <div className="border-t border-border p-2 bg-bg-tertiary/30">
                  <div className="flex items-end gap-1.5 bg-bg-tertiary rounded-lg border border-border focus-within:border-accent-amber transition-colors px-2.5 py-1.5">
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          void handleSend()
                        }
                      }}
                      rows={1}
                      placeholder={`Reply to ${activeThread.visitorName}…  (Enter to send)`}
                      className="flex-1 bg-transparent resize-none outline-none text-text-primary text-xs leading-relaxed font-mono placeholder:text-text-muted/60 max-h-32 py-1"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSend()}
                      disabled={!reply.trim()}
                      aria-label="Send reply"
                      className="text-accent-amber disabled:text-text-muted/40 disabled:cursor-not-allowed hover:scale-110 transition-transform p-1"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-t border-border p-3 bg-bg-tertiary/30 text-center text-text-muted text-[11px] font-mono">
                  This conversation is closed. Reopen to reply.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Suppress unused-import warnings on icons that may not all render in every branch
void X; void User
