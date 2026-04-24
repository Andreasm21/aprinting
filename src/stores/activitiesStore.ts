import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

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
  loading: boolean
  addActivity: (data: Omit<CustomerActivity, 'id' | 'createdAt'>) => Promise<string>
  deleteActivity: (id: string) => Promise<void>
  getActivitiesForCustomer: (customerId: string) => CustomerActivity[]
}

// ---------------------------------------------------------------------------
// Supabase helpers
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
  if (!isSupabaseConfigured) {
    useActivitiesStore.setState({ loading: false })
    return
  }
  useActivitiesStore.setState({ loading: true })
  try {
    const { data, error } = await supabase
      .from('customer_activities')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[activities] Supabase fetch error:', error)
      useActivitiesStore.setState({ loading: false })
      return
    }
    const activities = ((data || []) as SupabaseActivityRow[]).map(fromRow)
    useActivitiesStore.setState({ activities, loading: false })
  } catch (err) {
    console.error('[activities] Supabase fetch exception:', err)
    useActivitiesStore.setState({ loading: false })
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useActivitiesStore = create<ActivitiesState>((set, get) => {

  return {
    activities: [],
    loading: true,

    addActivity: async (data) => {
      const id = `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const activity: CustomerActivity = {
        ...data,
        id,
        createdAt: new Date().toISOString(),
      }
      set((state) => ({ activities: [activity, ...state.activities] }))
      await sbUpsert(activity)
      return id
    },

    deleteActivity: async (id) => {
      set((state) => ({ activities: state.activities.filter((a) => a.id !== id) }))
      await sbDelete(id)
    },

    getActivitiesForCustomer: (customerId) => {
      return get().activities.filter((a) => a.customerId === customerId)
    },
  }
})

// Kick off initial Supabase fetch AFTER the store is fully assigned (avoids TDZ).
void fetchFromSupabase()
