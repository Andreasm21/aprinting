import { create } from 'zustand'
import type { Language, FilterCategory } from '@/types'

interface AppState {
  language: Language
  activeFilter: FilterCategory
  checkoutStep: number
  showCheckout: boolean
  mobileMenuOpen: boolean
  setLanguage: (lang: Language) => void
  toggleLanguage: () => void
  setFilter: (filter: FilterCategory) => void
  setCheckoutStep: (step: number) => void
  openCheckout: () => void
  closeCheckout: () => void
  setMobileMenuOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  language: 'en',
  activeFilter: 'all',
  checkoutStep: 1,
  showCheckout: false,
  mobileMenuOpen: false,

  setLanguage: (lang) => set({ language: lang }),
  toggleLanguage: () =>
    set((state) => ({ language: state.language === 'en' ? 'gr' : 'en' })),
  setFilter: (filter) => set({ activeFilter: filter }),
  setCheckoutStep: (step) => set({ checkoutStep: step }),
  openCheckout: () => set({ showCheckout: true, checkoutStep: 1 }),
  closeCheckout: () => set({ showCheckout: false, checkoutStep: 1 }),
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
}))
