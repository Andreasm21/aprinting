import { useState, useEffect, useCallback } from 'react'
import { ShoppingCart, Check, Box, X, ZoomIn, Minus, Plus, ChevronLeft, ChevronRight, Layers, Tag } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import { useCartStore } from '@/stores/cartStore'
import { useAppStore } from '@/stores/appStore'
import { useContentStore } from '@/stores/contentStore'
import ModelViewer from '@/components/ModelViewer'
import type { FilterCategory, Product } from '@/types'

function ProductCard({ product, onQuickView }: { product: Product; onQuickView: () => void }) {
  const [added, setAdded] = useState(false)
  const t = useTranslation()
  const language = useAppStore((s) => s.language)
  const addItem = useCartStore((s) => s.addItem)

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation()
    addItem(product)
    setAdded(true)
    setTimeout(() => setAdded(false), 1200)
  }

  const name = language === 'gr' ? product.nameGr : product.name
  const description = language === 'gr' ? product.descriptionGr : product.description

  return (
    <div
      className="card-base card-hover group flex flex-col cursor-pointer"
      onClick={onQuickView}
    >
      {/* Image / 3D model */}
      <div className="relative bg-bg-tertiary rounded-md h-44 mb-4 flex items-center justify-center overflow-hidden">
        {product.modelUrl ? (
          <ModelViewer src={product.modelUrl} alt={name} />
        ) : product.imageUrl ? (
          <img src={product.imageUrl} alt={name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <Box size={48} className="text-text-muted/30" />
        )}
        {product.badge && (
          <span className="absolute top-2 right-2 font-accent text-xs bg-accent-amber text-bg-primary px-2 py-0.5 rounded">
            {product.badge}
          </span>
        )}
        {/* Quick view overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
          <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm text-white text-xs font-mono px-3 py-1.5 rounded-full border border-white/20">
            <ZoomIn size={14} /> Quick View
          </span>
        </div>
      </div>

      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="font-mono text-sm font-bold text-text-primary leading-tight">{name}</h3>
        <span className="font-accent text-lg font-bold text-accent-amber whitespace-nowrap">€{product.price}</span>
      </div>

      <span className="inline-block font-accent text-xs text-text-muted border border-border rounded px-1.5 py-0.5 w-fit mb-2">
        {product.material}
      </span>

      <p className="text-text-secondary text-xs leading-relaxed mb-4 flex-1 line-clamp-2">{description}</p>

      <div className="flex items-center justify-between mt-auto">
        <span className={`text-xs font-accent flex items-center gap-1 ${product.inStock ? 'text-accent-green' : 'text-red-400'}`}>
          <span className={`w-1.5 h-1.5 rounded-full inline-block ${product.inStock ? 'bg-accent-green' : 'bg-red-400'}`} />
          {product.inStock ? t.products.inStock : (language === 'gr' ? 'Εξαντλημένο' : 'Out of Stock')}
        </span>

        <button
          onClick={handleAdd}
          disabled={!product.inStock}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-bold transition-all duration-200 ${
            added
              ? 'bg-accent-green text-bg-primary'
              : product.inStock
              ? 'bg-accent-amber text-bg-primary hover:shadow-[0_0_12px_rgba(245,158,11,0.4)]'
              : 'bg-bg-tertiary text-text-muted cursor-not-allowed'
          }`}
        >
          {added ? <Check size={14} /> : <ShoppingCart size={14} />}
          {added ? t.products.added : t.products.addToCart}
        </button>
      </div>
    </div>
  )
}

function QuickViewModal({
  product,
  products,
  onClose,
  onNavigate,
}: {
  product: Product
  products: Product[]
  onClose: () => void
  onNavigate: (product: Product) => void
}) {
  const [added, setAdded] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const t = useTranslation()
  const language = useAppStore((s) => s.language)
  const addItem = useCartStore((s) => s.addItem)

  const name = language === 'gr' ? product.nameGr : product.name
  const description = language === 'gr' ? product.descriptionGr : product.description

  const currentIndex = products.findIndex((p) => p.id === product.id)
  const prevProduct = currentIndex > 0 ? products[currentIndex - 1] : null
  const nextProduct = currentIndex < products.length - 1 ? products[currentIndex + 1] : null

  const handleAdd = () => {
    for (let i = 0; i < quantity; i++) {
      addItem(product)
    }
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'ArrowLeft' && prevProduct) onNavigate(prevProduct)
    if (e.key === 'ArrowRight' && nextProduct) onNavigate(nextProduct)
  }, [onClose, onNavigate, prevProduct, nextProduct])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  // Reset quantity when product changes
  useEffect(() => {
    setQuantity(1)
    setAdded(false)
  }, [product.id])

  const categoryLabel = {
    fdm: 'FDM Print',
    resin: 'Resin Print',
    custom: 'Custom',
    accessories: 'Accessory',
  }[product.category]

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-bg-secondary border border-border rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-fade-in relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-bg-primary/80 backdrop-blur-sm border border-border hover:border-accent-amber text-text-muted hover:text-text-primary transition-all"
        >
          <X size={18} />
        </button>

        {/* Nav arrows */}
        {prevProduct && (
          <button
            onClick={() => onNavigate(prevProduct)}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full bg-bg-primary/80 backdrop-blur-sm border border-border hover:border-accent-amber text-text-muted hover:text-accent-amber transition-all"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        {nextProduct && (
          <button
            onClick={() => onNavigate(nextProduct)}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full bg-bg-primary/80 backdrop-blur-sm border border-border hover:border-accent-amber text-text-muted hover:text-accent-amber transition-all"
          >
            <ChevronRight size={20} />
          </button>
        )}

        <div className="grid md:grid-cols-2 gap-0">
          {/* Left — large image / 3D */}
          <div className="relative bg-bg-tertiary flex items-center justify-center min-h-[300px] md:min-h-[450px] md:rounded-l-xl overflow-hidden">
            {product.modelUrl ? (
              <ModelViewer src={product.modelUrl} alt={name} className="w-full h-full" />
            ) : product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={name}
                className="w-full h-full object-contain p-6"
              />
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Box size={80} className="text-text-muted/20" />
                <span className="text-text-muted text-xs font-mono">No image available</span>
              </div>
            )}

            {product.badge && (
              <span className="absolute top-4 left-4 font-accent text-sm bg-accent-amber text-bg-primary px-3 py-1 rounded-lg font-bold shadow-lg">
                {product.badge}
              </span>
            )}

            {/* Category pill */}
            <span className="absolute bottom-4 left-4 font-mono text-xs bg-bg-primary/80 backdrop-blur-sm text-text-secondary px-3 py-1.5 rounded-full border border-border">
              {categoryLabel}
            </span>
          </div>

          {/* Right — details */}
          <div className="p-6 md:p-8 flex flex-col">
            {/* Title & price */}
            <div className="mb-4">
              <h2 className="font-mono text-xl md:text-2xl font-bold text-text-primary mb-2 leading-tight">
                {name}
              </h2>
              <div className="flex items-center gap-3">
                <span className="font-mono text-3xl font-bold text-accent-amber">
                  €{product.price}
                </span>
                <span className={`text-xs font-accent flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
                  product.inStock
                    ? 'text-accent-green bg-accent-green/10 border border-accent-green/20'
                    : 'text-red-400 bg-red-400/10 border border-red-400/20'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${product.inStock ? 'bg-accent-green' : 'bg-red-400'}`} />
                  {product.inStock ? t.products.inStock : (language === 'gr' ? 'Εξαντλημένο' : 'Out of Stock')}
                </span>
              </div>
            </div>

            {/* Specs */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-bg-tertiary rounded-lg p-3 flex items-center gap-2.5">
                <Layers size={16} className="text-accent-blue shrink-0" />
                <div>
                  <p className="text-text-muted text-[10px] font-mono uppercase">Material</p>
                  <p className="text-text-primary text-sm font-accent">{product.material}</p>
                </div>
              </div>
              <div className="bg-bg-tertiary rounded-lg p-3 flex items-center gap-2.5">
                <Tag size={16} className="text-accent-amber shrink-0" />
                <div>
                  <p className="text-text-muted text-[10px] font-mono uppercase">Category</p>
                  <p className="text-text-primary text-sm font-accent capitalize">{product.category}</p>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="mb-6 flex-1">
              <h3 className="font-mono text-xs text-text-muted uppercase tracking-wider mb-2">Description</h3>
              <p className="text-text-secondary text-sm leading-relaxed">{description}</p>
            </div>

            {/* Quantity + Add to Cart */}
            {product.inStock && (
              <div className="border-t border-border pt-5 mt-auto">
                <div className="flex items-center gap-4">
                  {/* Quantity selector */}
                  <div className="flex items-center border border-border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="p-2.5 hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="font-mono text-sm font-bold text-text-primary w-10 text-center">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      className="p-2.5 hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {/* Add to Cart */}
                  <button
                    onClick={handleAdd}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-mono text-sm font-bold transition-all duration-300 ${
                      added
                        ? 'bg-accent-green text-bg-primary'
                        : 'bg-accent-amber text-bg-primary hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:scale-[1.02]'
                    }`}
                  >
                    {added ? (
                      <>
                        <Check size={18} />
                        {quantity > 1 ? `${quantity} added to cart!` : 'Added to cart!'}
                      </>
                    ) : (
                      <>
                        <ShoppingCart size={18} />
                        {t.products.addToCart} — €{(product.price * quantity).toFixed(2)}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Out of stock message */}
            {!product.inStock && (
              <div className="border-t border-border pt-5 mt-auto">
                <div className="bg-bg-tertiary rounded-lg p-4 text-center">
                  <p className="font-mono text-sm text-red-400 mb-1">Currently out of stock</p>
                  <p className="text-text-muted text-xs">Contact us for availability or custom orders.</p>
                </div>
              </div>
            )}

            {/* Keyboard hint */}
            <p className="text-text-muted text-[10px] font-mono mt-4 text-center hidden md:block">
              ← → to browse • ESC to close
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

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
            <div
              key={product.id}
              className="reveal"
              style={{ transitionDelay: `${i * 50}ms` }}
            >
              <ProductCard
                product={product}
                onQuickView={() => setQuickViewProduct(product)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Quick View Modal */}
      {quickViewProduct && (
        <QuickViewModal
          product={quickViewProduct}
          products={filtered}
          onClose={() => setQuickViewProduct(null)}
          onNavigate={(p) => setQuickViewProduct(p)}
        />
      )}
    </section>
  )
}
