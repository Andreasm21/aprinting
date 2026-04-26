// Quick-view modal — opens from a product card without full navigation.
// Two-column layout: auto-rotating Three.js viewer on the left, condensed
// info + filament/color/qty controls on the right.

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { X, ArrowRight, Check } from 'lucide-react'
import type { Product } from '@/types'
import { useCartStore } from '@/stores/cartStore'
import FilamentPills from './ui/FilamentPills'
import ColorSwatchRow from './ui/ColorSwatchRow'
import QtyStepper from './ui/QtyStepper'

interface Props {
  product: Product | null
  onClose: () => void
}

export default function QuickViewModal({ product, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const viewerRef = useRef<{ setColor(c: string): void; resize(): void; dispose(): void; setGeometry(g: unknown): void; renderOnce(): void } | null>(null)

  // Variant state — pre-selects the first option of each.
  const [filament, setFilament] = useState<string | undefined>(undefined)
  const [color, setColor] = useState<string | undefined>(undefined)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const addItem = useCartStore((s) => s.addItem)

  // Reset variant + viewer state whenever a different product opens.
  useEffect(() => {
    if (!product) return
    setFilament(product.filaments?.[0]?.name)
    setColor(product.colors?.[0]?.hex)
    setQty(1)
    setAdded(false)
  }, [product])

  // Lazily init the viewer once the modal is mounted with a product.
  useEffect(() => {
    if (!product || !canvasRef.current) return
    let cancelled = false
    let viewer: { setColor(c: string): void; resize(): void; dispose(): void; setGeometry(g: unknown): void; renderOnce(): void; setAutoRotate(on: boolean, sp?: number): void; start(): void } | null = null

    Promise.all([
      import('@/components/viewer/STLViewer'),
      import('@/components/viewer/loadGeometry'),
    ]).then(async ([{ STLViewer }, { loadGeometry }]) => {
      if (cancelled || !canvasRef.current || !product.modelUrl) return
      viewer = new STLViewer(canvasRef.current, {
        bgColor: 0x1A1A1E,
        modelColor: parseHex(color) ?? parseHex(product.colors?.[0]?.hex) ?? 0xF59E0B,
        enableControls: true,
        enableRotate: true,
        enablePan: false,
        enableZoom: false,
        autoRotate: true,
        rotateSpeed: 0.4,
        cameraDistMul: 2.4,
      }) as unknown as typeof viewer
      viewerRef.current = viewer
      // Modal might still be transitioning in — wait one frame for layout.
      requestAnimationFrame(() => viewer?.resize())
      try {
        if (!viewer) return
        const v = viewer
        const geom = await loadGeometry(product.modelUrl)
        if (cancelled) return
        v.setGeometry(geom as unknown as Parameters<typeof v.setGeometry>[0])
        v.setAutoRotate(true, 0.4)
        v.start()
      } catch {
        // Fallback: just leave the viewer empty.
      }
    })

    return () => {
      cancelled = true
      viewer?.dispose()
      viewerRef.current = null
    }
  }, [product])

  // Live colour sync on the modal's viewer when the swatch changes.
  useEffect(() => {
    if (viewerRef.current && color) viewerRef.current.setColor(color)
  }, [color])

  // ESC + click-outside to close.
  useEffect(() => {
    if (!product) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [product, onClose])

  if (!product) return null

  const fil = product.filaments?.find((f) => f.name === filament)
  const unitPrice = product.price + (fil?.extra_eur ?? 0)
  const totalPrice = unitPrice * qty

  const handleAdd = () => {
    addItem({ product, quantity: qty, chosenFilament: filament, chosenColor: color })
    setAdded(true)
    setTimeout(() => setAdded(false), 1200)
  }

  const slug = product.slug || `product-${product.id}`

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-bg-secondary border border-border rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden grid sm:grid-cols-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left — viewer */}
        <div className="relative aspect-square bg-bg-tertiary">
          {product.modelUrl ? (
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" style={{ touchAction: 'none' }} />
          ) : product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="absolute inset-0 w-full h-full object-cover" />
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-bg-primary/70 backdrop-blur flex items-center justify-center text-text-muted hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </div>

        {/* Right — info + controls */}
        <div className="p-6 flex flex-col overflow-y-auto">
          {product.collection && (
            <p className="text-[10px] font-mono uppercase tracking-widest text-text-muted mb-1">
              {product.collection}{product.seriesNo ? ` · No. ${product.seriesNo}` : ''}
            </p>
          )}
          <h2 className="font-mono text-xl font-bold text-text-primary">{product.name}</h2>
          <p className="font-mono text-2xl text-accent-amber font-bold mt-2">€{unitPrice.toFixed(2)}</p>

          {product.description && (
            <p className="text-sm text-text-secondary mt-3 line-clamp-3">{product.description}</p>
          )}

          {product.specs && Object.values(product.specs).some(Boolean) && (
            <p className="text-[11px] text-text-muted font-mono mt-3">
              {[
                product.specs.dimensions_mm && `${product.specs.dimensions_mm} mm`,
                product.specs.weight_g && `${product.specs.weight_g} g`,
                product.inStock ? 'in stock' : 'out of stock',
              ].filter(Boolean).join(' · ')}
            </p>
          )}

          {product.filaments && product.filaments.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] font-mono uppercase text-text-muted mb-1.5">Filament</p>
              <FilamentPills filaments={product.filaments} value={filament} onChange={setFilament} />
            </div>
          )}

          {product.colors && product.colors.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] font-mono uppercase text-text-muted mb-1.5">Color</p>
              <ColorSwatchRow colors={product.colors} value={color} onChange={setColor} />
            </div>
          )}

          <div className="mt-5 flex items-center gap-3">
            <QtyStepper value={qty} onChange={setQty} />
            <button
              onClick={handleAdd}
              className={`flex-1 py-3 px-4 rounded-lg font-mono text-sm uppercase tracking-wider font-bold transition-all flex items-center justify-center gap-2 ${
                added ? 'bg-accent-green text-bg-primary' : 'bg-accent-amber text-bg-primary hover:brightness-110'
              }`}
            >
              {added ? <><Check size={14} /> Added</> : <>Add to cart · €{totalPrice.toFixed(2)}</>}
            </button>
          </div>

          <Link
            to={`/p/${slug}`}
            onClick={onClose}
            className="mt-3 text-xs font-mono uppercase tracking-wider text-text-muted hover:text-accent-amber flex items-center justify-center gap-1.5 py-2"
          >
            Full page <ArrowRight size={11} />
          </Link>
        </div>
      </div>
    </div>
  )
}

function parseHex(hex?: string): number | undefined {
  if (!hex) return undefined
  const cleaned = hex.replace('#', '')
  const n = parseInt(cleaned, 16)
  return isNaN(n) ? undefined : n
}
