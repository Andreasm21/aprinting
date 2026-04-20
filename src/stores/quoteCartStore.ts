import { create } from 'zustand'

const STORAGE_KEY = 'axiom_quote_cart'

export type CartSource = 'inventory' | 'product'

export interface QuoteCartItem {
  source: CartSource
  productId: string
  partNumber?: string
  description: string
  unitPrice: number
  quantity: number
  material?: string
}

interface QuoteCartState {
  items: QuoteCartItem[]
  isOpen: boolean
  addItem: (item: Omit<QuoteCartItem, 'quantity'> & { quantity?: number }) => void
  updateQuantity: (productId: string, qty: number) => void
  removeItem: (productId: string) => void
  clearCart: () => void
  openCart: () => void
  closeCart: () => void
  toggleCart: () => void
}

function load(): QuoteCartItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch { /* ignore */ }
  return []
}

function save(items: QuoteCartItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export const useQuoteCartStore = create<QuoteCartState>((set, get) => ({
  items: load(),
  isOpen: false,

  addItem: (item) => {
    set((state) => {
      const existing = state.items.find((i) => i.productId === item.productId && i.source === item.source)
      let items: QuoteCartItem[]
      if (existing) {
        items = state.items.map((i) =>
          i.productId === item.productId && i.source === item.source
            ? { ...i, quantity: i.quantity + (item.quantity || 1) }
            : i
        )
      } else {
        items = [...state.items, { ...item, quantity: item.quantity || 1 }]
      }
      save(items)
      return { items }
    })
  },

  updateQuantity: (productId, qty) => {
    set((state) => {
      const items = state.items.map((i) =>
        i.productId === productId ? { ...i, quantity: Math.max(1, qty) } : i
      )
      save(items)
      return { items }
    })
  },

  removeItem: (productId) => {
    set((state) => {
      const items = state.items.filter((i) => i.productId !== productId)
      save(items)
      return { items }
    })
  },

  clearCart: () => {
    save([])
    set({ items: [], isOpen: false })
  },

  openCart: () => set({ isOpen: true }),
  closeCart: () => set({ isOpen: false }),
  toggleCart: () => set({ isOpen: !get().isOpen }),
}))
