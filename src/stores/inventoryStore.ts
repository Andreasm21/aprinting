import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuditLogStore } from './auditLogStore'
import { useNotificationsStore } from './notificationsStore'
import { useAdminAuthStore } from './adminAuthStore'
import { useContentStore } from './contentStore'
import { sendEmail } from '@/lib/emailClient'
import { lowStockAlertEmail } from '@/lib/emailTemplates'
import { useEmailLogStore } from './emailLogStore'

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
  | string          // user-defined custom categories

export const FILAMENT_CATEGORIES = ['PLA', 'PETG', 'ABS', 'TPU', 'Resin', 'Nylon'] as const
const DEFAULT_FILAMENT_UNIT_GRAMS = 1000

export const CATEGORIES: string[] = [
  'PLA', 'PETG', 'ABS', 'TPU', 'Resin', 'Nylon',
  'Tools', 'Spare Parts', 'Consumables', 'Equipment', 'Packaging',
  'Hardware', 'Finished',
]

const CUSTOM_CATEGORIES_KEY = 'inventory_custom_categories'

export function getCustomCategories(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_CATEGORIES_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function saveCustomCategory(name: string): void {
  const existing = getCustomCategories()
  if (!existing.includes(name)) {
    localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify([...existing, name]))
  }
}

export function isFilamentCategory(category: string): boolean {
  return (FILAMENT_CATEGORIES as readonly string[]).includes(category)
}

export function getUnitWeightGrams(product: Pick<InventoryProduct, 'category' | 'unitWeightGrams'>): number {
  if (!isFilamentCategory(product.category)) return 1
  return product.unitWeightGrams && product.unitWeightGrams > 0
    ? product.unitWeightGrams
    : DEFAULT_FILAMENT_UNIT_GRAMS
}

export function storageQtyToDisplay(
  product: Pick<InventoryProduct, 'category' | 'unitWeightGrams'>,
  qty: number,
): number {
  return isFilamentCategory(product.category) ? qty / getUnitWeightGrams(product) : qty
}

export function displayQtyToStorage(category: string, qty: number): number {
  return isFilamentCategory(category) ? qty * DEFAULT_FILAMENT_UNIT_GRAMS : qty
}

export function getStockUnitLabel(productOrCategory: Pick<InventoryProduct, 'category'> | string): 'kg' | 'pcs' {
  const category = typeof productOrCategory === 'string' ? productOrCategory : productOrCategory.category
  return isFilamentCategory(category) ? 'kg' : 'pcs'
}

export function getStorageUnitLabel(productOrCategory: Pick<InventoryProduct, 'category'> | string): 'g' | 'pcs' {
  const category = typeof productOrCategory === 'string' ? productOrCategory : productOrCategory.category
  return isFilamentCategory(category) ? 'g' : 'pcs'
}

export function formatStockQty(
  product: Pick<InventoryProduct, 'category' | 'unitWeightGrams'>,
  qty: number,
): string {
  const displayQty = storageQtyToDisplay(product, qty)
  if (isFilamentCategory(product.category)) {
    return `${displayQty.toLocaleString('en-GB', { maximumFractionDigits: 3 })} kg`
  }
  return `${displayQty.toLocaleString('en-GB', { maximumFractionDigits: 0 })} pcs`
}

export function getStockUnitCost(
  product: Pick<InventoryProduct, 'category' | 'cost' | 'unitWeightGrams'>,
): number {
  return isFilamentCategory(product.category) ? product.cost / getUnitWeightGrams(product) : product.cost
}

export function getStockLineValue(
  product: Pick<InventoryProduct, 'category' | 'cost' | 'unitWeightGrams'>,
  storageQty: number,
): number {
  return storageQty * getStockUnitCost(product)
}

export function getMovementValue(
  product: Pick<InventoryProduct, 'category' | 'cost' | 'unitWeightGrams'> | undefined,
  movement: Pick<StockMovement, 'qty' | 'unitCost'>,
): number {
  if (!product) return movement.qty * movement.unitCost
  if (!isFilamentCategory(product.category)) return movement.qty * movement.unitCost

  const correctUnitCost = getStockUnitCost(product)
  // Older filament IN movements were sometimes saved as kg × €/kg while qty
  // was already grams. If the movement unit cost is clearly not €/g, value it
  // as kg-priced stock so reports do not explode by 1000x.
  if (movement.unitCost > correctUnitCost * 10) {
    return storageQtyToDisplay(product, movement.qty) * movement.unitCost
  }
  return movement.qty * movement.unitCost
}

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
  // Auto-deduct material consumed by an accepted quote. Records an OUT
  // movement and triggers a low-stock alert if the on-hand qty crosses
  // below the per-product reorderLevel (or the global low-stock %).
  consumeMaterial: (partNumber: string, grams: number, reference?: string) => Promise<void>
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
    unitWeightGrams: r.unit_weight_grams != null ? Number(r.unit_weight_grams) : undefined,
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
          `Stock ${data.type}: ${formatStockQty(p, data.qty)} × ${p.partNumber}`,
          data.reference || ''
        )
      }
      return id
    },

    consumeMaterial: async (partNumber, grams, reference) => {
      if (!grams || grams <= 0) return
      const product = get().products.find((p) => p.partNumber === partNumber)
      if (!product) {
        console.warn('[inventory] consumeMaterial: no product matches', partNumber)
        return
      }
      const qtyBefore = get().getQtyOnHand(product.id)
      // unitCost recorded on the OUT movement = cost per gram so reports show
      // the COGS portion correctly.
      const unitCost = getStockUnitCost(product)
      get().addMovement({
        productId: product.id,
        type: 'OUT',
        qty: grams,
        unitCost,
        reference: reference || 'Quote accepted',
        notes: `Auto-deducted ${grams}g for ${reference || 'accepted quote'}`,
      })
      const qtyAfter = qtyBefore - grams

      // Compute the threshold: per-product reorderLevel wins, else the
      // global low-stock % of the total stocked-in (sum of all IN movements).
      const totalIn = get().movements
        .filter((m) => m.productId === product.id && m.type === 'IN')
        .reduce((sum, m) => sum + m.qty, 0)
      const pct = useContentStore.getState().content.printPricing.lowStockPercent ?? 20
      const threshold = product.reorderLevel > 0
        ? product.reorderLevel
        : totalIn * (pct / 100)

      // Only fire when this movement CROSSED the threshold (was above, now
      // at-or-below). Avoids spamming alerts while stock is already low.
      if (qtyBefore > threshold && qtyAfter <= threshold) {
        const unit = getStockUnitLabel(product)
        // 1) In-app notification
        void useNotificationsStore.getState().addAdminAlert({
          kind: 'other',
          title: `[LOW STOCK] ${product.partNumber} — ${product.name}`,
          message: `${formatStockQty(product, qtyAfter)} left (threshold ${formatStockQty(product, threshold)}). Time to reorder.`,
          context: { customerName: product.name },
        })
        // 2) Email to admins
        const adminEmails = useAdminAuthStore.getState().users
          .map((u) => u.email)
          .filter((e): e is string => !!e && e.includes('@'))
        const recipients = adminEmails.length > 0
          ? Array.from(new Set([...adminEmails, 'team@axiomcreate.com']))
          : ['team@axiomcreate.com']
        const inventoryUrl = `${window.location.origin}/admin/inventory/products`
        const tmpl = lowStockAlertEmail({
          items: [{
            partNumber: product.partNumber,
            name: product.name,
            category: product.category,
            qtyOnHand: storageQtyToDisplay(product, qtyAfter),
            threshold: storageQtyToDisplay(product, threshold),
            unit,
          }],
          inventoryUrl,
        })
        const res = await sendEmail({
          to: recipients,
          subject: tmpl.subject,
          html: tmpl.html,
          text: tmpl.text,
        })
        await useEmailLogStore.getState().log({
          to: recipients,
          subject: tmpl.subject,
          template: 'custom',
          status: res.success ? 'sent' : 'failed',
          error: res.error,
          sentBy: 'system',
        })
      }
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
