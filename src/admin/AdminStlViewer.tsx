// Admin STL Viewer at /admin/stl-viewer.
//
// Operator tool — drag-drop an STL, inspect it in 3D, color-test, then
// trigger the 5-shot capture pipeline to get marketing PNGs ready for the
// product page or social media.

import { useEffect, useRef, useState } from 'react'
import { Upload, RotateCcw, Camera, Loader2, X, Download, Box, FileImage, Wand2 } from 'lucide-react'
import { Vector3 } from 'three'
import { STLViewer } from '@/components/viewer/STLViewer'
import { parseSTL } from '@/components/viewer/parseSTL'
import { captureFiveShots, downloadShots, type CaptureShot } from '@/components/viewer/captureRig'
import ViewerControls, { type ModelFinish } from '@/components/viewer/ViewerControls'
import AdvancedRotationPanel, { AdvancedRotationToggle } from '@/components/viewer/AdvancedRotationPanel'
import BrandLogo from '@/components/BrandLogo'

interface FileInfo {
  name: string
  triangles: number
  vertices: number
  bbox: { x: number; y: number; z: number }
}

export default function AdminStlViewer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const viewerRef = useRef<STLViewer | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [file, setFile] = useState<FileInfo | null>(null)
  const [color, setColor] = useState('#F59E0B') // accent-amber default
  const [wireframe, setWireframe] = useState(false)
  const [autoRotate, setAutoRotate] = useState(false)
  const [finish, setFinish] = useState<ModelFinish>('matte')
  const [watermarkText, setWatermarkText] = useState('AXIOM')
  const [dragOver, setDragOver] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [shots, setShots] = useState<CaptureShot[] | null>(null)
  const [status, setStatus] = useState<string>('Drop an STL file or click Open STL')
  // Advanced rotation panel state.
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [rotateSpeed, setRotateSpeed] = useState(0.5)
  // Live mirror of viewer.controls — re-rendered on every viewer frame so the
  // advanced panel inputs reflect mouse-drag in real time.
  const [live, setLive] = useState({ theta: Math.PI / 4, phi: Math.PI / 2.7, dist: 100, distMin: 1, distMax: 10000 })

  // Init viewer once on mount.
  useEffect(() => {
    if (!canvasRef.current) return
    const v = new STLViewer(canvasRef.current, {
      bgColor: 0x0F0F0F,
      modelColor: 0xF59E0B,
      enableControls: true,
      studioMode: false,
      autoRotate: false,
      cameraDistMul: 2.4,
    })
    viewerRef.current = v

    // Mirror controls into React state so the advanced rotation panel
    // reflects mouse-drag and refit operations in real time. Throttle
    // implicitly via React's batching — we only setState if a value changed.
    const syncLive = () => {
      const limits = v.controls.getDistanceLimits()
      setLive((prev) => {
        if (
          prev.theta === v.controls.theta &&
          prev.phi === v.controls.phi &&
          prev.dist === v.controls.dist &&
          prev.distMin === limits.minDist &&
          prev.distMax === limits.maxDist
        ) return prev
        return {
          theta: v.controls.theta,
          phi: v.controls.phi,
          dist: v.controls.dist,
          distMin: limits.minDist,
          distMax: limits.maxDist,
        }
      })
    }
    v.onRender = syncLive

    const ro = new ResizeObserver(() => v.resize())
    ro.observe(canvasRef.current)

    return () => {
      ro.disconnect()
      v.dispose()
      viewerRef.current = null
    }
  }, [])

  // Reactive controls.
  useEffect(() => {
    viewerRef.current?.setColor(color)
  }, [color])

  useEffect(() => {
    viewerRef.current?.setWireframe(wireframe)
  }, [wireframe])

  useEffect(() => {
    if (!viewerRef.current) return
    viewerRef.current.setAutoRotate(autoRotate, rotateSpeed)
    if (autoRotate) viewerRef.current.start()
    else viewerRef.current.stop()
  }, [autoRotate, rotateSpeed])

  useEffect(() => {
    viewerRef.current?.setFinish(finish)
  }, [finish])

  // ── File loading ──

  const loadArrayBuffer = (buffer: ArrayBuffer, name: string) => {
    if (!viewerRef.current) return
    try {
      const geom = parseSTL(buffer)
      viewerRef.current.setGeometry(geom)
      const bbox = geom.boundingBox!
      const triangles = (geom.getAttribute('position').count / 3) | 0
      setFile({
        name,
        triangles,
        vertices: triangles * 3,
        bbox: {
          x: +(bbox.max.x - bbox.min.x).toFixed(1),
          y: +(bbox.max.y - bbox.min.y).toFixed(1),
          z: +(bbox.max.z - bbox.min.z).toFixed(1),
        },
      })
      setStatus(`Loaded ${name} · ${triangles.toLocaleString()} triangles`)
    } catch (err) {
      setStatus(`Failed to parse ${name}: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }

  const loadFile = async (file: File) => {
    setStatus(`Loading ${file.name}...`)
    const buf = await file.arrayBuffer()
    loadArrayBuffer(buf, file.name)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) loadFile(f)
  }

  // Drag-drop handlers attached to the whole window so the user can drop
  // anywhere on the page (not just the canvas).
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer?.types.includes('Files')) setDragOver(true)
    }
    const onDragLeave = (e: DragEvent) => {
      // Only clear if leaving to outside the window (not crossing element borders).
      if (e.clientX === 0 && e.clientY === 0) setDragOver(false)
    }
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const f = e.dataTransfer?.files?.[0]
      if (f && /\.stl$/i.test(f.name)) loadFile(f)
      else if (f) setStatus(`${f.name} is not an .stl file`)
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  const handleResetView = () => {
    viewerRef.current?.refitCamera()
  }
  // The Vector3 import is kept for the type — could be removed but harmless.
  void Vector3

  const handleCapture = async () => {
    if (!viewerRef.current || !file) return
    setCapturing(true)
    setStatus('Capturing 5 angles...')
    try {
      const result = await captureFiveShots(viewerRef.current, { watermarkText })
      setShots(result)
      setStatus(`Captured ${result.length} shots`)
    } catch (err) {
      setStatus(`Capture failed: ${err instanceof Error ? err.message : 'unknown'}`)
    } finally {
      setCapturing(false)
    }
  }

  const handleDownloadAll = () => {
    if (!shots || !file) return
    downloadShots(shots, file.name.replace(/\.stl$/i, ''))
  }

  return (
    <div className="absolute inset-0 bg-bg-primary text-text-primary overflow-hidden">
      {/* Full-viewport canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block"
        style={{ touchAction: 'none' }}
      />

      {/* Drag-drop overlay */}
      {dragOver && (
        <div className="absolute inset-0 z-30 bg-accent-amber/10 border-2 border-dashed border-accent-amber flex items-center justify-center pointer-events-none">
          <div className="bg-bg-secondary/90 px-6 py-4 rounded-lg border border-accent-amber font-mono text-accent-amber flex items-center gap-2">
            <Upload size={20} /> Drop STL file to load
          </div>
        </div>
      )}

      {/* Header bar */}
      <div className="absolute top-0 inset-x-0 z-20 px-6 py-4 flex items-center justify-between bg-gradient-to-b from-bg-primary/90 to-transparent">
        <div className="flex items-center gap-1">
          <BrandLogo size="sm" />
          <span className="ml-3 text-[10px] font-mono uppercase tracking-widest text-text-muted">STL Viewer</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".stl"
            onChange={handleFileInput}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs font-mono uppercase tracking-wider px-3 py-2 rounded border border-border hover:border-accent-amber hover:text-accent-amber flex items-center gap-1.5"
          >
            <Upload size={13} /> Open STL
          </button>
          <button
            onClick={handleResetView}
            disabled={!file}
            className="text-xs font-mono uppercase tracking-wider px-3 py-2 rounded border border-border hover:border-accent-amber hover:text-accent-amber flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw size={13} /> Reset View
          </button>
          <button
            onClick={handleCapture}
            disabled={!file || capturing}
            className="text-xs font-mono uppercase tracking-wider px-4 py-2 rounded bg-accent-amber text-bg-primary font-bold hover:brightness-110 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {capturing ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
            {capturing ? 'Capturing…' : 'Capture 5'}
          </button>
        </div>
      </div>

      {/* Info panel — top left */}
      {file && (
        <div className="absolute top-20 left-6 z-20 bg-bg-secondary/85 backdrop-blur border border-border rounded-lg p-4 min-w-[240px]">
          <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted mb-1">File</div>
          <div className="text-sm font-mono text-text-primary truncate mb-3">{file.name}</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs font-mono">
            <span className="text-text-muted">Triangles</span>
            <span className="text-right text-text-primary">{file.triangles.toLocaleString()}</span>
            <span className="text-text-muted">Vertices</span>
            <span className="text-right text-text-primary">{file.vertices.toLocaleString()}</span>
            <span className="text-text-muted">Size X</span>
            <span className="text-right text-text-primary">{file.bbox.x} mm</span>
            <span className="text-text-muted">Size Y</span>
            <span className="text-right text-text-primary">{file.bbox.y} mm</span>
            <span className="text-text-muted">Size Z</span>
            <span className="text-right text-text-primary">{file.bbox.z} mm</span>
          </div>
        </div>
      )}

      {/* Display panel — bottom right */}
      <div className="absolute bottom-16 right-6 z-20 bg-bg-secondary/85 backdrop-blur border border-border rounded-lg p-4 w-[240px]">
        <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted mb-3">Display</div>

        {/* Color */}
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs text-text-secondary">Color</label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer bg-transparent border border-border"
          />
        </div>

        <Toggle label="Wireframe" value={wireframe} onChange={setWireframe} />
        <Toggle label="Auto-rotate" value={autoRotate} onChange={setAutoRotate} />

        {/* Capture watermark — separated by border */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1">
            <Wand2 size={10} /> Capture
          </div>
          <label className="text-xs text-text-secondary block mb-1.5">Watermark text</label>
          <input
            type="text"
            value={watermarkText}
            onChange={(e) => setWatermarkText(e.target.value.slice(0, 20))}
            maxLength={20}
            placeholder="AXIOM"
            className="w-full bg-bg-tertiary border border-border rounded px-2 py-1.5 text-xs font-mono text-text-primary focus:border-accent-amber focus:outline-none"
          />
          <p className="text-[10px] text-text-muted font-mono mt-1.5">Empty disables watermark.</p>
        </div>
      </div>

      {/* Status line — bottom left */}
      <div className="absolute bottom-3 left-6 z-20 text-[11px] font-mono text-text-muted/70">
        {status}
      </div>

      {/* Floating viewer controls — center, above the hint line */}
      {file && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
          {/* Advanced rotation panel — opens above the controls bar. */}
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
              onTheta={(deg) => viewerRef.current?.controls.setView((deg * Math.PI) / 180, live.phi)}
              onPhi={(deg) => viewerRef.current?.controls.setView(live.theta, (deg * Math.PI) / 180)}
              onDist={(d) => { if (viewerRef.current) { viewerRef.current.controls.dist = d; viewerRef.current.controls.update(); viewerRef.current.renderOnce() } }}
              onSpeed={setRotateSpeed}
              onRefit={() => viewerRef.current?.refitCamera()}
              modelInfo={{
                radius: viewerRef.current?.getModelRadius(),
                bbox: file ? { x: file.bbox.x, y: file.bbox.y, z: file.bbox.z } : undefined,
              }}
            />
          )}

          {/* Bottom: controls bar + Advanced toggle pill */}
          <div className="flex items-center gap-2">
            <ViewerControls
              autoRotate={autoRotate}
              onToggleAutoRotate={() => setAutoRotate((v) => !v)}
              onSnapTo={(v) => viewerRef.current?.snapToView(v)}
              onReset={handleResetView}
              finish={finish}
              onFinishChange={setFinish}
            />
            <AdvancedRotationToggle
              open={advancedOpen}
              onClick={() => setAdvancedOpen((v) => !v)}
            />
          </div>
        </div>
      )}

      {/* Hint line — bottom center */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 text-[11px] font-mono text-text-muted/50">
        L-drag rotate · R-drag pan · scroll zoom
      </div>

      {/* Empty-state hint when no file loaded */}
      {!file && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="text-center text-text-muted">
            <Box size={64} className="mx-auto mb-4 opacity-30" />
            <p className="font-mono text-sm">Drop an STL file or click <span className="text-accent-amber">Open STL</span></p>
          </div>
        </div>
      )}

      {/* Capture gallery modal */}
      {shots && (
        <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur flex items-center justify-center p-6">
          <div className="bg-bg-secondary border border-border rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-bg-secondary z-10">
              <div className="flex items-center gap-2">
                <FileImage size={16} className="text-accent-amber" />
                <h2 className="font-mono text-base font-bold">Captured {shots.length} shots</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadAll}
                  className="text-xs font-mono uppercase tracking-wider px-3 py-2 rounded bg-accent-amber text-bg-primary font-bold hover:brightness-110 flex items-center gap-1.5"
                >
                  <Download size={13} /> Download All
                </button>
                <button onClick={() => setShots(null)} className="p-2 hover:bg-bg-tertiary rounded">
                  <X size={18} className="text-text-muted" />
                </button>
              </div>
            </div>

            <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
              {shots.map((shot, i) => (
                <div key={shot.name} className="card-base p-2">
                  <img src={shot.dataUrl} alt={shot.name} className="w-full aspect-square object-cover rounded" />
                  <div className="flex items-center justify-between mt-2 px-1">
                    <div>
                      <p className="text-[10px] font-mono text-text-muted uppercase">#{String(i + 1).padStart(2, '0')}</p>
                      <p className="text-xs font-mono text-text-primary">{shot.name}</p>
                    </div>
                    <a
                      href={shot.dataUrl}
                      download={`${file?.name.replace(/\.stl$/i, '') || 'axiom'}_${String(i + 1).padStart(2, '0')}_${shot.name}.png`}
                      className="text-xs font-mono text-accent-amber hover:text-accent-amber/80 px-2 py-1 rounded border border-accent-amber/30 hover:bg-accent-amber/10"
                    >
                      <Download size={11} className="inline mr-1" /> PNG
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <span className="text-xs text-text-secondary">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-9 h-5 rounded-full transition-colors ${value ? 'bg-accent-amber' : 'bg-bg-tertiary border border-border'}`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-bg-primary transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`}
        />
      </button>
    </div>
  )
}
