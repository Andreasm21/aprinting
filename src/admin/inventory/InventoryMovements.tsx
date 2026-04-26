import { useState, useMemo } from 'react'
import { Plus, ArrowDownLeft, ArrowUpRight, RotateCcw, ArrowLeftRight } from 'lucide-react'
import { formatStockQty, getMovementValue, useInventoryStore, type MovementType } from '@/stores/inventoryStore'
import InventoryLayout from './InventoryLayout'
import NewMovementModal from './NewMovementModal'

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export default function InventoryMovements() {
  const movements = useInventoryStore((s) => s.movements)
  const products = useInventoryStore((s) => s.products)
  const [filter, setFilter] = useState<'all' | MovementType>('all')
  const [creating, setCreating] = useState(false)

  const filtered = useMemo(() => {
    if (filter === 'all') return movements
    return movements.filter((m) => m.type === filter)
  }, [movements, filter])

  const counts = useMemo(() => ({
    all: movements.length,
    IN: movements.filter((m) => m.type === 'IN').length,
    OUT: movements.filter((m) => m.type === 'OUT').length,
    ADJUST: movements.filter((m) => m.type === 'ADJUST').length,
  }), [movements])

  return (
    <InventoryLayout>
      <div className="flex items-center justify-between mb-4">
        <p className="text-text-secondary text-sm">{filtered.length} movement{filtered.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setCreating(true)}
          className="btn-amber text-sm py-2 px-4 flex items-center gap-1.5"
        >
          <Plus size={14} /> New Movement
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex gap-1 flex-wrap mb-4">
        {([
          { key: 'all' as const, label: 'All', count: counts.all, color: 'text-text-muted' },
          { key: 'IN' as const, label: 'In', count: counts.IN, color: 'text-accent-green' },
          { key: 'OUT' as const, label: 'Out', count: counts.OUT, color: 'text-red-400' },
          { key: 'ADJUST' as const, label: 'Adjust', count: counts.ADJUST, color: 'text-accent-amber' },
        ]).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-xs font-mono px-3 py-2 rounded-lg border transition-all uppercase ${
              filter === f.key ? 'border-accent-amber text-accent-amber bg-accent-amber/5' : 'border-border text-text-muted hover:text-text-secondary'
            }`}
          >
            {f.label} <span className={`ml-1 opacity-70 ${filter === f.key ? '' : f.color}`}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card-base p-10 text-center">
          <ArrowLeftRight size={32} className="mx-auto text-text-muted/20 mb-3" />
          <p className="text-text-muted text-sm font-mono">[ NO MOVEMENTS ]</p>
        </div>
      ) : (
        <div className="card-base overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 font-mono text-xs text-text-muted uppercase">Type</th>
                <th className="text-left p-3 font-mono text-xs text-text-muted uppercase">Part #</th>
                <th className="text-left p-3 font-mono text-xs text-text-muted uppercase hidden md:table-cell">Reference</th>
                <th className="text-right p-3 font-mono text-xs text-text-muted uppercase">Qty</th>
                <th className="text-right p-3 font-mono text-xs text-text-muted uppercase hidden lg:table-cell">Value</th>
                <th className="text-left p-3 font-mono text-xs text-text-muted uppercase">When</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const p = products.find((x) => x.id === m.productId)
                const value = getMovementValue(p, m)
                const Icon = m.type === 'IN' ? ArrowDownLeft : m.type === 'OUT' ? ArrowUpRight : RotateCcw
                const color = m.type === 'IN' ? 'text-accent-green bg-accent-green/10 border-accent-green/30' : m.type === 'OUT' ? 'text-red-400 bg-red-400/10 border-red-400/30' : 'text-accent-amber bg-accent-amber/10 border-accent-amber/30'
                return (
                  <tr key={m.id} className="border-b border-border last:border-0 hover:bg-bg-tertiary/50">
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${color}`}>
                        <Icon size={10} /> {m.type}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-xs text-accent-amber">{p?.partNumber || '—'}</td>
                    <td className="p-3 font-mono text-xs text-text-secondary hidden md:table-cell">{m.reference || '—'}</td>
                    <td className={`p-3 text-right font-mono text-sm font-bold ${
                      m.type === 'IN' ? 'text-accent-green' : m.type === 'OUT' ? 'text-red-400' : 'text-accent-amber'
                    }`}>
                      {m.type === 'OUT' ? '-' : m.type === 'IN' ? '+' : '±'}{p ? formatStockQty(p, Math.abs(m.qty)) : Math.abs(m.qty)}
                    </td>
                    <td className="p-3 text-right font-mono text-xs text-text-secondary hidden lg:table-cell">€{value.toFixed(2)}</td>
                    <td className="p-3 font-mono text-[11px] text-text-muted whitespace-nowrap">{formatDateTime(m.createdAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating && <NewMovementModal onClose={() => setCreating(false)} />}
    </InventoryLayout>
  )
}
