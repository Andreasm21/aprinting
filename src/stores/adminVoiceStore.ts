// Track who is currently in voice for each chat room.
//
// Backed by `admin_voice_room_state` table + a global realtime subscription.
// useVoiceRoom drives the actual WebRTC mesh; this store just keeps the
// "who's in the call" list in sync so the UI can show participant chips +
// a "Voice active" badge per room.

import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export interface VoiceParticipant {
  roomId: string
  userId: string
  joinedAt: string
  muted: boolean
}

interface RowShape {
  room_id: string
  user_id: string
  joined_at: string
  muted: boolean
}

let _realtimeStarted = false
let _warned = false

interface State {
  // roomId -> Map<userId, participant>
  byRoom: Map<string, Map<string, VoiceParticipant>>
  hasLoaded: boolean
  schemaMissing: boolean

  load: () => Promise<void>
  join: (roomId: string, userId: string) => Promise<void>
  leave: (roomId: string, userId: string) => Promise<void>
  setMuted: (roomId: string, userId: string, muted: boolean) => Promise<void>

  participantsIn: (roomId: string) => VoiceParticipant[]
  countIn: (roomId: string) => number
  iAmIn: (roomId: string, userId: string) => boolean

  _onUpsert: (p: VoiceParticipant) => void
  _onDelete: (roomId: string, userId: string) => void
}

export const useAdminVoiceStore = create<State>((set, get) => ({
  byRoom: new Map(),
  hasLoaded: false,
  schemaMissing: false,

  load: async () => {
    if (!isSupabaseConfigured) { set({ hasLoaded: true }); return }
    if (get().hasLoaded) return
    try {
      const { data, error } = await supabase.from('admin_voice_room_state').select('*')
      if (error) {
        const code = (error as { code?: string }).code
        const tableMissing = code === '42P01' || code === 'PGRST205' ||
          /Could not find the table/i.test(error.message ?? '') ||
          /relation .* does not exist/i.test(error.message ?? '')
        if (tableMissing) {
          if (!_warned) {
            _warned = true
            console.info('[admin_voice] table not found — apply supabase/migrations/20260428_chat_extras.sql')
          }
          set({ hasLoaded: true, schemaMissing: true })
          return
        }
        console.error('[admin_voice] load:', error.message)
        set({ hasLoaded: true })
        return
      }
      const byRoom = new Map<string, Map<string, VoiceParticipant>>()
      for (const r of (data ?? []) as RowShape[]) {
        const p: VoiceParticipant = {
          roomId: r.room_id, userId: r.user_id, joinedAt: r.joined_at, muted: r.muted,
        }
        const inner = byRoom.get(p.roomId) ?? new Map<string, VoiceParticipant>()
        inner.set(p.userId, p)
        byRoom.set(p.roomId, inner)
      }
      set({ byRoom, hasLoaded: true })
      if (!_realtimeStarted) {
        _realtimeStarted = true
        startRealtime()
      }
    } catch (err) {
      console.error('[admin_voice] load:', err)
      set({ hasLoaded: true })
    }
  },

  join: async (roomId, userId) => {
    if (!isSupabaseConfigured || get().schemaMissing) return
    // Optimistic
    get()._onUpsert({ roomId, userId, joinedAt: new Date().toISOString(), muted: false })
    try {
      const { error } = await supabase
        .from('admin_voice_room_state')
        .upsert({ room_id: roomId, user_id: userId, muted: false, joined_at: new Date().toISOString() },
          { onConflict: 'room_id,user_id' })
      if (error) console.error('[admin_voice] join:', error.message)
    } catch (err) {
      console.error('[admin_voice] join:', err)
    }
  },

  leave: async (roomId, userId) => {
    // Optimistic local removal
    get()._onDelete(roomId, userId)
    if (!isSupabaseConfigured) return
    try {
      const { error } = await supabase.from('admin_voice_room_state')
        .delete().eq('room_id', roomId).eq('user_id', userId)
      if (error) console.error('[admin_voice] leave:', error.message)
    } catch (err) {
      console.error('[admin_voice] leave:', err)
    }
  },

  setMuted: async (roomId, userId, muted) => {
    const inner = get().byRoom.get(roomId)
    const existing = inner?.get(userId)
    if (existing) get()._onUpsert({ ...existing, muted })
    if (!isSupabaseConfigured) return
    try {
      const { error } = await supabase.from('admin_voice_room_state')
        .update({ muted }).eq('room_id', roomId).eq('user_id', userId)
      if (error) console.error('[admin_voice] setMuted:', error.message)
    } catch (err) {
      console.error('[admin_voice] setMuted:', err)
    }
  },

  participantsIn: (roomId) => {
    const inner = get().byRoom.get(roomId)
    if (!inner) return []
    return Array.from(inner.values()).sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
  },
  countIn: (roomId) => get().byRoom.get(roomId)?.size ?? 0,
  iAmIn: (roomId, userId) => Boolean(get().byRoom.get(roomId)?.has(userId)),

  _onUpsert: (p) => {
    set((state) => {
      const next = new Map(state.byRoom)
      const inner = new Map(next.get(p.roomId) ?? new Map())
      inner.set(p.userId, p)
      next.set(p.roomId, inner)
      return { byRoom: next }
    })
  },
  _onDelete: (roomId, userId) => {
    set((state) => {
      const inner = state.byRoom.get(roomId)
      if (!inner) return {}
      if (!inner.has(userId)) return {}
      const next = new Map(state.byRoom)
      const innerNext = new Map(inner)
      innerNext.delete(userId)
      if (innerNext.size === 0) next.delete(roomId)
      else next.set(roomId, innerNext)
      return { byRoom: next }
    })
  },
}))

function startRealtime() {
  if (!isSupabaseConfigured) return
  const channel = supabase.channel('admin-voice:state')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_voice_room_state' }, (payload) => {
      const r = payload.new as RowShape
      useAdminVoiceStore.getState()._onUpsert({
        roomId: r.room_id, userId: r.user_id, joinedAt: r.joined_at, muted: r.muted,
      })
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'admin_voice_room_state' }, (payload) => {
      const r = payload.new as RowShape
      useAdminVoiceStore.getState()._onUpsert({
        roomId: r.room_id, userId: r.user_id, joinedAt: r.joined_at, muted: r.muted,
      })
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'admin_voice_room_state' }, (payload) => {
      const r = payload.old as { room_id?: string; user_id?: string }
      if (r.room_id && r.user_id) {
        useAdminVoiceStore.getState()._onDelete(r.room_id, r.user_id)
      }
    })
    .subscribe()
  void channel
}
