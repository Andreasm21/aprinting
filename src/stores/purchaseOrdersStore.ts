import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuditLogStore } from './auditLogStore'

export type POStatus = 'ordered' | 'shipped' | 'received' | 'cancelled'

export interface POItem {
  id: string
  partNumber: string
  name: string
  category: string
  quantity: number
  unitCost: number
  received: boolean
  // After receiving, we link the inventory product id
  inventoryProductId?: string
}

export interface PurchaseOrder {
  id: string
  poNumber: string
  supplier: string
  trackingNumber?: string
  carrier?: string
  status: POStatus
  items: POItem[]
  orderedAt: string
  expectedAt?: string
  receivedAt?: string
  notes?: string
  createdAt: string
}

interface PurchaseOrdersState {
  orders: PurchaseOrder[]
  loading: boolean
  addOrder: (data: Omit<PurchaseOrder, 'id' | 'createdAt'>) => string
  updateOrder: (id: string, updates: Partial<PurchaseOrder>) => void
  deleteOrder: (id: string) => void
  receiveItem: (orderId: string, itemId: string, inventoryProductId: string) => void
  getNextPONumber: () => string
}

// Supabase converters
interface SbRow {
  id: string
  po_number: string
  supplier: string | null
  tracking_number: string | null
  carrier: string | null
  status: string
  items: POItem[]
  ordered_at: string
  expected_at: string | null
  received_at: string | null
  notes: string | null
  created_at: string
}

function toRow(o: PurchaseOrder): SbRow {
  return {
    id: o.id,
    po_number: o.poNumber,
    supplier: o.supplier || null,
    tracking_number: o.trackingNumber ?? null,
    carrier: o.carrier ?? null,
    status: o.status,
    items: o.items,
    ordered_at: o.orderedAt,
    expected_at: o.expectedAt ?? null,
    received_at: o.receivedAt ?? null,
    notes: o.notes ?? null,
    created_at: o.createdAt,
  }
}

function fromRow(r: SbRow): PurchaseOrder {
  return {
    id: r.id,
    poNumber: r.po_number,
    supplier: r.supplier || '',
    trackingNumber: r.tracking_number ?? undefined,
    carrier: r.carrier ?? undefined,
    status: r.status as POStatus,
    items: r.items || [],
    orderedAt: r.ordered_at,
    expectedAt: r.expected_at ?? undefined,
    receivedAt: r.received_at ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
  }
}

// Supabase ops
async function sbUpsert(o: PurchaseOrder) {
  if (!isSupabaseConfigured) return
  try {
    const { error } = await supabase.from('purchase_orders').upsert(toRow(o), { onConflict: 'id' })
    if (error) console.error('[po] upsert error:', error)
  } catch (err) { console.error('[po]', err) }
}

async function sbDelete(id: string) {
  if (!isSupabaseConfigured) return
  try {
    const { error } = await supabase.from('purchase_orders').delete().eq('id', id)
    if (error) console.error('[po] delete error:', error)
  } catch (err) { console.error('[po]', err) }
}

async function fetchFromSupabase() {
  if (!isSupabaseConfigured) {
    usePurchaseOrdersStore.setState({ loading: false })
    return
  }
  usePurchaseOrdersStore.setState({ loading: true })
  try {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*')
      .order('ordered_at', { ascending: false })
    if (error) {
      console.error('[po] fetch error:', error)
      usePurchaseOrdersStore.setState({ loading: false })
      return
    }
    const rows = (data || []) as SbRow[]
    const orders = rows.map(fromRow)
    usePurchaseOrdersStore.setState({ orders, loading: false })
  } catch (err) {
    console.error('[po]', err)
    usePurchaseOrdersStore.setState({ loading: false })
  }
}

export const usePurchaseOrdersStore = create<PurchaseOrdersState>((set, get) => {
  fetchFromSupabase()

  return {
    orders: [],
    loading: true,

    addOrder: (data) => {
      const id = `po-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const order: PurchaseOrder = {
        ...data,
        id,
        createdAt: new Date().toISOString(),
      }
      set((state) => ({ orders: [order, ...state.orders] }))
      void sbUpsert(order)
      useAuditLogStore.getState().log('create', 'product', `PO ${order.poNumber} created`, `${order.supplier} · ${order.items.length} items`)
      return id
    },

    updateOrder: (id, updates) => {
      let updated: PurchaseOrder | undefined
      set((state) => {
        const orders = state.orders.map((o) => {
          if (o.id !== id) return o
          updated = { ...o, ...updates }
          return updated
        })
        return { orders }
      })
      if (updated) {
        void sbUpsert(updated)
        if (updates.status) useAuditLogStore.getState().log('status_change', 'product', `PO ${updated.poNumber} → ${updates.status}`)
      }
    },

    deleteOrder: (id) => {
      const o = get().orders.find((x) => x.id === id)
      if (o) useAuditLogStore.getState().log('delete', 'product', `PO ${o.poNumber} deleted`)
      set((state) => ({ orders: state.orders.filter((o) => o.id !== id) }))
      void sbDelete(id)
    },

    receiveItem: (orderId, itemId, inventoryProductId) => {
      let updated: PurchaseOrder | undefined
      set((state) => {
        const orders = state.orders.map((o) => {
          if (o.id !== orderId) return o
          const items = o.items.map((it) => it.id === itemId ? { ...it, received: true, inventoryProductId } : it)
          const allReceived = items.every((it) => it.received)
          updated = {
            ...o,
            items,
            status: allReceived ? 'received' : o.status,
            receivedAt: allReceived ? new Date().toISOString() : o.receivedAt,
          }
          return updated
        })
        return { orders }
      })
      if (updated) void sbUpsert(updated)
    },

    getNextPONumber: () => {
      const year = new Date().getFullYear() % 100
      const existing = get().orders.filter((o) => o.poNumber.includes(`PO-${year}`))
      const max = existing.reduce((m, o) => {
        const match = o.poNumber.match(/(\d{4})$/)
        return match ? Math.max(m, parseInt(match[1])) : m
      }, 0)
      return `PO-${year}-${String(max + 1).padStart(4, '0')}`
    },
  }
})
