// "Sarah is typing…" / "Sarah and Mike are typing…" — sits between the
// MessageList and the composer. Hidden when nobody is typing.
//
// Animated three-dot pulse keeps it lively without being noisy.

import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { useAdminChatStore } from '@/stores/adminChatStore'

const EMPTY_TYPING: { userId: string; expiresAt: number }[] = []

interface Props {
  roomId: string
}

export default function TypingIndicator({ roomId }: Props) {
  const allUsers = useAdminAuthStore((s) => s.users)
  const typing = useAdminChatStore((s) => s.typingByRoom.get(roomId) ?? EMPTY_TYPING)

  if (typing.length === 0) return null

  const names = typing
    .map((t) => allUsers.find((u) => u.id === t.userId)?.displayName)
    .filter((n): n is string => Boolean(n))

  if (names.length === 0) return null

  let label: string
  if (names.length === 1) label = `${names[0]} is typing`
  else if (names.length === 2) label = `${names[0]} and ${names[1]} are typing`
  else label = `${names[0]}, ${names[1]} and ${names.length - 2} more are typing`

  return (
    <div className="px-4 py-1 text-[10px] text-text-muted italic flex items-center gap-1.5">
      <span className="flex gap-0.5">
        <span className="w-1 h-1 rounded-full bg-text-muted animate-pulse" style={{ animationDelay: '0ms' }} />
        <span className="w-1 h-1 rounded-full bg-text-muted animate-pulse" style={{ animationDelay: '150ms' }} />
        <span className="w-1 h-1 rounded-full bg-text-muted animate-pulse" style={{ animationDelay: '300ms' }} />
      </span>
      {label}
    </div>
  )
}
