// "Read · 3" pill under each message. Hover/focus → tooltip with names.
//
// Self-author rendering: shows "Read by · 2 of N" instead of just "Read · 2"
// so the author can see how many of the other room members have caught up.

import { useState } from 'react'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { useAdminChatStore, type ChatReadReceipt } from '@/stores/adminChatStore'

const EMPTY_READS: ChatReadReceipt[] = []
const EMPTY_MEMBERS: string[] = []

interface Props {
  messageId: string
  roomId: string
  authorId: string
}

export default function ReadByPill({ messageId, roomId, authorId }: Props) {
  const currentUser = useAdminAuthStore((s) => s.currentUser)
  const allUsers = useAdminAuthStore((s) => s.users)
  const reads = useAdminChatStore((s) => s.readsByMessage.get(messageId) ?? EMPTY_READS)
  const members = useAdminChatStore((s) => s.membersByRoom.get(roomId) ?? EMPTY_MEMBERS)
  const [showNames, setShowNames] = useState(false)

  if (!currentUser) return null

  const isOwn = authorId === currentUser.id

  // Exclude the author from the "read by" count — authors don't read their own messages
  const readers = reads.filter((r) => r.userId !== authorId)
  const readerCount = readers.length

  // Total possible readers = members minus the author
  const possibleReaders = Math.max(0, members.filter((id) => id !== authorId).length)

  if (readerCount === 0 && !isOwn) return null

  // For other-author messages: only show pill if at least 1 other person has read it
  // and it doesn't include just me
  if (!isOwn && readers.every((r) => r.userId === currentUser.id)) return null

  const readerNames = readers
    .map((r) => allUsers.find((u) => u.id === r.userId)?.displayName ?? 'Unknown')
    .filter(Boolean)

  const label = isOwn
    ? `Read by · ${readerCount}${possibleReaders > 0 ? ` of ${possibleReaders}` : ''}`
    : `Read · ${readerCount}`

  return (
    <div className="relative inline-block mt-0.5">
      <button
        type="button"
        onMouseEnter={() => setShowNames(true)}
        onMouseLeave={() => setShowNames(false)}
        onFocus={() => setShowNames(true)}
        onBlur={() => setShowNames(false)}
        className="text-[9px] text-text-muted hover:text-text-secondary uppercase tracking-wider"
      >
        {label}
      </button>
      {showNames && readerNames.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 px-2 py-1 bg-bg-primary border border-border rounded whitespace-nowrap z-10 shadow-lg text-[10px] text-text-secondary">
          {readerNames.slice(0, 6).join(', ')}
          {readerNames.length > 6 && ` +${readerNames.length - 6}`}
        </div>
      )}
    </div>
  )
}
