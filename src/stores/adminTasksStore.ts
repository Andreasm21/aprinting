// Admin tasks store — internal task tracker.
//
// Tasks are owned by admins (assignee + creator). Backed by `admin_tasks`
// table with realtime subscription so both the assignee and the assigner
// see status changes live.

import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export type TaskStatus = 'open' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface AdminTask {
  id: string
  title: string
  description?: string
  assignedTo: string
  assignedBy: string
  status: TaskStatus
  priority: TaskPriority
  dueAt?: string
  createdAt: string
  completedAt?: string
  sourceRoomId?: string
  sourceMessageId?: string
}

interface TaskRow {
  id: string
  title: string
  description: string | null
  assigned_to: string
  assigned_by: string
  status: string
  priority: string
  due_at: string | null
  created_at: string
  completed_at: string | null
  source_room_id: string | null
  source_message_id: string | null
}

function fromRow(r: TaskRow): AdminTask {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? undefined,
    assignedTo: r.assigned_to,
    assignedBy: r.assigned_by,
    status: (r.status as TaskStatus) ?? 'open',
    priority: (r.priority as TaskPriority) ?? 'normal',
    dueAt: r.due_at ?? undefined,
    createdAt: r.created_at,
    completedAt: r.completed_at ?? undefined,
    sourceRoomId: r.source_room_id ?? undefined,
    sourceMessageId: r.source_message_id ?? undefined,
  }
}

let _warnedTasksMissing = false
let _realtimeStarted = false

interface TasksState {
  tasks: AdminTask[]
  loading: boolean
  hasLoaded: boolean
  schemaMissing: boolean

  load: () => Promise<void>
  create: (input: {
    title: string
    description?: string
    assignedTo: string
    assignedBy: string
    priority?: TaskPriority
    dueAt?: string
    sourceRoomId?: string
    sourceMessageId?: string
  }) => Promise<AdminTask | null>
  updateStatus: (id: string, status: TaskStatus) => Promise<void>
  update: (id: string, updates: Partial<Pick<AdminTask, 'title' | 'description' | 'priority' | 'dueAt' | 'assignedTo'>>) => Promise<void>
  remove: (id: string) => Promise<void>

  // Selectors
  getMyOpenCount: (userId: string) => number
  getByAssignee: (userId: string) => AdminTask[]
  getByStatus: (status: TaskStatus, scope: 'mine' | 'all', userId: string) => AdminTask[]

  // Internal — realtime callback
  _onTaskInserted: (t: AdminTask) => void
  _onTaskUpdated: (t: AdminTask) => void
  _onTaskDeleted: (id: string) => void
}

export const useAdminTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  loading: false,
  hasLoaded: false,
  schemaMissing: false,

  load: async () => {
    if (!isSupabaseConfigured) { set({ hasLoaded: true }); return }
    if (get().loading || get().hasLoaded) return
    set({ loading: true })
    try {
      const { data, error } = await supabase
        .from('admin_tasks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) {
        const msg = error.message ?? ''
        const tableMissing =
          (error as { code?: string }).code === '42P01' ||
          (error as { code?: string }).code === 'PGRST205' ||
          /Could not find the table/i.test(msg) ||
          /relation .* does not exist/i.test(msg)
        if (tableMissing) {
          if (!_warnedTasksMissing) {
            _warnedTasksMissing = true
            console.info('[admin_tasks] table not found — apply supabase/migrations/20260428_chat_extras.sql')
          }
          set({ loading: false, hasLoaded: true, schemaMissing: true })
          return
        }
        console.error('[admin_tasks] load:', msg)
        set({ loading: false, hasLoaded: true })
        return
      }
      set({ tasks: ((data ?? []) as TaskRow[]).map(fromRow), loading: false, hasLoaded: true })
      // Start realtime subscription once
      if (!_realtimeStarted) {
        _realtimeStarted = true
        startRealtime()
      }
    } catch (err) {
      console.error('[admin_tasks] load:', err)
      set({ loading: false, hasLoaded: true })
    }
  },

  create: async (input) => {
    if (!isSupabaseConfigured || get().schemaMissing) return null
    try {
      const { data, error } = await supabase
        .from('admin_tasks')
        .insert({
          title: input.title.trim(),
          description: input.description?.trim() || null,
          assigned_to: input.assignedTo,
          assigned_by: input.assignedBy,
          priority: input.priority ?? 'normal',
          due_at: input.dueAt ?? null,
          source_room_id: input.sourceRoomId ?? null,
          source_message_id: input.sourceMessageId ?? null,
        })
        .select()
        .single()
      if (error || !data) {
        console.error('[admin_tasks] create:', error?.message)
        return null
      }
      const task = fromRow(data as TaskRow)
      // Optimistic insert in case the realtime stream hasn't echoed yet
      get()._onTaskInserted(task)
      return task
    } catch (err) {
      console.error('[admin_tasks] create:', err)
      return null
    }
  },

  updateStatus: async (id, status) => {
    if (!isSupabaseConfigured) return
    const updates: Record<string, unknown> = { status }
    if (status === 'done') updates.completed_at = new Date().toISOString()
    else updates.completed_at = null

    // Optimistic local update
    set((s) => ({
      tasks: s.tasks.map((t) => t.id === id ? {
        ...t, status, completedAt: status === 'done' ? new Date().toISOString() : undefined,
      } : t),
    }))

    try {
      const { error } = await supabase.from('admin_tasks').update(updates).eq('id', id)
      if (error) console.error('[admin_tasks] updateStatus:', error.message)
    } catch (err) {
      console.error('[admin_tasks] updateStatus:', err)
    }
  },

  update: async (id, updates) => {
    if (!isSupabaseConfigured) return
    const row: Record<string, unknown> = {}
    if (updates.title != null) row.title = updates.title
    if (updates.description !== undefined) row.description = updates.description || null
    if (updates.priority) row.priority = updates.priority
    if (updates.dueAt !== undefined) row.due_at = updates.dueAt || null
    if (updates.assignedTo) row.assigned_to = updates.assignedTo

    // Optimistic local merge
    set((s) => ({ tasks: s.tasks.map((t) => t.id === id ? { ...t, ...updates } : t) }))

    try {
      const { error } = await supabase.from('admin_tasks').update(row).eq('id', id)
      if (error) console.error('[admin_tasks] update:', error.message)
    } catch (err) {
      console.error('[admin_tasks] update:', err)
    }
  },

  remove: async (id) => {
    if (!isSupabaseConfigured) return
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
    try {
      const { error } = await supabase.from('admin_tasks').delete().eq('id', id)
      if (error) console.error('[admin_tasks] remove:', error.message)
    } catch (err) {
      console.error('[admin_tasks] remove:', err)
    }
  },

  getMyOpenCount: (userId) =>
    get().tasks.filter((t) => t.assignedTo === userId && t.status !== 'done').length,
  getByAssignee: (userId) => get().tasks.filter((t) => t.assignedTo === userId),
  getByStatus: (status, scope, userId) => {
    const base = get().tasks.filter((t) => t.status === status)
    return scope === 'mine' ? base.filter((t) => t.assignedTo === userId) : base
  },

  _onTaskInserted: (t) => {
    set((s) => {
      if (s.tasks.some((x) => x.id === t.id)) return {}
      return { tasks: [t, ...s.tasks] }
    })
  },
  _onTaskUpdated: (t) => {
    set((s) => ({ tasks: s.tasks.map((x) => x.id === t.id ? t : x) }))
  },
  _onTaskDeleted: (id) => {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
  },
}))

function startRealtime() {
  if (!isSupabaseConfigured) return
  const channel = supabase.channel('admin-tasks:all')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_tasks' }, (payload) => {
      useAdminTasksStore.getState()._onTaskInserted(fromRow(payload.new as TaskRow))
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'admin_tasks' }, (payload) => {
      useAdminTasksStore.getState()._onTaskUpdated(fromRow(payload.new as TaskRow))
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'admin_tasks' }, (payload) => {
      const id = (payload.old as { id?: string }).id
      if (id) useAdminTasksStore.getState()._onTaskDeleted(id)
    })
    .subscribe()
  // Channel lives forever; admin app session is short-lived enough that we
  // don't bother cleaning up across HMR — store stays a singleton in prod.
  void channel
}
