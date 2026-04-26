// Color swatches — 36px circles. Active swatch gets a 2px amber ring.
// Selecting a color emits the hex; product-page color sync hooks listen and
// update all open viewer instances to match.

import type { ProductColor } from '@/types'

interface Props {
  colors: ProductColor[]
  value: string | undefined
  onChange: (hex: string) => void
}

export default function ColorSwatchRow({ colors, value, onChange }: Props) {
  if (colors.length === 0) return null
  return (
    <div className="flex flex-wrap gap-3">
      {colors.map((c) => {
        const active = value === c.hex
        return (
          <button
            key={c.hex + c.name}
            type="button"
            onClick={() => onChange(c.hex)}
            title={c.name}
            className={`w-9 h-9 rounded-full transition-all ${
              active ? 'ring-2 ring-accent-amber ring-offset-2 ring-offset-bg-primary' : ''
            }`}
            style={{ backgroundColor: c.hex }}
            aria-label={c.name}
          />
        )
      })}
    </div>
  )
}
