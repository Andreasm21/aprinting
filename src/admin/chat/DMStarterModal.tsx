// Pick another admin → opens an existing 2-person DM or creates a new one.

import { useState } from 'react'
import { X, MessageSquare } from 'lucide-react'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { useAdminChatStore } from '@/stores/adminChatStore'
import PresenceDot from './PresenceDot'

interface Props {
  onClose: () => void
}

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 2)
}

export default function DMStarterModal({ onClose }: Props) {
  const currentUser = useAdminAuthStore((s) => s.currentUser)
  const allUsers = useAdminAuthStore((s) => s.users)
  const presence = useAdminChatStore((s) => s.presence)
  const openOrCreateDM = useAdminChatStore((s) => s.openOrCreateDM)
  const setActiveRoom = useAdminChatStore((s) => s.setActiveRoom)
  const [submittingId, setSubmittingId] = useState<string | null>(null)

  if (!currentUser) return null

  const otherUsers = allUsers.filter((u) => u.id !== currentUser.id)

  const [error, setError] = useState('')

  const start = async (otherId: string) => {
    setError('')
    setSubmittingId(otherId)
    const id = await openOrCreateDM(otherId, currentUser.id)
    setSubmittingId(null)
    if (id) {
      setActiveRoom(id)
      onClose()
    } else if (useAdminChatStore.getState().schemaMissing) {
      setError('Chat schema not installed. Run supabase/migrations/20260428_admin_chat.sql in the Supabase SQL Editor first, then refresh.')
    } else {
      setError('Failed to open DM — check the console.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm card-base p-5 font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-text-primary font-bold text-sm flex items-center gap-2">
            <MessageSquare size={14} className="text-accent-amber" /> Direct message
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-text-muted hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-text-muted text-xs mb-3">Pick an admin to chat with. Existing DMs are reopened.</p>

        {error && (
          <p className="text-red-400 text-[11px] mb-3 leading-relaxed">{error}</p>
        )}

        <div className="border border-border rounded-lg max-h-64 overflow-y-auto bg-bg-tertiary/30">
          {otherUsers.length === 0 && (
            <div className="px-3 py-6 text-[11px] text-text-muted text-center">
              No other admins yet — invite teammates from <span className="text-accent-amber">/admin/team</span>.
            </div>
          )}
          {otherUsers.map((u) => {
            const isOnline = presence.get(u.id)?.online ?? false
            const isSubmitting = submittingId === u.id
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => void start(u.id)}
                disabled={isSubmitting}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-bg-tertiary/60 disabled:opacity-50 text-left"
              >
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-accent-amber/10 flex items-center justify-center text-accent-amber font-bold text-[10px]">
                    {initials(u.displayName)}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 ring-2 ring-bg-secondary rounded-full">
                    <PresenceDot online={isOnline} size={9} />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-text-primary text-xs truncate">{u.displayName}</p>
                  <p className="text-text-muted text-[10px]">@{u.username}</p>
                </div>
                <span className="text-[10px] uppercase text-text-muted">
                  {isSubmitting ? 'Opening…' : 'Message →'}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex justify-end mt-4">
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text-primary text-xs px-3 py-1.5"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
