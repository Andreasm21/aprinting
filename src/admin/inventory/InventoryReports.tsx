import { useMemo, useState } from 'react'
import { Download, Euro, TrendingUp, RefreshCw, Skull } from 'lucide-react'
import { formatStockQty, getMovementValue, getStockLineValue, getStockUnitLabel, useInventoryStore } from '@/stores/inventoryStore'
import InventoryLayout from './InventoryLayout'

function daysSince(dateStr: string, now: number): number {
  return Math.floor((now - new Date(dateStr).getTime()) / 86400000)
}

export default function InventoryReports() {
  const [now] = useState(() => Date.now())
  const products = useInventoryStore((s) => s.products)
  const movements = useInventoryStore((s) => s.movements)
  const getQtyOnHand = useInventoryStore((s) => s.getQtyOnHand)

  const kpis = useMemo(() => {
    const thirtyDaysAgo = now - 30 * 86400000

    // COGS last 30d = sum of (OUT movements qty * unit_cost)
    let cogs30d = 0
    for (const m of movements) {
      if (m.type !== 'OUT') continue
      if (new Date(m.createdAt).getTime() < thirtyDaysAgo) continue
      cogs30d += getMovementValue(products.find((p) => p.id === m.productId), m)
    }

    // Inventory value now
    const invValue = products.reduce((s, p) => s + getStockLineValue(p, Math.max(0, getQtyOnHand(p.id))), 0)

    // Turnover (annualized) = (COGS 30d * 12) / avg inventory
    const turnover = invValue > 0 ? (cogs30d * 12) / invValue : 0
    let health: 'HEALTHY' | 'MODERATE' | 'SLOW' = 'SLOW'
    if (turnover >= 4) health = 'HEALTHY'
    else if (turnover >= 2) health = 'MODERATE'

    return { cogs30d, invValue, turnover, health }
  }, [products, movements, getQtyOnHand, now])

  const aging = useMemo(() => {
    // For each product, find the last OUT movement
    const buckets = [
      { label: '0-30d', min: 0, max: 30, count: 0, value: 0, color: 'bg-accent-green/70' },
      { label: '31-60d', min: 31, max: 60, count: 0, value: 0, color: 'bg-accent-amber/70' },
      { label: '61-90d', min: 61, max: 90, count: 0, value: 0, color: 'bg-orange-500/70' },
      { label: '90-180d', min: 91, max: 180, count: 0, value: 0, color: 'bg-red-400/70' },
      { label: 'Dead (180d+)', min: 181, max: Infinity, count: 0, value: 0, color: 'bg-red-500/90' },
    ]

    for (const p of products) {
      const qty = getQtyOnHand(p.id)
      if (qty <= 0) continue
      const lastOut = movements.find((m) => m.productId === p.id && m.type === 'OUT')
      const days = lastOut ? daysSince(lastOut.createdAt, now) : daysSince(p.createdAt, now)
      const value = getStockLineValue(p, qty)
      for (const b of buckets) {
        if (days >= b.min && days <= b.max) {
          b.count++
          b.value += value
          break
        }
      }
    }
    return buckets
  }, [products, movements, getQtyOnHand, now])

  const deadStock = useMemo(() => {
    return products
      .map((p) => {
        const qty = getQtyOnHand(p.id)
        if (qty <= 0) return null
        const lastOut = movements.find((m) => m.productId === p.id && m.type === 'OUT')
        const days = lastOut ? daysSince(lastOut.createdAt, now) : daysSince(p.createdAt, now)
        if (days < 60) return null
        return { product: p, qty, days, tiedCapital: getStockLineValue(p, qty) }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.tiedCapital - a.tiedCapital)
      .slice(0, 10)
  }, [products, movements, getQtyOnHand, now])

  const maxBucket = Math.max(...aging.map((b) => b.value), 1)

  const exportCSV = () => {
    const header = ['Part Number', 'Name', 'Category', 'Brand', 'Bin', 'Qty', 'Unit', 'Cost', 'Cost Unit', 'Value', 'Status', 'Barcode'].join(',')
    const rows = products.map((p) => {
      const qty = getQtyOnHand(p.id)
      const status = qty <= 0 ? 'OUT' : qty <= p.reorderLevel ? 'LOW' : 'OK'
      const displayQty = formatStockQty(p, qty).replace(` ${getStockUnitLabel(p)}`, '')
      return [
        p.partNumber,
        `"${p.name.replace(/"/g, '""')}"`,
        p.category,
        p.brand || '',
        p.bin || '',
        displayQty,
        getStockUnitLabel(p),
        p.cost.toFixed(2),
        getStockUnitLabel(p),
        getStockLineValue(p, Math.max(0, qty)).toFixed(2),
        status,
        p.barcode || '',
      ].join(',')
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inventory-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <InventoryLayout>
      <div className="flex items-center justify-between mb-4">
        <p className="text-text-secondary text-sm">Inventory analytics & health metrics</p>
        <button onClick={exportCSV} className="btn-outline text-sm py-2 px-4 flex items-center gap-1.5">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="card-base p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">COGS (30d)</span>
            <Euro size={14} className="text-accent-amber" />
          </div>
          <div className="font-mono text-xl font-bold text-accent-amber">€{kpis.cogs30d.toFixed(2)}</div>
        </div>
        <div className="card-base p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">Avg Inventory Value</span>
            <TrendingUp size={14} className="text-accent-blue" />
          </div>
          <div className="font-mono text-xl font-bold text-accent-blue">€{kpis.invValue.toFixed(2)}</div>
        </div>
        <div className="card-base p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">Turnover (annualized)</span>
            <RefreshCw size={14} className={kpis.health === 'HEALTHY' ? 'text-accent-green' : kpis.health === 'MODERATE' ? 'text-accent-amber' : 'text-red-400'} />
          </div>
          <div className={`font-mono text-xl font-bold ${kpis.health === 'HEALTHY' ? 'text-accent-green' : kpis.health === 'MODERATE' ? 'text-accent-amber' : 'text-red-400'}`}>
            {kpis.turnover.toFixed(2)}x
          </div>
          <div className="text-[10px] font-mono text-text-muted mt-1">{kpis.health}</div>
        </div>
      </div>

      {/* Aging chart */}
      <div className="card-base p-5 mb-6">
        <h3 className="font-mono text-xs text-text-muted uppercase tracking-wider mb-4">Inventory Aging</h3>
        <div className="space-y-2">
          {aging.map((b) => (
            <div key={b.label} className="flex items-center gap-3">
              <span className="font-mono text-xs text-text-secondary w-24 uppercase">{b.label}</span>
              <div className="flex-1 bg-bg-tertiary rounded-sm h-6 relative overflow-hidden">
                <div
                  className={`h-full ${b.color} rounded-sm transition-all`}
                  style={{ width: `${(b.value / maxBucket) * 100}%` }}
                />
                <span className="absolute inset-0 flex items-center px-2 font-mono text-[11px] text-text-primary">
                  {b.count} items · €{b.value.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dead Stock */}
      <div className="card-base p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-mono text-xs text-text-muted uppercase tracking-wider flex items-center gap-2">
            <Skull size={12} className="text-red-400" /> Dead Stock (60d+ no OUT)
          </h3>
          <span className="text-[10px] font-mono text-text-muted">Top 10 by tied capital</span>
        </div>
        {deadStock.length === 0 ? (
          <p className="text-text-muted text-xs font-mono text-center py-6">[ NO DEAD STOCK ]</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 font-mono text-xs text-text-muted uppercase">Part #</th>
                  <th className="text-left py-2 font-mono text-xs text-text-muted uppercase">Name</th>
                  <th className="text-right py-2 font-mono text-xs text-text-muted uppercase">Qty</th>
                  <th className="text-right py-2 font-mono text-xs text-text-muted uppercase">Days</th>
                  <th className="text-right py-2 font-mono text-xs text-text-muted uppercase">Tied €</th>
                </tr>
              </thead>
              <tbody>
                {deadStock.map((d) => (
                  <tr key={d.product.id} className="border-b border-border last:border-0 hover:bg-bg-tertiary/50">
                    <td className="py-2 font-mono text-xs text-accent-amber">{d.product.partNumber}</td>
                    <td className="py-2 text-text-secondary text-xs truncate max-w-[300px]">{d.product.name}</td>
                    <td className="py-2 text-right font-mono text-sm text-text-primary">{formatStockQty(d.product, d.qty)}</td>
                    <td className="py-2 text-right font-mono text-xs text-text-muted">{d.days}d</td>
                    <td className="py-2 text-right font-mono text-sm text-red-400 font-bold">€{d.tiedCapital.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </InventoryLayout>
  )
}
