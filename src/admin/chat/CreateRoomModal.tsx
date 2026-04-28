// Modal for spinning up a new channel: name + topic + member checklist.
//
// The current admin is auto-included; the rest of the admin list is shown as
// togglable checkboxes. Channel names are normalised (lowercased, # stripped).

import { useState } from 'react'
import { X, Hash } from 'lucide-react'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { useAdminChatStore } from '@/stores/adminChatStore'

interface Props {
  onClose: () => void
}

export default function CreateRoomModal({ onClose }: Props) {
  const currentUser = useAdminAuthStore((s) => s.currentUser)
  const allUsers = useAdminAuthStore((s) => s.users)
  const createChannel = useAdminChatStore((s) => s.createChannel)
  const setActiveRoom = useAdminChatStore((s) => s.setActiveRoom)

  const [name, setName] = useState('')
  const [topic, setTopic] = useState('')
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!currentUser) return null

  const otherUsers = allUsers.filter((u) => u.id !== currentUser.id)

  const toggle = (id: string) => {
    setMemberIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const submit = async () => {
    setError('')
    const cleaned = name.trim().toLowerCase().replace(/^#/, '')
    if (!/^[a-z0-9-_]{2,30}$/.test(cleaned)) {
      setError('Name must be 2-30 chars, lowercase letters/numbers/-/_ only')
      return
    }
    setSubmitting(true)
    const id = await createChannel(cleaned, topic, Array.from(memberIds), currentUser.id)
    setSubmitting(false)
    if (id) {
      setActiveRoom(id)
      onClose()
    } else if (useAdminChatStore.getState().schemaMissing) {
      setError('Chat schema not installed. Run supabase/migrations/20260428_admin_chat.sql in the Supabase SQL Editor first, then refresh.')
    } else {
      setError('Failed to create channel — check the console for details.')
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
            <Hash size={14} className="text-accent-amber" /> New channel
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

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] uppercase text-text-muted tracking-wider mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError('') }}
              placeholder="e.g. urgent"
              autoFocus
              className="input-field text-xs"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase text-text-muted tracking-wider mb-1">Topic (optional)</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What's this channel about?"
              className="input-field text-xs"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase text-text-muted tracking-wider mb-1">
              Members ({memberIds.size + 1})
            </label>
            <div className="border border-border rounded-lg max-h-48 overflow-y-auto bg-bg-tertiary/30">
              <div className="px-3 py-2 text-xs text-text-muted border-b border-border bg-bg-tertiary/40">
                {currentUser.displayName} <span className="text-[9px] uppercase ml-1">you · creator</span>
              </div>
              {otherUsers.length === 0 && (
                <div className="px-3 py-3 text-[11px] text-text-muted">No other admins yet.</div>
              )}
              {otherUsers.map((u) => (
                <label key={u.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-bg-tertiary/60 text-xs">
                  <input
                    type="checkbox"
                    checked={memberIds.has(u.id)}
                    onChange={() => toggle(u.id)}
                    className="accent-amber-500"
                  />
                  <span className="text-text-primary">{u.displayName}</span>
                  <span className="text-text-muted text-[10px]">@{u.username}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-red-400 text-[11px]">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-text-muted hover:text-text-primary text-xs px-3 py-1.5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting || !name.trim()}
              className="bg-accent-amber text-bg-primary font-bold text-xs px-4 py-1.5 rounded disabled:opacity-50 hover:bg-accent-amber/90"
            >
              {submitting ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
