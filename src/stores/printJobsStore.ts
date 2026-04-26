import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuditLogStore } from './auditLogStore'

export type JobPriority = 'low' | 'normal' | 'high' | 'urgent'
export type JobStatus = 'queued' | 'printing' | 'paused' | 'completed' | 'failed' | 'cancelled'
export type JobSource = 'manual' | 'quotation' | 'invoice' | 'order'

const PRIORITY_WEIGHT: Record<JobPriority, number> = {
  urgent: 3, high: 2, normal: 1, low: 0,
}

export interface PrintJob {
  id: string
  customerId?: string
  documentId?: string
  source: JobSource
  description: string
  material?: string
  weightGrams?: number
  estimatedHours?: number
  quantity: number
  priority: JobPriority
  position: number
  status: JobStatus
  progress: number  // 0-100
  startedAt?: string
  completedAt?: string
  notes?: string
  createdAt: string
}

interface PrintJobsState {
  jobs: PrintJob[]
  loading: boolean
  addJob: (data: Omit<PrintJob, 'id' | 'createdAt' | 'position' | 'status' | 'progress'>) => string
  updateJob: (id: string, updates: Partial<PrintJob>) => void
  deleteJob: (id: string) => void
  startJob: (id: string) => void
  completeJob: (id: string) => void
  failJob: (id: string) => void
  pauseJob: (id: string) => void
  fastTrack: (id: string) => void
  reorderJob: (id: string, newPosition: number) => void
  // Computed selectors
  getActiveJob: () => PrintJob | undefined
  getQueuedJobs: () => PrintJob[]
  getCompletedTodayJobs: () => PrintJob[]
  getQuickWins: () => PrintJob[]
}

// Supabase converters
interface SbRow {
  id: string
  customer_id: string | null
  document_id: string | null
  source: string
  description: string
  material: string | null
  weight_grams: number | null
  estimated_hours: number | null
  quantity: number
  priority: string
  position: number
  status: string
  progress: number
  started_at: string | null
  completed_at: string | null
  notes: string | null
  created_at: string
}

function toRow(j: PrintJob): SbRow {
  return {
    id: j.id,
    customer_id: j.customerId ?? null,
    document_id: j.documentId ?? null,
    source: j.source,
    description: j.description,
    material: j.material ?? null,
    weight_grams: j.weightGrams ?? null,
    estimated_hours: j.estimatedHours ?? null,
    quantity: j.quantity,
    priority: j.priority,
    position: j.position,
    status: j.status,
    progress: j.progress,
    started_at: j.startedAt ?? null,
    completed_at: j.completedAt ?? null,
    notes: j.notes ?? null,
    created_at: j.createdAt,
  }
}

function fromRow(r: SbRow): PrintJob {
  return {
    id: r.id,
    customerId: r.customer_id ?? undefined,
    documentId: r.document_id ?? undefined,
    source: (r.source || 'manual') as JobSource,
    description: r.description,
    material: r.material ?? undefined,
    weightGrams: r.weight_grams != null ? Number(r.weight_grams) : undefined,
    estimatedHours: r.estimated_hours != null ? Number(r.estimated_hours) : undefined,
    quantity: r.quantity,
    priority: (r.priority || 'normal') as JobPriority,
    position: r.position,
    status: (r.status || 'queued') as JobStatus,
    progress: r.progress ?? 0,
    startedAt: r.started_at ?? undefined,
    completedAt: r.completed_at ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
  }
}

async function sbUpsert(j: PrintJob) {
  if (!isSupabaseConfigured) return
  try {
    const { error } = await supabase.from('print_jobs').upsert(toRow(j), { onConflict: 'id' })
    if (error) console.error('[print_jobs] upsert:', error)
  } catch (err) { console.error('[print_jobs]', err) }
}

async function sbDelete(id: string) {
  if (!isSupabaseConfigured) return
  try {
    const { error } = await supabase.from('print_jobs').delete().eq('id', id)
    if (error) console.error('[print_jobs] delete:', error)
  } catch (err) { console.error('[print_jobs]', err) }
}

async function fetchFromSupabase() {
  if (!isSupabaseConfigured) {
    usePrintJobsStore.setState({ loading: false })
    return
  }
  usePrintJobsStore.setState({ loading: true })
  try {
    const { data, error } = await supabase
      .from('print_jobs')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[print_jobs] fetch:', error)
      usePrintJobsStore.setState({ loading: false })
      return
    }
    const jobs = ((data || []) as SbRow[]).map(fromRow)
    usePrintJobsStore.setState({ jobs, loading: false })
  } catch (err) {
    console.error('[print_jobs]', err)
    usePrintJobsStore.setState({ loading: false })
  }
}

export const usePrintJobsStore = create<PrintJobsState>((set, get) => {
  return {
    jobs: [],
    loading: true,

    addJob: (data) => {
      const id = `pj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const job: PrintJob = {
        ...data,
        id,
        position: get().jobs.filter((j) => j.priority === data.priority && j.status === 'queued').length,
        status: 'queued',
        progress: 0,
        createdAt: new Date().toISOString(),
      }
      set((state) => ({ jobs: [job, ...state.jobs] }))
      void sbUpsert(job)
      useAuditLogStore.getState().log('create', 'order', `Print job queued: ${job.description}`)
      return id
    },

    updateJob: (id, updates) => {
      let updated: PrintJob | undefined
      set((state) => ({
        jobs: state.jobs.map((j) => {
          if (j.id !== id) return j
          updated = { ...j, ...updates }
          return updated
        }),
      }))
      if (updated) void sbUpsert(updated)
    },

    deleteJob: (id) => {
      const j = get().jobs.find((x) => x.id === id)
      if (j) useAuditLogStore.getState().log('delete', 'order', `Print job deleted: ${j.description}`)
      set((state) => ({ jobs: state.jobs.filter((x) => x.id !== id) }))
      void sbDelete(id)
    },

    startJob: (id) => {
      // Pause any other printing job (single printer assumption)
      const active = get().jobs.find((j) => j.status === 'printing')
      if (active && active.id !== id) {
        get().updateJob(active.id, { status: 'paused' })
      }
      get().updateJob(id, { status: 'printing', startedAt: new Date().toISOString(), progress: 0 })
      const j = get().jobs.find((x) => x.id === id)
      if (j) useAuditLogStore.getState().log('status_change', 'order', `Print started: ${j.description}`)
    },

    completeJob: (id) => {
      get().updateJob(id, { status: 'completed', completedAt: new Date().toISOString(), progress: 100 })
      const j = get().jobs.find((x) => x.id === id)
      if (j) useAuditLogStore.getState().log('status_change', 'order', `Print completed: ${j.description}`)
    },

    failJob: (id) => {
      get().updateJob(id, { status: 'failed', completedAt: new Date().toISOString() })
      const j = get().jobs.find((x) => x.id === id)
      if (j) useAuditLogStore.getState().log('status_change', 'order', `Print failed: ${j.description}`)
    },

    pauseJob: (id) => {
      get().updateJob(id, { status: 'paused' })
    },

    fastTrack: (id) => {
      get().updateJob(id, { priority: 'urgent', position: 0 })
      const j = get().jobs.find((x) => x.id === id)
      if (j) useAuditLogStore.getState().log('update', 'order', `Print fast-tracked: ${j.description}`)
    },

    reorderJob: (id, newPosition) => {
      get().updateJob(id, { position: newPosition })
    },

    getActiveJob: () => get().jobs.find((j) => j.status === 'printing'),

    getQueuedJobs: () => {
      return get().jobs
        .filter((j) => j.status === 'queued' || j.status === 'paused')
        .sort((a, b) => {
          const pw = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]
          if (pw !== 0) return pw
          return a.position - b.position
        })
    },

    getCompletedTodayJobs: () => {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      return get().jobs.filter((j) =>
        (j.status === 'completed' || j.status === 'failed') &&
        j.completedAt && new Date(j.completedAt) >= todayStart
      )
    },

    getQuickWins: () => {
      // Queued jobs under 1h that aren't already top-priority
      return get().jobs
        .filter((j) => j.status === 'queued' && j.priority !== 'urgent' && (j.estimatedHours ?? 999) < 1)
        .sort((a, b) => (a.estimatedHours ?? 0) - (b.estimatedHours ?? 0))
        .slice(0, 5)
    },
  }
})

// Kick off initial Supabase fetch AFTER the store is fully assigned (avoids TDZ).
void fetchFromSupabase()
