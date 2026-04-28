// Visitor-side live-chat store.
//
// One thread per visitor (kept in localStorage so the same visitor reconnects
// across reloads). The visitor identifies themselves with name + email upfront;
// after that all messages stream into client_chat_messages and admins reply
// from /admin/conversations.

import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { notifyAdminsOfNewMessage } from '@/lib/clientChatNotifier'

const VISITOR_ID_KEY = 'axiom-visitor-id'
const THREAD_ID_KEY = 'axiom-visitor-thread-id'
const VISITOR_NAME_KEY = 'axiom-visitor-name'
const VISITOR_EMAIL_KEY = 'axiom-visitor-email'

export type AuthorKind = 'visitor' | 'admin' | 'system'

export interface ClientChatMessage {
  id: string
  threadId: string
  authorKind: AuthorKind
  authorId?: string
  body: string
  createdAt: string
  readAt?: string
}

export interface ClientChatThread {
  id: string
  visitorId: string
  visitorName: string
  visitorEmail: string
  status: 'open' | 'closed'
  assignedAdminId?: string
  createdAt: string
  lastMessageAt: string
  lastEmailSentAt?: string
}

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
    authorKind: (r.author_kind === 'admin' || r.author_kind === 'system' ? r.author_kind : 'visitor') as AuthorKind,
    authorId: r.author_id ?? undefined,
    body: r.body,
    createdAt: r.created_at,
    readAt: r.read_at ?? undefined,
  }
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `v-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function readLocal(key: string): string | null {
  if (typeof localStorage === 'undefined') return null
  try { return localStorage.getItem(key) } catch { return null }
}
function writeLocal(key: string, value: string) {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(key, value) } catch { /* ignore */ }
}

interface ClientChatState {
  open: boolean
  loading: boolean
  visitorId: string | null
  visitorName: string
  visitorEmail: string
  threadId: string | null
  thread: ClientChatThread | null
  messages: ClientChatMessage[]
  error: string | null

  // ─── Actions ───
  bootstrap: () => void
  setOpen: (open: boolean) => void
  toggleOpen: () => void
  startThread: (name: string, email: string, firstMessage: string) => Promise<void>
  sendMessage: (body: string) => Promise<void>
  /** Mark every admin message as read by this visitor. */
  markAdminMessagesRead: () => Promise<void>

  // ─── Internal ───
  _onMessageInserted: (m: ClientChatMessage) => void
  _onThreadUpdated: (t: ClientChatThread) => void

  // ─── Selectors ───
  /** How many admin messages haven't been read by the visitor yet. */
  unreadAdminCount: () => number
}

let _channel: ReturnType<typeof supabase.channel> | null = null
function subscribeToThread(threadId: string) {
  // Tear down any previous subscription
  if (_channel) {
    void supabase.removeChannel(_channel).catch(() => {})
    _channel = null
  }
  if (!isSupabaseConfigured) return
  _channel = supabase.channel(`client-chat:visitor:${threadId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'client_chat_messages', filter: `thread_id=eq.${threadId}` }, (payload) => {
      const msg = messageFromRow(payload.new as MessageRow)
      useClientChatStore.getState()._onMessageInserted(msg)
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'client_chat_threads', filter: `id=eq.${threadId}` }, (payload) => {
      useClientChatStore.getState()._onThreadUpdated(threadFromRow(payload.new as ThreadRow))
    })
    .subscribe()
}

export const useClientChatStore = create<ClientChatState>((set, get) => ({
  open: false,
  loading: false,
  visitorId: null,
  visitorName: '',
  visitorEmail: '',
  threadId: null,
  thread: null,
  messages: [],
  error: null,

  bootstrap: () => {
    let visitorId = readLocal(VISITOR_ID_KEY)
    if (!visitorId) {
      visitorId = uuid()
      writeLocal(VISITOR_ID_KEY, visitorId)
    }
    const name = readLocal(VISITOR_NAME_KEY) ?? ''
    const email = readLocal(VISITOR_EMAIL_KEY) ?? ''
    const threadId = readLocal(THREAD_ID_KEY)
    set({ visitorId, visitorName: name, visitorEmail: email, threadId })

    // Resume the thread if we have one
    if (threadId && isSupabaseConfigured) {
      void (async () => {
        set({ loading: true })
        try {
          const [threadRes, msgRes] = await Promise.all([
            supabase.from('client_chat_threads').select('*').eq('id', threadId).maybeSingle(),
            supabase.from('client_chat_messages').select('*').eq('thread_id', threadId).order('created_at', { ascending: true }),
          ])
          if (threadRes.error || !threadRes.data) {
            // Thread vanished — clear local state
            writeLocal(THREAD_ID_KEY, '')
            set({ threadId: null, thread: null, messages: [], loading: false })
            return
          }
          const thread = threadFromRow(threadRes.data as ThreadRow)
          const messages = ((msgRes.data ?? []) as MessageRow[]).map(messageFromRow)
          set({ thread, messages, loading: false })
          subscribeToThread(thread.id)
        } catch (err) {
          console.error('[client_chat] bootstrap:', err)
          set({ loading: false })
        }
      })()
    }
  },

  setOpen: (open) => {
    set({ open })
    if (open) void get().markAdminMessagesRead()
  },
  toggleOpen: () => {
    const next = !get().open
    set({ open: next })
    if (next) void get().markAdminMessagesRead()
  },

  startThread: async (name, email, firstMessage) => {
    set({ error: null })
    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    const trimmedMsg = firstMessage.trim()
    if (!trimmedName || !trimmedEmail || !trimmedMsg) {
      set({ error: 'Name, email and a message are required' })
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      set({ error: 'Please enter a valid email address' })
      return
    }
    if (!isSupabaseConfigured) {
      set({ error: 'Chat is not configured. Please email us directly.' })
      return
    }
    let visitorId = get().visitorId
    if (!visitorId) {
      visitorId = uuid()
      writeLocal(VISITOR_ID_KEY, visitorId)
    }
    writeLocal(VISITOR_NAME_KEY, trimmedName)
    writeLocal(VISITOR_EMAIL_KEY, trimmedEmail)

    set({ loading: true, visitorId, visitorName: trimmedName, visitorEmail: trimmedEmail })

    try {
      const { data: threadData, error: threadErr } = await supabase
        .from('client_chat_threads')
        .insert({
          visitor_id: visitorId,
          visitor_name: trimmedName,
          visitor_email: trimmedEmail,
        })
        .select()
        .single()
      if (threadErr || !threadData) {
        set({ error: threadErr?.message ?? 'Failed to start chat', loading: false })
        return
      }
      const thread = threadFromRow(threadData as ThreadRow)

      // Insert the first visitor message
      const { data: msgData, error: msgErr } = await supabase
        .from('client_chat_messages')
        .insert({ thread_id: thread.id, author_kind: 'visitor', body: trimmedMsg })
        .select()
        .single()
      if (msgErr || !msgData) {
        set({ error: msgErr?.message ?? 'Failed to send message', loading: false })
        return
      }
      const firstMsg = messageFromRow(msgData as MessageRow)

      writeLocal(THREAD_ID_KEY, thread.id)
      set({
        threadId: thread.id,
        thread,
        messages: [firstMsg],
        loading: false,
      })
      subscribeToThread(thread.id)

      // Fire admin notification (don't block UI on the email)
      void notifyAdminsOfNewMessage(thread, trimmedMsg, true).catch((err) => {
        console.warn('[client_chat] notifyAdmins:', err)
      })
    } catch (err) {
      console.error('[client_chat] startThread:', err)
      set({ error: err instanceof Error ? err.message : 'Unknown error', loading: false })
    }
  },

  sendMessage: async (body) => {
    const trimmed = body.trim()
    if (!trimmed) return
    const threadId = get().threadId
    const thread = get().thread
    if (!threadId || !thread) return
    if (!isSupabaseConfigured) return

    // Optimistic
    const optimistic: ClientChatMessage = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      threadId,
      authorKind: 'visitor',
      body: trimmed,
      createdAt: new Date().toISOString(),
    }
    set((s) => ({ messages: [...s.messages, optimistic] }))

    try {
      const { data, error } = await supabase
        .from('client_chat_messages')
        .insert({ thread_id: threadId, author_kind: 'visitor', body: trimmed })
        .select()
        .single()
      if (error || !data) {
        console.error('[client_chat] sendMessage:', error?.message)
        return
      }
      const real = messageFromRow(data as MessageRow)
      set((s) => ({
        messages: s.messages.map((m) => m.id === optimistic.id ? real : m),
      }))

      // Bump last_message_at on the thread
      await supabase.from('client_chat_threads')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', threadId)

      // Maybe notify admins (with built-in debounce)
      void notifyAdminsOfNewMessage(thread, trimmed, false).catch((err) => {
        console.warn('[client_chat] notifyAdmins:', err)
      })
    } catch (err) {
      console.error('[client_chat] sendMessage:', err)
    }
  },

  markAdminMessagesRead: async () => {
    const threadId = get().threadId
    if (!threadId || !isSupabaseConfigured) return
    const unreadIds = get().messages
      .filter((m) => m.authorKind === 'admin' && !m.readAt)
      .map((m) => m.id)
    if (unreadIds.length === 0) return
    // Optimistic
    const now = new Date().toISOString()
    set((s) => ({ messages: s.messages.map((m) => unreadIds.includes(m.id) ? { ...m, readAt: now } : m) }))
    try {
      await supabase.from('client_chat_messages').update({ read_at: now }).in('id', unreadIds)
    } catch (err) {
      console.warn('[client_chat] markRead:', err)
    }
  },

  _onMessageInserted: (m) => {
    set((s) => {
      if (s.messages.some((x) => x.id === m.id)) return {}
      return { messages: [...s.messages, m] }
    })
    // If the panel is open and this is from an admin, mark it read immediately
    if (m.authorKind === 'admin' && get().open) {
      void get().markAdminMessagesRead()
    }
  },

  _onThreadUpdated: (t) => {
    set({ thread: t })
  },

  unreadAdminCount: () => {
    return get().messages.filter((m) => m.authorKind === 'admin' && !m.readAt).length
  },
}))
