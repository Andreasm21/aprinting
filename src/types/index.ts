export interface Product {
  id: number
  name: string
  nameGr: string
  category: 'fdm' | 'resin' | 'custom' | 'accessories'
  material: string
  price: number
  description: string
  descriptionGr: string
  badge?: string
  inStock: boolean
  modelUrl?: string
  imageUrl?: string
}

export interface CartItem {
  product: Product
  quantity: number
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
