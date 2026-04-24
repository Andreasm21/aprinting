import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useActivitiesStore } from './activitiesStore'
import { useAuditLogStore } from './auditLogStore'

export type AccountType = 'individual' | 'business'
export type PaymentTerms = 'immediate' | 'net15' | 'net30' | 'net60'
export type DiscountTier = 'none' | 'silver' | 'gold' | 'platinum'

export const DISCOUNT_RATES: Record<DiscountTier, number> = {
  none: 0,
  silver: 5,
  gold: 10,
  platinum: 15,
}

export interface ExtraContact {
  name: string
  email: string
  phone?: string
  role?: string
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
  extraContacts?: ExtraContact[]
  totalOrders: number
  totalSpent: number
  passwordHash?: string
  portalEnabled?: boolean
  lastLoginAt?: string
  createdAt: string
  lastOrderAt?: string
}

interface CustomersState {
  customers: Customer[]
  loading: boolean
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'totalOrders' | 'totalSpent'>) => void
  updateCustomer: (id: string, updates: Partial<Customer>) => void
  deleteCustomer: (id: string) => void
  recordOrder: (email: string, name: string, phone: string, amount: number, address?: string, city?: string, postalCode?: string) => void
  getCustomerByEmail: (email: string) => Customer | undefined
  getCustomerById: (id: string) => Customer | undefined
}

// ---------------------------------------------------------------------------
// camelCase <-> snake_case conversion helpers
// ---------------------------------------------------------------------------

type SupabaseCustomerRow = {
  id: string
  account_type: string
  name: string
  email: string
  phone: string
  company: string | null
  vat_number: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  billing_address: string | null
  billing_city: string | null
  billing_postal_code: string | null
  payment_terms: string | null
  discount_tier: string | null
  notes: string | null
  tags: string[] | null
  extra_contacts: ExtraContact[] | null
  total_orders: number
  total_spent: number
  password_hash: string | null
  portal_enabled: boolean
  last_login_at: string | null
  created_at: string
  last_order_at: string | null
}

function toSupabaseRow(c: Customer): SupabaseCustomerRow {
  return {
    id: c.id,
    account_type: c.accountType,
    name: c.name,
    email: c.email,
    phone: c.phone,
    company: c.company ?? null,
    vat_number: c.vatNumber ?? null,
    address: c.address ?? null,
    city: c.city ?? null,
    postal_code: c.postalCode ?? null,
    billing_address: c.billingAddress ?? null,
    billing_city: c.billingCity ?? null,
    billing_postal_code: c.billingPostalCode ?? null,
    payment_terms: c.paymentTerms ?? null,
    discount_tier: c.discountTier ?? null,
    notes: c.notes ?? null,
    tags: c.tags,
    extra_contacts: c.extraContacts ?? null,
    total_orders: c.totalOrders,
    total_spent: c.totalSpent,
    password_hash: c.passwordHash ?? null,
    portal_enabled: c.portalEnabled ?? false,
    last_login_at: c.lastLoginAt ?? null,
    created_at: c.createdAt,
    last_order_at: c.lastOrderAt ?? null,
  }
}

function fromSupabaseRow(row: SupabaseCustomerRow): Customer {
  return {
    id: row.id,
    accountType: (row.account_type ?? 'individual') as AccountType,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company ?? undefined,
    vatNumber: row.vat_number ?? undefined,
    address: row.address ?? undefined,
    city: row.city ?? undefined,
    postalCode: row.postal_code ?? undefined,
    billingAddress: row.billing_address ?? undefined,
    billingCity: row.billing_city ?? undefined,
    billingPostalCode: row.billing_postal_code ?? undefined,
    paymentTerms: (row.payment_terms as PaymentTerms) ?? undefined,
    discountTier: (row.discount_tier as DiscountTier) ?? undefined,
    notes: row.notes ?? undefined,
    tags: row.tags ?? [],
    extraContacts: row.extra_contacts ?? undefined,
    totalOrders: row.total_orders ?? 0,
    totalSpent: Number(row.total_spent) ?? 0,
    passwordHash: row.password_hash ?? undefined,
    portalEnabled: row.portal_enabled ?? false,
    lastLoginAt: row.last_login_at ?? undefined,
    createdAt: row.created_at,
    lastOrderAt: row.last_order_at ?? undefined,
  }
}

/** Convert a partial Customer update into a partial Supabase row. */
function partialToSupabaseRow(updates: Partial<Customer>): Record<string, unknown> {
  const map: Record<string, string> = {
    id: 'id',
    accountType: 'account_type',
    name: 'name',
    email: 'email',
    phone: 'phone',
    company: 'company',
    vatNumber: 'vat_number',
    address: 'address',
    city: 'city',
    postalCode: 'postal_code',
    billingAddress: 'billing_address',
    billingCity: 'billing_city',
    billingPostalCode: 'billing_postal_code',
    paymentTerms: 'payment_terms',
    discountTier: 'discount_tier',
    notes: 'notes',
    tags: 'tags',
    extraContacts: 'extra_contacts',
    totalOrders: 'total_orders',
    totalSpent: 'total_spent',
    passwordHash: 'password_hash',
    portalEnabled: 'portal_enabled',
    lastLoginAt: 'last_login_at',
    createdAt: 'created_at',
    lastOrderAt: 'last_order_at',
  }
  const row: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(updates)) {
    const snakeKey = map[key]
    if (snakeKey) {
      row[snakeKey] = value ?? null
    }
  }
  return row
}

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------

async function supabaseUpsert(customer: Customer) {
  if (!isSupabaseConfigured) return
  const { error } = await supabase
    .from('customers')
    .upsert(toSupabaseRow(customer), { onConflict: 'id' })
  if (error) console.error('[customers] Supabase upsert failed:', error)
}

async function supabaseDelete(id: string) {
  if (!isSupabaseConfigured) return
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)
  if (error) console.error('[customers] Supabase delete failed:', error)
}

async function fetchFromSupabase(
  set: (fn: (state: CustomersState) => Partial<CustomersState>) => void,
) {
  set(() => ({ loading: true }))
  if (!isSupabaseConfigured) {
    set(() => ({ loading: false }))
    return
  }
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
    if (error) {
      console.error('[customers] Supabase fetch failed:', error)
      set(() => ({ loading: false }))
      return
    }
    const rows = (data || []) as SupabaseCustomerRow[]
    const customers = rows.map(fromSupabaseRow)
    set(() => ({ customers, loading: false }))
  } catch (err) {
    console.error('[customers] Supabase fetch error:', err)
    set(() => ({ loading: false }))
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useCustomersStore = create<CustomersState>((set, get) => {
  // Kick off initial Supabase fetch
  fetchFromSupabase(set)

  return {
    customers: [],
    loading: true,

    addCustomer: async (data) => {
      const customer: Customer = {
        ...data,
        id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
        totalOrders: 0,
        totalSpent: 0,
      }
      set((state) => ({ customers: [customer, ...state.customers] }))
      await supabaseUpsert(customer)
      // Auto-log activity
      useActivitiesStore.getState().addActivity({
        customerId: customer.id,
        type: 'note',
        title: 'Customer account created',
        description: `${customer.accountType === 'business' ? 'Business' : 'Individual'} account`,
        metadata: {},
      })
      useAuditLogStore.getState().log('create', 'customer', `Customer "${customer.name}" created`, customer.email)
    },

    updateCustomer: async (id, updates) => {
      set((state) => ({
        customers: state.customers.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        ),
      }))
      if (isSupabaseConfigured) {
        const row = partialToSupabaseRow(updates)
        const { error } = await supabase
          .from('customers')
          .update(row)
          .eq('id', id)
        if (error) console.error('[customers] Supabase update failed:', error)
      }
      const c = get().customers.find((c) => c.id === id)
      if (c) useAuditLogStore.getState().log('update', 'customer', `Customer "${c.name}" updated`, '', updates as Record<string, unknown>)
    },

    deleteCustomer: async (id) => {
      const c = get().customers.find((c) => c.id === id)
      if (c) useAuditLogStore.getState().log('delete', 'customer', `Customer "${c.name}" deleted`, c.email)
      set((state) => ({
        customers: state.customers.filter((c) => c.id !== id),
      }))
      await supabaseDelete(id)
    },

    recordOrder: async (email, name, phone, amount, address, city, postalCode) => {
      const existing = get().customers.find((c) => c.email.toLowerCase() === email.toLowerCase())
      if (existing) {
        const updatedCustomer: Customer = {
          ...existing,
          name: name || existing.name,
          phone: phone || existing.phone,
          address: address || existing.address,
          city: city || existing.city,
          postalCode: postalCode || existing.postalCode,
          totalOrders: existing.totalOrders + 1,
          totalSpent: existing.totalSpent + amount,
          lastOrderAt: new Date().toISOString(),
        }
        set((state) => ({
          customers: state.customers.map((c) =>
            c.id === existing.id ? updatedCustomer : c
          ),
        }))
        await supabaseUpsert(updatedCustomer)
        // Auto-log activity
        useActivitiesStore.getState().addActivity({
          customerId: existing.id,
          type: 'order',
          title: `Order placed — €${amount.toFixed(2)}`,
          description: '',
          metadata: { amount },
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
        set((state) => ({ customers: [customer, ...state.customers] }))
        await supabaseUpsert(customer)
      }
    },

    getCustomerByEmail: (email) => {
      return get().customers.find((c) => c.email.toLowerCase() === email.toLowerCase())
    },

    getCustomerById: (id) => {
      return get().customers.find((c) => c.id === id)
    },
  }
})
