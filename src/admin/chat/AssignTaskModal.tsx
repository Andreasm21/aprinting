// "Assign task to X" modal — opened from the chat People view's right-click
// menu. Pre-fills the assignee; collects title, description, priority, due date.

import { useState } from 'react'
import { X, Flag, Calendar, ListChecks } from 'lucide-react'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { useAdminTasksStore, type TaskPriority } from '@/stores/adminTasksStore'

interface Props {
  assigneeId: string
  sourceRoomId?: string
  sourceMessageId?: string
  onClose: () => void
}

const PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'text-text-muted' },
  { value: 'normal', label: 'Normal', color: 'text-text-secondary' },
  { value: 'high', label: 'High', color: 'text-amber-400' },
  { value: 'urgent', label: 'Urgent', color: 'text-red-400' },
]

export default function AssignTaskModal({ assigneeId, sourceRoomId, sourceMessageId, onClose }: Props) {
  const currentUser = useAdminAuthStore((s) => s.currentUser)
  const allUsers = useAdminAuthStore((s) => s.users)
  const create = useAdminTasksStore((s) => s.create)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [dueAt, setDueAt] = useState('')           // datetime-local value
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!currentUser) return null

  const assignee = allUsers.find((u) => u.id === assigneeId)
  const isSelf = assigneeId === currentUser.id

  const submit = async () => {
    setError('')
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    setSubmitting(true)
    const task = await create({
      title,
      description,
      assignedTo: assigneeId,
      assignedBy: currentUser.id,
      priority,
      dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      sourceRoomId,
      sourceMessageId,
    })
    setSubmitting(false)
    if (task) {
      onClose()
    } else if (useAdminTasksStore.getState().schemaMissing) {
      setError('Tasks schema not installed — run supabase/migrations/20260428_chat_extras.sql')
    } else {
      setError('Failed to create task — see console')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="w-full max-w-md card-base p-5 font-mono" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-text-primary font-bold text-sm flex items-center gap-2">
            <ListChecks size={14} className="text-accent-amber" />
            Assign task to <span className="text-accent-amber">{isSelf ? 'yourself' : assignee?.displayName ?? 'admin'}</span>
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-text-muted hover:text-text-primary">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] uppercase text-text-muted tracking-wider mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError('') }}
              placeholder="What needs doing?"
              autoFocus
              maxLength={200}
              className="input-field text-xs"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase text-text-muted tracking-wider mb-1">Details (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any notes, context, links…"
              rows={3}
              className="input-field text-xs resize-y"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase text-text-muted tracking-wider mb-1 flex items-center gap-1">
                <Flag size={10} /> Priority
              </label>
              <div className="grid grid-cols-2 gap-1">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value)}
                    className={`px-2 py-1.5 rounded text-[10px] uppercase tracking-wider border transition-colors ${
                      priority === p.value
                        ? 'bg-accent-amber/10 border-accent-amber text-accent-amber'
                        : `border-border ${p.color} hover:border-accent-amber/50`
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase text-text-muted tracking-wider mb-1 flex items-center gap-1">
                <Calendar size={10} /> Due (optional)
              </label>
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="input-field text-xs"
              />
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
              disabled={submitting || !title.trim()}
              className="bg-accent-amber text-bg-primary font-bold text-xs px-4 py-1.5 rounded disabled:opacity-50 hover:bg-accent-amber/90"
            >
              {submitting ? 'Creating…' : 'Assign task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
