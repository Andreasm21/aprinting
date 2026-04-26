import { Minus, Plus } from 'lucide-react'

interface Props {
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
}

export default function QtyStepper({ value, onChange, min = 1, max = 99 }: Props) {
  const dec = () => onChange(Math.max(min, value - 1))
  const inc = () => onChange(Math.min(max, value + 1))
  return (
    <div className="inline-flex items-center bg-bg-tertiary border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={dec}
        disabled={value <= min}
        className="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-accent-amber disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <Minus size={14} />
      </button>
      <span className="w-12 text-center font-mono text-sm text-text-primary">{value}</span>
      <button
        type="button"
        onClick={inc}
        disabled={value >= max}
        className="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-accent-amber disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <Plus size={14} />
      </button>
    </div>
  )
}
