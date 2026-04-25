import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuditLogStore } from './auditLogStore'

export type MovementType = 'IN' | 'OUT' | 'ADJUST'
export type StockStatus = 'OK' | 'LOW' | 'OUT'
export type InventoryCategory =
  // Filaments — appear in the quotation material picker
  | 'PLA' | 'PETG' | 'ABS' | 'TPU' | 'Resin' | 'Nylon'
  // Print-shop stock that isn't filament
  | 'Tools'         // calipers, scrapers, deburring tools, build-plate cleaners
  | 'Spare Parts'   // nozzles, hot ends, build plates, belts, fans
  | 'Consumables'   // IPA, glue sticks, paper towels, gloves, lubricants
  | 'Equipment'     // printers, dryboxes, enclosures, washers/curers
  | 'Packaging'     // boxes, tape, bubble wrap, mailers
  | 'Hardware'      // screws, M3/M4 bolts, threaded inserts, magnets
  | 'Finished'      // completed prints ready to ship

export const CATEGORIES: InventoryCategory[] = [
  'PLA', 'PETG', 'ABS', 'TPU', 'Resin', 'Nylon',
  'Tools', 'Spare Parts', 'Consumables', 'Equipment', 'Packaging',
  'Hardware', 'Finished',
]

export interface InventoryProduct {
  id: string
  partNumber: string
  name: string
  category: InventoryCategory
  brand?: string
  cost: number
  price: number
  reorderLevel: number
  bin?: string
  barcode?: string
  supplier?: string
  unitWeightGrams?: number  // For material spools (e.g. 1000 for 1kg, 500 for 500g)
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface StockMovement {
  id: string
  productId: string
  type: MovementType
  qty: number
  unitCost: number
  reference?: string
  notes?: string
  createdAt: string
}

interface InventoryState {
  products: InventoryProduct[]
  movements: StockMovement[]
  loading: boolean
  addProduct: (data: Omit<InventoryProduct, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateProduct: (id: string, updates: Partial<InventoryProduct>) => void
  deleteProduct: (id: string) => void
  addMovement: (data: Omit<StockMovement, 'id' | 'createdAt'>) => string
  getQtyOnHand: (productId: string) => number
  getStockStatus: (productId: string) => StockStatus
  getProductById: (id: string) => InventoryProduct | undefined
  getProductByPartNumber: (partNumber: string) => InventoryProduct | undefined
  getProductByBarcode: (barcode: string) => InventoryProduct | undefined
}

// ─────────────────────── Supabase converters ────────────────────────

interface SbProduct {
  id: string
  part_number: string
  name: string
  category: string
  brand: string | null
  cost: number
  price: number
  reorder_level: number
  bin: string | null
  barcode: string | null
  supplier: string | null
  unit_weight_grams: number | null
  archived: boolean
  created_at: string
  updated_at: string
}

interface SbMovement {
  id: string
  product_id: string
  type: string
  qty: number
  unit_cost: number
  reference: string | null
  notes: string | null
  created_at: string
}

function productToRow(p: InventoryProduct): SbProduct {
  return {
    id: p.id,
    part_number: p.partNumber,
    name: p.name,
    category: p.category,
    brand: p.brand ?? null,
    cost: p.cost,
    price: p.price,
    reorder_level: p.reorderLevel,
    bin: p.bin ?? null,
    barcode: p.barcode ?? null,
    supplier: p.supplier ?? null,
    unit_weight_grams: p.unitWeightGrams ?? null,
    archived: p.archived,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  }
}

function rowToProduct(r: SbProduct): InventoryProduct {
  return {
    id: r.id,
    partNumber: r.part_number,
    name: r.name,
    category: r.category as InventoryCategory,
    brand: r.brand ?? undefined,
    cost: Number(r.cost),
    price: Number(r.price),
    reorderLevel: Number(r.reorder_level),
    bin: r.bin ?? undefined,
    barcode: r.barcode ?? undefined,
    supplier: r.supplier ?? undefined,
    unitWeightGrams: r.unit_weight_grams != null ? Number(r.unit_weight_grams) : 1000,
    archived: r.archived,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function movementToRow(m: StockMovement): SbMovement {
  return {
    id: m.id,
    product_id: m.productId,
    type: m.type,
    qty: m.qty,
    unit_cost: m.unitCost,
    reference: m.reference ?? null,
    notes: m.notes ?? null,
    created_at: m.createdAt,
  }
}

function rowToMovement(r: SbMovement): StockMovement {
  return {
    id: r.id,
    productId: r.product_id,
    type: r.type as MovementType,
    qty: Number(r.qty),
    unitCost: Number(r.unit_cost),
    reference: r.reference ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
  }
}

function partialProductToRow(updates: Partial<InventoryProduct>): Record<string, unknown> {
  const map: Record<string, string> = {
    partNumber: 'part_number',
    name: 'name',
    category: 'category',
    brand: 'brand',
    cost: 'cost',
    price: 'price',
    reorderLevel: 'reorder_level',
    bin: 'bin',
    barcode: 'barcode',
    supplier: 'supplier',
    unitWeightGrams: 'unit_weight_grams',
    archived: 'archived',
    updatedAt: 'updated_at',
  }
  const row: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(updates)) {
    if (map[key]) row[map[key]] = value
  }
  return row
}

// ─────────────────────── Supabase operations ────────────────────────

async function sbUpsertProduct(p: InventoryProduct) {
  if (!isSupabaseConfigured) return
  try {
    const { error } = await supabase.from('inventory_products').upsert(productToRow(p), { onConflict: 'id' })
    if (error) console.error('[inventory] upsert product:', error)
  } catch (err) { console.error('[inventory]', err) }
}

async function sbDeleteProduct(id: string) {
  if (!isSupabaseConfigured) return
  try {
    const { error } = await supabase.from('inventory_products').delete().eq('id', id)
    if (error) console.error('[inventory] delete product:', error)
  } catch (err) { console.error('[inventory]', err) }
}

async function sbInsertMovement(m: StockMovement) {
  if (!isSupabaseConfigured) return
  try {
    const { error } = await supabase.from('stock_movements').insert(movementToRow(m))
    if (error) console.error('[inventory] insert movement:', error)
  } catch (err) { console.error('[inventory]', err) }
}

async function fetchFromSupabase() {
  if (!isSupabaseConfigured) {
    useInventoryStore.setState({ loading: false })
    return
  }
  useInventoryStore.setState({ loading: true })
  try {
    const [{ data: prods, error: pe }, { data: moves, error: me }] = await Promise.all([
      supabase.from('inventory_products').select('*').order('created_at', { ascending: false }),
      supabase.from('stock_movements').select('*').order('created_at', { ascending: false }),
    ])

    if (pe) console.error('[inventory] fetch products:', pe)
    if (me) console.error('[inventory] fetch movements:', me)

    const products = prods ? (prods as SbProduct[]).map(rowToProduct) : []
    const movements = moves ? (moves as SbMovement[]).map(rowToMovement) : []

    useInventoryStore.setState({ products, movements, loading: false })
  } catch (err) {
    console.error('[inventory] fetch error:', err)
    useInventoryStore.setState({ loading: false })
  }
}

// ─────────────────────── Store ──────────────────────────────────────

export const useInventoryStore = create<InventoryState>((set, get) => {
  return {
    products: [],
    movements: [],
    loading: true,

    addProduct: (data) => {
      const id = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const now = new Date().toISOString()
      const product: InventoryProduct = { ...data, id, createdAt: now, updatedAt: now }
      set((state) => ({ products: [product, ...state.products] }))
      void (async () => {
        await sbUpsertProduct(product)
      })()
      useAuditLogStore.getState().log('create', 'product', `Inventory: "${product.partNumber}" added`, product.name)
      return id
    },

    updateProduct: (id, updates) => {
      let updated: InventoryProduct | undefined
      set((state) => {
        const products = state.products.map((p) => {
          if (p.id === id) {
            updated = { ...p, ...updates, updatedAt: new Date().toISOString() }
            return updated
          }
          return p
        })
        return { products }
      })
      if (updated && isSupabaseConfigured) {
        const row = partialProductToRow({ ...updates, updatedAt: updated.updatedAt })
        void (async () => {
          const { error } = await supabase.from('inventory_products').update(row).eq('id', id)
          if (error) console.error('[inventory] update:', error)
        })()
      }
      if (updated) useAuditLogStore.getState().log('update', 'product', `Inventory: "${updated.partNumber}" updated`)
    },

    deleteProduct: (id) => {
      const p = get().products.find((x) => x.id === id)
      if (p) useAuditLogStore.getState().log('delete', 'product', `Inventory: "${p.partNumber}" deleted`)
      set((state) => ({ products: state.products.filter((x) => x.id !== id) }))
      void (async () => {
        await sbDeleteProduct(id)
      })()
    },

    addMovement: (data) => {
      const id = `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const movement: StockMovement = { ...data, id, createdAt: new Date().toISOString() }
      set((state) => ({ movements: [movement, ...state.movements] }))
      void (async () => {
        await sbInsertMovement(movement)
      })()
      const p = get().products.find((x) => x.id === data.productId)
      if (p) {
        useAuditLogStore.getState().log(
          'create',
          'product',
          `Stock ${data.type}: ${data.qty} × ${p.partNumber}`,
          data.reference || ''
        )
      }
      return id
    },

    getQtyOnHand: (productId) => {
      return get().movements
        .filter((m) => m.productId === productId)
        .reduce((sum, m) => {
          if (m.type === 'IN') return sum + m.qty
          if (m.type === 'OUT') return sum - m.qty
          if (m.type === 'ADJUST') return sum + m.qty
          return sum
        }, 0)
    },

    getStockStatus: (productId) => {
      const qty = get().getQtyOnHand(productId)
      const p = get().products.find((x) => x.id === productId)
      if (!p) return 'OK'
      if (qty <= 0) return 'OUT'
      if (qty <= p.reorderLevel) return 'LOW'
      return 'OK'
    },

    getProductById: (id) => get().products.find((p) => p.id === id),
    getProductByPartNumber: (pn) => get().products.find((p) => p.partNumber.toLowerCase() === pn.toLowerCase()),
    getProductByBarcode: (bc) => get().products.find((p) => p.barcode === bc),
  }
})

// Kick off initial Supabase fetch AFTER the store reference is fully assigned.
// Calling this inside the create() callback hits a temporal-dead-zone when
// fetchFromSupabase tries to read `useInventoryStore.setState` before the
// `export const useInventoryStore` assignment completes — silent failure,
// store stays loading: true forever, page renders "0 products".
void fetchFromSupabase()
