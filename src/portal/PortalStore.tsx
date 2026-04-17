import { useState, useMemo } from 'react'
import { Package, Search, Tag } from 'lucide-react'
import { useContentStore } from '@/stores/contentStore'
import { usePortalAuthStore } from '@/stores/portalAuthStore'
import { DISCOUNT_RATES } from '@/stores/customersStore'
import { CYPRUS_VAT_RATE } from '@/stores/invoicesStore'
import type { FilterCategory } from '@/types'

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  fdm: 'FDM',
  resin: 'Resin',
  custom: 'Custom',
  accessories: 'Accessories',
}

function removeVat(price: number): number {
  return price / (1 + CYPRUS_VAT_RATE)
}

export default function PortalStore() {
  const products = useContentStore((s) => s.products)
  const pricing = useContentStore((s) => s.content.pricing)
  const customer = usePortalAuthStore((s) => s.customer)

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<FilterCategory>('all')

  const discountPercent = customer?.discountTier ? DISCOUNT_RATES[customer.discountTier] : 0

  const filtered = useMemo(() => {
    return products
      .filter((p) => p.inStock)
      .filter((p) => category === 'all' || p.category === category)
      .filter((p) => {
        if (!search) return true
        const q = search.toLowerCase()
        return p.name.toLowerCase().includes(q) || p.material.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      })
  }, [products, category, search])

  const categories: FilterCategory[] = ['all', 'fdm', 'resin', 'custom', 'accessories']
  const categoryCounts = useMemo(() => {
    const inStock = products.filter((p) => p.inStock)
    return {
      all: inStock.length,
      fdm: inStock.filter((p) => p.category === 'fdm').length,
      resin: inStock.filter((p) => p.category === 'resin').length,
      custom: inStock.filter((p) => p.category === 'custom').length,
      accessories: inStock.filter((p) => p.category === 'accessories').length,
    }
  }, [products])

  return (
    <div>
      <h1 className="font-mono text-2xl font-bold text-text-primary mb-1">Store</h1>
      <p className="text-text-secondary text-sm mb-1">
        Browse our products. All prices shown are <span className="text-accent-amber font-bold">excluding VAT</span>.
      </p>
      {discountPercent > 0 && (
        <p className="text-accent-green text-xs font-mono mb-4">
          Your {customer?.discountTier} tier discount of {discountPercent}% is applied to prices below.
        </p>
      )}
      {!discountPercent && <div className="mb-4" />}

      {/* Search + Category filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="input-field pl-9 text-sm py-2"
          />
        </div>
        <div className="flex gap-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`text-xs font-mono px-3 py-2 rounded-lg border transition-all ${
                category === cat
                  ? 'border-accent-amber text-accent-amber bg-accent-amber/5'
                  : 'border-border text-text-muted hover:text-text-secondary'
              }`}
            >
              {CATEGORY_LABELS[cat]}
              <span className="ml-1 opacity-60">{categoryCounts[cat]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Products grid */}
      {filtered.length === 0 ? (
        <div className="card-base p-10 text-center">
          <Package size={32} className="mx-auto text-text-muted/20 mb-3" />
          <p className="text-text-muted text-sm font-mono">No products found</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((product) => {
            const exVat = removeVat(product.price)
            const afterDiscount = discountPercent > 0 ? exVat * (1 - discountPercent / 100) : exVat

            return (
              <div key={product.id} className="card-base p-5 flex flex-col">
                {/* Image */}
                {product.imageUrl && (
                  <div className="w-full h-40 rounded-lg overflow-hidden mb-4 bg-bg-tertiary">
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                  </div>
                )}

                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-mono text-sm font-bold text-text-primary leading-tight">{product.name}</h3>
                  {product.badge && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-accent-amber/10 text-accent-amber border border-accent-amber/20 shrink-0">
                      {product.badge}
                    </span>
                  )}
                </div>

                {/* Material & category */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted">
                    {product.category}
                  </span>
                  <span className="text-xs text-text-muted">{product.material}</span>
                </div>

                {/* Description */}
                <p className="text-text-secondary text-xs leading-relaxed mb-4 flex-1 line-clamp-2">{product.description}</p>

                {/* Price */}
                <div className="border-t border-border pt-3 mt-auto">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[10px] text-text-muted uppercase font-mono">Price (ex. VAT)</p>
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-lg font-bold text-accent-amber">€{afterDiscount.toFixed(2)}</span>
                        {discountPercent > 0 && (
                          <span className="font-mono text-xs text-text-muted line-through">€{exVat.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                    {discountPercent > 0 && (
                      <span className="flex items-center gap-1 text-[10px] font-mono text-accent-green bg-accent-green/10 px-2 py-0.5 rounded-full border border-accent-green/20">
                        <Tag size={8} /> -{discountPercent}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Material pricing table */}
      <div className="mt-8 grid sm:grid-cols-2 gap-4">
        <div className="card-base p-5">
          <h3 className="font-mono text-xs text-text-muted uppercase tracking-wider mb-3">FDM Material Rates (ex. VAT)</h3>
          <div className="space-y-2">
            {pricing.fdm.map((row, i) => {
              const price = parseFloat(row.price.replace('€', ''))
              const exVat = removeVat(price)
              return (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-text-primary">{row.material}</span>
                  <span className="font-mono text-accent-amber">€{exVat.toFixed(4)}/g</span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="card-base p-5">
          <h3 className="font-mono text-xs text-text-muted uppercase tracking-wider mb-3">Resin Rates (ex. VAT)</h3>
          <div className="space-y-2">
            {pricing.resin.map((row, i) => {
              const price = parseFloat(row.price.replace('€', ''))
              const exVat = removeVat(price)
              return (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-text-primary">{row.type}</span>
                  <span className="font-mono text-accent-amber">€{exVat.toFixed(4)}/g</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
