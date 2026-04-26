// Floating viewer-control bar — reusable across the admin STL viewer,
// product page, and quick-view modal. Sits over the canvas at the bottom.
//
// Two control groups, separated by a divider:
//   1. Rotation: snap angles + auto-rotate play/pause + reset
//   2. Finish:   matte / glossy / metallic / gradient (pill toggles)
//
// Pure presentational — parent owns the viewer ref and wires callbacks.

import { Play, Pause, RotateCcw, Layers } from 'lucide-react'
import type { CSSProperties } from 'react'

export type ModelFinish = 'matte' | 'glossy' | 'metallic' | 'gradient'

interface Props {
  // Rotation
  autoRotate: boolean
  onToggleAutoRotate: () => void
  onSnapTo: (view: 'front' | 'side' | 'back' | 'top' | 'hero') => void
  onReset?: () => void
  // Finish
  finish: ModelFinish
  onFinishChange: (f: ModelFinish) => void
  // Optional overrides
  hideFinish?: boolean
  hideAngles?: boolean
  className?: string
  style?: CSSProperties
}

const FINISHES: { id: ModelFinish; label: string; tone: string }[] = [
  { id: 'matte',    label: 'Matte',    tone: 'PLA / PETG' },
  { id: 'glossy',   label: 'Glossy',   tone: 'Silk PLA' },
  { id: 'metallic', label: 'Metallic', tone: 'Silver / gold' },
  { id: 'gradient', label: 'Two-tone', tone: 'Gradient finish' },
]

const ANGLES: { id: 'front' | 'side' | 'back' | 'top' | 'hero'; label: string }[] = [
  { id: 'hero',  label: '3D' },
  { id: 'front', label: 'F' },
  { id: 'side',  label: 'S' },
  { id: 'back',  label: 'B' },
  { id: 'top',   label: 'T' },
]

export default function ViewerControls({
  autoRotate,
  onToggleAutoRotate,
  onSnapTo,
  onReset,
  finish,
  onFinishChange,
  hideFinish,
  hideAngles,
  className = '',
  style,
}: Props) {
  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 bg-bg-primary/85 backdrop-blur border border-border rounded-full px-2 py-1.5 shadow-lg ${className}`}
      style={style}
    >
      {/* Auto-rotate */}
      <button
        type="button"
        onClick={onToggleAutoRotate}
        title={autoRotate ? 'Pause rotation' : 'Auto-rotate'}
        className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
          autoRotate ? 'bg-accent-amber text-bg-primary' : 'text-text-secondary hover:text-accent-amber'
        }`}
      >
        {autoRotate ? <Pause size={12} /> : <Play size={12} />}
      </button>

      {/* Snap angles */}
      {!hideAngles && (
        <>
          <span className="w-px h-4 bg-border mx-0.5" />
          {ANGLES.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onSnapTo(a.id)}
              title={`View: ${a.id}`}
              className="w-7 h-7 rounded-full text-[10px] font-mono font-bold text-text-secondary hover:text-accent-amber hover:bg-bg-tertiary transition-colors"
            >
              {a.label}
            </button>
          ))}
        </>
      )}

      {/* Reset */}
      {onReset && (
        <>
          <span className="w-px h-4 bg-border mx-0.5" />
          <button
            type="button"
            onClick={onReset}
            title="Reset view"
            className="w-7 h-7 rounded-full text-text-secondary hover:text-accent-amber hover:bg-bg-tertiary flex items-center justify-center"
          >
            <RotateCcw size={12} />
          </button>
        </>
      )}

      {/* Finish picker */}
      {!hideFinish && (
        <>
          <span className="w-px h-4 bg-border mx-0.5" />
          <Layers size={11} className="text-text-muted ml-1 mr-0.5" />
          {FINISHES.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onFinishChange(f.id)}
              title={f.tone}
              className={`text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full transition-colors ${
                finish === f.id
                  ? 'bg-accent-amber text-bg-primary'
                  : 'text-text-secondary hover:text-accent-amber hover:bg-bg-tertiary'
              }`}
            >
              {f.label}
            </button>
          ))}
        </>
      )}
    </div>
  )
}
