import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

const STORAGE_KEY = 'axiom_audit_log'
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
  log: (action: AuditAction, category: AuditCategory, label: string, detail?: string, metadata?: Record<string, unknown>) => void
  getRecent: (limit?: number) => AuditEntry[]
  getByCategory: (category: AuditCategory) => AuditEntry[]
  clearAll: () => void
}

// localStorage helpers
function load(): AuditEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch { /* ignore */ }
  return []
}

function save(entries: AuditEntry[]) {
  // Keep only latest entries to avoid bloat
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_LOCAL_ENTRIES)))
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
  if (!isSupabaseConfigured) return
  try {
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(MAX_LOCAL_ENTRIES)
    if (error) {
      console.error('[audit] Supabase fetch error:', error)
      return
    }
    if (data && data.length > 0) {
      const entries = (data as SbRow[]).map(fromRow)
      save(entries)
      useAuditLogStore.setState({ entries })
    } else {
      const local = load()
      if (local.length > 0) {
        for (const e of local) await sbInsert(e)
      }
    }
  } catch (err) {
    console.error('[audit] Supabase fetch exception:', err)
  }
}

export const useAuditLogStore = create<AuditLogState>((set, get) => {
  fetchFromSupabase()

  return {
    entries: load(),

    log: (action, category, label, detail = '', metadata = {}) => {
      // Lazily import to avoid circular dep
      let actor: string | undefined
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
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
      set((state) => {
        const entries = [entry, ...state.entries].slice(0, MAX_LOCAL_ENTRIES)
        save(entries)
        return { entries }
      })
      sbInsert(entry)
    },

    getRecent: (limit = 20) => get().entries.slice(0, limit),

    getByCategory: (category) => get().entries.filter((e) => e.category === category),

    clearAll: () => {
      localStorage.removeItem(STORAGE_KEY)
      set({ entries: [] })
    },
  }
})
