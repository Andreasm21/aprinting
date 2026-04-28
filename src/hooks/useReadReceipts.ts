// Mark messages as read when they scroll into view inside the chat panel.
//
// Strict gating — we only mark a message read when ALL of:
//   • the panel is open (`active === true`)
//   • the room is active (handled by the caller passing `roomId`)
//   • the document is visible (no read-receipt ghosts when the tab is hidden)
//   • the message has fully entered the viewport (IntersectionObserver)
//
// Each visible message → upsert into admin_chat_message_reads + bump
// admin_chat_room_state.last_read_message_id to the newest read message.

import { useEffect, useRef } from 'react'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { useAdminChatStore, type ChatMessage } from '@/stores/adminChatStore'

const EMPTY_MESSAGES: ChatMessage[] = []

export function useReadReceipts(roomId: string | null, active: boolean) {
  const currentUser = useAdminAuthStore((s) => s.currentUser)
  const messages = useAdminChatStore((s) => (roomId ? s.messagesByRoom.get(roomId) ?? EMPTY_MESSAGES : EMPTY_MESSAGES))
  const markRead = useAdminChatStore((s) => s.markRead)
  const updateLastRead = useAdminChatStore((s) => s.updateLastRead)

  // Track which message IDs we've already marked this session to avoid spam
  const markedRef = useRef<Set<string>>(new Set())
  // Reset the marked-set when the room changes
  useEffect(() => { markedRef.current = new Set() }, [roomId])

  useEffect(() => {
    if (!roomId || !currentUser || !active) return
    if (typeof IntersectionObserver === 'undefined') return

    let lastReadIdInBatch: string | null = null

    const observer = new IntersectionObserver((entries) => {
      // Bail if the tab isn't visible
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return

      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const id = (entry.target as HTMLElement).dataset.messageId
        if (!id) continue
        if (markedRef.current.has(id)) continue

        const msg = messages.find((m) => m.id === id)
        if (!msg) continue
        if (msg.authorId === currentUser.id) {
          // We don't mark our own messages as read (just record the pointer)
          markedRef.current.add(id)
          lastReadIdInBatch = id
          continue
        }

        markedRef.current.add(id)
        void markRead(id, currentUser.id)
        lastReadIdInBatch = id
      }

      // Update the per-room "last read" pointer to the latest fully-seen msg
      if (lastReadIdInBatch) {
        void updateLastRead(roomId, currentUser.id, lastReadIdInBatch)
      }
    }, { threshold: 0.7 })

    // Observe every rendered message via its data-message-id attribute
    const els = document.querySelectorAll<HTMLElement>('[data-message-id]')
    els.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [roomId, currentUser, active, messages, markRead, updateLastRead])
}
