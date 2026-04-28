// Browser notifications for incoming chat messages.
//
// Permission policy:
//   • Ask once when the bubble first opens.
//   • Store the result in localStorage so we never re-prompt.
//   • Silently no-op if denied.
//
// Dispatch policy:
//   • Only fire when:
//       - the bubble is closed   (open = focused = no notification needed)
//       OR the message is in a non-active room
//     AND the message is not by the current user
//     AND the room is not muted
//     AND (the user is mentioned   OR   it's a 1-on-1 DM)
//
// Click → focuses the window, opens the bubble, switches to that room.

import { useEffect, useRef } from 'react'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { useAdminChatStore } from '@/stores/adminChatStore'
import type { ChatMessage } from '@/stores/adminChatStore'

const PERMISSION_STORAGE_KEY = 'axiom-chat-notif-asked'

function ensurePermission() {
  if (typeof Notification === 'undefined') return
  if (Notification.permission !== 'default') return
  if (typeof localStorage !== 'undefined' && localStorage.getItem(PERMISSION_STORAGE_KEY)) return
  try {
    void Notification.requestPermission().finally(() => {
      try { localStorage.setItem(PERMISSION_STORAGE_KEY, '1') } catch { /* ignore */ }
    })
  } catch {
    /* ignore */
  }
}

export function useBrowserNotifications() {
  const currentUser = useAdminAuthStore((s) => s.currentUser)
  const allUsers = useAdminAuthStore((s) => s.users)
  // Subscribe via getState() inside an effect — we don't want re-renders on every
  // store change, just on the messages-by-room map identity.
  const seenIdsRef = useRef<Set<string>>(new Set())

  // Ask permission once on first bubble-open
  const bubbleOpen = useAdminChatStore((s) => s.bubbleOpen)
  const askedRef = useRef(false)
  useEffect(() => {
    if (bubbleOpen && !askedRef.current) {
      askedRef.current = true
      ensurePermission()
    }
  }, [bubbleOpen])

  // Subscribe to message inserts via the store's subscription primitive
  useEffect(() => {
    if (!currentUser) return

    return useAdminChatStore.subscribe((state, prev) => {
      if (state.messagesByRoom === prev.messagesByRoom) return

      // Find any new messages we haven't seen yet
      for (const [roomId, msgs] of state.messagesByRoom) {
        for (const m of msgs) {
          if (seenIdsRef.current.has(m.id)) continue
          seenIdsRef.current.add(m.id)
          handleNewMessage(m, roomId, currentUser.id, allUsers)
        }
      }
    })
  }, [currentUser, allUsers])
}

function handleNewMessage(
  msg: ChatMessage,
  roomId: string,
  currentUserId: string,
  allUsers: { id: string; displayName: string }[],
) {
  if (typeof Notification === 'undefined') return
  if (Notification.permission !== 'granted') return

  // Don't notify on our own messages
  if (msg.authorId === currentUserId) return

  // Don't notify on optimistic messages (no real id yet)
  if (msg.id.startsWith('local-')) return

  const state = useAdminChatStore.getState()
  const room = state.rooms.find((r) => r.id === roomId)
  if (!room) return  // not a room we're a member of

  // Mute respect
  if (state.isRoomMuted(roomId)) return

  // Don't notify when bubble is open AND this is the active room (user is here)
  if (state.bubbleOpen && state.activeRoomId === roomId) return

  // Notify policy: only mentions or DMs
  const mentioned = msg.mentions.includes(currentUserId)
  const isDM = room.kind === 'dm'
  if (!mentioned && !isDM) return

  const author = allUsers.find((u) => u.id === msg.authorId)
  const authorName = author?.displayName ?? 'Someone'
  const roomLabel = room.kind === 'channel' ? `#${room.name}` : 'DM'

  try {
    const notif = new Notification(`${authorName} in ${roomLabel}`, {
      body: msg.body.slice(0, 200),
      tag: `chat-${roomId}`,        // collapse multiple notifs from same room
      icon: '/brand/axiom-logo-favicon.png',
    })
    notif.onclick = () => {
      try { window.focus() } catch { /* ignore */ }
      const s = useAdminChatStore.getState()
      s.setActiveRoom(roomId)
      s.setBubbleOpen(true)
      notif.close()
    }
  } catch {
    /* ignore */
  }
}
