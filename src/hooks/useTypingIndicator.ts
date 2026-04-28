// Typing indicator — bidirectional broadcast on a per-room channel.
//
// Subscribes to `admin-chat:typing:{roomId}` and:
//   • Pushes incoming pings into adminChatStore.typingByRoom (3s TTL,
//     pruned by a 1s interval).
//   • Returns a `notifyTyping()` callback that broadcasts our own ping,
//     throttled to once every 1.5s so heavy typing doesn't flood.
//
// One channel per active room — auto-resubscribes when room changes.

import { useCallback, useEffect, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { useAdminChatStore } from '@/stores/adminChatStore'

const THROTTLE_MS = 1500

interface TypingPayload {
  user_id: string
}

export function useTypingIndicator(roomId: string | null) {
  const currentUser = useAdminAuthStore((s) => s.currentUser)
  const onTypingPing = useAdminChatStore((s) => s._onTypingPing)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const lastSentRef = useRef<number>(0)

  useEffect(() => {
    if (!roomId || !currentUser || !isSupabaseConfigured) return

    const channel = supabase.channel(`admin-chat:typing:${roomId}`, {
      config: { broadcast: { self: false } },
    })
      .on('broadcast', { event: 'typing' }, (payload) => {
        const data = payload.payload as TypingPayload
        if (data?.user_id && data.user_id !== currentUser.id) {
          onTypingPing(roomId, data.user_id)
        }
      })
      .subscribe()

    channelRef.current = channel

    // Prune expired entries every second
    const prune = setInterval(() => {
      const now = Date.now()
      const state = useAdminChatStore.getState()
      const list = state.typingByRoom.get(roomId) ?? []
      const filtered = list.filter((t) => t.expiresAt > now)
      if (filtered.length !== list.length) {
        const next = new Map(state.typingByRoom)
        next.set(roomId, filtered)
        useAdminChatStore.setState({ typingByRoom: next })
      }
    }, 1000)

    return () => {
      clearInterval(prune)
      void supabase.removeChannel(channel).catch(() => {})
      channelRef.current = null
    }
  }, [roomId, currentUser, onTypingPing])

  /** Called by the composer on each keystroke; throttled. */
  const notifyTyping = useCallback(() => {
    if (!roomId || !currentUser || !isSupabaseConfigured) return
    const ch = channelRef.current
    if (!ch) return
    const now = Date.now()
    if (now - lastSentRef.current < THROTTLE_MS) return
    lastSentRef.current = now
    void ch.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: currentUser.id } satisfies TypingPayload,
    })
  }, [roomId, currentUser])

  return { notifyTyping }
}
