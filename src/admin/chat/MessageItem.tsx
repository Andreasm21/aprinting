// Single chat message row.
//
// Layout:
//   [avatar]  Author Name · 14:32
//             message body
//             (Read by · 3 — Phase 3)

import { useMemo } from 'react'
import type { ChatMessage } from '@/stores/adminChatStore'
import type { AdminUser } from '@/stores/adminAuthStore'
import ReadByPill from './ReadByPill'
import AttachmentChip from './AttachmentChip'
import ImageAttachment from './ImageAttachment'
import AudioAttachment from './AudioAttachment'

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

interface Props {
  message: ChatMessage
  author: AdminUser | undefined
  isOwn: boolean
  /** Set to false when the previous message was by the same author within
   *  60s — we collapse the avatar/header to keep the conversation tight. */
  showHeader: boolean
}

export default function MessageItem({ message, author, isOwn, showHeader }: Props) {
  const name = author?.displayName ?? 'Unknown'
  const isPending = message.id.startsWith('local-')

  const bodyParts = useMemo(() => {
    // Render @mentions as amber chips. Anything else is plain text.
    // Mentions are stored as user IDs in `message.mentions`, but the body
    // contains @username — so we just match the @<word> pattern.
    const re = /(@\w+)/g
    return message.body.split(re).map((part, i) => {
      if (re.test(part)) {
        return (
          <span key={i} className="px-1 py-0.5 rounded bg-accent-amber/20 text-accent-amber font-medium">
            {part}
          </span>
        )
      }
      return <span key={i}>{part}</span>
    })
  }, [message.body])

  return (
    <div
      data-message-id={isPending ? undefined : message.id}
      className={`flex gap-2.5 px-3 ${showHeader ? 'pt-2' : 'pt-0.5'}`}
    >
      {/* Avatar column (hidden when collapsed) */}
      <div className="w-8 flex-shrink-0">
        {showHeader && (
          <div className="w-8 h-8 rounded-full bg-accent-amber/10 flex items-center justify-center text-accent-amber font-bold text-[10px]">
            {initials(name)}
          </div>
        )}
      </div>

      {/* Body column */}
      <div className="min-w-0 flex-1">
        {showHeader && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className={`font-bold ${isOwn ? 'text-accent-amber' : 'text-text-primary'}`}>
              {name}
            </span>
            <span className="text-text-muted text-[10px]">{formatTime(message.createdAt)}</span>
          </div>
        )}
        {message.body && (
          <div
            className={`text-text-secondary text-xs leading-relaxed break-words whitespace-pre-wrap ${
              isPending ? 'opacity-60' : ''
            }`}
          >
            {bodyParts}
          </div>
        )}
        {message.attachments.length > 0 && (
          <div className={`flex flex-wrap gap-1.5 ${message.body ? 'mt-1.5' : ''} ${isPending ? 'opacity-60' : ''}`}>
            {message.attachments.map((att) => {
              if (att.kind === 'image') return <ImageAttachment key={att.url} attachment={att} />
              if (att.kind === 'audio') return <AudioAttachment key={att.url} attachment={att} />
              return <AttachmentChip key={att.url} attachment={att} />
            })}
          </div>
        )}
        {!isPending && (
          <ReadByPill messageId={message.id} roomId={message.roomId} authorId={message.authorId} />
        )}
      </div>
    </div>
  )
}
