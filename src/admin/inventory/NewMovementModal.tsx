import { useState, useMemo } from 'react'
import { X, Check, ArrowDownLeft, ArrowUpRight, RotateCcw, Minus, Plus, Search } from 'lucide-react'
import {
  displayQtyToStorage,
  getStockUnitCost,
  getStockUnitLabel,
  useInventoryStore,
  type InventoryProduct,
  type MovementType,
} from '@/stores/inventoryStore'

export default function NewMovementModal({
  presetProduct,
  onClose,
}: {
  presetProduct?: InventoryProduct
  onClose: () => void
}) {
  const products = useInventoryStore((s) => s.products)
  const addMovement = useInventoryStore((s) => s.addMovement)

  const [type, setType] = useState<MovementType>('IN')
  const [product, setProduct] = useState<InventoryProduct | null>(presetProduct || null)
  const [search, setSearch] = useState('')
  const [qty, setQty] = useState(1)
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  const suggestions = useMemo(() => {
    if (!search || product) return []
    const q = search.toLowerCase()
    return products
      .filter((p) => p.partNumber.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || (p.barcode || '').includes(q))
      .slice(0, 5)
  }, [products, search, product])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!product) return
    const storageQty = displayQtyToStorage(product.category, Math.abs(qty))
    addMovement({
      productId: product.id,
      type,
      qty: type === 'ADJUST' && qty < 0 ? -storageQty : storageQty,
      unitCost: getStockUnitCost(product),
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
    })
    onClose()
  }

  const typeOptions = [
    { value: 'IN' as const, label: 'Stock In', icon: ArrowDownLeft, color: 'text-accent-green', activeClass: 'border-accent-green text-accent-green bg-accent-green/10' },
    { value: 'OUT' as const, label: 'Stock Out', icon: ArrowUpRight, color: 'text-red-400', activeClass: 'border-red-400 text-red-400 bg-red-400/10' },
    { value: 'ADJUST' as const, label: 'Adjust', icon: RotateCcw, color: 'text-accent-amber', activeClass: 'border-accent-amber text-accent-amber bg-accent-amber/10' },
  ]

  const confirmColor = type === 'IN' ? 'bg-accent-green text-bg-primary' : type === 'OUT' ? 'bg-red-400 text-bg-primary' : 'bg-accent-amber text-bg-primary'
  const qtyUnit = product ? getStockUnitLabel(product) : 'pcs'
  const qtyStep = qtyUnit === 'kg' ? 0.1 : 1

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-bg-secondary border border-border rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-bg-secondary z-10">
          <h2 className="font-mono text-lg font-bold text-text-primary">New Movement</h2>
          <button onClick={onClose} className="p-1 hover:bg-bg-tertiary rounded">
            <X size={20} className="text-text-muted" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Type selector */}
          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-2">Type</label>
            <div className="grid grid-cols-3 gap-2">
              {typeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={`py-4 rounded-lg border-2 font-mono text-sm font-bold transition-all flex flex-col items-center gap-1 ${
                    type === opt.value ? opt.activeClass : 'border-border text-text-muted hover:border-text-secondary'
                  }`}
                >
                  <opt.icon size={18} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Product selector */}
          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1">Product</label>
            {product ? (
              <div className="flex items-center gap-3 bg-bg-tertiary rounded-lg p-3 border border-border">
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm text-accent-amber">{product.partNumber}</p>
                  <p className="text-[11px] text-text-muted truncate">{product.name}</p>
                </div>
                <button type="button" onClick={() => setProduct(null)} className="text-[10px] font-mono text-text-muted hover:text-accent-amber">
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by part #, name, barcode..."
                  className="input-field pl-9 text-sm"
                  autoFocus
                />
                {suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-bg-secondary border border-border rounded-lg shadow-xl max-h-64 overflow-y-auto z-10">
                    {suggestions.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setProduct(p); setSearch('') }}
                        className="w-full text-left px-3 py-2 hover:bg-bg-tertiary transition-colors border-b border-border last:border-0"
                      >
                        <div className="font-mono text-xs text-accent-amber">{p.partNumber}</div>
                        <div className="text-[11px] text-text-muted truncate">{p.name}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quantity stepper */}
          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-2">
              Quantity ({qtyUnit}) {type === 'ADJUST' && <span className="text-text-muted">(+/- delta)</span>}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQty(type === 'ADJUST' ? qty - qtyStep : Math.max(qtyStep, qty - qtyStep))}
                className="w-12 h-12 rounded-lg border border-border hover:border-accent-amber flex items-center justify-center text-text-muted hover:text-accent-amber transition-all"
              >
                <Minus size={20} />
              </button>
              <input
                type="number"
                step={qtyStep}
                value={qty}
                onChange={(e) => setQty(parseFloat(e.target.value) || 0)}
                className="input-field text-center text-lg font-mono font-bold flex-1 h-12"
              />
              <button
                type="button"
                onClick={() => setQty(qty + qtyStep)}
                className="w-12 h-12 rounded-lg border border-border hover:border-accent-amber flex items-center justify-center text-text-muted hover:text-accent-amber transition-all"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          {/* Reference */}
          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1">Reference</label>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="PO-26-0060, JOB-3612, MAINT-0120..."
              className="input-field text-sm font-mono"
            />
            <p className="text-[10px] text-text-muted font-mono mt-1">
              PO = purchase · JOB = print job · MAINT = maintenance · SALE = sale · PROD = in-house
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="input-field text-sm resize-none"
              placeholder="Optional..."
            />
          </div>

          <div className="flex gap-3 pt-3 border-t border-border">
            <button type="button" onClick={onClose} className="btn-outline text-sm py-2 px-4 flex-1">Cancel</button>
            <button
              type="submit"
              disabled={!product || qty === 0}
              className={`${confirmColor} flex-1 font-mono text-sm font-bold py-3 rounded-lg transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5`}
            >
              <Check size={14} /> Confirm {type}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
