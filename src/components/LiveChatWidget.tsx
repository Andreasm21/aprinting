// Public-facing live chat bubble — bottom-right of every storefront page.
//
// Two modes:
//   1. Gating form  — first time the visitor opens the bubble. Asks for
//      name + email + the first message. Submit → creates a thread server-side
//      and immediately switches to chat mode.
//   2. Chat mode    — full conversation: visitor messages on the right, admin
//      replies on the left. New admin messages mark themselves read once the
//      bubble is open.
//
// Visitor identity persists in localStorage so reloading the page reconnects
// to the same thread.

import { useEffect, useRef, useState } from 'react'
import { MessageCircle, X, Send } from 'lucide-react'
import { useClientChatStore } from '@/stores/clientChatStore'

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 2)
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function LiveChatWidget() {
  const open = useClientChatStore((s) => s.open)
  const toggleOpen = useClientChatStore((s) => s.toggleOpen)
  const setOpen = useClientChatStore((s) => s.setOpen)
  const bootstrap = useClientChatStore((s) => s.bootstrap)
  const startThread = useClientChatStore((s) => s.startThread)
  const sendMessage = useClientChatStore((s) => s.sendMessage)
  const messages = useClientChatStore((s) => s.messages)
  const thread = useClientChatStore((s) => s.thread)
  const visitorName = useClientChatStore((s) => s.visitorName)
  const visitorEmail = useClientChatStore((s) => s.visitorEmail)
  const loading = useClientChatStore((s) => s.loading)
  const error = useClientChatStore((s) => s.error)
  const unreadAdminCount = useClientChatStore((s) => s.unreadAdminCount())

  // Gating form state
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formBody, setFormBody] = useState('')

  // Chat composer state
  const [body, setBody] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Bootstrap on mount — pulls visitor id + thread from localStorage
  useEffect(() => { bootstrap() }, [bootstrap])

  // Pre-fill the form with stored values if visitor has chatted before
  useEffect(() => {
    if (!formName && visitorName) setFormName(visitorName)
    if (!formEmail && visitorEmail) setFormEmail(visitorEmail)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitorName, visitorEmail])

  // Auto-grow composer
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 96)}px`
  }, [body])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, open])

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault()
    await startThread(formName, formEmail, formBody)
  }

  const handleSend = async () => {
    if (!body.trim()) return
    const msg = body
    setBody('')
    await sendMessage(msg)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 font-mono text-xs">
      {/* Expanded panel */}
      {open && (
        <div className="mb-3 w-[360px] max-h-[560px] flex flex-col rounded-2xl bg-bg-secondary border border-border shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border bg-bg-tertiary/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <div>
                <p className="text-text-primary font-bold">Chat with Axiom</p>
                <p className="text-text-muted text-[10px]">
                  {thread ? 'We typically reply within an hour' : 'Send us a message — we\'ll reply ASAP'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="text-text-muted hover:text-text-primary p-1"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          {!thread ? (
            // ─── Gating form ───
            <form onSubmit={handleStart} className="p-4 flex flex-col gap-3">
              <p className="text-text-secondary text-[11px] leading-relaxed">
                Quick intro so we know who we're talking to. We'll only use your email to reply.
              </p>
              <div>
                <label className="block text-[10px] uppercase text-text-muted tracking-wider mb-1">Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Your name"
                  required
                  autoFocus
                  className="input-field text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase text-text-muted tracking-wider mb-1">Email</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="input-field text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase text-text-muted tracking-wider mb-1">How can we help?</label>
                <textarea
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  placeholder="Type your question…"
                  required
                  rows={3}
                  className="input-field text-xs resize-y"
                />
              </div>
              {error && <p className="text-red-400 text-[11px]">{error}</p>}
              <button
                type="submit"
                disabled={loading || !formName.trim() || !formEmail.trim() || !formBody.trim()}
                className="bg-accent-amber text-bg-primary font-bold text-xs px-4 py-2 rounded disabled:opacity-50 hover:bg-accent-amber/90 transition-colors"
              >
                {loading ? 'Sending…' : 'Start chat'}
              </button>
            </form>
          ) : (
            <>
              {/* Message list */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5">
                {messages.map((m) => {
                  const isVisitor = m.authorKind === 'visitor'
                  const isSystem = m.authorKind === 'system'
                  if (isSystem) {
                    return (
                      <div key={m.id} className="text-center text-text-muted text-[10px] italic py-1">
                        {m.body}
                      </div>
                    )
                  }
                  return (
                    <div key={m.id} className={`flex gap-2 ${isVisitor ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[9px] flex-shrink-0 ${
                        isVisitor ? 'bg-accent-amber/20 text-accent-amber' : 'bg-bg-tertiary text-text-secondary'
                      }`}>
                        {isVisitor ? initials(visitorName || 'You') : 'AX'}
                      </div>
                      <div className={`max-w-[230px] min-w-0 ${isVisitor ? 'text-right' : 'text-left'}`}>
                        <div className={`inline-block px-3 py-2 rounded-2xl text-xs leading-relaxed break-words whitespace-pre-wrap ${
                          isVisitor
                            ? 'bg-accent-amber/15 text-text-primary rounded-tr-sm'
                            : 'bg-bg-tertiary text-text-primary rounded-tl-sm'
                        }`}>
                          {m.body}
                        </div>
                        <p className="text-[9px] text-text-muted mt-0.5 px-1">
                          {formatTime(m.createdAt)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Composer */}
              <div className="border-t border-border bg-bg-tertiary/30 p-2">
                <div className="flex items-end gap-1.5 bg-bg-tertiary rounded-lg border border-border focus-within:border-accent-amber transition-colors px-2 py-1.5">
                  <textarea
                    ref={taRef}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    placeholder="Type a message…"
                    className="flex-1 bg-transparent resize-none outline-none text-text-primary text-xs leading-relaxed font-mono placeholder:text-text-muted/60 max-h-24 py-1"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={!body.trim()}
                    aria-label="Send message"
                    className="text-accent-amber disabled:text-text-muted/40 disabled:cursor-not-allowed hover:scale-110 transition-transform p-1"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Bubble button */}
      <button
        type="button"
        onClick={toggleOpen}
        aria-label={open ? 'Close chat' : 'Chat with us'}
        className="relative w-12 h-12 rounded-full bg-accent-amber text-bg-primary shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
      >
        <MessageCircle size={20} />
        {unreadAdminCount > 0 && !open && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-bg-primary">
            {unreadAdminCount}
          </span>
        )}
      </button>
    </div>
  )
}
