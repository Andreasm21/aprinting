// React hook wrapping the STLViewer class.
//
// Why a hook: the class is intentionally framework-agnostic, but most callers
// are React components that want a `ref` to a canvas, lifecycle wiring, and
// declarative props (color / autoRotate / modelUrl). The hook handles all
// that so a component just renders a <canvas ref={canvasRef}>.

import { useEffect, useRef, useState } from 'react'
import { STLViewer, type STLViewerOptions } from './STLViewer'
import { loadGeometry } from './loadGeometry'

interface UseSTLViewerArgs extends STLViewerOptions {
  /** URL of the .stl / .glb file to load. If null/undefined, no model is shown. */
  modelUrl?: string | null
  /** Pause the render loop entirely — used by ProductCard to freeze idle cards. */
  paused?: boolean
}

interface UseSTLViewerResult {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  viewer: STLViewer | null
  loading: boolean
  error: string | null
}

export function useSTLViewer(args: UseSTLViewerArgs): UseSTLViewerResult {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const viewerRef = useRef<STLViewer | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, force] = useState({})

  // Construct the viewer once on mount, dispose on unmount.
  useEffect(() => {
    if (!canvasRef.current) return
    const v = new STLViewer(canvasRef.current, args)
    viewerRef.current = v
    force({}) // trigger re-render so consumers can use the viewer ref
    // Resize observer keeps canvas size in sync with its container.
    const ro = new ResizeObserver(() => v.resize())
    ro.observe(canvasRef.current)
    return () => {
      ro.disconnect()
      v.dispose()
      viewerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load + apply geometry whenever modelUrl changes.
  useEffect(() => {
    const v = viewerRef.current
    if (!v || !args.modelUrl) return
    let cancelled = false
    setLoading(true)
    setError(null)
    loadGeometry(args.modelUrl)
      .then((geom) => {
        if (cancelled) return
        v.setGeometry(geom)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load model')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [args.modelUrl])

  // Reactive color updates.
  useEffect(() => {
    if (viewerRef.current && args.modelColor !== undefined) {
      viewerRef.current.setColor(args.modelColor)
    }
  }, [args.modelColor])

  // Auto-rotate + paused state controls.
  useEffect(() => {
    const v = viewerRef.current
    if (!v) return
    if (args.paused) {
      v.stop()
      return
    }
    if (args.autoRotate) {
      v.setAutoRotate(true, args.rotateSpeed)
      v.start()
    } else {
      v.setAutoRotate(false)
      v.stop()
    }
  }, [args.autoRotate, args.paused, args.rotateSpeed])

  return { canvasRef, viewer: viewerRef.current, loading, error }
}
