import { create } from 'zustand'
import type { Product } from '@/types'
import { products as defaultProducts } from '@/data/products'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuditLogStore } from './auditLogStore'

export interface SiteContent {
  hero: {
    tagline: string
    taglineGr: string
    subtitle: string
    subtitleGr: string
    stat1: string
    stat2: string
    stat3: string
  }
  services: {
    fdm: { title: string; description: string; descriptionGr: string; badge: string }
    resin: { title: string; description: string; descriptionGr: string; badge: string }
    prototyping: { title: string; description: string; descriptionGr: string; badge: string }
  }
  about: {
    p1: string
    p1Gr: string
    p2: string
    p2Gr: string
    printsVal: string
    customersVal: string
    yearsVal: string
    materialsVal: string
  }
  contact: {
    whatsappNumber: string
    email: string
    location: string
    hours: string
  }
  pricing: {
    fdm: { material: string; price: string; min: string }[]
    resin: { type: string; price: string; min: string }[]
    designRate: string
  }
  printPricing: {
    electricityRate: number       // €/kWh
    labourRate: number            // €/hr
    depreciationRate: number      // €/hr
    profitMarkup: number          // % (e.g. 30 = +30% on top of COGS)
    defaultPowerDraw: number      // kW
    defaultLabourHours: number    // hours of human work per job (default)
  }
}

const defaultContent: SiteContent = {
  hero: {
    tagline: 'From Digital to Physical',
    taglineGr: 'Από το Ψηφιακό στο Φυσικό',
    subtitle: 'Professional FDM & Resin 3D printing in Cyprus. Custom prints, prototypes, and ready-made products — delivered to your door.',
    subtitleGr: 'Επαγγελματική 3D εκτύπωση FDM & Resin στην Κύπρο. Εξατομικευμένες εκτυπώσεις, πρωτότυπα και έτοιμα προϊόντα — παράδοση στην πόρτα σας.',
    stat1: '500+ Prints Delivered',
    stat2: '2 Printer Technologies',
    stat3: 'Cyprus-wide Delivery',
  },
  services: {
    fdm: {
      title: 'FDM Printing',
      description: 'PLA, PETG, TPU materials. Large build volume. Functional parts, enclosures, tools, and home items.',
      descriptionGr: 'Υλικά PLA, PETG, TPU. Μεγάλος όγκος εκτύπωσης. Λειτουργικά εξαρτήματα, θήκες, εργαλεία.',
      badge: 'From €0.05/g',
    },
    resin: {
      title: 'Resin Printing',
      description: 'Ultra-high detail. Miniatures, jewelry molds, dental models, engineering prototypes. Smooth surface finish.',
      descriptionGr: 'Εξαιρετική λεπτομέρεια. Μινιατούρες, καλούπια κοσμημάτων, οδοντιατρικά μοντέλα, πρωτότυπα.',
      badge: 'From €0.12/g',
    },
    prototyping: {
      title: 'Prototyping',
      description: 'Rapid iteration for businesses, startups, and inventors. From concept to physical part in 24-48 hours.',
      descriptionGr: 'Γρήγορη ανάπτυξη για επιχειρήσεις και εφευρέτες. Από ιδέα σε φυσικό αντικείμενο σε 24-48 ώρες.',
      badge: 'Custom Quote',
    },
  },
  about: {
    p1: "We're a Cyprus-based 3D printing studio driven by a passion for making. Whether you're a startup building a prototype, a hobbyist bringing ideas to life, or a business needing production parts — we've got you covered.",
    p1Gr: 'Είμαστε ένα στούντιο 3D εκτύπωσης στην Κύπρο με πάθος για τη δημιουργία. Είτε είστε startup, χομπίστας ή επιχείρηση — είμαστε εδώ για εσάς.',
    p2: "With both FDM and resin printing technologies, we deliver quality prints with fast turnaround. Every project gets our full attention, from file optimization to post-processing.",
    p2Gr: 'Με τεχνολογίες FDM και ρητίνης, παραδίδουμε ποιοτικές εκτυπώσεις με γρήγορη ανταπόκριση. Κάθε έργο λαμβάνει την πλήρη προσοχή μας.',
    printsVal: '500+',
    customersVal: '120+',
    yearsVal: '3+',
    materialsVal: '8+',
  },
  contact: {
    whatsappNumber: '+357 99 000 000',
    email: 'team@axiomcreate.com',
    location: 'Cyprus 🇨🇾',
    hours: 'Mon – Sat: 9:00 – 19:00',
  },
  pricing: {
    fdm: [
      { material: 'PLA', price: '€0.08', min: '€5' },
      { material: 'PETG', price: '€0.10', min: '€6' },
      { material: 'ABS', price: '€0.08', min: '€5' },
      { material: 'ASA', price: '€0.10', min: '€6' },
      { material: 'TPU (Flexible)', price: '€0.15', min: '€8' },
      { material: 'Nylon / PA', price: '€0.25', min: '€10' },
      { material: 'PPS-CF', price: '€0.65', min: '€25' },
    ],
    resin: [
      { type: 'Standard', price: '€0.06', min: '€8' },
      { type: 'High-Detail / 8K', price: '€0.10', min: '€10' },
      { type: 'Tough / ABS-Like', price: '€0.10', min: '€10' },
      { type: 'Flexible', price: '€0.22', min: '€12' },
      { type: 'Castable / Dental', price: '€0.40', min: '€20' },
    ],
    designRate: '€15',
  },
  printPricing: {
    electricityRate: 0.32,
    labourRate: 7,
    depreciationRate: 0.30,
    profitMarkup: 30,
    defaultPowerDraw: 0.45,
    defaultLabourHours: 1,
  },
}

interface ContentState {
  products: Product[]
  content: SiteContent
  loading: boolean
  addProduct: (product: Omit<Product, 'id'>) => void
  updateProduct: (id: number, product: Partial<Product>) => void
  deleteProduct: (id: number) => void
  updateContent: (section: keyof SiteContent, data: Record<string, unknown>) => void
  updatePricingRow: (table: 'fdm' | 'resin', index: number, data: Record<string, string>) => void
  addPricingRow: (table: 'fdm' | 'resin') => void
  deletePricingRow: (table: 'fdm' | 'resin', index: number) => void
  resetAll: () => void
}

// ─────────────── Supabase converters: storefront_products ───────────────

interface SbProductRow {
  id: number
  name: string
  name_gr: string | null
  category: string
  material: string | null
  price: number
  description: string | null
  description_gr: string | null
  badge: string | null
  in_stock: boolean
  model_url: string | null
  image_url: string | null
  created_at: string
  updated_at: string
}

function productToRow(p: Product): Omit<SbProductRow, 'created_at' | 'updated_at'> {
  return {
    id: p.id,
    name: p.name,
    name_gr: p.nameGr ?? null,
    category: p.category,
    material: p.material ?? null,
    price: p.price,
    description: p.description ?? null,
    description_gr: p.descriptionGr ?? null,
    badge: p.badge ?? null,
    in_stock: p.inStock,
    model_url: p.modelUrl ?? null,
    image_url: p.imageUrl ?? null,
  }
}

function rowToProduct(r: SbProductRow): Product {
  return {
    id: r.id,
    name: r.name,
    nameGr: r.name_gr ?? '',
    category: (r.category || 'fdm') as Product['category'],
    material: r.material ?? '',
    price: Number(r.price),
    description: r.description ?? '',
    descriptionGr: r.description_gr ?? '',
    badge: r.badge ?? undefined,
    inStock: r.in_stock,
    modelUrl: r.model_url ?? undefined,
    imageUrl: r.image_url ?? undefined,
  }
}

// ─────────────── Supabase ops ───────────────

async function sbFetchProducts(): Promise<Product[]> {
  if (!isSupabaseConfigured) return []
  try {
    const { data, error } = await supabase
      .from('storefront_products')
      .select('*')
      .order('id', { ascending: true })
    if (error) {
      console.error('[content] fetch products:', error)
      return []
    }
    return ((data || []) as SbProductRow[]).map(rowToProduct)
  } catch (err) {
    console.error('[content]', err)
    return []
  }
}

async function sbUpsertProduct(p: Product) {
  if (!isSupabaseConfigured) return
  try {
    const { error } = await supabase.from('storefront_products').upsert(productToRow(p), { onConflict: 'id' })
    if (error) console.error('[content] upsert product:', error)
  } catch (err) { console.error('[content]', err) }
}

async function sbDeleteProduct(id: number) {
  if (!isSupabaseConfigured) return
  try {
    const { error } = await supabase.from('storefront_products').delete().eq('id', id)
    if (error) console.error('[content] delete product:', error)
  } catch (err) { console.error('[content]', err) }
}

async function sbBulkUpsertProducts(products: Product[]) {
  if (!isSupabaseConfigured) return
  try {
    const rows = products.map(productToRow)
    const { error } = await supabase.from('storefront_products').upsert(rows, { onConflict: 'id' })
    if (error) console.error('[content] bulk upsert products:', error)
  } catch (err) { console.error('[content]', err) }
}

async function sbFetchContent(): Promise<SiteContent | null> {
  if (!isSupabaseConfigured) return null
  try {
    const { data, error } = await supabase
      .from('site_content')
      .select('data')
      .eq('id', 'singleton')
      .maybeSingle()
    if (error) {
      console.error('[content] fetch content:', error)
      return null
    }
    if (!data) return null
    return data.data as SiteContent
  } catch (err) {
    console.error('[content]', err)
    return null
  }
}

async function sbUpsertContent(content: SiteContent) {
  if (!isSupabaseConfigured) return
  try {
    const { error } = await supabase
      .from('site_content')
      .upsert({ id: 'singleton', data: content, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (error) console.error('[content] upsert content:', error)
  } catch (err) { console.error('[content]', err) }
}

// ─────────────── Initial fetch ───────────────

async function fetchAll() {
  useContentStore.setState({ loading: true })
  try {
    const [content, products] = await Promise.all([sbFetchContent(), sbFetchProducts()])

    // If site_content is empty, seed it with defaults
    let resolvedContent: SiteContent
    if (content) {
      // Merge with defaults to fill in any new fields added since last save
      resolvedContent = { ...defaultContent, ...content }
    } else {
      resolvedContent = defaultContent
      sbUpsertContent(defaultContent) // seed (fire and forget)
    }

    // If storefront_products is empty, seed it with defaults
    let resolvedProducts = products
    if (products.length === 0) {
      resolvedProducts = defaultProducts
      sbBulkUpsertProducts(defaultProducts) // seed (fire and forget)
    }

    useContentStore.setState({ content: resolvedContent, products: resolvedProducts, loading: false })
  } catch (err) {
    console.error('[content] fetchAll error:', err)
    useContentStore.setState({ loading: false })
  }
}

// ─────────────── Store ───────────────

export const useContentStore = create<ContentState>((set, get) => {
  return {
    products: defaultProducts, // shown until Supabase fetch completes
    content: defaultContent,
    loading: true,

    addProduct: (product) => {
      const maxId = Math.max(0, ...get().products.map((p) => p.id))
      const newProduct: Product = { ...product, id: maxId + 1 }
      set((state) => ({ products: [...state.products, newProduct] }))
      void sbUpsertProduct(newProduct)
      useAuditLogStore.getState().log('create', 'product', `Product "${product.name}" added`)
    },

    updateProduct: (id, updates) => {
      const p = get().products.find((p) => p.id === id)
      let updated: Product | undefined
      set((state) => ({
        products: state.products.map((p) => {
          if (p.id !== id) return p
          updated = { ...p, ...updates }
          return updated
        }),
      }))
      if (updated) void sbUpsertProduct(updated)
      if (p) useAuditLogStore.getState().log('update', 'product', `Product "${p.name}" updated`)
    },

    deleteProduct: (id) => {
      const p = get().products.find((p) => p.id === id)
      set((state) => ({ products: state.products.filter((p) => p.id !== id) }))
      void sbDeleteProduct(id)
      if (p) useAuditLogStore.getState().log('delete', 'product', `Product "${p.name}" deleted`)
    },

    updateContent: (section, data) => {
      let newContent: SiteContent | undefined
      set((state) => {
        newContent = {
          ...state.content,
          [section]: { ...state.content[section], ...data },
        }
        return { content: newContent }
      })
      if (newContent) void sbUpsertContent(newContent)
      useAuditLogStore.getState().log('update', 'content', `${String(section)} section updated`)
    },

    updatePricingRow: (table, index, data) => {
      let newContent: SiteContent | undefined
      set((state) => {
        const rows = [...state.content.pricing[table]]
        rows[index] = { ...rows[index], ...data }
        newContent = {
          ...state.content,
          pricing: { ...state.content.pricing, [table]: rows },
        }
        return { content: newContent }
      })
      if (newContent) void sbUpsertContent(newContent)
    },

    addPricingRow: (table) => {
      let newContent: SiteContent | undefined
      set((state) => {
        const newRow = table === 'fdm'
          ? { material: 'New Material', price: '€0.00', min: '€0' }
          : { type: 'New Type', price: '€0.00', min: '€0' }
        const rows = [...state.content.pricing[table], newRow]
        newContent = {
          ...state.content,
          pricing: { ...state.content.pricing, [table]: rows },
        }
        return { content: newContent }
      })
      if (newContent) void sbUpsertContent(newContent)
    },

    deletePricingRow: (table, index) => {
      let newContent: SiteContent | undefined
      set((state) => {
        const rows = state.content.pricing[table].filter((_, i) => i !== index)
        newContent = {
          ...state.content,
          pricing: { ...state.content.pricing, [table]: rows },
        }
        return { content: newContent }
      })
      if (newContent) void sbUpsertContent(newContent)
    },

    resetAll: () => {
      set({ products: defaultProducts, content: defaultContent })
      void sbUpsertContent(defaultContent)
      void sbBulkUpsertProducts(defaultProducts)
      useAuditLogStore.getState().log('reset', 'system', 'All data reset to defaults')
    },
  }
})

// Kick off initial Supabase fetch AFTER the store is fully assigned (avoids TDZ).
void fetchAll()
