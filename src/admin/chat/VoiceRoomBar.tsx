// Slim "now in voice" bar that sits above the MessageComposer when an admin
// has joined the voice room. Shows participant chips with live audio
// levels (animated ring on whoever's speaking), mute toggle, leave button.

import { useMemo } from 'react'
import { Mic, MicOff, PhoneOff } from 'lucide-react'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { useAdminVoiceStore } from '@/stores/adminVoiceStore'

interface Props {
  roomId: string
  localMuted: boolean
  onToggleMute: () => void
  onLeave: () => void
  /** peer-id → 0..1 audio level */
  levels: Map<string, number>
}

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 2)
}

export default function VoiceRoomBar({ roomId, localMuted, onToggleMute, onLeave, levels }: Props) {
  const currentUser = useAdminAuthStore((s) => s.currentUser)
  const allUsers = useAdminAuthStore((s) => s.users)
  const participants = useAdminVoiceStore((s) => s.byRoom.get(roomId))

  const usersById = useMemo(() => new Map(allUsers.map((u) => [u.id, u])), [allUsers])

  if (!currentUser || !participants) return null

  const list = Array.from(participants.values()).sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))

  return (
    <div className="border-t border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          In voice · {list.length}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={localMuted ? 'Unmute mic' : 'Mute mic'}
            title={localMuted ? 'Unmute mic' : 'Mute mic'}
            className={`p-1.5 rounded transition-colors ${
              localMuted
                ? 'text-red-400 bg-red-500/10 hover:bg-red-500/20'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {localMuted ? <MicOff size={13} /> : <Mic size={13} />}
          </button>
          <button
            type="button"
            onClick={onLeave}
            aria-label="Leave voice"
            title="Leave voice"
            className="p-1.5 rounded text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
          >
            <PhoneOff size={13} />
          </button>
        </div>
      </div>

      {/* Participant chips */}
      <div className="flex flex-wrap gap-1.5">
        {list.map((p) => {
          const user = usersById.get(p.userId)
          const isMe = p.userId === currentUser.id
          // For me, "speaking" really means "mic active and unmuted" — we
          // don't analyse the local stream. For others, use the level meter.
          const level = isMe ? (localMuted ? 0 : 0.4) : (levels.get(p.userId) ?? 0)
          const speaking = level > 0.08
          const muted = isMe ? localMuted : p.muted
          return (
            <div
              key={p.userId}
              className={`flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full bg-bg-tertiary border ${
                speaking ? 'border-emerald-400 shadow-[0_0_0_2px_rgba(16,185,129,0.2)]' : 'border-border'
              } transition-all`}
            >
              <div className="relative">
                <div className="w-5 h-5 rounded-full bg-accent-amber/10 flex items-center justify-center text-accent-amber font-bold text-[8px]">
                  {user ? initials(user.displayName) : '?'}
                </div>
                {muted && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-1 ring-bg-tertiary flex items-center justify-center">
                    <MicOff size={6} className="text-white" />
                  </span>
                )}
              </div>
              <span className="text-[10px] text-text-secondary truncate max-w-[80px]">
                {user?.displayName ?? 'Unknown'}{isMe ? ' · you' : ''}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
