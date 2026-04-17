import { create } from 'zustand'
import bcrypt from 'bcryptjs'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { Customer } from './customersStore'

const SESSION_KEY = 'axiom_portal_auth'

interface PortalAuthState {
  customer: Customer | null
  isAuthenticated: boolean
  loading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  checkSession: () => void
  refreshCustomer: () => Promise<void>
}

export const usePortalAuthStore = create<PortalAuthState>((set, get) => ({
  customer: null,
  isAuthenticated: false,
  loading: true,

  login: async (email, password) => {
    // Try Supabase first
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('email', email.toLowerCase())
          .eq('portal_enabled', true)
          .limit(1)
          .single()

        if (error || !data) {
          return { success: false, error: 'Invalid email or password' }
        }

        if (!data.password_hash) {
          return { success: false, error: 'Portal access not configured. Contact your admin.' }
        }

        const valid = await bcrypt.compare(password, data.password_hash)
        if (!valid) {
          return { success: false, error: 'Invalid email or password' }
        }

        // Build customer object from Supabase row
        const customer: Customer = {
          id: data.id,
          accountType: data.account_type || 'individual',
          name: data.name,
          email: data.email,
          phone: data.phone || '',
          company: data.company || undefined,
          vatNumber: data.vat_number || undefined,
          address: data.address || undefined,
          city: data.city || undefined,
          postalCode: data.postal_code || undefined,
          billingAddress: data.billing_address || undefined,
          billingCity: data.billing_city || undefined,
          billingPostalCode: data.billing_postal_code || undefined,
          paymentTerms: data.payment_terms || undefined,
          discountTier: data.discount_tier || undefined,
          notes: data.notes || undefined,
          tags: data.tags || [],
          totalOrders: data.total_orders || 0,
          totalSpent: Number(data.total_spent) || 0,
          portalEnabled: true,
          passwordHash: data.password_hash,
          lastLoginAt: new Date().toISOString(),
          createdAt: data.created_at,
          lastOrderAt: data.last_order_at || undefined,
        }

        // Update last login
        supabase.from('customers').update({ last_login_at: new Date().toISOString() }).eq('id', data.id).then(() => {})

        // Save session
        try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: customer.id, email: customer.email })) } catch {}

        set({ customer, isAuthenticated: true, loading: false })
        return { success: true }
      } catch (err) {
        console.error('[portal] Login error:', err)
        return { success: false, error: 'Connection error. Try again.' }
      }
    }

    // Fallback: check localStorage customers
    try {
      const stored = localStorage.getItem('aprinting_customers')
      if (stored) {
        const customers: Customer[] = JSON.parse(stored)
        const found = customers.find((c) => c.email.toLowerCase() === email.toLowerCase() && c.portalEnabled)
        if (found && found.passwordHash) {
          const valid = await bcrypt.compare(password, found.passwordHash)
          if (valid) {
            try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: found.id, email: found.email })) } catch {}
            set({ customer: found, isAuthenticated: true, loading: false })
            return { success: true }
          }
        }
      }
    } catch {}

    return { success: false, error: 'Invalid email or password' }
  },

  logout: () => {
    try { sessionStorage.removeItem(SESSION_KEY) } catch {}
    set({ customer: null, isAuthenticated: false, loading: false })
  },

  checkSession: () => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY)
      if (!stored) {
        set({ loading: false })
        return
      }
      const { id } = JSON.parse(stored)

      // Restore from Supabase
      if (isSupabaseConfigured) {
        supabase
          .from('customers')
          .select('*')
          .eq('id', id)
          .eq('portal_enabled', true)
          .single()
          .then(({ data }) => {
            if (data) {
              const customer: Customer = {
                id: data.id,
                accountType: data.account_type || 'individual',
                name: data.name,
                email: data.email,
                phone: data.phone || '',
                company: data.company || undefined,
                vatNumber: data.vat_number || undefined,
                address: data.address || undefined,
                city: data.city || undefined,
                postalCode: data.postal_code || undefined,
                billingAddress: data.billing_address || undefined,
                billingCity: data.billing_city || undefined,
                billingPostalCode: data.billing_postal_code || undefined,
                paymentTerms: data.payment_terms || undefined,
                discountTier: data.discount_tier || undefined,
                tags: data.tags || [],
                totalOrders: data.total_orders || 0,
                totalSpent: Number(data.total_spent) || 0,
                portalEnabled: true,
                createdAt: data.created_at,
                lastOrderAt: data.last_order_at || undefined,
              }
              set({ customer, isAuthenticated: true, loading: false })
            } else {
              sessionStorage.removeItem(SESSION_KEY)
              set({ loading: false })
            }
          })
          .then(undefined, () => set({ loading: false }))
        return
      }

      // Fallback: localStorage
      const customers: Customer[] = JSON.parse(localStorage.getItem('aprinting_customers') || '[]')
      const found = customers.find((c) => c.id === id && c.portalEnabled)
      if (found) {
        set({ customer: found, isAuthenticated: true, loading: false })
      } else {
        sessionStorage.removeItem(SESSION_KEY)
        set({ loading: false })
      }
    } catch {
      set({ loading: false })
    }
  },

  refreshCustomer: async () => {
    const current = get().customer
    if (!current || !isSupabaseConfigured) return
    try {
      const { data } = await supabase.from('customers').select('*').eq('id', current.id).single()
      if (data) {
        const customer: Customer = {
          ...current,
          totalOrders: data.total_orders || 0,
          totalSpent: Number(data.total_spent) || 0,
        }
        set({ customer })
      }
    } catch {}
  },
}))
