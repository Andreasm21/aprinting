import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuditLogStore } from './auditLogStore'

const PRODUCTS_KEY = 'axiom_inventory_products'
const MOVEMENTS_KEY = 'axiom_stock_movements'
const SEEDED_FLAG_KEY = 'axiom_inventory_seeded'
const TOMBSTONES_KEY = 'axiom_inventory_tombstones'

// ─────────────────── Tombstone tracking (prevents deletes from being re-fetched) ───────────────────

interface Tombstone { id: string; deletedAt: number }
const TOMBSTONE_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days

function loadTombstones(): Tombstone[] {
  try {
    const raw = localStorage.getItem(TOMBSTONES_KEY)
    if (!raw) return []
    const items: Tombstone[] = JSON.parse(raw)
    // Cleanup expired
    const now = Date.now()
    return items.filter((t) => now - t.deletedAt < TOMBSTONE_TTL)
  } catch { return [] }
}

function addTombstone(id: string) {
  const items = loadTombstones()
  if (!items.find((t) => t.id === id)) {
    items.push({ id, deletedAt: Date.now() })
    localStorage.setItem(TOMBSTONES_KEY, JSON.stringify(items))
  }
}

export type MovementType = 'IN' | 'OUT' | 'ADJUST'
export type StockStatus = 'OK' | 'LOW' | 'OUT'
export type InventoryCategory = 'PLA' | 'PETG' | 'ABS' | 'TPU' | 'Resin' | 'Nylon' | 'Hardware' | 'Finished'

export const CATEGORIES: InventoryCategory[] = ['PLA', 'PETG', 'ABS', 'TPU', 'Resin', 'Nylon', 'Hardware', 'Finished']

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

// ─────────────────────── localStorage helpers ───────────────────────

function loadProducts(): InventoryProduct[] {
  try {
    const stored = localStorage.getItem(PRODUCTS_KEY)
    if (stored) return JSON.parse(stored)
  } catch { /* ignore */ }
  return []
}

function saveProducts(products: InventoryProduct[]) {
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products))
}

function loadMovements(): StockMovement[] {
  try {
    const stored = localStorage.getItem(MOVEMENTS_KEY)
    if (stored) return JSON.parse(stored)
  } catch { /* ignore */ }
  return []
}

function saveMovements(movements: StockMovement[]) {
  localStorage.setItem(MOVEMENTS_KEY, JSON.stringify(movements))
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
  if (!isSupabaseConfigured) return
  try {
    const [{ data: prods, error: pe }, { data: moves, error: me }] = await Promise.all([
      supabase.from('inventory_products').select('*').order('created_at', { ascending: false }),
      supabase.from('stock_movements').select('*').order('created_at', { ascending: false }),
    ])

    if (pe) console.error('[inventory] fetch products:', pe)
    if (me) console.error('[inventory] fetch movements:', me)

    // Filter out tombstoned (deleted) items
    const tombstonedIds = new Set(loadTombstones().map((t) => t.id))
    const productsClean = prods ? (prods as SbProduct[]).filter((p) => !tombstonedIds.has(p.id)) : []
    const movementsClean = moves ? (moves as SbMovement[]).filter((m) => !tombstonedIds.has(m.product_id)) : []

    // Cleanup: try to delete any tombstoned items that still exist remotely
    if (prods) {
      for (const p of prods as SbProduct[]) {
        if (tombstonedIds.has(p.id)) sbDeleteProduct(p.id)
      }
    }

    const hasProducts = productsClean.length > 0
    const hasMovements = movementsClean.length > 0
    const hasBeenSeeded = localStorage.getItem(SEEDED_FLAG_KEY) === '1'

    if (hasProducts) {
      const products = productsClean.map(rowToProduct)
      saveProducts(products)
      useInventoryStore.setState({ products })
    } else if (!hasBeenSeeded) {
      // Seed only on the very first load (never re-seed after deletions)
      const local = loadProducts()
      if (local.length === 0) {
        console.log('[inventory] Seeding initial inventory data')
        const seeded = getSeedProducts()
        saveProducts(seeded)
        useInventoryStore.setState({ products: seeded })
        for (const p of seeded) sbUpsertProduct(p)

        const seededMovements = getSeedMovements(seeded)
        saveMovements(seededMovements)
        useInventoryStore.setState({ movements: seededMovements })
        for (const m of seededMovements) sbInsertMovement(m)
        localStorage.setItem(SEEDED_FLAG_KEY, '1')
        return
      } else {
        for (const p of local) sbUpsertProduct(p)
      }
    }

    if (hasMovements) {
      const movements = movementsClean.map(rowToMovement)
      saveMovements(movements)
      useInventoryStore.setState({ movements })
    } else {
      const local = loadMovements()
      if (local.length > 0) {
        for (const m of local) sbInsertMovement(m)
      }
    }
  } catch (err) {
    console.error('[inventory] fetch error:', err)
  }
}

// ─────────────────────── Seed data ──────────────────────────────────

function getSeedProducts(): InventoryProduct[] {
  const now = new Date().toISOString()
  const items: Omit<InventoryProduct, 'id' | 'createdAt' | 'updatedAt'>[] = [
    { partNumber: 'POLY-PLA-GAL-1KG', name: 'Polymaker PolyLite PLA Galaxy Black 1kg', category: 'PLA', brand: 'Polymaker', cost: 18.50, price: 32.00, reorderLevel: 5, bin: 'A-01-1', barcode: '4710881830001', supplier: 'Polymaker EU', archived: false },
    { partNumber: 'BAMB-PETG-BLK-1KG', name: 'Bambu Lab PETG HF Jet Black 1kg', category: 'PETG', brand: 'Bambu Lab', cost: 21.00, price: 38.00, reorderLevel: 4, bin: 'A-02-1', barcode: '4710881830002', supplier: 'Bambu Lab EU', archived: false },
    { partNumber: 'PRUSA-PLA-ORG-1KG', name: 'Prusament PLA Prusa Orange 1kg', category: 'PLA', brand: 'Prusament', cost: 24.90, price: 42.00, reorderLevel: 4, bin: 'A-01-2', barcode: '4710881830003', supplier: 'Prusa Research', archived: false },
    { partNumber: 'ESUN-ABS-WHT-1KG', name: 'eSUN ABS+ Cold White 1kg', category: 'ABS', brand: 'eSUN', cost: 19.50, price: 34.00, reorderLevel: 6, bin: 'A-03-1', barcode: '4710881830004', supplier: 'eSUN', archived: false },
    { partNumber: 'OVRT-TPU-BLK-500', name: 'Overture TPU 95A Black 500g', category: 'TPU', brand: 'Overture', cost: 14.00, price: 28.00, reorderLevel: 8, bin: 'A-04-1', barcode: '4710881830005', supplier: 'Overture', archived: false },
    { partNumber: 'ANY-RES-GRY-1L', name: 'Anycubic Craftsman Resin Grey 1L', category: 'Resin', brand: 'Anycubic', cost: 28.00, price: 49.00, reorderLevel: 5, bin: 'B-01-1', barcode: '4710881830006', supplier: 'Anycubic', archived: false },
    { partNumber: 'ELG-RES-BLK-1L', name: 'Elegoo Standard Resin Black 1L', category: 'Resin', brand: 'Elegoo', cost: 22.00, price: 39.00, reorderLevel: 6, bin: 'B-01-2', barcode: '4710881830007', supplier: 'Elegoo', archived: false },
    { partNumber: 'SIRAYA-RES-CLR-1L', name: 'Siraya Tech Blu Tough Resin Clear 1L', category: 'Resin', brand: 'Siraya Tech', cost: 38.00, price: 65.00, reorderLevel: 3, bin: 'B-02-1', barcode: '4710881830008', supplier: 'Siraya Tech', archived: false },
    { partNumber: 'E3D-NOZ-04-BRS', name: 'E3D V6 Nozzle Brass 0.4mm', category: 'Hardware', brand: 'E3D', cost: 3.50, price: 9.00, reorderLevel: 20, bin: 'C-01-1', barcode: '4710881830009', supplier: 'E3D Online', archived: false },
    { partNumber: 'E3D-NOZ-06-HRD', name: 'E3D Nozzle X Hardened 0.6mm', category: 'Hardware', brand: 'E3D', cost: 18.00, price: 32.00, reorderLevel: 10, bin: 'C-01-2', barcode: '4710881830010', supplier: 'E3D Online', archived: false },
    { partNumber: 'QIDI-BLD-PEI-X', name: 'QIDI Plus4 PEI Build Plate Textured', category: 'Hardware', brand: 'QIDI', cost: 45.00, price: 75.00, reorderLevel: 3, bin: 'C-02-1', barcode: '4710881830011', supplier: 'QIDI Tech', archived: false },
    { partNumber: 'SUN-PLA-SLK-1KG', name: 'SUNLU Silk PLA Rainbow 1kg', category: 'PLA', brand: 'SUNLU', cost: 16.50, price: 29.00, reorderLevel: 6, bin: 'A-01-3', barcode: '4710881830012', supplier: 'SUNLU', archived: false },
    { partNumber: 'FLSN-CF-PA-500', name: 'Fillamentum CF Nylon 500g', category: 'Nylon', brand: 'Fillamentum', cost: 58.00, price: 95.00, reorderLevel: 3, bin: 'A-05-1', barcode: '4710881830013', supplier: 'Fillamentum', archived: false },
    { partNumber: 'AXM-PRT-VASE-01', name: 'Finished Print · Hex Vase Large', category: 'Finished', brand: 'Axiom', cost: 4.50, price: 45.00, reorderLevel: 3, bin: 'D-01-1', archived: false },
    { partNumber: 'AXM-PRT-DESK-02', name: 'Finished Print · Desk Cable Manager', category: 'Finished', brand: 'Axiom', cost: 2.80, price: 22.00, reorderLevel: 5, bin: 'D-01-2', archived: false },
  ]

  // Seed prices are gross (incl. VAT); convert to net (ex. VAT) for storage.
  return items.map((item, i) => ({
    ...item,
    price: Math.round((item.price / 1.19) * 100) / 100,
    id: `inv-${Date.now()}-${i.toString().padStart(3, '0')}`,
    createdAt: now,
    updatedAt: now,
  }))
}

function getSeedMovements(products: InventoryProduct[]): StockMovement[] {
  const movements: StockMovement[] = []
  const now = Date.now()
  let counter = 0

  const addMove = (p: InventoryProduct, type: MovementType, qty: number, ref: string, daysAgo: number) => {
    counter++
    const d = new Date(now - daysAgo * 86400000)
    movements.push({
      id: `mov-${d.getTime()}-${counter.toString().padStart(3, '0')}`,
      productId: p.id,
      type,
      qty,
      unitCost: p.cost,
      reference: ref,
      createdAt: d.toISOString(),
    })
  }

  // Most products get IN stock first
  products.forEach((p, i) => {
    const initial = p.reorderLevel + 5 + (i % 3) * 3
    addMove(p, 'IN', initial, `PO-26-${String(60 + i).padStart(4, '0')}`, 28 - i)
  })

  // Some OUT movements
  addMove(products[0], 'OUT', 3, 'JOB-3601', 15)
  addMove(products[0], 'OUT', 4, 'JOB-3612', 8)
  addMove(products[1], 'OUT', 2, 'JOB-3605', 12)
  addMove(products[2], 'OUT', 3, 'JOB-3619', 4)
  addMove(products[3], 'OUT', 5, 'JOB-3622', 2)
  addMove(products[4], 'OUT', 6, 'JOB-3625', 1)
  addMove(products[5], 'OUT', 4, 'SALE-1170', 7)
  addMove(products[6], 'OUT', 5, 'SALE-1175', 3)
  addMove(products[8], 'OUT', 15, 'MAINT-0120', 5)
  addMove(products[9], 'OUT', 8, 'MAINT-0121', 2)

  // Drive 2 products LOW and 1 OUT
  addMove(products[4], 'OUT', 10, 'JOB-3630', 0) // TPU now very low
  addMove(products[7], 'OUT', 3, 'PROD-0025', 1) // Siraya low

  // An ADJUST
  addMove(products[5], 'ADJUST', -2, 'MAINT-0125', 3)

  return movements.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

// ─────────────────────── Store ──────────────────────────────────────

export const useInventoryStore = create<InventoryState>((set, get) => {
  fetchFromSupabase()

  return {
    products: loadProducts(),
    movements: loadMovements(),

    addProduct: (data) => {
      const id = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const now = new Date().toISOString()
      const product: InventoryProduct = { ...data, id, createdAt: now, updatedAt: now }
      set((state) => {
        const products = [product, ...state.products]
        saveProducts(products)
        return { products }
      })
      sbUpsertProduct(product)
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
        saveProducts(products)
        return { products }
      })
      if (updated && isSupabaseConfigured) {
        const row = partialProductToRow({ ...updates, updatedAt: updated.updatedAt })
        supabase.from('inventory_products').update(row).eq('id', id).then(({ error }) => {
          if (error) console.error('[inventory] update:', error)
        })
      }
      if (updated) useAuditLogStore.getState().log('update', 'product', `Inventory: "${updated.partNumber}" updated`)
    },

    deleteProduct: (id) => {
      const p = get().products.find((x) => x.id === id)
      if (p) useAuditLogStore.getState().log('delete', 'product', `Inventory: "${p.partNumber}" deleted`)
      // Add tombstone first so even if Supabase delete is slow, the item won't reappear on refresh
      addTombstone(id)
      set((state) => {
        const products = state.products.filter((x) => x.id !== id)
        saveProducts(products)
        return { products }
      })
      sbDeleteProduct(id)
    },

    addMovement: (data) => {
      const id = `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const movement: StockMovement = { ...data, id, createdAt: new Date().toISOString() }
      set((state) => {
        const movements = [movement, ...state.movements]
        saveMovements(movements)
        return { movements }
      })
      sbInsertMovement(movement)
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
