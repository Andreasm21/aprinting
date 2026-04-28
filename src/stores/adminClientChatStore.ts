// Admin-side store for client (visitor) live chat threads.
//
// Loads every thread + message and keeps them in sync via a global realtime
// subscription. Lets admins reply, close threads, and assign owners.

import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { ClientChatMessage, ClientChatThread } from './clientChatStore'

interface ThreadRow {
  id: string
  visitor_id: string
  visitor_name: string
  visitor_email: string
  status: string
  assigned_admin_id: string | null
  created_at: string
  last_message_at: string
  last_email_sent_at: string | null
}
function threadFromRow(r: ThreadRow): ClientChatThread {
  return {
    id: r.id,
    visitorId: r.visitor_id,
    visitorName: r.visitor_name,
    visitorEmail: r.visitor_email,
    status: r.status === 'closed' ? 'closed' : 'open',
    assignedAdminId: r.assigned_admin_id ?? undefined,
    createdAt: r.created_at,
    lastMessageAt: r.last_message_at,
    lastEmailSentAt: r.last_email_sent_at ?? undefined,
  }
}

interface MessageRow {
  id: string
  thread_id: string
  author_kind: string
  author_id: string | null
  body: string
  created_at: string
  read_at: string | null
}
function messageFromRow(r: MessageRow): ClientChatMessage {
  return {
    id: r.id,
    threadId: r.thread_id,
    authorKind: (r.author_kind === 'admin' || r.author_kind === 'system' ? r.author_kind : 'visitor') as ClientChatMessage['authorKind'],
    authorId: r.author_id ?? undefined,
    body: r.body,
    createdAt: r.created_at,
    readAt: r.read_at ?? undefined,
  }
}

let _warned = false
let _realtimeStarted = false

interface State {
  threads: ClientChatThread[]
  messagesByThread: Map<string, ClientChatMessage[]>
  loading: boolean
  hasLoaded: boolean
  schemaMissing: boolean
  activeThreadId: string | null

  load: () => Promise<void>
  loadMessages: (threadId: string) => Promise<void>
  sendReply: (threadId: string, adminId: string, body: string) => Promise<void>
  closeThread: (threadId: string) => Promise<void>
  reopenThread: (threadId: string) => Promise<void>
  assign: (threadId: string, adminId: string | null) => Promise<void>
  setActiveThread: (id: string | null) => void
  /** Mark every visitor message in this thread as read by an admin. */
  markVisitorMessagesRead: (threadId: string) => Promise<void>

  // Internal — realtime
  _onMessageInserted: (m: ClientChatMessage) => void
  _onMessageUpdated: (m: ClientChatMessage) => void
  _onThreadInserted: (t: ClientChatThread) => void
  _onThreadUpdated: (t: ClientChatThread) => void

  // Selectors
  unreadCount: () => number
  unreadInThread: (threadId: string) => number
}

export const useAdminClientChatStore = create<State>((set, get) => ({
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
        .from('client_chat_threads')
        .select('*')
        .order('last_message_at', { ascending: false })
      if (error) {
        const code = (error as { code?: string }).code
        const tableMissing = code === '42P01' || code === 'PGRST205' ||
          /Could not find the table/i.test(error.message ?? '') ||
          /relation .* does not exist/i.test(error.message ?? '')
        if (tableMissing) {
          if (!_warned) {
            _warned = true
            console.info('[client_chat] table not found — apply supabase/migrations/20260428_client_chat.sql')
          }
          set({ loading: false, hasLoaded: true, schemaMissing: true })
          return
        }
        console.error('[client_chat:admin] load:', error.message)
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
      console.error('[client_chat:admin] load:', err)
      set({ loading: false, hasLoaded: true })
    }
  },

  loadMessages: async (threadId) => {
    if (!isSupabaseConfigured) return
    try {
      const { data, error } = await supabase
        .from('client_chat_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })
      if (error) {
        console.error('[client_chat:admin] loadMessages:', error.message)
        return
      }
      const msgs = ((data ?? []) as MessageRow[]).map(messageFromRow)
      set((s) => {
        const next = new Map(s.messagesByThread)
        next.set(threadId, msgs)
        return { messagesByThread: next }
      })
    } catch (err) {
      console.error('[client_chat:admin] loadMessages:', err)
    }
  },

  sendReply: async (threadId, adminId, body) => {
    const trimmed = body.trim()
    if (!trimmed || !isSupabaseConfigured) return

    const optimistic: ClientChatMessage = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      threadId,
      authorKind: 'admin',
      authorId: adminId,
      body: trimmed,
      createdAt: new Date().toISOString(),
    }
    set((s) => {
      const next = new Map(s.messagesByThread)
      next.set(threadId, [...(next.get(threadId) ?? []), optimistic])
      return { messagesByThread: next }
    })

    try {
      const { data, error } = await supabase.from('client_chat_messages')
        .insert({ thread_id: threadId, author_kind: 'admin', author_id: adminId, body: trimmed })
        .select()
        .single()
      if (error || !data) {
        console.error('[client_chat:admin] sendReply:', error?.message)
        return
      }
      const real = messageFromRow(data as MessageRow)
      set((s) => {
        const next = new Map(s.messagesByThread)
        const list = (next.get(threadId) ?? []).map((m) => m.id === optimistic.id ? real : m)
        next.set(threadId, list)
        return { messagesByThread: next }
      })

      // Bump last_message_at on the thread
      await supabase.from('client_chat_threads')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', threadId)
    } catch (err) {
      console.error('[client_chat:admin] sendReply:', err)
    }
  },

  closeThread: async (threadId) => {
    if (!isSupabaseConfigured) return
    set((s) => ({ threads: s.threads.map((t) => t.id === threadId ? { ...t, status: 'closed' } : t) }))
    try {
      await supabase.from('client_chat_threads').update({ status: 'closed' }).eq('id', threadId)
    } catch (err) {
      console.warn('[client_chat:admin] closeThread:', err)
    }
  },

  reopenThread: async (threadId) => {
    if (!isSupabaseConfigured) return
    set((s) => ({ threads: s.threads.map((t) => t.id === threadId ? { ...t, status: 'open' } : t) }))
    try {
      await supabase.from('client_chat_threads').update({ status: 'open' }).eq('id', threadId)
    } catch (err) {
      console.warn('[client_chat:admin] reopenThread:', err)
    }
  },

  assign: async (threadId, adminId) => {
    if (!isSupabaseConfigured) return
    set((s) => ({ threads: s.threads.map((t) => t.id === threadId ? { ...t, assignedAdminId: adminId ?? undefined } : t) }))
    try {
      await supabase.from('client_chat_threads').update({ assigned_admin_id: adminId }).eq('id', threadId)
    } catch (err) {
      console.warn('[client_chat:admin] assign:', err)
    }
  },

  setActiveThread: (id) => {
    set({ activeThreadId: id })
    if (id) {
      void get().loadMessages(id)
      void get().markVisitorMessagesRead(id)
    }
  },

  markVisitorMessagesRead: async (threadId) => {
    if (!isSupabaseConfigured) return
    const msgs = get().messagesByThread.get(threadId) ?? []
    const unreadIds = msgs.filter((m) => m.authorKind === 'visitor' && !m.readAt).map((m) => m.id)
    if (unreadIds.length === 0) return
    const now = new Date().toISOString()
    set((s) => {
      const next = new Map(s.messagesByThread)
      next.set(threadId, msgs.map((m) => unreadIds.includes(m.id) ? { ...m, readAt: now } : m))
      return { messagesByThread: next }
    })
    try {
      await supabase.from('client_chat_messages').update({ read_at: now }).in('id', unreadIds)
    } catch (err) {
      console.warn('[client_chat:admin] markRead:', err)
    }
  },

  // ─── Realtime callbacks ───
  _onMessageInserted: (m) => {
    set((s) => {
      const next = new Map(s.messagesByThread)
      const existing = next.get(m.threadId) ?? []
      if (existing.some((x) => x.id === m.id)) return {}
      next.set(m.threadId, [...existing, m])
      return { messagesByThread: next }
    })
  },
  _onMessageUpdated: (m) => {
    set((s) => {
      const existing = s.messagesByThread.get(m.threadId)
      if (!existing) return {}
      const next = new Map(s.messagesByThread)
      next.set(m.threadId, existing.map((x) => x.id === m.id ? m : x))
      return { messagesByThread: next }
    })
  },
  _onThreadInserted: (t) => {
    set((s) => {
      if (s.threads.some((x) => x.id === t.id)) return {}
      return { threads: [t, ...s.threads] }
    })
  },
  _onThreadUpdated: (t) => {
    set((s) => ({ threads: s.threads.map((x) => x.id === t.id ? t : x) }))
  },

  // ─── Selectors ───
  unreadInThread: (threadId) => {
    const msgs = get().messagesByThread.get(threadId) ?? []
    return msgs.filter((m) => m.authorKind === 'visitor' && !m.readAt).length
  },
  unreadCount: () => {
    let total = 0
    for (const t of get().threads) {
      total += get().unreadInThread(t.id)
    }
    return total
  },
}))

function startRealtime() {
  if (!isSupabaseConfigured) return
  const channel = supabase.channel('client-chat:admin:all')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'client_chat_threads' }, (payload) => {
      useAdminClientChatStore.getState()._onThreadInserted(threadFromRow(payload.new as ThreadRow))
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'client_chat_threads' }, (payload) => {
      useAdminClientChatStore.getState()._onThreadUpdated(threadFromRow(payload.new as ThreadRow))
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'client_chat_messages' }, (payload) => {
      useAdminClientChatStore.getState()._onMessageInserted(messageFromRow(payload.new as MessageRow))
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'client_chat_messages' }, (payload) => {
      useAdminClientChatStore.getState()._onMessageUpdated(messageFromRow(payload.new as MessageRow))
    })
    .subscribe()
  void channel
}
