// Scrollable list of MessageItems. Auto-scrolls to bottom on new messages
// when the user was already pinned to the bottom (so we don't yank them
// upward if they're scrolled back reading history).

import { useEffect, useMemo, useRef } from 'react'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { useAdminChatStore, type ChatMessage } from '@/stores/adminChatStore'
import MessageItem from './MessageItem'

const HEADER_REGROUP_WINDOW_MS = 60_000  // collapse author/time when sender + window match
const EMPTY_MESSAGES: ChatMessage[] = []  // stable ref so the selector never invalidates

interface Props {
  roomId: string
}

export default function MessageList({ roomId }: Props) {
  const messages = useAdminChatStore((s) => s.messagesByRoom.get(roomId) ?? EMPTY_MESSAGES)
  const currentUser = useAdminAuthStore((s) => s.currentUser)
  const allUsers = useAdminAuthStore((s) => s.users)

  const usersById = useMemo(() => {
    const map = new Map(allUsers.map((u) => [u.id, u]))
    return map
  }, [allUsers])

  const scrollRef = useRef<HTMLDivElement>(null)
  const wasAtBottom = useRef(true)

  // Track whether user is pinned to bottom *before* DOM updates
  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    wasAtBottom.current = distance < 60
  }

  // After messages change, snap to bottom if we were already there
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (wasAtBottom.current) el.scrollTop = el.scrollHeight
  }, [messages])

  // First mount → bottom
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [roomId])

  return (
    <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto py-2 space-y-0">
      {messages.length === 0 && (
        <div className="px-4 py-10 text-center text-text-muted text-xs">
          <p>No messages yet — say hi.</p>
        </div>
      )}

      {messages.map((msg, i) => {
        const prev = messages[i - 1]
        const sameAuthor = prev && prev.authorId === msg.authorId
        const closeInTime = prev && new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() < HEADER_REGROUP_WINDOW_MS
        const showHeader = !sameAuthor || !closeInTime
        const author = usersById.get(msg.authorId)
        return (
          <MessageItem
            key={msg.id}
            message={msg}
            author={author}
            isOwn={!!currentUser && msg.authorId === currentUser.id}
            showHeader={!!showHeader}
          />
        )
      })}
    </div>
  )
}
