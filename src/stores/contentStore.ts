import { create } from 'zustand'
import type { Product } from '@/types'
import { products as defaultProducts } from '@/data/products'

const STORAGE_KEY_PRODUCTS = 'aprinting_products'
const STORAGE_KEY_CONTENT = 'aprinting_content'

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
    email: 'hello@axiom3d.cy',
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
}

function loadProducts(): Product[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PRODUCTS)
    if (stored) return JSON.parse(stored)
  } catch { /* ignore */ }
  return defaultProducts
}

function loadContent(): SiteContent {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_CONTENT)
    if (stored) return { ...defaultContent, ...JSON.parse(stored) }
  } catch { /* ignore */ }
  return defaultContent
}

interface ContentState {
  products: Product[]
  content: SiteContent
  addProduct: (product: Omit<Product, 'id'>) => void
  updateProduct: (id: number, product: Partial<Product>) => void
  deleteProduct: (id: number) => void
  updateContent: (section: keyof SiteContent, data: Record<string, unknown>) => void
  updatePricingRow: (table: 'fdm' | 'resin', index: number, data: Record<string, string>) => void
  addPricingRow: (table: 'fdm' | 'resin') => void
  deletePricingRow: (table: 'fdm' | 'resin', index: number) => void
  resetAll: () => void
}

export const useContentStore = create<ContentState>((set, get) => ({
  products: loadProducts(),
  content: loadContent(),

  addProduct: (product) => {
    const maxId = Math.max(0, ...get().products.map((p) => p.id))
    const newProduct = { ...product, id: maxId + 1 }
    set((state) => {
      const products = [...state.products, newProduct]
      localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(products))
      return { products }
    })
  },

  updateProduct: (id, updates) => {
    set((state) => {
      const products = state.products.map((p) => (p.id === id ? { ...p, ...updates } : p))
      localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(products))
      return { products }
    })
  },

  deleteProduct: (id) => {
    set((state) => {
      const products = state.products.filter((p) => p.id !== id)
      localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(products))
      return { products }
    })
  },

  updateContent: (section, data) => {
    set((state) => {
      const content = {
        ...state.content,
        [section]: { ...state.content[section], ...data },
      }
      localStorage.setItem(STORAGE_KEY_CONTENT, JSON.stringify(content))
      return { content }
    })
  },

  updatePricingRow: (table, index, data) => {
    set((state) => {
      const rows = [...state.content.pricing[table]]
      rows[index] = { ...rows[index], ...data }
      const content = {
        ...state.content,
        pricing: { ...state.content.pricing, [table]: rows },
      }
      localStorage.setItem(STORAGE_KEY_CONTENT, JSON.stringify(content))
      return { content }
    })
  },

  addPricingRow: (table) => {
    set((state) => {
      const newRow = table === 'fdm'
        ? { material: 'New Material', price: '€0.00', min: '€0' }
        : { type: 'New Type', price: '€0.00', min: '€0' }
      const rows = [...state.content.pricing[table], newRow]
      const content = {
        ...state.content,
        pricing: { ...state.content.pricing, [table]: rows },
      }
      localStorage.setItem(STORAGE_KEY_CONTENT, JSON.stringify(content))
      return { content }
    })
  },

  deletePricingRow: (table, index) => {
    set((state) => {
      const rows = state.content.pricing[table].filter((_, i) => i !== index)
      const content = {
        ...state.content,
        pricing: { ...state.content.pricing, [table]: rows },
      }
      localStorage.setItem(STORAGE_KEY_CONTENT, JSON.stringify(content))
      return { content }
    })
  },

  resetAll: () => {
    localStorage.removeItem(STORAGE_KEY_PRODUCTS)
    localStorage.removeItem(STORAGE_KEY_CONTENT)
    set({ products: defaultProducts, content: defaultContent })
  },
}))
