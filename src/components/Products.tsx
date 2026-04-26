// Storefront catalog grid.
//
// The card + quick-view modal logic now lives in dedicated files
// (ProductCard.tsx / QuickViewModal.tsx) so they can also power the
// product page. This component is just the section frame: title, filter
// chips, grid wiring, and the modal mount.

import { useState } from 'react'
import { useTranslation } from '@/hooks/useTranslation'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import { useAppStore } from '@/stores/appStore'
import { useContentStore } from '@/stores/contentStore'
import ProductCard from '@/components/ProductCard'
import QuickViewModal from '@/components/QuickViewModal'
import type { FilterCategory, Product } from '@/types'

export default function Products() {
  const t = useTranslation()
  const ref = useScrollReveal<HTMLElement>()
  const { activeFilter, setFilter } = useAppStore()
  const products = useContentStore((s) => s.products)
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null)

  const filters: { key: FilterCategory; label: string }[] = [
    { key: 'all', label: t.products.all },
    { key: 'fdm', label: t.products.fdm },
    { key: 'resin', label: t.products.resin },
    { key: 'custom', label: t.products.custom },
  ]

  const filtered = activeFilter === 'all' ? products : products.filter((p) => p.category === activeFilter)

  return (
    <section id="products" ref={ref} className="py-20 md:py-28 bg-bg-secondary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 reveal">
          <h2 className="section-title">
            <span className="section-title-amber">{t.products.title}</span>
          </h2>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap justify-center gap-2 mb-10 reveal">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`font-mono text-xs px-4 py-2 rounded-full border transition-all duration-200 ${
                activeFilter === f.key
                  ? 'bg-accent-amber text-bg-primary border-accent-amber'
                  : 'border-border text-text-secondary hover:border-accent-amber hover:text-accent-amber'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((product, i) => (
            <div key={product.id} className="reveal" style={{ transitionDelay: `${i * 50}ms` }}>
              <ProductCard
                product={product}
                onQuickView={(p) => setQuickViewProduct(p)}
              />
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-text-muted text-sm font-mono">
            No products in this category yet.
          </div>
        )}
      </div>

      {/* Quick View Modal — shared component, same as product page UI primitives */}
      <QuickViewModal product={quickViewProduct} onClose={() => setQuickViewProduct(null)} />
    </section>
  )
}
