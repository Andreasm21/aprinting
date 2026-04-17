import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuditLogStore } from './auditLogStore'

const STORAGE_KEY = 'aprinting_notifications'

export type NotificationType = 'order' | 'part_request' | 'contact'

export interface OrderNotification {
  type: 'order'
  id: string
  date: string
  customer: {
    name: string
    email: string
    phone: string
    deliveryType: 'delivery' | 'pickup'
    address?: string
    city?: string
    postalCode?: string
  }
  items: { name: string; quantity: number; price: number }[]
  subtotal: number
  deliveryFee: number
  total: number
  read: boolean
}

export interface PartRequestNotification {
  type: 'part_request'
  id: string
  date: string
  reference: string
  images: number
  details: {
    vehicleMake: string
    vehicleModel: string
    vehicleYear: string
    partName: string
    partDescription: string
    dimensions: string
    material: string
    quantity: number
    finish: string
    urgency: string
  }
  business: {
    companyName: string
    vatNumber: string
    contactName: string
    contactEmail: string
    contactPhone: string
    notes: string
  }
  read: boolean
}

export interface ContactNotification {
  type: 'contact'
  id: string
  date: string
  name: string
  email: string
  service: string
  message: string
  read: boolean
}

export type Notification = OrderNotification | PartRequestNotification | ContactNotification

interface NotificationsState {
  notifications: Notification[]
  addOrder: (order: Omit<OrderNotification, 'type' | 'id' | 'date' | 'read'>) => void
  addPartRequest: (request: Omit<PartRequestNotification, 'type' | 'id' | 'date' | 'read'>) => void
  addContact: (contact: Omit<ContactNotification, 'type' | 'id' | 'date' | 'read'>) => void
  markRead: (id: string) => void
  markAllRead: () => void
  deleteNotification: (id: string) => void
  clearAll: () => void
  getUnreadCount: () => number
}

// ---------------------------------------------------------------------------
// localStorage helpers (cache / fallback)
// ---------------------------------------------------------------------------

function loadNotifications(): Notification[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch { /* ignore */ }
  return []
}

function save(notifications: Notification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications))
}

// ---------------------------------------------------------------------------
// Supabase format converters
// ---------------------------------------------------------------------------

interface SupabaseNotificationRow {
  id: string
  type: NotificationType
  date: string
  read: boolean
  data: Record<string, unknown>
}

/** Convert a local Notification into the Supabase row shape. */
function toSupabaseRow(n: Notification): SupabaseNotificationRow {
  // Pull out the common columns; everything else goes into `data`.
  const { id, type, date, read, ...rest } = n
  return { id, type, date, read, data: rest }
}

/** Reconstruct a full Notification from a Supabase row. */
function fromSupabaseRow(row: SupabaseNotificationRow): Notification {
  const { id, type, date, read, data } = row
  return { id, type, date, read, ...data } as Notification
}

// ---------------------------------------------------------------------------
// Supabase fire-and-forget helpers
// ---------------------------------------------------------------------------

async function sbUpsert(notification: Notification) {
  if (!isSupabaseConfigured) return
  const { error } = await supabase
    .from('notifications')
    .upsert(toSupabaseRow(notification))
  if (error) console.error('[notifications] Supabase upsert failed:', error)
}

async function sbUpdate(id: string, fields: Partial<Pick<SupabaseNotificationRow, 'read'>>) {
  if (!isSupabaseConfigured) return
  const { error } = await supabase
    .from('notifications')
    .update(fields)
    .eq('id', id)
  if (error) console.error('[notifications] Supabase update failed:', error)
}

async function sbUpdateAll(fields: Partial<Pick<SupabaseNotificationRow, 'read'>>) {
  if (!isSupabaseConfigured) return
  // Update every row — use a filter that matches all rows
  const { error } = await supabase
    .from('notifications')
    .update(fields)
    .not('id', 'is', null)
  if (error) console.error('[notifications] Supabase updateAll failed:', error)
}

async function sbDelete(id: string) {
  if (!isSupabaseConfigured) return
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', id)
  if (error) console.error('[notifications] Supabase delete failed:', error)
}

async function sbDeleteAll() {
  if (!isSupabaseConfigured) return
  const { error } = await supabase
    .from('notifications')
    .delete()
    .not('id', 'is', null)
  if (error) console.error('[notifications] Supabase deleteAll failed:', error)
}

// ---------------------------------------------------------------------------
// Fetch from Supabase and replace local state
// ---------------------------------------------------------------------------

async function fetchFromSupabase(
  set: (partial: Partial<NotificationsState>) => void,
) {
  if (!isSupabaseConfigured) return
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('date', { ascending: false })

    if (error) {
      console.error('[notifications] Supabase fetch failed:', error)
      return
    }

    if (data && data.length > 0) {
      const notifications = (data as SupabaseNotificationRow[]).map(fromSupabaseRow)
      save(notifications)
      set({ notifications })
    } else {
      // Supabase is empty — push localStorage data up (initial sync)
      const local = loadNotifications()
      if (local.length > 0) {
        console.log(`[notifications] Initial sync: pushing ${local.length} local notifications to Supabase`)
        for (const n of local) {
          sbUpsert(n)
        }
      }
    }
  } catch (err) {
    console.error('[notifications] Supabase fetch exception:', err)
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useNotificationsStore = create<NotificationsState>((set, get) => {
  // Kick off a Supabase fetch as soon as the store is created.
  // The localStorage data is loaded synchronously below so the UI is never empty.
  fetchFromSupabase(set)

  return {
    notifications: loadNotifications(),

    addOrder: (order) => {
      const notification: OrderNotification = {
        ...order,
        type: 'order',
        id: `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: new Date().toISOString(),
        read: false,
      }
      set((state) => {
        const notifications = [notification, ...state.notifications]
        save(notifications)
        return { notifications }
      })
      sbUpsert(notification)
      useAuditLogStore.getState().log('create', 'notification', `New order received`, `€${notification.total.toFixed(2)} — ${notification.customer.name}`)
    },

    addPartRequest: (request) => {
      const notification: PartRequestNotification = {
        ...request,
        type: 'part_request',
        id: `pr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: new Date().toISOString(),
        read: false,
      }
      set((state) => {
        const notifications = [notification, ...state.notifications]
        save(notifications)
        return { notifications }
      })
      sbUpsert(notification)
      useAuditLogStore.getState().log('create', 'notification', `New part request received`, `${notification.details.partName} — ${notification.business.contactName}`)
    },

    addContact: (contact) => {
      const notification: ContactNotification = {
        ...contact,
        type: 'contact',
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: new Date().toISOString(),
        read: false,
      }
      set((state) => {
        const notifications = [notification, ...state.notifications]
        save(notifications)
        return { notifications }
      })
      sbUpsert(notification)
      useAuditLogStore.getState().log('create', 'notification', `New contact message`, `From ${notification.name}`)
    },

    markRead: (id) => {
      set((state) => {
        const notifications = state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        )
        save(notifications)
        return { notifications }
      })
      sbUpdate(id, { read: true })
    },

    markAllRead: () => {
      set((state) => {
        const notifications = state.notifications.map((n) => ({ ...n, read: true }))
        save(notifications)
        return { notifications }
      })
      sbUpdateAll({ read: true })
    },

    deleteNotification: (id) => {
      const n = get().notifications.find((n) => n.id === id)
      if (n) useAuditLogStore.getState().log('delete', 'notification', `Notification deleted`, n.type)
      set((state) => {
        const notifications = state.notifications.filter((n) => n.id !== id)
        save(notifications)
        return { notifications }
      })
      sbDelete(id)
    },

    clearAll: () => {
      const count = get().notifications.length
      localStorage.removeItem(STORAGE_KEY)
      set({ notifications: [] })
      sbDeleteAll()
      if (count > 0) useAuditLogStore.getState().log('delete', 'notification', `All notifications cleared`, `${count} removed`)
    },

    getUnreadCount: () => get().notifications.filter((n) => !n.read).length,
  }
})
