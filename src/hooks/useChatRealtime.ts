// Per-room realtime subscription. Streams new messages from
// `admin_chat_messages` straight into the store as they're inserted server-side.
//
// One channel per active room. Auto-resubscribes when the active room
// changes; auto-cleans on unmount.
//
// Phase 3 adds a parallel `admin-chat:badge` global channel that listens to
// every room the admin is in (for unread counts even when the panel's
// closed) and a `admin-chat:reads:{roomId}` channel for live read receipts.

import { useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAdminChatStore } from '@/stores/adminChatStore'

interface RawMessageRow {
  id: string
  room_id: string
  author_id: string
  body: string
  mentions: string[] | null
  attachments: unknown            // JSONB — caller validates
  reply_to_id: string | null
  created_at: string
}

interface RawReadRow {
  message_id: string
  user_id: string
  read_at: string
}

/** Subscribe to live message inserts for one room. */
export function useRoomRealtime(roomId: string | null) {
  const onMessageInserted = useAdminChatStore((s) => s._onMessageInserted)
  const onReadInserted = useAdminChatStore((s) => s._onReadInserted)

  useEffect(() => {
    if (!roomId || !isSupabaseConfigured) return

    const channel = supabase.channel(`admin-chat:room:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_chat_messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const r = payload.new as RawMessageRow
          onMessageInserted({
            id: r.id,
            roomId: r.room_id,
            authorId: r.author_id,
            body: r.body,
            mentions: r.mentions ?? [],
            attachments: Array.isArray(r.attachments) ? r.attachments as never : [],
            replyToId: r.reply_to_id ?? undefined,
            createdAt: r.created_at,
          })
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_chat_message_reads' },
        (payload) => {
          const r = payload.new as RawReadRow
          onReadInserted({
            messageId: r.message_id,
            userId: r.user_id,
            readAt: r.read_at,
          })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel).catch(() => {})
    }
  }, [roomId, onMessageInserted, onReadInserted])
}

/** Global subscription used for the unread-count badge — fires for every
 *  message INSERT regardless of room. The store handles filtering / unread
 *  bookkeeping. Phase 3 wires the badge math; the channel is set up here
 *  because the bubble owns this hook for its whole lifetime. */
export function useGlobalChatRealtime() {
  const onMessageInserted = useAdminChatStore((s) => s._onMessageInserted)

  useEffect(() => {
    if (!isSupabaseConfigured) return

    const channel = supabase.channel('admin-chat:badge')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_chat_messages' },
        (payload) => {
          const r = payload.new as RawMessageRow
          onMessageInserted({
            id: r.id,
            roomId: r.room_id,
            authorId: r.author_id,
            body: r.body,
            mentions: r.mentions ?? [],
            attachments: Array.isArray(r.attachments) ? r.attachments as never : [],
            replyToId: r.reply_to_id ?? undefined,
            createdAt: r.created_at,
          })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel).catch(() => {})
    }
  }, [onMessageInserted])
}
