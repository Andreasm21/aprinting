export interface ProductFilament {
  name: string
  /** Extra €  added on top of the base price when this filament is chosen */
  extra_eur: number
}

export interface ProductColor {
  hex: string   // e.g. '#F59E0B'
  name: string  // e.g. 'Axiom Amber'
}

/** Per-product specs grid (label → value). Free-form JSONB so admin can
 *  add whatever rows make sense for each product. Common keys:
 *    dimensions_mm, weight_g, layer_height_mm, print_time, infill_pct, edition
 */
export type ProductSpecs = Record<string, string | number>

export interface Product {
  id: number
  name: string
  nameGr: string
  /** URL slug for /p/:slug routing. Auto-generated from name on insert. */
  slug?: string
  /** Optional collection grouping, e.g. 'Topology Series' */
  collection?: string
  /** Optional series number within the collection */
  seriesNo?: number
  category: 'fdm' | 'resin' | 'custom' | 'accessories'
  material: string
  price: number
  description: string
  descriptionGr: string
  badge?: string
  inStock: boolean
  /** Free-text shipping estimate, e.g. '3–5 days' */
  shipsIn?: string
  modelUrl?: string  // .stl or .glb — auto-detected by extension
  imageUrl?: string
  /** Variant arrays (empty = no variant choice on this product) */
  filaments?: ProductFilament[]
  colors?: ProductColor[]
  specs?: ProductSpecs
}

export interface CartItem {
  product: Product
  quantity: number
  /** Customer's chosen filament (must be one of product.filaments names) */
  chosenFilament?: string
  /** Customer's chosen color (must be one of product.colors hex values) */
  chosenColor?: string
}

export type Language = 'en' | 'gr'

export type FilterCategory = 'all' | 'fdm' | 'resin' | 'custom' | 'accessories'

export interface CheckoutStep {
  step: 1 | 2 | 3 | 4
}

export interface CustomerInfo {
  name: string
  email: string
  phone: string
  deliveryType: 'delivery' | 'pickup'
  address: string
  city: string
  postalCode: string
}

export interface PortfolioItem {
  id: number
  title: string
  description: string
  material: string
  technology: 'FDM' | 'Resin'
  tags: string[]
}
