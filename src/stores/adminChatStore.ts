// Admin chat store — channels + DMs, per-message read receipts, presence.
//
// Phase 1 (this commit) — schema + presence + room loader skeleton. Realtime
// subscriptions for messages/reads/typing come in Phase 2-5.
//
// Backed by `admin_chat_*` tables (see supabase/migrations/20260428_admin_chat.sql).
// Auth is gated by the React app via useAdminAuthStore (custom bcrypt session).

import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { ChatAttachment } from '@/lib/chatStorage'

// ───────────────────────── Types ─────────────────────────────

export type RoomKind = 'channel' | 'dm'

export interface ChatRoom {
  id: string
  kind: RoomKind
  name?: string                   // channels only
  topic?: string                  // channels only
  createdBy: string               // admin_user id
  createdAt: string
}

export interface ChatRoomMember {
  roomId: string
  userId: string
  joinedAt: string
}

export interface ChatMessage {
  id: string
  roomId: string
  authorId: string
  body: string
  mentions: string[]              // admin_user ids
  attachments: ChatAttachment[]
  replyToId?: string
  createdAt: string
}

export interface ChatReadReceipt {
  messageId: string
  userId: string
  readAt: string
}

export interface ChatRoomState {
  roomId: string
  userId: string
  lastReadMessageId?: string
  mutedUntil?: string
}

/** Live presence info for a single admin. */
export interface PresenceEntry {
  userId: string
  displayName: string
  online: boolean
  lastSeen?: string               // ISO timestamp; only set when online === false
}

// ───────────────────────── Row converters ─────────────────────────

interface RoomRow {
  id: string
  kind: string
  name: string | null
  topic: string | null
  created_by: string
  created_at: string
}
function roomFromRow(r: RoomRow): ChatRoom {
  return {
    id: r.id,
    kind: (r.kind === 'dm' ? 'dm' : 'channel') as RoomKind,
    name: r.name ?? undefined,
    topic: r.topic ?? undefined,
    createdBy: r.created_by,
    createdAt: r.created_at,
  }
}

interface MessageRow {
  id: string
  room_id: string
  author_id: string
  body: string
  mentions: string[] | null
  attachments: ChatAttachment[] | null
  reply_to_id: string | null
  created_at: string
}
function messageFromRow(r: MessageRow): ChatMessage {
  return {
    id: r.id,
    roomId: r.room_id,
    authorId: r.author_id,
    body: r.body,
    mentions: r.mentions ?? [],
    attachments: Array.isArray(r.attachments) ? r.attachments : [],
    replyToId: r.reply_to_id ?? undefined,
    createdAt: r.created_at,
  }
}

interface MemberRow {
  room_id: string
  user_id: string
  joined_at: string
}

interface ReadRow {
  message_id: string
  user_id: string
  read_at: string
}

interface RoomStateRow {
  room_id: string
  user_id: string
  last_read_message_id: string | null
  muted_until: string | null
}

// Module-level "we already complained about missing tables" flag — survives
// HMR re-evaluation in dev so we don't flood the console on every edit.
let _warnedMissingTables = false

// ───────────────────────── Store ─────────────────────────────

interface AdminChatState {
  // Server-backed state
  rooms: ChatRoom[]
  membersByRoom: Map<string, string[]>                    // roomId -> [userId, ...]
  messagesByRoom: Map<string, ChatMessage[]>
  readsByMessage: Map<string, ChatReadReceipt[]>
  lastReadByRoom: Map<string, string | undefined>         // my last_read_message_id per room
  mutedByRoom: Map<string, string>                        // roomId -> ISO timestamp of mute expiry

  // Local UI state
  activeRoomId: string | null
  bubbleOpen: boolean
  loading: boolean
  hasLoadedRooms: boolean
  /** True when we hit a missing-table error talking to Supabase. Surfaces a
   *  banner in the bubble + disables create/DM buttons so users get a clear
   *  hint instead of silent failures. */
  schemaMissing: boolean

  // Live presence (populated by useAdminPresence)
  presence: Map<string, PresenceEntry>

  // Live typing pings (populated by useTypingIndicator). The expiresAt is
  // a unix-ms timestamp; entries past expiry are pruned by the hook.
  typingByRoom: Map<string, { userId: string; expiresAt: number }[]>

  // ────── Actions ──────
  loadRooms: (currentUserId: string) => Promise<void>
  loadMessages: (roomId: string) => Promise<void>
  loadReads: (roomId: string) => Promise<void>
  sendMessage: (roomId: string, authorId: string, body: string, mentions?: string[], attachments?: ChatAttachment[]) => Promise<void>
  markRead: (messageId: string, userId: string) => Promise<void>
  updateLastRead: (roomId: string, userId: string, messageId: string) => Promise<void>
  setActiveRoom: (roomId: string | null) => void
  setBubbleOpen: (open: boolean) => void
  toggleBubble: () => void

  // Multi-room actions (Phase 4)
  createChannel: (name: string, topic: string, memberIds: string[], currentUserId: string) => Promise<string | null>
  openOrCreateDM: (otherUserId: string, currentUserId: string) => Promise<string | null>
  leaveRoom: (roomId: string, currentUserId: string) => Promise<void>

  // Mute (Phase 5)
  muteRoom: (roomId: string, userId: string, until: string | null) => Promise<void>

  // Internal — called by hooks
  _setPresence: (entries: PresenceEntry[]) => void
  _onMessageInserted: (m: ChatMessage) => void
  _onReadInserted: (r: ChatReadReceipt) => void
  _onTypingPing: (roomId: string, userId: string) => void

  // Computed selectors (functions; cheap to recompute)
  getUnreadCount: (roomId: string, currentUserId: string) => number
  getTotalUnread: (currentUserId: string) => number
  isRoomMuted: (roomId: string) => boolean
}

export const useAdminChatStore = create<AdminChatState>((set, get) => ({
  rooms: [],
  membersByRoom: new Map(),
  messagesByRoom: new Map(),
  readsByMessage: new Map(),
  lastReadByRoom: new Map(),
  mutedByRoom: new Map(),

  activeRoomId: null,
  bubbleOpen: false,
  loading: false,
  hasLoadedRooms: false,
  schemaMissing: false,

  presence: new Map(),
  typingByRoom: new Map(),

  // Load every room the current admin is a member of, plus their member lists.
  loadRooms: async (currentUserId) => {
    if (!isSupabaseConfigured) {
      set({ hasLoadedRooms: true })
      return
    }
    // Hard re-entry guard — even if a re-render races us, only one loader runs.
    if (get().loading || get().hasLoadedRooms) return
    set({ loading: true })
    try {
      // 1. Find rooms I'm a member of
      const { data: myMemberships, error: memErr } = await supabase
        .from('admin_chat_room_members')
        .select('room_id')
        .eq('user_id', currentUserId)

      if (memErr) {
        // Likely cause: chat migration hasn't been applied yet. Detect a
        // missing-table error from either Postgres (42P01) or PostgREST's
        // schema-cache message and downgrade to one info log.
        const code = (memErr as { code?: string }).code
        const msg = memErr.message ?? ''
        const tableMissing =
          code === '42P01' || code === 'PGRST205' ||
          /relation .* does not exist/i.test(msg) ||
          /Could not find the table/i.test(msg)
        if (tableMissing) {
          if (!_warnedMissingTables) {
            _warnedMissingTables = true
            console.info('[admin_chat] tables not found — apply supabase/migrations/20260428_admin_chat.sql')
          }
          set({ loading: false, hasLoadedRooms: true, schemaMissing: true })
        } else {
          console.error('[admin_chat] memberships:', msg)
          set({ loading: false, hasLoadedRooms: true })
        }
        return
      }

      const myRoomIds = (myMemberships ?? []).map((m) => m.room_id as string)
      if (myRoomIds.length === 0) {
        set({ rooms: [], membersByRoom: new Map(), loading: false, hasLoadedRooms: true })
        return
      }

      // 2. Pull rooms + their full member lists in parallel
      const [{ data: roomData, error: roomErr }, { data: memberData, error: memberErr }] = await Promise.all([
        supabase.from('admin_chat_rooms').select('*').in('id', myRoomIds),
        supabase.from('admin_chat_room_members').select('*').in('room_id', myRoomIds),
      ])

      if (roomErr || memberErr) {
        console.error('[admin_chat] rooms/members:', roomErr ?? memberErr)
        set({ loading: false, hasLoadedRooms: true })
        return
      }

      // 3. Pull my room_state (last_read pointer + mute) for those rooms
      const { data: stateData } = await supabase
        .from('admin_chat_room_state')
        .select('*')
        .eq('user_id', currentUserId)
        .in('room_id', myRoomIds)

      const rooms = ((roomData ?? []) as RoomRow[]).map(roomFromRow)
      const membersByRoom = new Map<string, string[]>()
      for (const row of (memberData ?? []) as MemberRow[]) {
        const list = membersByRoom.get(row.room_id) ?? []
        list.push(row.user_id)
        membersByRoom.set(row.room_id, list)
      }

      const lastReadByRoom = new Map<string, string | undefined>()
      const mutedByRoom = new Map<string, string>()
      for (const row of (stateData ?? []) as RoomStateRow[]) {
        if (row.last_read_message_id) lastReadByRoom.set(row.room_id, row.last_read_message_id)
        if (row.muted_until) mutedByRoom.set(row.room_id, row.muted_until)
      }

      set({ rooms, membersByRoom, lastReadByRoom, mutedByRoom, loading: false, hasLoadedRooms: true })
    } catch (err) {
      console.error('[admin_chat] loadRooms:', err)
      set({ loading: false, hasLoadedRooms: true })
    }
  },

  loadMessages: async (roomId) => {
    if (!isSupabaseConfigured) return
    try {
      const { data, error } = await supabase
        .from('admin_chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) {
        console.error('[admin_chat] loadMessages:', error)
        return
      }
      const msgs = ((data ?? []) as MessageRow[]).map(messageFromRow).reverse()
      set((state) => {
        const next = new Map(state.messagesByRoom)
        next.set(roomId, msgs)
        return { messagesByRoom: next }
      })
    } catch (err) {
      console.error('[admin_chat] loadMessages:', err)
    }
  },

  sendMessage: async (roomId, authorId, body, mentions = [], attachments = []) => {
    const trimmed = body.trim()
    // Allow attachment-only messages with empty body
    if (!trimmed && attachments.length === 0) return
    if (!isSupabaseConfigured) return

    // Optimistic insert with a temporary id so the composer feels instant.
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      roomId,
      authorId,
      body: trimmed,
      mentions,
      attachments,
      createdAt: new Date().toISOString(),
    }
    set((state) => {
      const next = new Map(state.messagesByRoom)
      next.set(roomId, [...(next.get(roomId) ?? []), optimistic])
      return { messagesByRoom: next }
    })

    try {
      const { data, error } = await supabase
        .from('admin_chat_messages')
        .insert({ room_id: roomId, author_id: authorId, body: trimmed, mentions, attachments })
        .select()
        .single()
      if (error || !data) {
        console.error('[admin_chat] sendMessage:', error)
        return
      }
      // Swap optimistic message for the real one
      const real = messageFromRow(data as MessageRow)
      set((state) => {
        const next = new Map(state.messagesByRoom)
        const list = (next.get(roomId) ?? []).map((m) => (m.id === optimistic.id ? real : m))
        next.set(roomId, list)
        return { messagesByRoom: next }
      })
    } catch (err) {
      console.error('[admin_chat] sendMessage:', err)
    }
  },

  setActiveRoom: (roomId) => set({ activeRoomId: roomId }),
  setBubbleOpen: (open) => set({ bubbleOpen: open }),
  toggleBubble: () => set((s) => ({ bubbleOpen: !s.bubbleOpen })),

  // ─── Read receipts (Phase 3) ───
  loadReads: async (roomId) => {
    if (!isSupabaseConfigured) return
    const messageIds = (get().messagesByRoom.get(roomId) ?? []).map((m) => m.id)
    if (messageIds.length === 0) return
    try {
      const { data, error } = await supabase
        .from('admin_chat_message_reads')
        .select('*')
        .in('message_id', messageIds)
      if (error) {
        console.error('[admin_chat] loadReads:', error)
        return
      }
      const next = new Map(get().readsByMessage)
      for (const row of (data ?? []) as ReadRow[]) {
        const list = next.get(row.message_id) ?? []
        if (!list.some((r) => r.userId === row.user_id)) {
          list.push({ messageId: row.message_id, userId: row.user_id, readAt: row.read_at })
        }
        next.set(row.message_id, list)
      }
      set({ readsByMessage: next })
    } catch (err) {
      console.error('[admin_chat] loadReads:', err)
    }
  },

  markRead: async (messageId, userId) => {
    if (!isSupabaseConfigured) return
    // Skip if we've already recorded this reader locally
    const existing = get().readsByMessage.get(messageId)
    if (existing?.some((r) => r.userId === userId)) return

    // Optimistic local update so the pill updates instantly
    const next = new Map(get().readsByMessage)
    next.set(messageId, [...(next.get(messageId) ?? []), {
      messageId, userId, readAt: new Date().toISOString(),
    }])
    set({ readsByMessage: next })

    try {
      const { error } = await supabase
        .from('admin_chat_message_reads')
        .upsert({ message_id: messageId, user_id: userId }, { onConflict: 'message_id,user_id' })
      if (error) console.error('[admin_chat] markRead:', error)
    } catch (err) {
      console.error('[admin_chat] markRead:', err)
    }
  },

  updateLastRead: async (roomId, userId, messageId) => {
    // Local update first for snappy badge clear
    const next = new Map(get().lastReadByRoom)
    next.set(roomId, messageId)
    set({ lastReadByRoom: next })

    if (!isSupabaseConfigured) return
    try {
      const { error } = await supabase
        .from('admin_chat_room_state')
        .upsert({ room_id: roomId, user_id: userId, last_read_message_id: messageId },
          { onConflict: 'room_id,user_id' })
      if (error) console.error('[admin_chat] updateLastRead:', error)
    } catch (err) {
      console.error('[admin_chat] updateLastRead:', err)
    }
  },

  // ─── Multi-room (Phase 4) ───
  createChannel: async (name, topic, memberIds, currentUserId) => {
    if (!isSupabaseConfigured) return null
    if (get().schemaMissing) return null
    try {
      const { data: room, error } = await supabase
        .from('admin_chat_rooms')
        .insert({
          kind: 'channel',
          name: name.trim().toLowerCase().replace(/^#/, ''),
          topic: topic.trim() || null,
          created_by: currentUserId,
        })
        .select()
        .single()
      if (error || !room) {
        const msg = error?.message ?? ''
        if (/Could not find the table/i.test(msg) || /relation .* does not exist/i.test(msg)) {
          set({ schemaMissing: true })
        }
        console.error('[admin_chat] createChannel:', msg || error)
        return null
      }

      // Make sure the creator is in the member list
      const allMembers = Array.from(new Set([currentUserId, ...memberIds]))
      const { error: memErr } = await supabase
        .from('admin_chat_room_members')
        .insert(allMembers.map((uid) => ({ room_id: room.id, user_id: uid })))
      if (memErr) console.error('[admin_chat] createChannel members:', memErr)

      // Local insert so the room appears immediately
      const newRoom = roomFromRow(room as RoomRow)
      set((state) => {
        const nextMembers = new Map(state.membersByRoom)
        nextMembers.set(newRoom.id, allMembers)
        return { rooms: [...state.rooms, newRoom], membersByRoom: nextMembers }
      })
      return newRoom.id
    } catch (err) {
      console.error('[admin_chat] createChannel:', err)
      return null
    }
  },

  openOrCreateDM: async (otherUserId, currentUserId) => {
    if (otherUserId === currentUserId) return null
    if (!isSupabaseConfigured) return null
    if (get().schemaMissing) return null

    // 1. Search for an existing DM with exactly these two members
    const dmRooms = get().rooms.filter((r) => r.kind === 'dm')
    for (const r of dmRooms) {
      const members = get().membersByRoom.get(r.id) ?? []
      if (members.length === 2 && members.includes(currentUserId) && members.includes(otherUserId)) {
        return r.id
      }
    }

    try {
      const { data: room, error } = await supabase
        .from('admin_chat_rooms')
        .insert({ kind: 'dm', created_by: currentUserId })
        .select()
        .single()
      if (error || !room) {
        const msg = error?.message ?? ''
        if (/Could not find the table/i.test(msg) || /relation .* does not exist/i.test(msg)) {
          set({ schemaMissing: true })
        }
        console.error('[admin_chat] openOrCreateDM:', msg || error)
        return null
      }
      const memberIds = [currentUserId, otherUserId]
      const { error: memErr } = await supabase
        .from('admin_chat_room_members')
        .insert(memberIds.map((uid) => ({ room_id: room.id, user_id: uid })))
      if (memErr) console.error('[admin_chat] openOrCreateDM members:', memErr)

      const newRoom = roomFromRow(room as RoomRow)
      set((state) => {
        const nextMembers = new Map(state.membersByRoom)
        nextMembers.set(newRoom.id, memberIds)
        return { rooms: [...state.rooms, newRoom], membersByRoom: nextMembers }
      })
      return newRoom.id
    } catch (err) {
      console.error('[admin_chat] openOrCreateDM:', err)
      return null
    }
  },

  leaveRoom: async (roomId, currentUserId) => {
    if (!isSupabaseConfigured) return
    try {
      const { error } = await supabase
        .from('admin_chat_room_members')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', currentUserId)
      if (error) {
        console.error('[admin_chat] leaveRoom:', error)
        return
      }
      set((state) => {
        const nextMembers = new Map(state.membersByRoom)
        const list = (nextMembers.get(roomId) ?? []).filter((id) => id !== currentUserId)
        nextMembers.set(roomId, list)
        return {
          rooms: state.rooms.filter((r) => r.id !== roomId),
          membersByRoom: nextMembers,
          activeRoomId: state.activeRoomId === roomId ? null : state.activeRoomId,
        }
      })
    } catch (err) {
      console.error('[admin_chat] leaveRoom:', err)
    }
  },

  // ─── Mute (Phase 5) ───
  muteRoom: async (roomId, userId, until) => {
    const next = new Map(get().mutedByRoom)
    if (until) next.set(roomId, until)
    else next.delete(roomId)
    set({ mutedByRoom: next })

    if (!isSupabaseConfigured) return
    try {
      const { error } = await supabase
        .from('admin_chat_room_state')
        .upsert({ room_id: roomId, user_id: userId, muted_until: until },
          { onConflict: 'room_id,user_id' })
      if (error) console.error('[admin_chat] muteRoom:', error)
    } catch (err) {
      console.error('[admin_chat] muteRoom:', err)
    }
  },

  // ─── Internal callbacks ───
  _setPresence: (entries) => {
    const map = new Map<string, PresenceEntry>()
    for (const e of entries) map.set(e.userId, e)
    set({ presence: map })
  },

  _onMessageInserted: (m) => {
    set((state) => {
      const next = new Map(state.messagesByRoom)
      const existing = next.get(m.roomId) ?? []
      // Skip duplicates (we may already have it from the optimistic path)
      if (existing.some((x) => x.id === m.id)) return {}
      next.set(m.roomId, [...existing, m])
      return { messagesByRoom: next }
    })
  },

  _onReadInserted: (r) => {
    set((state) => {
      const existing = state.readsByMessage.get(r.messageId) ?? []
      if (existing.some((x) => x.userId === r.userId)) return {}
      const next = new Map(state.readsByMessage)
      next.set(r.messageId, [...existing, r])
      return { readsByMessage: next }
    })
  },

  _onTypingPing: (roomId, userId) => {
    const expiresAt = Date.now() + 3000
    set((state) => {
      const list = (state.typingByRoom.get(roomId) ?? []).filter((t) => t.userId !== userId)
      list.push({ userId, expiresAt })
      const next = new Map(state.typingByRoom)
      next.set(roomId, list)
      return { typingByRoom: next }
    })
  },

  // ─── Selectors ───
  getUnreadCount: (roomId, _currentUserId) => {
    const messages = get().messagesByRoom.get(roomId) ?? []
    if (messages.length === 0) return 0
    const lastReadId = get().lastReadByRoom.get(roomId)
    if (!lastReadId) return messages.length
    const idx = messages.findIndex((m) => m.id === lastReadId)
    if (idx === -1) return messages.length
    return Math.max(0, messages.length - 1 - idx)
  },

  getTotalUnread: (currentUserId) => {
    let total = 0
    for (const r of get().rooms) {
      total += get().getUnreadCount(r.id, currentUserId)
    }
    return total
  },

  isRoomMuted: (roomId) => {
    const until = get().mutedByRoom.get(roomId)
    if (!until) return false
    return new Date(until).getTime() > Date.now()
  },
}))
