// Orders — top-level customer-job entity that ties together a quotation
// and its generated invoice + tracks the production lifecycle.
//
// Lifecycle:
//   PENDING → ACCEPTED → IN_PRODUCTION → READY → SHIPPED → DELIVERED → CLOSED
//                                                                  CANCELLED (any time)
//
// An Order is created automatically when a quotation's status flips to
// 'paid' (i.e. accepted by the customer or admin). At that moment the
// quotation's line items are also copied into a new Invoice, and both ids
// are linked back to the Order.

import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuditLogStore } from './auditLogStore'

export type OrderStatus =
  | 'pending'         // order created, waiting for production to start
  | 'in_production'   // currently being printed
  | 'ready'           // print done, ready for pickup/ship
  | 'shipped'         // out for delivery
  | 'delivered'       // customer received
  | 'closed'          // archived / completed
  | 'cancelled'

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'pending', 'in_production', 'ready', 'shipped', 'delivered', 'closed',
]

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending',
  in_production: 'In Production',
  ready: 'Ready',
  shipped: 'Shipped',
  delivered: 'Delivered',
  closed: 'Closed',
  cancelled: 'Cancelled',
}

export type OrderEventType =
  | 'quotation_sent'
  | 'quotation_accepted'
  | 'order_created'
  | 'invoice_generated'
  | 'status_changed'
  | 'note_added'

export interface OrderEvent {
  type: OrderEventType
  date: string
  by?: string                   // username or 'customer' / 'system'
  note?: string
  // Optional context the UI may render
  fromStatus?: OrderStatus
  toStatus?: OrderStatus
  invoiceNumber?: string
  quotationNumber?: string
}

export interface Order {
  id: string
  orderNumber: string
  customerId?: string
  customerName: string
  quotationId?: string
  invoiceId?: string
  status: OrderStatus
  total: number
  currency: string
  notes?: string
  history: OrderEvent[]
  createdAt: string
  updatedAt: string
}

interface SbRow {
  id: string
  order_number: string
  customer_id: string | null
  customer_name: string
  quotation_id: string | null
  invoice_id: string | null
  status: string
  total: number
  currency: string
  notes: string | null
  history: OrderEvent[] | string
  created_at: string
  updated_at: string
}

function rowToOrder(r: SbRow): Order {
  let history: OrderEvent[] = []
  if (Array.isArray(r.history)) history = r.history
  else if (typeof r.history === 'string') {
    try { const j = JSON.parse(r.history); if (Array.isArray(j)) history = j } catch { /* ignore */ }
  }
  return {
    id: r.id,
    orderNumber: r.order_number,
    customerId: r.customer_id ?? undefined,
    customerName: r.customer_name,
    quotationId: r.quotation_id ?? undefined,
    invoiceId: r.invoice_id ?? undefined,
    status: (r.status as OrderStatus) || 'pending',
    total: Number(r.total) || 0,
    currency: r.currency || 'EUR',
    notes: r.notes ?? undefined,
    history,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function orderToRow(o: Order): Record<string, unknown> {
  return {
    id: o.id,
    order_number: o.orderNumber,
    customer_id: o.customerId ?? null,
    customer_name: o.customerName,
    quotation_id: o.quotationId ?? null,
    invoice_id: o.invoiceId ?? null,
    status: o.status,
    total: o.total,
    currency: o.currency,
    notes: o.notes ?? null,
    history: o.history,
    created_at: o.createdAt,
    updated_at: o.updatedAt,
  }
}

interface OrdersState {
  orders: Order[]
  loading: boolean
  addOrder: (data: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>
  updateOrder: (id: string, updates: Partial<Order>) => Promise<void>
  deleteOrder: (id: string) => Promise<void>
  appendEvent: (id: string, event: Omit<OrderEvent, 'date'>) => Promise<void>
  changeStatus: (id: string, to: OrderStatus, by?: string, note?: string) => Promise<void>
  getOrderById: (id: string) => Order | undefined
  getOrderByQuotationId: (qId: string) => Order | undefined
  getOrdersForCustomer: (customerId: string) => Order[]
  getNextOrderNumber: () => string
}

async function sbUpsert(o: Order): Promise<void> {
  if (!isSupabaseConfigured) return
  const { error } = await supabase.from('orders').upsert(orderToRow(o), { onConflict: 'id' })
  if (error) console.error('[orders] upsert error:', error)
}

async function sbDelete(id: string): Promise<void> {
  if (!isSupabaseConfigured) return
  const { error } = await supabase.from('orders').delete().eq('id', id)
  if (error) console.error('[orders] delete error:', error)
}

/** Subscribe to realtime updates so the admin tab sees new orders and
 *  status changes the moment a customer accepts a quote. */
function subscribeRealtime(): void {
  if (!isSupabaseConfigured) return
  supabase
    .channel('orders-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
      // Re-fetch on every change — simpler than reconciling individual events.
      void fetchFromSupabase()
      console.log('[orders] realtime change:', payload.eventType)
    })
    .subscribe()
}

async function fetchFromSupabase(): Promise<void> {
  if (!isSupabaseConfigured) {
    useOrdersStore.setState({ loading: false })
    return
  }
  useOrdersStore.setState({ loading: true })
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[orders] fetch error:', error)
      useOrdersStore.setState({ loading: false })
      return
    }
    const orders = (data || []).map((r) => rowToOrder(r as SbRow))
    useOrdersStore.setState({ orders, loading: false })
  } catch (err) {
    console.error('[orders] fetch exception:', err)
    useOrdersStore.setState({ loading: false })
  }
}

export const useOrdersStore = create<OrdersState>((set, get) => ({
  orders: [],
  loading: true,

  addOrder: async (data) => {
    const id = `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const now = new Date().toISOString()
    const order: Order = { ...data, id, createdAt: now, updatedAt: now }
    set((state) => ({ orders: [order, ...state.orders] }))
    await sbUpsert(order)
    useAuditLogStore.getState().log('create', 'order', `Order ${order.orderNumber} created`, order.customerName)
    return id
  },

  updateOrder: async (id, updates) => {
    let updated: Order | undefined
    set((state) => ({
      orders: state.orders.map((o) => {
        if (o.id !== id) return o
        updated = { ...o, ...updates, updatedAt: new Date().toISOString() }
        return updated
      }),
    }))
    if (updated) await sbUpsert(updated)
  },

  deleteOrder: async (id) => {
    const o = get().orders.find((x) => x.id === id)
    if (o) useAuditLogStore.getState().log('delete', 'order', `Order ${o.orderNumber} deleted`)
    set((state) => ({ orders: state.orders.filter((x) => x.id !== id) }))
    await sbDelete(id)
  },

  appendEvent: async (id, event) => {
    const fullEvent: OrderEvent = { ...event, date: new Date().toISOString() }
    let updated: Order | undefined
    set((state) => ({
      orders: state.orders.map((o) => {
        if (o.id !== id) return o
        updated = { ...o, history: [...o.history, fullEvent], updatedAt: new Date().toISOString() }
        return updated
      }),
    }))
    if (updated) await sbUpsert(updated)
  },

  changeStatus: async (id, to, by, note) => {
    const o = get().orders.find((x) => x.id === id)
    if (!o) return
    const event: OrderEvent = {
      type: 'status_changed',
      date: new Date().toISOString(),
      by: by || 'system',
      note,
      fromStatus: o.status,
      toStatus: to,
    }
    let updated: Order | undefined
    set((state) => ({
      orders: state.orders.map((x) => {
        if (x.id !== id) return x
        updated = { ...x, status: to, history: [...x.history, event], updatedAt: new Date().toISOString() }
        return updated
      }),
    }))
    if (updated) {
      await sbUpsert(updated)
      useAuditLogStore.getState().log('update', 'order', `Order ${updated.orderNumber}: ${o.status} → ${to}`, by)
    }
  },

  getOrderById: (id) => get().orders.find((o) => o.id === id),
  getOrderByQuotationId: (qId) => get().orders.find((o) => o.quotationId === qId),
  getOrdersForCustomer: (customerId) => get().orders.filter((o) => o.customerId === customerId),

  getNextOrderNumber: () => {
    const year = new Date().getFullYear()
    const prefix = `ORD-${year}-`
    const max = get().orders.reduce((m, o) => {
      if (!o.orderNumber.startsWith(prefix)) return m
      const n = parseInt(o.orderNumber.slice(prefix.length), 10)
      return isNaN(n) ? m : Math.max(m, n)
    }, 0)
    return `${prefix}${String(max + 1).padStart(4, '0')}`
  },
}))

// Kick off initial Supabase fetch AFTER the store is fully assigned (avoids TDZ).
void fetchFromSupabase()
subscribeRealtime()
