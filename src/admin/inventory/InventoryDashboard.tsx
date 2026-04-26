import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Package, TrendingUp, Clock, ArrowDownLeft, ArrowUpRight, RotateCcw, Euro } from 'lucide-react'
import {
  CATEGORIES,
  formatStockQty,
  getMovementValue,
  getStockLineValue,
  useInventoryStore,
  type MovementType,
} from '@/stores/inventoryStore'
import InventoryLayout from './InventoryLayout'

const CATEGORY_COLORS: Record<string, string> = {
  PLA: '#F59E0B',
  PETG: '#FB923C',
  ABS: '#EF4444',
  TPU: '#A855F7',
  Resin: '#3B82F6',
  Nylon: '#22C55E',
  Hardware: '#64748B',
  Finished: '#EC4899',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-GB')
}

function MovementIcon({ type }: { type: MovementType }) {
  if (type === 'IN') return <ArrowDownLeft size={12} className="text-accent-green" />
  if (type === 'OUT') return <ArrowUpRight size={12} className="text-red-400" />
  return <RotateCcw size={12} className="text-accent-amber" />
}

export default function InventoryDashboard() {
  const [now] = useState(() => Date.now())
  const products = useInventoryStore((s) => s.products)
  const movements = useInventoryStore((s) => s.movements)
  const getQtyOnHand = useInventoryStore((s) => s.getQtyOnHand)
  const getStockStatus = useInventoryStore((s) => s.getStockStatus)

  const stats = useMemo(() => {
    let totalValue = 0
    let stockedSkus = 0
    let lowStock = 0
    let outOfStock = 0

    for (const p of products) {
      const qty = getQtyOnHand(p.id)
      totalValue += getStockLineValue(p, Math.max(0, qty))
      if (qty > 0) stockedSkus++
      if (qty <= 0) outOfStock++
      else if (qty <= p.reorderLevel) lowStock++
    }

    return { totalValue, stockedSkus, skus: products.length, lowStock, outOfStock }
  }, [products, getQtyOnHand])

  const lowStockItems = useMemo(() => {
    return products
      .filter((p) => !p.archived)
      .map((p) => ({ product: p, qty: getQtyOnHand(p.id), status: getStockStatus(p.id) }))
      .filter((item) => item.status !== 'OK')
      .sort((a, b) => a.qty - b.qty)
      .slice(0, 8)
  }, [products, getQtyOnHand, getStockStatus])

  const categoryBreakdown = useMemo(() => {
    return CATEGORIES.map((cat) => {
      const items = products.filter((p) => p.category === cat)
      const value = items.reduce((sum, p) => sum + getStockLineValue(p, Math.max(0, getQtyOnHand(p.id))), 0)
      return { category: cat, value, color: CATEGORY_COLORS[cat] }
    }).filter((c) => c.value > 0)
  }, [products, getQtyOnHand])

  const totalCategoryValue = categoryBreakdown.reduce((s, c) => s + c.value, 0)

  const recentMovements = useMemo(() => movements.slice(0, 8), [movements])

  const topMovers = useMemo(() => {
    const thirtyDaysAgo = now - 30 * 86400000
    const counts = new Map<string, { qty: number; value: number }>()
    for (const m of movements) {
      if (m.type !== 'OUT') continue
      if (new Date(m.createdAt).getTime() < thirtyDaysAgo) continue
      const p = products.find((product) => product.id === m.productId)
      const existing = counts.get(m.productId) || { qty: 0, value: 0 }
      counts.set(m.productId, {
        qty: existing.qty + m.qty,
        value: existing.value + getMovementValue(p, m),
      })
    }
    return Array.from(counts.entries())
      .map(([productId, movement]) => ({
        product: products.find((p) => p.id === productId),
        qty: movement.qty,
        value: movement.value,
      }))
      .filter((x) => x.product)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
  }, [movements, now, products])

  const topMoverMax = Math.max(...topMovers.map((m) => m.value), 1)

  const stops = (() => {
    if (categoryBreakdown.length === 0) return ''
    let cumulative = 0
    return categoryBreakdown.map((c) => {
      const start = cumulative
      cumulative += (c.value / totalCategoryValue) * 100
      return `${c.color} ${start}% ${cumulative}%`
    }).join(', ')
  })()

  return (
    <InventoryLayout>
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Stock Value', value: `€${stats.totalValue.toFixed(2)}`, icon: Euro, color: 'text-accent-amber' },
          { label: 'Stocked SKUs', value: stats.stockedSkus.toString(), icon: Package, color: 'text-accent-blue' },
          { label: 'SKUs', value: stats.skus.toString(), icon: TrendingUp, color: 'text-accent-green' },
          { label: 'Low / Out', value: `${stats.lowStock} / ${stats.outOfStock}`, icon: AlertTriangle, color: stats.outOfStock > 0 ? 'text-red-400' : 'text-accent-amber' },
        ].map((kpi) => (
          <div key={kpi.label} className="card-base p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">{kpi.label}</span>
              <kpi.icon size={14} className={kpi.color} />
            </div>
            <div className={`font-mono text-xl font-bold ${kpi.color}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        {/* Value by Category — CSS donut */}
        <div className="card-base p-5">
          <h3 className="font-mono text-xs text-text-muted uppercase tracking-wider mb-4">Value by Category</h3>
          {categoryBreakdown.length === 0 ? (
            <p className="text-text-muted text-xs font-mono text-center py-8">[ NO DATA ]</p>
          ) : (
            <div className="flex items-center gap-6">
              <div className="shrink-0">
                <div
                  className="w-32 h-32 rounded-full flex items-center justify-center"
                  style={{ background: `conic-gradient(${stops})` }}
                >
                  <div className="w-20 h-20 rounded-full bg-bg-secondary flex flex-col items-center justify-center">
                    <span className="text-[10px] font-mono text-text-muted">TOTAL</span>
                    <span className="text-sm font-mono font-bold text-text-primary">€{totalCategoryValue.toFixed(0)}</span>
                  </div>
                </div>
              </div>
              <div className="flex-1 space-y-1.5 text-xs">
                {categoryBreakdown.map((c) => (
                  <div key={c.category} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                      <span className="font-mono text-text-secondary uppercase">{c.category}</span>
                    </div>
                    <span className="font-mono text-text-primary">€{c.value.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Top movers 30d */}
        <div className="card-base p-5">
          <h3 className="font-mono text-xs text-text-muted uppercase tracking-wider mb-4">Top Movers (30d OUT)</h3>
          {topMovers.length === 0 ? (
            <p className="text-text-muted text-xs font-mono text-center py-8">[ NO OUTBOUND ACTIVITY ]</p>
          ) : (
            <div className="space-y-2">
              {topMovers.map((m) => (
                <div key={m.product!.id} className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-accent-amber w-32 truncate">{m.product!.partNumber}</span>
                  <div className="flex-1 bg-bg-tertiary rounded-sm h-5 relative overflow-hidden">
                    <div
                      className="h-full bg-accent-amber/60 rounded-sm"
                      style={{ width: `${(m.value / topMoverMax) * 100}%` }}
                    />
                    <span className="absolute inset-0 flex items-center px-2 font-mono text-[10px] text-text-primary">
                      {formatStockQty(m.product!, m.qty)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Low stock + Recent movements */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Low Stock Alerts */}
        <div className="card-base p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-mono text-xs text-text-muted uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle size={12} className="text-red-400" /> Low Stock Alerts
            </h3>
            <Link to="/admin/inventory/products" className="text-[10px] font-mono text-accent-amber hover:underline">
              View all
            </Link>
          </div>
          {lowStockItems.length === 0 ? (
            <p className="text-text-muted text-xs font-mono text-center py-8">[ ALL STOCK LEVELS NOMINAL ]</p>
          ) : (
            <div className="space-y-1">
              {lowStockItems.map((item) => (
                <div
                  key={item.product.id}
                  className={`flex items-center gap-3 p-2.5 border-l-2 ${
                    item.status === 'OUT' ? 'border-red-400 bg-red-400/5' : 'border-accent-amber bg-accent-amber/5'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs text-accent-amber truncate">{item.product.partNumber}</p>
                    <p className="text-[11px] text-text-muted truncate">{item.product.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-mono text-sm font-bold ${item.status === 'OUT' ? 'text-red-400' : 'text-accent-amber'}`}>
                      {formatStockQty(item.product, item.qty)}
                    </p>
                    <p className="text-[10px] text-text-muted font-mono">min {formatStockQty(item.product, item.product.reorderLevel)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Movements */}
        <div className="card-base p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-mono text-xs text-text-muted uppercase tracking-wider flex items-center gap-2">
              <Clock size={12} className="text-accent-amber" /> Recent Movements
            </h3>
            <Link to="/admin/inventory/movements" className="text-[10px] font-mono text-accent-amber hover:underline">
              View all
            </Link>
          </div>
          {recentMovements.length === 0 ? (
            <p className="text-text-muted text-xs font-mono text-center py-8">[ NO MOVEMENTS YET ]</p>
          ) : (
            <div className="space-y-1">
              {recentMovements.map((m) => {
                const p = products.find((x) => x.id === m.productId)
                return (
                  <div key={m.id} className="flex items-center gap-3 p-2 hover:bg-bg-tertiary/50 rounded">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      m.type === 'IN' ? 'bg-accent-green/10' : m.type === 'OUT' ? 'bg-red-400/10' : 'bg-accent-amber/10'
                    }`}>
                      <MovementIcon type={m.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-accent-amber truncate">{p?.partNumber || m.productId}</span>
                        <span className="text-[10px] font-mono text-text-muted">{m.reference}</span>
                      </div>
                      <p className="text-[10px] text-text-muted font-mono">{timeAgo(m.createdAt)}</p>
                    </div>
                    <span className={`font-mono text-xs font-bold ${
                      m.type === 'IN' ? 'text-accent-green' : m.type === 'OUT' ? 'text-red-400' : 'text-accent-amber'
                    }`}>
                      {m.type === 'OUT' ? '-' : m.type === 'IN' ? '+' : '±'}{p ? formatStockQty(p, Math.abs(m.qty)) : Math.abs(m.qty)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </InventoryLayout>
  )
}
