// Storefront product card with hover-to-rotate 3D thumbnail.
//
// Performance principles:
// 1. Three.js is dynamically imported only when the card scrolls into view
//    (IntersectionObserver). This keeps the home-page eager bundle small.
// 2. Only the hovered card's render loop is running — others freeze on
//    their last rendered frame at zero GPU cost.
// 3. Geometry is cached per modelUrl (loadGeometry's module-level Map)
//    so reopening the same product doesn't re-parse the file.

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Box, ZoomIn } from 'lucide-react'
import type { Product } from '@/types'

interface Props {
  product: Product
  onQuickView: (product: Product) => void
  /** Optional override color — used for product-page color sync */
  colorHex?: string
}

export default function ProductCard({ product, onQuickView, colorHex }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  // Hold the viewer in a ref because we don't want a re-render when it changes.
  const viewerRef = useRef<unknown | null>(null)
  const [hovered, setHovered] = useState(false)
  const [inView, setInView] = useState(false)
  const cardRef = useRef<HTMLAnchorElement | null>(null)

  // Defer canvas init until the card actually scrolls into view.
  useEffect(() => {
    if (!cardRef.current || inView) return
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setInView(true)
        obs.disconnect()
      }
    }, { rootMargin: '200px' })
    obs.observe(cardRef.current)
    return () => obs.disconnect()
  }, [inView])

  // Lazily import the viewer module + initialise once we're in view.
  useEffect(() => {
    if (!inView || !canvasRef.current || !product.modelUrl) return
    let cancelled = false
    let viewer: { setColor(c: number | string): void; setAutoRotate(on: boolean, sp?: number): void; start(): void; stop(): void; renderOnce(): void; resize(): void; dispose(): void; setGeometry(g: unknown): void } | null = null

    Promise.all([
      import('@/components/viewer/STLViewer'),
      import('@/components/viewer/loadGeometry'),
    ]).then(async ([{ STLViewer }, { loadGeometry }]) => {
      if (cancelled || !canvasRef.current) return
      viewer = new STLViewer(canvasRef.current, {
        bgColor: 0x1A1A1E, // bg-secondary so the card blends seamlessly
        modelColor: parseHex(colorHex) ?? 0xF59E0B,
        enableControls: false,
        autoRotate: false,
        cameraDistMul: 2.2,
      }) as unknown as typeof viewer
      viewerRef.current = viewer
      try {
        const geom = await loadGeometry(product.modelUrl!)
        if (cancelled) return
        ;(viewer as { setGeometry(g: unknown): void }).setGeometry(geom)
        viewer!.renderOnce()
      } catch {
        // Fail silently — card falls back to no model.
      }
    })

    return () => {
      cancelled = true
      if (viewer) viewer.dispose()
      viewerRef.current = null
    }
  }, [inView, product.modelUrl])

  // React to colour overrides (from product page color sync).
  useEffect(() => {
    if (viewerRef.current && colorHex) {
      ;(viewerRef.current as { setColor(c: string): void }).setColor(colorHex)
    }
  }, [colorHex])

  // Resting pose for the snap-back animation. Matches STLViewer defaults so
  // the model lands in a presentable hero angle, not whichever frame the
  // spin happened to land on.
  const RESTING_THETA = Math.PI / 4
  const RESTING_PHI = Math.PI / 2.7

  // Animate on hover; on leave, smoothly tween back to the resting pose.
  useEffect(() => {
    const v = viewerRef.current as
      | {
          setAutoRotate(on: boolean, sp?: number): void
          start(): void
          stop(): void
          renderOnce(): void
          controls: { theta: number; phi: number; setView(theta: number, phi: number): void }
        }
      | null
    if (!v) return
    if (hovered) {
      v.setAutoRotate(true, 0.6)
      v.start()
      return
    }
    // Mouseleave path: stop auto-rotate, then ease theta + phi back to
    // their resting values over ~300ms. Wrap theta to its nearest 2π so the
    // tween always takes the short way around.
    v.setAutoRotate(false)
    const startTheta = wrapAngle(v.controls.theta, RESTING_THETA)
    const startPhi = v.controls.phi
    const dur = 320
    const t0 = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / dur)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic — fast then settle
      const theta = startTheta + (RESTING_THETA - startTheta) * eased
      const phi = startPhi + (RESTING_PHI - startPhi) * eased
      v.controls.setView(theta, phi)
      v.renderOnce()
      if (t < 1) raf = requestAnimationFrame(tick)
      else v.stop()
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [hovered])

  const slug = product.slug || `product-${product.id}`

  return (
    <Link
      to={`/p/${slug}`}
      ref={cardRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group block bg-bg-secondary border border-border rounded-xl overflow-hidden transition-all hover:-translate-y-0.5 hover:border-accent-amber/50"
    >
      {/* 1:1 thumbnail */}
      <div className="relative aspect-square bg-bg-tertiary overflow-hidden">
        {product.modelUrl ? (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full block"
            style={{ touchAction: 'none' }}
          />
        ) : product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-text-muted/30">
            <Box size={48} />
          </div>
        )}

        {/* Badge */}
        {product.badge && (
          <span className="absolute top-3 right-3 px-2 py-0.5 bg-accent-amber text-bg-primary text-[10px] font-mono uppercase tracking-wider rounded">
            {product.badge}
          </span>
        )}

        {/* Quick-view overlay — fades in on hover */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg-primary via-bg-primary/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onQuickView(product)
            }}
            className="w-full text-xs font-mono uppercase tracking-wider px-3 py-2 rounded bg-bg-secondary/80 backdrop-blur border border-accent-amber/40 text-accent-amber hover:bg-accent-amber hover:text-bg-primary transition-all flex items-center justify-center gap-1.5"
          >
            <ZoomIn size={12} /> Quick view
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        {product.collection && (
          <p className="text-[10px] font-mono uppercase tracking-widest text-text-muted mb-1">
            {product.collection}{product.seriesNo ? ` · No. ${product.seriesNo}` : ''}
          </p>
        )}
        <h3 className="font-mono text-base text-text-primary truncate">{product.name}</h3>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-text-muted">{product.material}</span>
          <span className="font-mono text-sm text-accent-amber font-bold">€{product.price.toFixed(2)}</span>
        </div>
      </div>
    </Link>
  )
}

function parseHex(hex?: string): number | undefined {
  if (!hex) return undefined
  const cleaned = hex.replace('#', '')
  const n = parseInt(cleaned, 16)
  return isNaN(n) ? undefined : n
}

/** Wrap `current` to the equivalent angle within ±π of `target`, so a tween
 *  always takes the shortest path on the circle (not the long way around). */
function wrapAngle(current: number, target: number): number {
  let c = current
  while (c - target > Math.PI) c -= 2 * Math.PI
  while (c - target < -Math.PI) c += 2 * Math.PI
  return c
}
