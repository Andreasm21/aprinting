import { create } from 'zustand'

const STORAGE_KEY = 'aprinting_customers'

export type AccountType = 'individual' | 'business'
export type PaymentTerms = 'immediate' | 'net15' | 'net30' | 'net60'
export type DiscountTier = 'none' | 'silver' | 'gold' | 'platinum'

export const DISCOUNT_RATES: Record<DiscountTier, number> = {
  none: 0,
  silver: 5,
  gold: 10,
  platinum: 15,
}

export interface Customer {
  id: string
  accountType: AccountType
  name: string
  email: string
  phone: string
  company?: string
  vatNumber?: string
  address?: string
  city?: string
  postalCode?: string
  billingAddress?: string
  billingCity?: string
  billingPostalCode?: string
  paymentTerms?: PaymentTerms
  discountTier?: DiscountTier
  notes?: string
  tags: string[]
  totalOrders: number
  totalSpent: number
  createdAt: string
  lastOrderAt?: string
}

interface CustomersState {
  customers: Customer[]
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'totalOrders' | 'totalSpent'>) => void
  updateCustomer: (id: string, updates: Partial<Customer>) => void
  deleteCustomer: (id: string) => void
  recordOrder: (email: string, name: string, phone: string, amount: number, address?: string, city?: string, postalCode?: string) => void
  getCustomerByEmail: (email: string) => Customer | undefined
  getCustomerById: (id: string) => Customer | undefined
}

function migrate(customer: Record<string, unknown>): Customer {
  const c = customer as unknown as Customer
  if (!c.accountType) {
    c.accountType = (c.company && c.vatNumber) ? 'business' : 'individual'
  }
  return c
}

function load(): Customer[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as Record<string, unknown>[]
      return parsed.map(migrate)
    }
  } catch { /* ignore */ }
  return []
}

function save(customers: Customer[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customers))
}

export const useCustomersStore = create<CustomersState>((set, get) => ({
  customers: load(),

  addCustomer: (data) => {
    const customer: Customer = {
      ...data,
      id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      totalOrders: 0,
      totalSpent: 0,
    }
    set((state) => {
      const customers = [customer, ...state.customers]
      save(customers)
      return { customers }
    })
  },

  updateCustomer: (id, updates) => {
    set((state) => {
      const customers = state.customers.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      )
      save(customers)
      return { customers }
    })
  },

  deleteCustomer: (id) => {
    set((state) => {
      const customers = state.customers.filter((c) => c.id !== id)
      save(customers)
      return { customers }
    })
  },

  recordOrder: (email, name, phone, amount, address, city, postalCode) => {
    const existing = get().customers.find((c) => c.email.toLowerCase() === email.toLowerCase())
    if (existing) {
      set((state) => {
        const customers = state.customers.map((c) =>
          c.id === existing.id
            ? {
                ...c,
                name: name || c.name,
                phone: phone || c.phone,
                address: address || c.address,
                city: city || c.city,
                postalCode: postalCode || c.postalCode,
                totalOrders: c.totalOrders + 1,
                totalSpent: c.totalSpent + amount,
                lastOrderAt: new Date().toISOString(),
              }
            : c
        )
        save(customers)
        return { customers }
      })
    } else {
      const customer: Customer = {
        id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        accountType: 'individual',
        name,
        email,
        phone,
        address,
        city,
        postalCode,
        tags: [],
        totalOrders: 1,
        totalSpent: amount,
        createdAt: new Date().toISOString(),
        lastOrderAt: new Date().toISOString(),
      }
      set((state) => {
        const customers = [customer, ...state.customers]
        save(customers)
        return { customers }
      })
    }
  },

  getCustomerByEmail: (email) => {
    return get().customers.find((c) => c.email.toLowerCase() === email.toLowerCase())
  },

  getCustomerById: (id) => {
    return get().customers.find((c) => c.id === id)
  },
}))
