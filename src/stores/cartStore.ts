import { create } from 'zustand'
import type { Product, CartItem } from '@/types'

// Dedup key includes the chosen filament + color so a customer can have
// "Topology №7 in PETG/Forest" + "Topology №7 in PLA/Carbon" as two
// distinct cart lines. Empty variants → key collapses to just the productId
// so non-variant products keep their pre-variant behaviour.
function lineKey(productId: number, filament?: string, color?: string): string {
  return `${productId}:${filament || ''}:${color || ''}`
}

/** Add filament's extra €  on top of the base product price for a single unit. */
export function unitPriceFor(item: CartItem): number {
  const base = item.product.price
  if (!item.chosenFilament || !item.product.filaments?.length) return base
  const fil = item.product.filaments.find((f) => f.name === item.chosenFilament)
  return base + (fil?.extra_eur ?? 0)
}

interface AddItemArgs {
  product: Product
  quantity?: number
  chosenFilament?: string
  chosenColor?: string
}

interface CartState {
  items: CartItem[]
  isOpen: boolean
  badgeBounce: boolean
  /** Backwards-compatible single-arg overload still works for non-variant products. */
  addItem: (productOrArgs: Product | AddItemArgs) => void
  removeItem: (key: string) => void
  updateQuantity: (key: string, quantity: number) => void
  clearCart: () => void
  toggleCart: () => void
  openCart: () => void
  closeCart: () => void
  getTotal: () => number
  getItemCount: () => number
  /** Compute the cart-line key for a given item (used by UI for stable React keys). */
  keyFor: (item: CartItem) => string
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  isOpen: false,
  badgeBounce: false,

  addItem: (input) => {
    // Normalise both call shapes into a structured args object.
    const args: AddItemArgs =
      'product' in (input as AddItemArgs)
        ? (input as AddItemArgs)
        : { product: input as Product }

    const qty = Math.max(1, args.quantity ?? 1)
    const key = lineKey(args.product.id, args.chosenFilament, args.chosenColor)

    set((state) => {
      const existing = state.items.find(
        (i) => lineKey(i.product.id, i.chosenFilament, i.chosenColor) === key,
      )
      if (existing) {
        return {
          items: state.items.map((i) =>
            lineKey(i.product.id, i.chosenFilament, i.chosenColor) === key
              ? { ...i, quantity: i.quantity + qty }
              : i,
          ),
          badgeBounce: true,
        }
      }
      const newItem: CartItem = {
        product: args.product,
        quantity: qty,
        chosenFilament: args.chosenFilament,
        chosenColor: args.chosenColor,
      }
      return { items: [...state.items, newItem], badgeBounce: true }
    })
    setTimeout(() => set({ badgeBounce: false }), 400)
  },

  removeItem: (key) =>
    set((state) => ({
      items: state.items.filter((i) => lineKey(i.product.id, i.chosenFilament, i.chosenColor) !== key),
    })),

  updateQuantity: (key, quantity) =>
    set((state) => ({
      items:
        quantity <= 0
          ? state.items.filter((i) => lineKey(i.product.id, i.chosenFilament, i.chosenColor) !== key)
          : state.items.map((i) =>
              lineKey(i.product.id, i.chosenFilament, i.chosenColor) === key ? { ...i, quantity } : i,
            ),
    })),

  clearCart: () => set({ items: [] }),
  toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),
  openCart: () => set({ isOpen: true }),
  closeCart: () => set({ isOpen: false }),

  getTotal: () => get().items.reduce((sum, i) => sum + unitPriceFor(i) * i.quantity, 0),
  getItemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
  keyFor: (item) => lineKey(item.product.id, item.chosenFilament, item.chosenColor),
}))
