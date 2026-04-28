// /admin/tasks — kanban-style task board for the studio team.
//
//   Columns: Open | In progress | Done
//   Filter: My tasks | All tasks
//
// Cards show: title, assignee avatar, priority chip, due date, source link
// (if spawned from a chat message). Click a card → small inline editor for
// status / re-assign / re-prioritise.

import { useEffect, useMemo, useState } from 'react'
import { ListChecks, Filter, Flag, User, Trash2, Clock } from 'lucide-react'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { useAdminTasksStore, type AdminTask, type TaskStatus, type TaskPriority } from '@/stores/adminTasksStore'

const COLUMNS: { status: TaskStatus; title: string; tone: string }[] = [
  { status: 'open',         title: 'Open',         tone: 'border-text-muted/40' },
  { status: 'in_progress',  title: 'In progress',  tone: 'border-amber-500/40' },
  { status: 'done',         title: 'Done',         tone: 'border-emerald-500/40' },
]

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'text-text-muted bg-text-muted/10',
  normal: 'text-text-secondary bg-text-secondary/10',
  high: 'text-amber-400 bg-amber-500/10',
  urgent: 'text-red-400 bg-red-500/10',
}

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 2)
}

function formatDue(iso: string | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  const diffMs = date.getTime() - now.getTime()
  const overdue = diffMs < 0
  if (sameDay) return overdue ? `Overdue · ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : `Today · ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: date.getFullYear() === now.getFullYear() ? undefined : '2-digit' })
}

export default function AdminTasks() {
  const currentUser = useAdminAuthStore((s) => s.currentUser)
  const allUsers = useAdminAuthStore((s) => s.users)
  const tasks = useAdminTasksStore((s) => s.tasks)
  const load = useAdminTasksStore((s) => s.load)
  const hasLoaded = useAdminTasksStore((s) => s.hasLoaded)
  const schemaMissing = useAdminTasksStore((s) => s.schemaMissing)
  const updateStatus = useAdminTasksStore((s) => s.updateStatus)
  const update = useAdminTasksStore((s) => s.update)
  const remove = useAdminTasksStore((s) => s.remove)

  const [scope, setScope] = useState<'mine' | 'all'>('mine')
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => { if (!hasLoaded) void load() }, [hasLoaded, load])

  const usersById = useMemo(() => new Map(allUsers.map((u) => [u.id, u])), [allUsers])

  const filtered = useMemo(() => {
    if (!currentUser) return []
    return scope === 'mine' ? tasks.filter((t) => t.assignedTo === currentUser.id) : tasks
  }, [tasks, scope, currentUser])

  const columns = useMemo(() => {
    const map: Record<TaskStatus, AdminTask[]> = { open: [], in_progress: [], done: [] }
    for (const t of filtered) map[t.status].push(t)
    // Sort: priority desc, then due_at asc, then created_at desc
    const priWeight: Record<TaskPriority, number> = { urgent: 3, high: 2, normal: 1, low: 0 }
    for (const status of Object.keys(map) as TaskStatus[]) {
      map[status].sort((a, b) => {
        const p = priWeight[b.priority] - priWeight[a.priority]
        if (p !== 0) return p
        if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt)
        if (a.dueAt) return -1
        if (b.dueAt) return 1
        return b.createdAt.localeCompare(a.createdAt)
      })
    }
    return map
  }, [filtered])

  if (!currentUser) return null

  if (schemaMissing) {
    return (
      <div className="card-base p-6 max-w-xl">
        <h1 className="font-mono text-lg font-bold text-text-primary mb-2 flex items-center gap-2">
          <ListChecks size={18} className="text-accent-amber" /> Tasks
        </h1>
        <p className="text-text-secondary text-sm mb-3">
          The tasks table hasn't been created yet.
        </p>
        <p className="text-text-muted text-xs leading-relaxed mb-2">
          Open the Supabase SQL Editor and run:
        </p>
        <code className="block bg-bg-tertiary border border-border rounded px-3 py-2 text-xs text-accent-amber select-all">
          supabase/migrations/20260428_chat_extras.sql
        </code>
        <p className="text-text-muted text-xs mt-3">Refresh this page once applied.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="font-mono text-2xl font-bold text-text-primary flex items-center gap-2">
            <ListChecks size={24} className="text-accent-amber" /> Tasks
          </h1>
          <p className="text-text-secondary text-sm">Internal to-dos for the studio team</p>
        </div>
        <div className="flex items-center gap-1 bg-bg-tertiary rounded-lg p-1 font-mono text-xs">
          <Filter size={12} className="text-text-muted ml-1.5 mr-0.5" />
          {(['mine', 'all'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={`px-3 py-1 rounded transition-colors ${
                scope === s ? 'bg-accent-amber text-bg-primary font-bold' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {s === 'mine' ? 'My tasks' : 'All tasks'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        {COLUMNS.map((col) => (
          <div key={col.status} className={`card-base p-3 border-t-2 ${col.tone}`}>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="font-mono text-xs uppercase tracking-wider text-text-secondary">
                {col.title}
              </h2>
              <span className="font-mono text-[10px] text-text-muted">{columns[col.status].length}</span>
            </div>

            {columns[col.status].length === 0 && (
              <div className="px-3 py-6 text-center text-text-muted text-xs">
                <p>Nothing here.</p>
              </div>
            )}

            <div className="space-y-2">
              {columns[col.status].map((task) => {
                const assignee = usersById.get(task.assignedTo)
                const due = formatDue(task.dueAt)
                const overdue = task.dueAt && task.status !== 'done' && new Date(task.dueAt) < new Date()
                const isEditing = editingId === task.id
                return (
                  <div
                    key={task.id}
                    className={`rounded-lg border bg-bg-tertiary/40 p-3 hover:border-accent-amber/50 transition-colors ${
                      isEditing ? 'border-accent-amber' : 'border-border'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setEditingId(isEditing ? null : task.id)}
                      className="w-full text-left"
                    >
                      <p className="text-text-primary text-xs font-medium">{task.title}</p>
                      {task.description && (
                        <p className="text-text-muted text-[11px] mt-1 line-clamp-3">{task.description}</p>
                      )}

                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${PRIORITY_COLORS[task.priority]}`}>
                          <Flag size={9} className="inline mr-1 -mt-0.5" />{task.priority}
                        </span>
                        {due && (
                          <span className={`text-[9px] flex items-center gap-1 ${overdue ? 'text-red-400' : 'text-text-muted'}`}>
                            <Clock size={9} />{due}
                          </span>
                        )}
                        {assignee && (
                          <span className="text-[9px] flex items-center gap-1 text-text-muted ml-auto">
                            <span className="w-4 h-4 rounded-full bg-accent-amber/10 text-accent-amber font-bold text-[8px] flex items-center justify-center">
                              {initials(assignee.displayName)}
                            </span>
                            {assignee.displayName}
                          </span>
                        )}
                      </div>
                    </button>

                    {isEditing && (
                      <div className="mt-3 pt-3 border-t border-border space-y-2">
                        <div>
                          <label className="block text-[9px] uppercase text-text-muted tracking-wider mb-1">Status</label>
                          <div className="grid grid-cols-3 gap-1">
                            {(['open', 'in_progress', 'done'] as TaskStatus[]).map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => void updateStatus(task.id, s)}
                                className={`text-[9px] uppercase tracking-wider px-2 py-1 rounded border transition-colors ${
                                  task.status === s ? 'bg-accent-amber/10 border-accent-amber text-accent-amber' : 'border-border text-text-secondary hover:border-accent-amber/50'
                                }`}
                              >
                                {s.replace('_', ' ')}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase text-text-muted tracking-wider mb-1">
                            <User size={9} className="inline mr-0.5" /> Re-assign
                          </label>
                          <select
                            value={task.assignedTo}
                            onChange={(e) => void update(task.id, { assignedTo: e.target.value })}
                            className="input-field text-[11px] py-1.5"
                          >
                            {allUsers.map((u) => (
                              <option key={u.id} value={u.id}>{u.displayName}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('Delete this task?')) {
                                void remove(task.id)
                                setEditingId(null)
                              }
                            }}
                            className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1"
                          >
                            <Trash2 size={10} /> Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
