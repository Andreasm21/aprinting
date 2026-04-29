// Admin mail store — backs /admin/mail.
//
// Threads + messages backed by Supabase, kept in sync via realtime. Sending
// uses the existing /api/send-email route; this store handles the local
// state, optimistic updates, and read-receipt bookkeeping.
//
// Phase 1 ships the read side. Reply composer + send wiring lands in
// Phase 3 alongside the rich-text editor.

import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export type EmailDirection = 'inbound' | 'outbound'

export interface EmailAttachment {
  id: string
  messageId: string
  filename: string
  contentType: string
  size: number
  storagePath: string
  url: string
}

export interface EmailMessage {
  id: string
  threadId: string
  direction: EmailDirection
  messageId?: string
  inReplyTo?: string
  referenceChain: string[]
  fromEmail: string
  fromName?: string
  toEmails: string[]
  ccEmails: string[]
  bccEmails: string[]
  subject: string
  bodyText?: string
  bodyHtml?: string
  sentByAdminId?: string
  readAt?: string
  createdAt: string
  attachments?: EmailAttachment[]
}

export interface EmailThread {
  id: string
  subject: string
  participantEmail: string
  participantName?: string
  messageCount: number
  lastMessageAt: string
  unreadCount: number
  customerId?: string
  leadId?: string
  documentId?: string
  archived: boolean
  createdAt: string
}

// ───────────────────────── Row converters ─────────────────────────

interface ThreadRow {
  id: string
  subject: string
  participant_email: string
  participant_name: string | null
  message_count: number
  last_message_at: string
  unread_count: number
  customer_id: string | null
  lead_id: string | null
  document_id: string | null
  archived: boolean
  created_at: string
}

function threadFromRow(r: ThreadRow): EmailThread {
  return {
    id: r.id,
    subject: r.subject,
    participantEmail: r.participant_email,
    participantName: r.participant_name ?? undefined,
    messageCount: r.message_count ?? 0,
    lastMessageAt: r.last_message_at,
    unreadCount: r.unread_count ?? 0,
    customerId: r.customer_id ?? undefined,
    leadId: r.lead_id ?? undefined,
    documentId: r.document_id ?? undefined,
    archived: Boolean(r.archived),
    createdAt: r.created_at,
  }
}

interface MessageRow {
  id: string
  thread_id: string
  direction: string
  message_id: string | null
  in_reply_to: string | null
  reference_chain: string[] | null
  from_email: string
  from_name: string | null
  to_emails: string[] | null
  cc_emails: string[] | null
  bcc_emails: string[] | null
  subject: string
  body_text: string | null
  body_html: string | null
  sent_by_admin_id: string | null
  read_at: string | null
  created_at: string
}

function messageFromRow(r: MessageRow): EmailMessage {
  return {
    id: r.id,
    threadId: r.thread_id,
    direction: (r.direction === 'outbound' ? 'outbound' : 'inbound') as EmailDirection,
    messageId: r.message_id ?? undefined,
    inReplyTo: r.in_reply_to ?? undefined,
    referenceChain: r.reference_chain ?? [],
    fromEmail: r.from_email,
    fromName: r.from_name ?? undefined,
    toEmails: r.to_emails ?? [],
    ccEmails: r.cc_emails ?? [],
    bccEmails: r.bcc_emails ?? [],
    subject: r.subject,
    bodyText: r.body_text ?? undefined,
    bodyHtml: r.body_html ?? undefined,
    sentByAdminId: r.sent_by_admin_id ?? undefined,
    readAt: r.read_at ?? undefined,
    createdAt: r.created_at,
  }
}

interface AttachmentRow {
  id: string
  message_id: string
  filename: string
  content_type: string
  size: number | string
  storage_path: string
  url: string
}

function attachmentFromRow(r: AttachmentRow): EmailAttachment {
  return {
    id: r.id,
    messageId: r.message_id,
    filename: r.filename,
    contentType: r.content_type,
    size: typeof r.size === 'string' ? parseInt(r.size, 10) || 0 : r.size,
    storagePath: r.storage_path,
    url: r.url,
  }
}

let _warned = false
let _realtimeStarted = false

// ─────────── Stable empty fallbacks (avoid React 19 getSnapshot loops) ───────────
const EMPTY_MESSAGES: EmailMessage[] = []

interface State {
  threads: EmailThread[]
  messagesByThread: Map<string, EmailMessage[]>
  loading: boolean
  hasLoaded: boolean
  schemaMissing: boolean
  activeThreadId: string | null

  load: () => Promise<void>
  loadMessages: (threadId: string) => Promise<void>
  setActiveThread: (id: string | null) => void

  /** Mark a thread's unread_count to zero and stamp read_at on its inbound messages. */
  markThreadRead: (threadId: string) => Promise<void>

  /** Send an outbound reply to a thread. Computes In-Reply-To/References
   *  from the latest inbound message, appends the admin's signature, posts
   *  to /api/send-email, and inserts the outbound row optimistically. */
  sendReply: (input: {
    threadId: string
    bodyHtml: string
    bodyText?: string
    attachments?: Array<{ filename: string; contentBase64: string; contentType?: string }>
    sentByAdminId: string
    fromName?: string
    /** Optional override of the from-address. Falls back to env's EMAIL_FROM on the server. */
    fromEmail?: string
  }) => Promise<{ ok: boolean; error?: string }>

  /** Toggle archive on a thread. */
  setArchived: (threadId: string, archived: boolean) => Promise<void>

  // Internal
  _onThreadInserted: (t: EmailThread) => void
  _onThreadUpdated: (t: EmailThread) => void
  _onMessageInserted: (m: EmailMessage) => void

  // Selectors
  byId: (threadId: string) => EmailThread | undefined
  unreadCount: () => number
  filtered: (filter: 'all' | 'unread' | 'archived') => EmailThread[]
}

export const useEmailsStore = create<State>((set, get) => ({
  threads: [],
  messagesByThread: new Map(),
  loading: false,
  hasLoaded: false,
  schemaMissing: false,
  activeThreadId: null,

  load: async () => {
    if (!isSupabaseConfigured) { set({ hasLoaded: true }); return }
    if (get().loading || get().hasLoaded) return
    set({ loading: true })
    try {
      const { data, error } = await supabase
        .from('email_threads')
        .select('*')
        .order('last_message_at', { ascending: false })
        .limit(500)
      if (error) {
        const code = (error as { code?: string }).code
        const tableMissing = code === '42P01' || code === 'PGRST205' ||
          /Could not find the table/i.test(error.message ?? '') ||
          /relation .* does not exist/i.test(error.message ?? '')
        if (tableMissing) {
          if (!_warned) {
            _warned = true
            console.info('[emails] table not found — apply supabase/migrations/20260429_mail_client.sql')
          }
          set({ loading: false, hasLoaded: true, schemaMissing: true })
          return
        }
        console.error('[emails] load:', error.message)
        set({ loading: false, hasLoaded: true })
        return
      }
      set({
        threads: ((data ?? []) as ThreadRow[]).map(threadFromRow),
        loading: false,
        hasLoaded: true,
      })
      if (!_realtimeStarted) {
        _realtimeStarted = true
        startRealtime()
      }
    } catch (err) {
      console.error('[emails] load:', err)
      set({ loading: false, hasLoaded: true })
    }
  },

  loadMessages: async (threadId) => {
    if (!isSupabaseConfigured) return
    try {
      const { data: messages, error } = await supabase
        .from('email_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })
      if (error) {
        console.error('[emails] loadMessages:', error.message)
        return
      }
      const msgs = ((messages ?? []) as MessageRow[]).map(messageFromRow)

      // Hydrate attachments in parallel
      const ids = msgs.map((m) => m.id)
      if (ids.length > 0) {
        const { data: atts } = await supabase
          .from('email_attachments')
          .select('*')
          .in('message_id', ids)
        const byMsg = new Map<string, EmailAttachment[]>()
        for (const row of (atts ?? []) as AttachmentRow[]) {
          const a = attachmentFromRow(row)
          const list = byMsg.get(a.messageId) ?? []
          list.push(a)
          byMsg.set(a.messageId, list)
        }
        for (const m of msgs) m.attachments = byMsg.get(m.id) ?? []
      }

      set((s) => {
        const next = new Map(s.messagesByThread)
        next.set(threadId, msgs)
        return { messagesByThread: next }
      })
    } catch (err) {
      console.error('[emails] loadMessages:', err)
    }
  },

  setActiveThread: (id) => {
    set({ activeThreadId: id })
    if (id) {
      void get().loadMessages(id)
      void get().markThreadRead(id)
    }
  },

  markThreadRead: async (threadId) => {
    if (!isSupabaseConfigured) return
    const thread = get().byId(threadId)
    if (!thread || thread.unreadCount === 0) return

    // Optimistic
    set((s) => ({
      threads: s.threads.map((t) => t.id === threadId ? { ...t, unreadCount: 0 } : t),
    }))

    try {
      const now = new Date().toISOString()
      await Promise.all([
        supabase.from('email_threads').update({ unread_count: 0 }).eq('id', threadId),
        supabase.from('email_messages')
          .update({ read_at: now })
          .eq('thread_id', threadId)
          .eq('direction', 'inbound')
          .is('read_at', null),
      ])
    } catch (err) {
      console.warn('[emails] markThreadRead:', err)
    }
  },

  sendReply: async (input) => {
    if (!isSupabaseConfigured) return { ok: false, error: 'Supabase not configured' }
    const thread = get().byId(input.threadId)
    if (!thread) return { ok: false, error: 'Thread not found' }

    // Find the most recent message in this thread to build threading headers.
    const msgs = get().messagesByThread.get(input.threadId) ?? EMPTY_MESSAGES
    const lastMessage = msgs[msgs.length - 1]
    const lastInbound = [...msgs].reverse().find((m) => m.direction === 'inbound')

    // Reply target = the most recent message in the thread (could be our own
    // previous reply if we sent the last one). Prefer the last inbound for
    // building the chain because that's what the customer's mail client
    // will use as the parent.
    const parent = lastInbound ?? lastMessage

    // Build the reference chain — root → ... → parent
    const refs: string[] = []
    if (parent?.referenceChain && parent.referenceChain.length > 0) {
      refs.push(...parent.referenceChain)
    }
    if (parent?.messageId && !refs.includes(parent.messageId)) {
      refs.push(parent.messageId)
    }

    // Generate our outgoing Message-ID so we can store it locally and
    // recognise the customer's reply when it arrives back via webhook.
    const newMessageId = `<reply-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@axiomcreate.com>`

    // Subject: Re: prefix if not already there
    const baseSubject = thread.subject.replace(/^(re|fw|fwd):\s*/gi, '').trim() || '(no subject)'
    const subject = baseSubject.toLowerCase().startsWith('re:') ? baseSubject : `Re: ${baseSubject}`

    // Optimistic insert
    const optimistic: EmailMessage = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      threadId: input.threadId,
      direction: 'outbound',
      messageId: newMessageId,
      inReplyTo: parent?.messageId,
      referenceChain: refs,
      fromEmail: input.fromEmail ?? '',
      fromName: input.fromName,
      toEmails: [thread.participantEmail],
      ccEmails: [],
      bccEmails: [],
      subject,
      bodyText: input.bodyText,
      bodyHtml: input.bodyHtml,
      sentByAdminId: input.sentByAdminId,
      createdAt: new Date().toISOString(),
    }
    set((s) => {
      const next = new Map(s.messagesByThread)
      next.set(input.threadId, [...(next.get(input.threadId) ?? []), optimistic])
      return { messagesByThread: next }
    })

    // POST to /api/send-email
    let sendError: string | null = null
    try {
      const r = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: thread.participantEmail,
          subject,
          html: input.bodyHtml,
          text: input.bodyText,
          inReplyTo: parent?.messageId,
          references: refs,
          messageId: newMessageId,
          // Send as the team's inbound address so customers reply back to it
          // → those replies fire the webhook and land in /admin/mail too.
          replyTo: input.fromEmail,
          attachments: input.attachments?.map((a) => ({
            filename: a.filename,
            content: a.contentBase64,
            contentType: a.contentType,
          })),
        }),
      })
      if (!r.ok) {
        const txt = await r.text().catch(() => '')
        sendError = `send-email ${r.status}: ${txt.slice(0, 200)}`
      }
    } catch (err) {
      sendError = err instanceof Error ? err.message : 'send-email failed'
    }

    if (sendError) {
      // Roll back the optimistic insert
      set((s) => {
        const next = new Map(s.messagesByThread)
        const list = (next.get(input.threadId) ?? []).filter((m) => m.id !== optimistic.id)
        next.set(input.threadId, list)
        return { messagesByThread: next }
      })
      return { ok: false, error: sendError }
    }

    // Persist to DB so it survives page refresh + so the customer's reply
    // can be threaded against it via In-Reply-To matching.
    try {
      const { data, error } = await supabase.from('email_messages')
        .insert({
          thread_id: input.threadId,
          direction: 'outbound',
          message_id: newMessageId,
          in_reply_to: parent?.messageId ?? null,
          reference_chain: refs,
          from_email: input.fromEmail ?? '',
          from_name: input.fromName ?? null,
          to_emails: [thread.participantEmail],
          cc_emails: [],
          bcc_emails: [],
          subject,
          body_text: input.bodyText ?? null,
          body_html: input.bodyHtml,
          sent_by_admin_id: input.sentByAdminId,
        })
        .select()
        .single()
      if (error || !data) {
        console.warn('[emails] sendReply persist:', error?.message)
      } else {
        // Swap the optimistic row for the real one
        const real = messageFromRow(data as MessageRow)
        set((s) => {
          const next = new Map(s.messagesByThread)
          const list = (next.get(input.threadId) ?? []).map((m) => m.id === optimistic.id ? real : m)
          next.set(input.threadId, list)
          return { messagesByThread: next }
        })
      }

      // Bump thread last_message_at + count
      await supabase.from('email_threads')
        .update({
          message_count: (thread.messageCount ?? 0) + 1,
          last_message_at: new Date().toISOString(),
        })
        .eq('id', input.threadId)
    } catch (err) {
      console.warn('[emails] sendReply persist:', err)
    }

    return { ok: true }
  },

  setArchived: async (threadId, archived) => {
    if (!isSupabaseConfigured) return
    set((s) => ({ threads: s.threads.map((t) => t.id === threadId ? { ...t, archived } : t) }))
    try {
      await supabase.from('email_threads').update({ archived }).eq('id', threadId)
    } catch (err) {
      console.warn('[emails] setArchived:', err)
    }
  },

  // ─── Realtime callbacks ───
  _onThreadInserted: (t) => {
    set((s) => {
      if (s.threads.some((x) => x.id === t.id)) return {}
      return { threads: [t, ...s.threads] }
    })
  },
  _onThreadUpdated: (t) => {
    set((s) => ({ threads: s.threads.map((x) => x.id === t.id ? t : x) }))
  },
  _onMessageInserted: (m) => {
    set((s) => {
      const existing = s.messagesByThread.get(m.threadId) ?? EMPTY_MESSAGES
      if (existing.some((x) => x.id === m.id)) return {}
      const next = new Map(s.messagesByThread)
      next.set(m.threadId, [...existing, m])
      return { messagesByThread: next }
    })
  },

  // ─── Selectors ───
  byId: (id) => get().threads.find((t) => t.id === id),
  unreadCount: () => get().threads.reduce((sum, t) => sum + (t.archived ? 0 : t.unreadCount), 0),
  filtered: (filter) => {
    const threads = get().threads
    switch (filter) {
      case 'unread':   return threads.filter((t) => !t.archived && t.unreadCount > 0)
      case 'archived': return threads.filter((t) => t.archived)
      default:         return threads.filter((t) => !t.archived)
    }
  },
}))

function startRealtime() {
  if (!isSupabaseConfigured) return
  const channel = supabase.channel('emails:all')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'email_threads' }, (payload) => {
      useEmailsStore.getState()._onThreadInserted(threadFromRow(payload.new as ThreadRow))
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'email_threads' }, (payload) => {
      useEmailsStore.getState()._onThreadUpdated(threadFromRow(payload.new as ThreadRow))
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'email_messages' }, (payload) => {
      useEmailsStore.getState()._onMessageInserted(messageFromRow(payload.new as MessageRow))
    })
    .subscribe()
  void channel
}
