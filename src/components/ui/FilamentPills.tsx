// Segmented filament selector — mutually exclusive pills with a price-modifier
// subtext when a filament costs extra. Used on the product page + quick-view modal.

import type { ProductFilament } from '@/types'

interface Props {
  filaments: ProductFilament[]
  value: string | undefined
  onChange: (name: string) => void
}

export default function FilamentPills({ filaments, value, onChange }: Props) {
  if (filaments.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2">
      {filaments.map((f) => {
        const active = value === f.name
        return (
          <button
            key={f.name}
            type="button"
            onClick={() => onChange(f.name)}
            className={`flex flex-col items-start gap-0.5 px-4 py-2.5 rounded-lg border text-left transition-all ${
              active
                ? 'border-accent-amber bg-accent-amber/10 text-accent-amber'
                : 'border-border text-text-secondary hover:border-text-muted hover:text-text-primary'
            }`}
          >
            <span className="font-mono text-sm font-bold uppercase tracking-wider">{f.name}</span>
            {f.extra_eur !== 0 && (
              <span className={`text-[10px] font-mono ${active ? 'text-accent-amber/80' : 'text-text-muted'}`}>
                {f.extra_eur > 0 ? `+€${f.extra_eur.toFixed(2)}` : `-€${Math.abs(f.extra_eur).toFixed(2)}`}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
