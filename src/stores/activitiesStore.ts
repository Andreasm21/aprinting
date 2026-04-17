import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

const STORAGE_KEY = 'axiom_customer_activities'

export type ActivityType = 'note' | 'call' | 'email' | 'meeting' | 'order' | 'invoice' | 'quotation' | 'status_change'

export interface CustomerActivity {
  id: string
  customerId: string
  type: ActivityType
  title: string
  description: string
  metadata: Record<string, unknown>
  createdAt: string
}

interface ActivitiesState {
  activities: CustomerActivity[]
  addActivity: (data: Omit<CustomerActivity, 'id' | 'createdAt'>) => string
  deleteActivity: (id: string) => void
  getActivitiesForCustomer: (customerId: string) => CustomerActivity[]
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function load(): CustomerActivity[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch { /* ignore */ }
  return []
}

function save(activities: CustomerActivity[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(activities))
}

// ---------------------------------------------------------------------------
// Supabase helpers (fire-and-forget)
// ---------------------------------------------------------------------------

interface SupabaseActivityRow {
  id: string
  customer_id: string
  type: string
  title: string
  description: string
  metadata: Record<string, unknown>
  created_at: string
}

function toRow(a: CustomerActivity): SupabaseActivityRow {
  return {
    id: a.id,
    customer_id: a.customerId,
    type: a.type,
    title: a.title,
    description: a.description,
    metadata: a.metadata,
    created_at: a.createdAt,
  }
}

function fromRow(row: SupabaseActivityRow): CustomerActivity {
  return {
    id: row.id,
    customerId: row.customer_id,
    type: row.type as ActivityType,
    title: row.title,
    description: row.description || '',
    metadata: row.metadata || {},
    createdAt: new Date(row.created_at).toISOString(),
  }
}

async function sbUpsert(activity: CustomerActivity) {
  if (!isSupabaseConfigured) return
  try {
    const { error } = await supabase.from('customer_activities').upsert(toRow(activity), { onConflict: 'id' })
    if (error) console.error('[activities] Supabase upsert error:', error)
  } catch (err) {
    console.error('[activities] Supabase upsert exception:', err)
  }
}

async function sbDelete(id: string) {
  if (!isSupabaseConfigured) return
  try {
    const { error } = await supabase.from('customer_activities').delete().eq('id', id)
    if (error) console.error('[activities] Supabase delete error:', error)
  } catch (err) {
    console.error('[activities] Supabase delete exception:', err)
  }
}

async function fetchFromSupabase(): Promise<void> {
  if (!isSupabaseConfigured) return
  try {
    const { data, error } = await supabase
      .from('customer_activities')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[activities] Supabase fetch error:', error)
      return
    }
    if (data && data.length > 0) {
      const activities = (data as SupabaseActivityRow[]).map(fromRow)
      save(activities)
      useActivitiesStore.setState({ activities })
    } else {
      const local = load()
      if (local.length > 0) {
        console.log(`[activities] Initial sync: pushing ${local.length} local activities to Supabase`)
        for (const a of local) {
          await sbUpsert(a)
        }
      }
    }
  } catch (err) {
    console.error('[activities] Supabase fetch exception:', err)
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useActivitiesStore = create<ActivitiesState>((set, get) => {
  fetchFromSupabase()

  return {
    activities: load(),

    addActivity: (data) => {
      const id = `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const activity: CustomerActivity = {
        ...data,
        id,
        createdAt: new Date().toISOString(),
      }
      set((state) => {
        const activities = [activity, ...state.activities]
        save(activities)
        return { activities }
      })
      sbUpsert(activity)
      return id
    },

    deleteActivity: (id) => {
      set((state) => {
        const activities = state.activities.filter((a) => a.id !== id)
        save(activities)
        return { activities }
      })
      sbDelete(id)
    },

    getActivitiesForCustomer: (customerId) => {
      return get().activities.filter((a) => a.customerId === customerId)
    },
  }
})
