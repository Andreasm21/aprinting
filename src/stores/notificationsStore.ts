import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuditLogStore } from './auditLogStore'
import {
  notifyAdminsOfOrder,
  notifyAdminsOfPartRequest,
  notifyAdminsOfContact,
  notifyAdminsOfAlert,
} from '@/lib/adminNotifier'
import { createLeadFromContact, createLeadFromPartRequest } from '@/lib/leadCreator'

export type NotificationType = 'order' | 'part_request' | 'contact' | 'admin_alert'

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

/** Generic in-app alert raised by various flows — quote accepted by customer,
 *  changes requested, customer requesting a portal account, paid-invoice
 *  cleanup prompt, etc. The `kind` field discriminates between subtypes;
 *  `context` holds whatever ids/names the UI needs to render action links. */
export interface AdminAlertNotification {
  type: 'admin_alert'
  id: string
  date: string
  kind:
    | 'quote_accepted'
    | 'quote_changes_requested'
    | 'account_requested'
    | 'invoice_paid_cleanup'
    | 'other'
  title: string
  message: string
  context?: {
    quoteId?: string
    quoteNumber?: string
    invoiceId?: string
    invoiceNumber?: string
    orderId?: string
    orderNumber?: string
    customerEmail?: string
    customerName?: string
    customerId?: string
  }
  read: boolean
}

export type Notification = OrderNotification | PartRequestNotification | ContactNotification | AdminAlertNotification

interface NotificationsState {
  notifications: Notification[]
  loading: boolean
  addOrder: (order: Omit<OrderNotification, 'type' | 'id' | 'date' | 'read'>) => Promise<void>
  addPartRequest: (request: Omit<PartRequestNotification, 'type' | 'id' | 'date' | 'read'>) => Promise<void>
  addContact: (contact: Omit<ContactNotification, 'type' | 'id' | 'date' | 'read'>) => Promise<void>
  addAdminAlert: (alert: Omit<AdminAlertNotification, 'type' | 'id' | 'date' | 'read'>) => Promise<string>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  deleteNotification: (id: string) => Promise<void>
  clearAll: () => Promise<void>
  getUnreadCount: () => number
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
// Supabase helpers
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
  if (!isSupabaseConfigured) {
    set({ loading: false })
    return
  }
  set({ loading: true })
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('date', { ascending: false })

    if (error) {
      console.error('[notifications] Supabase fetch failed:', error)
      set({ loading: false })
      return
    }

    const rows = (data || []) as SupabaseNotificationRow[]
    const notifications = rows.map(fromSupabaseRow)
    set({ notifications, loading: false })
  } catch (err) {
    console.error('[notifications] Supabase fetch exception:', err)
    set({ loading: false })
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useNotificationsStore = create<NotificationsState>((set, get) => {
  // Kick off a Supabase fetch as soon as the store is created.
  fetchFromSupabase(set)

  // Realtime: re-fetch on every notifications-table change so the bell
  // icon lights up the moment a customer accepts a quote, requests
  // changes, etc. (driven from the public quote page).
  if (isSupabaseConfigured) {
    supabase
      .channel('notifications-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        void fetchFromSupabase(set)
      })
      .subscribe()
  }

  return {
    notifications: [],
    loading: true,

    addOrder: async (order) => {
      const notification: OrderNotification = {
        ...order,
        type: 'order',
        id: `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: new Date().toISOString(),
        read: false,
      }
      set((state) => ({ notifications: [notification, ...state.notifications] }))
      await sbUpsert(notification)
      useAuditLogStore.getState().log('create', 'notification', `New order received`, `€${notification.total.toFixed(2)} — ${notification.customer.name}`)
      // Don't block the UI on the email — fire-and-forget
      void notifyAdminsOfOrder(notification).catch((err) => console.warn('[notifications] email:', err))
    },

    addPartRequest: async (request) => {
      const notification: PartRequestNotification = {
        ...request,
        type: 'part_request',
        id: `pr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: new Date().toISOString(),
        read: false,
      }
      set((state) => ({ notifications: [notification, ...state.notifications] }))
      await sbUpsert(notification)
      useAuditLogStore.getState().log('create', 'notification', `New part request received`, `${notification.details.partName} — ${notification.business.contactName}`)
      void notifyAdminsOfPartRequest(notification).catch((err) => console.warn('[notifications] email:', err))
      void createLeadFromPartRequest(notification).catch((err) => console.warn('[notifications] lead:', err))
    },

    addContact: async (contact) => {
      const notification: ContactNotification = {
        ...contact,
        type: 'contact',
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: new Date().toISOString(),
        read: false,
      }
      set((state) => ({ notifications: [notification, ...state.notifications] }))
      await sbUpsert(notification)
      useAuditLogStore.getState().log('create', 'notification', `New contact message`, `From ${notification.name}`)
      void notifyAdminsOfContact(notification).catch((err) => console.warn('[notifications] email:', err))
      void createLeadFromContact(notification).catch((err) => console.warn('[notifications] lead:', err))
    },

    addAdminAlert: async (alert) => {
      const notification: AdminAlertNotification = {
        ...alert,
        type: 'admin_alert',
        id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: new Date().toISOString(),
        read: false,
      }
      set((state) => ({ notifications: [notification, ...state.notifications] }))
      await sbUpsert(notification)
      useAuditLogStore.getState().log('create', 'notification', notification.title, notification.message)
      void notifyAdminsOfAlert(notification).catch((err) => console.warn('[notifications] email:', err))
      return notification.id
    },

    markRead: async (id) => {
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
      }))
      await sbUpdate(id, { read: true })
    },

    markAllRead: async () => {
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
      }))
      await sbUpdateAll({ read: true })
    },

    deleteNotification: async (id) => {
      const n = get().notifications.find((n) => n.id === id)
      if (n) useAuditLogStore.getState().log('delete', 'notification', `Notification deleted`, n.type)
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      }))
      await sbDelete(id)
    },

    clearAll: async () => {
      const count = get().notifications.length
      set({ notifications: [] })
      await sbDeleteAll()
      if (count > 0) useAuditLogStore.getState().log('delete', 'notification', `All notifications cleared`, `${count} removed`)
    },

    getUnreadCount: () => get().notifications.filter((n) => !n.read).length,
  }
})
