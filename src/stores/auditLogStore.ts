import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

const MAX_LOCAL_ENTRIES = 500

export type AuditCategory =
  | 'customer'
  | 'invoice'
  | 'quotation'
  | 'notification'
  | 'product'
  | 'content'
  | 'system'

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'status_change'
  | 'convert'
  | 'lock'
  | 'login'
  | 'reset'

export interface AuditEntry {
  id: string
  action: AuditAction
  category: AuditCategory
  label: string
  detail: string
  metadata: Record<string, unknown>
  actor?: string
  createdAt: string
}

interface AuditLogState {
  entries: AuditEntry[]
  loading: boolean
  log: (action: AuditAction, category: AuditCategory, label: string, detail?: string, metadata?: Record<string, unknown>) => Promise<void>
  getRecent: (limit?: number) => AuditEntry[]
  getByCategory: (category: AuditCategory) => AuditEntry[]
  clearAll: () => Promise<void>
}

// Supabase helpers
interface SbRow {
  id: string
  action: string
  category: string
  label: string
  detail: string
  metadata: Record<string, unknown>
  actor: string | null
  created_at: string
}

function toRow(e: AuditEntry): SbRow {
  return {
    id: e.id,
    action: e.action,
    category: e.category,
    label: e.label,
    detail: e.detail,
    metadata: e.metadata,
    actor: e.actor ?? null,
    created_at: e.createdAt,
  }
}

function fromRow(r: SbRow): AuditEntry {
  return {
    id: r.id,
    action: r.action as AuditAction,
    category: r.category as AuditCategory,
    label: r.label,
    detail: r.detail || '',
    metadata: r.metadata || {},
    actor: r.actor ?? undefined,
    createdAt: new Date(r.created_at).toISOString(),
  }
}

async function sbInsert(entry: AuditEntry) {
  if (!isSupabaseConfigured) return
  try {
    const { error } = await supabase.from('audit_log').insert(toRow(entry))
    if (error) console.error('[audit] Supabase insert error:', error)
  } catch (err) {
    console.error('[audit] Supabase insert exception:', err)
  }
}

async function fetchFromSupabase(): Promise<void> {
  if (!isSupabaseConfigured) {
    useAuditLogStore.setState({ loading: false })
    return
  }
  useAuditLogStore.setState({ loading: true })
  try {
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(MAX_LOCAL_ENTRIES)
    if (error) {
      console.error('[audit] Supabase fetch error:', error)
      useAuditLogStore.setState({ loading: false })
      return
    }
    const entries = ((data || []) as SbRow[]).map(fromRow)
    useAuditLogStore.setState({ entries, loading: false })
  } catch (err) {
    console.error('[audit] Supabase fetch exception:', err)
    useAuditLogStore.setState({ loading: false })
  }
}

export const useAuditLogStore = create<AuditLogState>((set, get) => {
  fetchFromSupabase()

  return {
    entries: [],
    loading: true,

    log: async (action, category, label, detail = '', metadata = {}) => {
      // Lazily read the admin auth context from the window so we can attribute
      // the log entry without creating a circular import.
      let actor: string | undefined
      try {
        const adminAuth = (window as unknown as { __axiomAdminAuth?: { username?: string } }).__axiomAdminAuth
        actor = adminAuth?.username
      } catch { /* ignore */ }
      const entry: AuditEntry = {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        action,
        category,
        label,
        detail,
        metadata,
        actor,
        createdAt: new Date().toISOString(),
      }
      set((state) => ({
        entries: [entry, ...state.entries].slice(0, MAX_LOCAL_ENTRIES),
      }))
      await sbInsert(entry)
    },

    getRecent: (limit = 20) => get().entries.slice(0, limit),

    getByCategory: (category) => get().entries.filter((e) => e.category === category),

    clearAll: async () => {
      set({ entries: [] })
      if (!isSupabaseConfigured) return
      try {
        const { error } = await supabase.from('audit_log').delete().neq('id', '')
        if (error) console.error('[audit] Supabase clearAll error:', error)
      } catch (err) {
        console.error('[audit] Supabase clearAll exception:', err)
      }
    },
  }
})
