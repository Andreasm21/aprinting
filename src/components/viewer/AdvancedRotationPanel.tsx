// Advanced rotation panel — expanded view that complements ViewerControls.
//
// Lets the operator dial in exact angles in degrees, slide through theta/phi
// continuously, control the auto-rotate speed, fine-tune zoom, and refit the
// camera if a weird-scale STL loaded poorly.
//
// State lives in the parent (admin viewer / product page); this component is
// purely presentational + emits change callbacks. The parent reads the live
// values from `viewer.controls.theta` etc on each frame via the `onRender`
// hook so the inputs reflect what the model is actually showing as the user
// drags.

import { useEffect, useState } from 'react'
import { Sliders, RefreshCw, ChevronDown, X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  // Live values from the viewer (updated as the user drags via mouse)
  theta: number      // radians
  phi: number        // radians
  dist: number
  distMin: number
  distMax: number
  rotateSpeed: number  // rad/sec used by auto-rotate
  // Setters — parent updates the viewer's controls and re-renders
  onTheta: (deg: number) => void
  onPhi: (deg: number) => void
  onDist: (v: number) => void
  onSpeed: (v: number) => void
  onRefit: () => void
  /** Optional model size summary, displayed for context. */
  modelInfo?: { radius?: number; bbox?: { x: number; y: number; z: number } }
}

const radToDeg = (r: number) => (r * 180) / Math.PI

export default function AdvancedRotationPanel({
  open,
  onClose,
  theta,
  phi,
  dist,
  distMin,
  distMax,
  rotateSpeed,
  onTheta,
  onPhi,
  onDist,
  onSpeed,
  onRefit,
  modelInfo,
}: Props) {
  // Local edit state for the numeric inputs so users can type freely without
  // every keystroke triggering a viewer update. Commits on blur / enter.
  const [thetaInput, setThetaInput] = useState(() => Math.round(radToDeg(theta)).toString())
  const [phiInput, setPhiInput] = useState(() => Math.round(radToDeg(phi)).toString())

  // When the parent's live theta/phi change (mouse-drag in the viewer),
  // sync the inputs back unless the user is currently typing in them.
  useEffect(() => { setThetaInput(Math.round(radToDeg(theta)).toString()) }, [theta])
  useEffect(() => { setPhiInput(Math.round(radToDeg(phi)).toString()) }, [phi])

  const commitTheta = () => {
    const n = parseFloat(thetaInput)
    if (Number.isFinite(n)) onTheta(((n % 360) + 360) % 360) // normalise to [0, 360)
  }
  const commitPhi = () => {
    const n = parseFloat(phiInput)
    if (Number.isFinite(n)) onPhi(Math.max(5, Math.min(175, n)))
  }

  if (!open) return null

  const thetaDeg = radToDeg(theta)
  const phiDeg = radToDeg(phi)

  return (
    <div className="bg-bg-secondary/95 backdrop-blur border border-border rounded-2xl shadow-2xl p-4 w-[320px] max-w-[calc(100vw-2rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-text-primary">
          <Sliders size={14} className="text-accent-amber" />
          <span className="font-mono text-xs uppercase tracking-wider">Rotation</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-bg-tertiary"
        >
          <X size={14} />
        </button>
      </div>

      {/* Theta — horizontal */}
      <DegreeRow
        label="Yaw"
        sublabel="θ — horizontal"
        value={thetaInput}
        onChange={setThetaInput}
        onCommit={commitTheta}
        onStep={(delta) => onTheta(((thetaDeg + delta) % 360 + 360) % 360)}
        min={0}
        max={360}
        liveDeg={thetaDeg}
      />

      {/* Phi — vertical (clamped to avoid gimbal flip) */}
      <DegreeRow
        label="Pitch"
        sublabel="φ — vertical (5–175°)"
        value={phiInput}
        onChange={setPhiInput}
        onCommit={commitPhi}
        onStep={(delta) => onPhi(Math.max(5, Math.min(175, phiDeg + delta)))}
        min={5}
        max={175}
        liveDeg={phiDeg}
      />

      {/* Distance — zoom */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">Zoom</span>
          <span className="text-[10px] font-mono text-text-secondary">{dist.toFixed(1)} u</span>
        </div>
        <input
          type="range"
          min={distMin}
          max={distMax}
          step={(distMax - distMin) / 200}
          value={dist}
          onChange={(e) => onDist(parseFloat(e.target.value))}
          className="w-full accent-accent-amber"
        />
      </div>

      {/* Auto-rotate speed */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">Auto-rotate speed</span>
          <span className="text-[10px] font-mono text-text-secondary">{rotateSpeed.toFixed(2)} rad/s</span>
        </div>
        <input
          type="range"
          min={0}
          max={3}
          step={0.05}
          value={rotateSpeed}
          onChange={(e) => onSpeed(parseFloat(e.target.value))}
          className="w-full accent-accent-amber"
        />
        <p className="text-[10px] text-text-muted font-mono mt-1">
          0.6 rad/s ≈ 10s full rotation. Higher = faster.
        </p>
      </div>

      {/* Refit + model info */}
      <div className="pt-3 border-t border-border space-y-2">
        <button
          type="button"
          onClick={onRefit}
          className="w-full flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-wider px-3 py-2 rounded-lg bg-accent-amber text-bg-primary font-bold hover:brightness-110"
        >
          <RefreshCw size={12} /> Refit camera
        </button>
        {modelInfo?.bbox && (
          <p className="text-[10px] text-text-muted font-mono leading-relaxed">
            Model: <span className="text-text-secondary">{modelInfo.bbox.x.toFixed(1)} × {modelInfo.bbox.y.toFixed(1)} × {modelInfo.bbox.z.toFixed(1)} u</span>
            {modelInfo.radius && <> · radius {modelInfo.radius.toFixed(1)}</>}
          </p>
        )}
      </div>
    </div>
  )
}

interface DegreeRowProps {
  label: string
  sublabel: string
  value: string
  onChange: (v: string) => void
  onCommit: () => void
  onStep: (delta: number) => void
  min: number
  max: number
  liveDeg: number
}

function DegreeRow({ label, sublabel, value, onChange, onCommit, onStep, min, max, liveDeg }: DegreeRowProps) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">{label}</span>
          <span className="text-[9px] font-mono text-text-muted/60 ml-1">{sublabel}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onStep(-15)}
          className="w-8 h-8 rounded-lg bg-bg-tertiary border border-border text-text-secondary hover:text-accent-amber hover:border-accent-amber font-mono text-xs"
          title="-15°"
        >−15</button>
        <button
          type="button"
          onClick={() => onStep(-1)}
          className="w-7 h-8 rounded-lg bg-bg-tertiary border border-border text-text-secondary hover:text-accent-amber hover:border-accent-amber font-mono text-[10px]"
          title="-1°"
        >−1</button>
        <div className="relative flex-1">
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onCommit}
            onKeyDown={(e) => { if (e.key === 'Enter') { onCommit(); (e.target as HTMLInputElement).blur() } }}
            min={min}
            max={max}
            className="w-full bg-bg-tertiary border border-border rounded-lg px-2 py-1.5 text-sm font-mono text-center text-text-primary focus:border-accent-amber focus:outline-none"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-xs font-mono pointer-events-none">°</span>
        </div>
        <button
          type="button"
          onClick={() => onStep(1)}
          className="w-7 h-8 rounded-lg bg-bg-tertiary border border-border text-text-secondary hover:text-accent-amber hover:border-accent-amber font-mono text-[10px]"
          title="+1°"
        >+1</button>
        <button
          type="button"
          onClick={() => onStep(15)}
          className="w-8 h-8 rounded-lg bg-bg-tertiary border border-border text-text-secondary hover:text-accent-amber hover:border-accent-amber font-mono text-xs"
          title="+15°"
        >+15</button>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={liveDeg}
        onChange={(e) => onStep(parseFloat(e.target.value) - liveDeg)}
        className="w-full mt-2 accent-accent-amber"
      />
    </div>
  )
}

/** Toggle button — small chevron + label for opening the advanced panel.
 *  Designed to fit alongside the floating ViewerControls bar. */
export function AdvancedRotationToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={open ? 'Hide advanced rotation' : 'Advanced rotation'}
      className={`flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full border transition-all ${
        open
          ? 'bg-accent-amber text-bg-primary border-accent-amber'
          : 'bg-bg-primary/85 backdrop-blur text-text-secondary border-border hover:text-accent-amber hover:border-accent-amber'
      }`}
    >
      <Sliders size={11} />
      Advanced
      <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
  )
}
