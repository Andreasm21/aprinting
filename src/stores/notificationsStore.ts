import { create } from 'zustand'

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

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
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
  },

  markRead: (id) => {
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      )
      save(notifications)
      return { notifications }
    })
  },

  markAllRead: () => {
    set((state) => {
      const notifications = state.notifications.map((n) => ({ ...n, read: true }))
      save(notifications)
      return { notifications }
    })
  },

  deleteNotification: (id) => {
    set((state) => {
      const notifications = state.notifications.filter((n) => n.id !== id)
      save(notifications)
      return { notifications }
    })
  },

  clearAll: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({ notifications: [] })
  },

  getUnreadCount: () => get().notifications.filter((n) => !n.read).length,
}))
