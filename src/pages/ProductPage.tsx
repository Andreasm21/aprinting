// Full product page at /p/:slug.
//
// 2-column layout: sticky studio-lit Three.js viewer on the left, scrollable
// info column on the right with filament + color + quantity + Add-to-Cart
// + specs table. Color picks update the viewer in real time.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Box, Check } from 'lucide-react'
import { useContentStore } from '@/stores/contentStore'
import { useCartStore } from '@/stores/cartStore'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import LiveChatWidget from '@/components/LiveChatWidget'
import FilamentPills from '@/components/ui/FilamentPills'
import ColorSwatchRow from '@/components/ui/ColorSwatchRow'
import QtyStepper from '@/components/ui/QtyStepper'
import ViewerControls, { type ModelFinish } from '@/components/viewer/ViewerControls'
import AdvancedRotationPanel, { AdvancedRotationToggle } from '@/components/viewer/AdvancedRotationPanel'

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>()
  const products = useContentStore((s) => s.products)
  const product = useMemo(
    () => products.find((p) => p.slug === slug || `product-${p.id}` === slug),
    [products, slug],
  )

  // Variant state — pre-selects the first option of each.
  const [filament, setFilament] = useState<string | undefined>(undefined)
  const [color, setColor] = useState<string | undefined>(undefined)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const addItem = useCartStore((s) => s.addItem)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const viewerRef = useRef<{
    setColor(c: string): void
    setFinish(f: ModelFinish): void
    snapToView(v: 'front' | 'side' | 'back' | 'top' | 'hero'): void
    setAutoRotate(on: boolean, sp?: number): void
    start(): void
    stop(): void
    resize(): void
    dispose(): void
    setGeometry(g: unknown): void
    renderOnce(): void
    getModelRadius(): number
    controls: { reset(t: unknown, dist: number): void }
    camera: { fov: number }
  } | null>(null)
  const [autoRotate, setAutoRotate] = useState(false)
  const [finish, setFinish] = useState<ModelFinish>('matte')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [rotateSpeed, setRotateSpeed] = useState(0.4)
  const [live, setLive] = useState({ theta: Math.PI / 4, phi: Math.PI / 2.7, dist: 100, distMin: 1, distMax: 10000 })

  useEffect(() => {
    if (!product) return
    setFilament(product.filaments?.[0]?.name)
    setColor(product.colors?.[0]?.hex)
    setQty(1)
    setAdded(false)
  }, [product])

  // Studio-lit viewer for the marketing-grade product render.
  useEffect(() => {
    if (!product || !canvasRef.current) return
    let cancelled = false
    let viewer: typeof viewerRef.current = null

    Promise.all([
      import('@/components/viewer/STLViewer'),
      import('@/components/viewer/loadGeometry'),
    ]).then(async ([{ STLViewer }, { loadGeometry }]) => {
      if (cancelled || !canvasRef.current || !product.modelUrl) return
      viewer = new STLViewer(canvasRef.current, {
        bgColor: 0x0F0F0F,
        modelColor: parseHex(color) ?? parseHex(product.colors?.[0]?.hex) ?? 0xF59E0B,
        enableControls: true,
        studioMode: true,
        autoRotate: false,
        cameraDistMul: 2.4,
      }) as unknown as typeof viewer
      viewerRef.current = viewer
      // Mirror controls so the advanced panel inputs follow drag in real time.
      ;(viewer as unknown as { onRender: (() => void) | null }).onRender = () => {
        const v = viewer
        if (!v) return
        const limits = (v as unknown as { controls: { getDistanceLimits(): { minDist: number; maxDist: number } } }).controls.getDistanceLimits()
        const ctrls = (v as unknown as { controls: { theta: number; phi: number; dist: number } }).controls
        setLive((prev) =>
          prev.theta === ctrls.theta && prev.phi === ctrls.phi && prev.dist === ctrls.dist && prev.distMin === limits.minDist && prev.distMax === limits.maxDist
            ? prev
            : { theta: ctrls.theta, phi: ctrls.phi, dist: ctrls.dist, distMin: limits.minDist, distMax: limits.maxDist },
        )
      }
      requestAnimationFrame(() => viewer?.resize())
      try {
        if (!viewer) return
        const v = viewer
        const geom = await loadGeometry(product.modelUrl)
        if (cancelled) return
        v.setGeometry(geom as unknown as Parameters<typeof v.setGeometry>[0])
        v.setFinish(finish)
      } catch {
        // ignore
      }
    })

    return () => {
      cancelled = true
      viewer?.dispose()
      viewerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id])

  // Auto-rotate / finish reactivity.
  useEffect(() => {
    const v = viewerRef.current
    if (!v) return
    if (autoRotate) { v.setAutoRotate(true, rotateSpeed); v.start() }
    else { v.setAutoRotate(false); v.stop() }
  }, [autoRotate, rotateSpeed])
  useEffect(() => {
    if (viewerRef.current) viewerRef.current.setFinish(finish)
  }, [finish])

  const handleReset = () => {
    ;(viewerRef.current as unknown as { refitCamera(): void } | null)?.refitCamera()
  }

  // Sync color → viewer (and the catalog thumbnails will update too thanks to
  // the BufferGeometry being shared via the loadGeometry cache).
  useEffect(() => {
    if (viewerRef.current && color) viewerRef.current.setColor(color)
  }, [color])

  if (!product) {
    return (
      <div className="min-h-screen bg-bg-primary text-text-primary">
        <Navbar />
        <div className="max-w-4xl mx-auto px-6 py-32 text-center">
          <Box size={48} className="mx-auto text-text-muted/30 mb-4" />
          <h1 className="font-mono text-2xl">Product not found</h1>
          <p className="text-text-muted mt-2">No product matches the URL <span className="font-mono text-accent-amber">/p/{slug}</span>.</p>
          <Link to="/" className="inline-block mt-6 text-accent-amber font-mono text-sm hover:underline">← Back to catalog</Link>
        </div>
        <Footer />
      </div>
    )
  }

  const fil = product.filaments?.find((f) => f.name === filament)
  const unitPrice = product.price + (fil?.extra_eur ?? 0)
  const totalPrice = unitPrice * qty

  const handleAdd = () => {
    addItem({ product, quantity: qty, chosenFilament: filament, chosenColor: color })
    setAdded(true)
    setTimeout(() => setAdded(false), 1200)
  }

  const specEntries = product.specs ? Object.entries(product.specs).filter(([, v]) => v !== undefined && v !== '') : []

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-10">
        {/* Left — sticky studio viewer. Capped at viewport-minus-nav so it
            never blows up on tall screens. */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div
            className="relative bg-bg-secondary border border-border rounded-2xl overflow-hidden mx-auto w-full"
            style={{
              maxWidth: 'min(100%, calc(100vh - 8rem))',
              aspectRatio: '1 / 1',
            }}
          >
            {product.modelUrl ? (
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" style={{ touchAction: 'none' }} />
            ) : product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-text-muted/30">
                <Box size={64} />
              </div>
            )}

            {product.modelUrl && (
              <>
                <p className="absolute top-3 left-3 text-[10px] font-mono text-text-muted/70 pointer-events-none">
                  drag · scroll · right-drag
                </p>
                {/* Floating controls — bottom-center, with optional advanced
                    panel that opens above. */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
                  {advancedOpen && (
                    <AdvancedRotationPanel
                      open={advancedOpen}
                      onClose={() => setAdvancedOpen(false)}
                      theta={live.theta}
                      phi={live.phi}
                      dist={live.dist}
                      distMin={live.distMin}
                      distMax={live.distMax}
                      rotateSpeed={rotateSpeed}
                      onTheta={(deg) => {
                        const ctrls = (viewerRef.current as unknown as { controls: { setView(t: number, p: number): void } } | null)?.controls
                        ctrls?.setView((deg * Math.PI) / 180, live.phi)
                      }}
                      onPhi={(deg) => {
                        const ctrls = (viewerRef.current as unknown as { controls: { setView(t: number, p: number): void } } | null)?.controls
                        ctrls?.setView(live.theta, (deg * Math.PI) / 180)
                      }}
                      onDist={(d) => {
                        const v = viewerRef.current as unknown as { controls: { dist: number; update(): void }; renderOnce(): void } | null
                        if (v) { v.controls.dist = d; v.controls.update(); v.renderOnce() }
                      }}
                      onSpeed={setRotateSpeed}
                      onRefit={() => (viewerRef.current as unknown as { refitCamera(): void } | null)?.refitCamera()}
                    />
                  )}
                  <div className="flex items-center gap-2">
                    <ViewerControls
                      autoRotate={autoRotate}
                      onToggleAutoRotate={() => setAutoRotate((v) => !v)}
                      onSnapTo={(v) => viewerRef.current?.snapToView(v)}
                      onReset={handleReset}
                      finish={finish}
                      onFinishChange={setFinish}
                    />
                    <AdvancedRotationToggle open={advancedOpen} onClick={() => setAdvancedOpen((v) => !v)} />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right — info + variants + Add to Cart */}
        <div className="space-y-5">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-mono text-text-muted hover:text-accent-amber">
            <ArrowLeft size={12} /> Back to catalog
          </Link>

          {(product.collection || product.seriesNo) && (
            <p className="text-[10px] font-mono uppercase tracking-widest text-accent-amber">
              {product.collection}{product.seriesNo ? ` · No. ${product.seriesNo}` : ''}
            </p>
          )}

          <h1 className="font-mono text-3xl font-bold text-text-primary -mt-2">{product.name}</h1>

          <div className="flex items-center gap-2 text-xs font-mono text-text-secondary">
            <span className={`w-2 h-2 rounded-full ${product.inStock ? 'bg-accent-green animate-pulse' : 'bg-text-muted'}`} />
            {product.inStock ? 'In stock' : 'Out of stock'}
            {product.shipsIn && product.inStock && <span className="text-text-muted">· Ships in {product.shipsIn}</span>}
          </div>

          <p className="text-2xl font-mono font-bold text-accent-amber">€{unitPrice.toFixed(2)}</p>

          {product.description && (
            <p className="text-sm text-text-secondary leading-relaxed">{product.description}</p>
          )}

          {/* Filament selector */}
          {product.filaments && product.filaments.length > 0 && (
            <div>
              <p className="text-[10px] font-mono uppercase text-text-muted mb-2">Filament</p>
              <FilamentPills filaments={product.filaments} value={filament} onChange={setFilament} />
            </div>
          )}

          {/* Color swatches */}
          {product.colors && product.colors.length > 0 && (
            <div>
              <p className="text-[10px] font-mono uppercase text-text-muted mb-2">Color · {product.colors.find((c) => c.hex === color)?.name || ''}</p>
              <ColorSwatchRow colors={product.colors} value={color} onChange={setColor} />
            </div>
          )}

          {/* Quantity + Add-to-cart */}
          <div className="flex items-center gap-3 pt-3">
            <QtyStepper value={qty} onChange={setQty} />
            <button
              onClick={handleAdd}
              disabled={!product.inStock}
              className={`flex-1 py-3.5 px-5 rounded-lg font-mono text-sm uppercase tracking-wider font-bold transition-all flex items-center justify-center gap-2 ${
                !product.inStock
                  ? 'bg-bg-tertiary text-text-muted cursor-not-allowed'
                  : added
                  ? 'bg-accent-green text-bg-primary'
                  : 'bg-accent-amber text-bg-primary hover:brightness-110'
              }`}
            >
              {added ? <><Check size={14} /> Added</> : product.inStock ? <>Add to cart · €{totalPrice.toFixed(2)} <ArrowRight size={14} /></> : 'Out of stock'}
            </button>
          </div>

          {/* Specs grid */}
          {specEntries.length > 0 && (
            <div className="pt-6 border-t border-border">
              <p className="text-[10px] font-mono uppercase text-text-muted mb-3">Specifications</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {specEntries.map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-border/50 py-1.5">
                    <span className="text-xs text-text-muted">{prettifyKey(k)}</span>
                    <span className="text-xs font-mono text-text-primary">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer />
      <LiveChatWidget />
    </div>
  )
}

function parseHex(hex?: string): number | undefined {
  if (!hex) return undefined
  const cleaned = hex.replace('#', '')
  const n = parseInt(cleaned, 16)
  return isNaN(n) ? undefined : n
}

function prettifyKey(k: string): string {
  return k
    .replace(/_mm$/, ' (mm)')
    .replace(/_g$/, ' (g)')
    .replace(/_pct$/, ' (%)')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
