import { useState, useMemo } from 'react'
import { Plus, Search, Edit3, Trash2, Package, QrCode, FileText, X, AlertTriangle } from 'lucide-react'
import { useInventoryStore, CATEGORIES, type InventoryProduct, type InventoryCategory, type StockStatus } from '@/stores/inventoryStore'
import { useQuoteCartStore } from '@/stores/quoteCartStore'
import InventoryLayout from './InventoryLayout'
import InventoryProductFormModal from './InventoryProductFormModal'
import InventoryLabelModal from './InventoryLabelModal'

const STATUS_STYLE: Record<StockStatus, string> = {
  OK: 'text-accent-green bg-accent-green/10 border-accent-green/30',
  LOW: 'text-accent-amber bg-accent-amber/10 border-accent-amber/30',
  OUT: 'text-red-400 bg-red-400/10 border-red-400/30',
}

export default function InventoryProducts() {
  const products = useInventoryStore((s) => s.products)
  const addProduct = useInventoryStore((s) => s.addProduct)
  const updateProduct = useInventoryStore((s) => s.updateProduct)
  const deleteProduct = useInventoryStore((s) => s.deleteProduct)
  const addMovement = useInventoryStore((s) => s.addMovement)
  const getQtyOnHand = useInventoryStore((s) => s.getQtyOnHand)
  const getStockStatus = useInventoryStore((s) => s.getStockStatus)

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<'all' | InventoryCategory>('all')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<InventoryProduct | null>(null)
  const [labeling, setLabeling] = useState<InventoryProduct | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ ids: string[]; label: string } | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [justQuoted, setJustQuoted] = useState<string | null>(null)
  const addToQuoteCart = useQuoteCartStore((s) => s.addItem)

  const handleQuote = (p: InventoryProduct) => {
    // For filament spools, the description should be just the filament kind (PLA, PETG, etc.)
    // — no brand. For Hardware/Finished items keep the descriptive name.
    const isFilament = ['PLA', 'PETG', 'ABS', 'TPU', 'Resin', 'Nylon'].includes(p.category)
    const desc = isFilament ? p.category : `${p.partNumber} — ${p.name}`
    addToQuoteCart({
      source: 'inventory',
      productId: p.id,
      partNumber: p.partNumber,
      description: desc,
      unitPrice: p.price,
      material: p.category,
    })
    setJustQuoted(p.id)
    setTimeout(() => setJustQuoted(null), 1500)
  }

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (p.archived) return false
      if (category !== 'all' && p.category !== category) return false
      if (!search) return true
      const q = search.toLowerCase()
      return (
        p.partNumber.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        (p.barcode || '').includes(q)
      )
    })
  }, [products, search, category])

  const requestDelete = (id: string) => {
    const p = products.find((x) => x.id === id)
    if (!p) return
    setDeleteTarget({ ids: [id], label: `${p.partNumber} — ${p.name}` })
    setDeleteConfirmText('')
  }

  const requestBulkDelete = () => {
    if (selectedIds.size === 0) return
    setDeleteTarget({ ids: Array.from(selectedIds), label: `${selectedIds.size} selected product${selectedIds.size > 1 ? 's' : ''}` })
    setDeleteConfirmText('')
  }

  const confirmDeletion = () => {
    if (!deleteTarget) return
    if (deleteConfirmText.trim().toLowerCase() !== 'delete') return
    for (const id of deleteTarget.ids) deleteProduct(id)
    setDeleteTarget(null)
    setDeleteConfirmText('')
    setSelectedIds(new Set())
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((p) => p.id)))
    }
  }

  return (
    <InventoryLayout>
      <div className="flex items-center justify-between mb-4">
        <p className="text-text-secondary text-sm">
          {filtered.length} product{filtered.length !== 1 ? 's' : ''}
          {selectedIds.size > 0 && <span className="ml-2 text-accent-amber">· {selectedIds.size} selected</span>}
        </p>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={requestBulkDelete}
              className="text-xs font-mono py-2 px-4 rounded-lg border border-red-400 text-red-400 hover:bg-red-400/10 flex items-center gap-1.5"
            >
              <Trash2 size={13} /> Delete {selectedIds.size}
            </button>
          )}
          <button
            onClick={() => setAdding(true)}
            className="btn-amber text-sm py-2 px-4 flex items-center gap-1.5"
          >
            <Plus size={14} /> Add Product
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search part #, name, brand, barcode..."
            className="input-field pl-9 text-sm py-2"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setCategory('all')}
            className={`text-xs font-mono px-3 py-2 rounded-lg border transition-all ${
              category === 'all' ? 'border-accent-amber text-accent-amber bg-accent-amber/5' : 'border-border text-text-muted hover:text-text-secondary'
            }`}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`text-xs font-mono px-3 py-2 rounded-lg border transition-all ${
                category === c ? 'border-accent-amber text-accent-amber bg-accent-amber/5' : 'border-border text-text-muted hover:text-text-secondary'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card-base p-10 text-center">
          <Package size={32} className="mx-auto text-text-muted/20 mb-3" />
          <p className="text-text-muted text-sm font-mono">[ NO PRODUCTS FOUND ]</p>
        </div>
      ) : (
        <div className="card-base overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="p-3 w-8">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onChange={toggleSelectAll}
                    className="accent-accent-amber"
                  />
                </th>
                <th className="text-left p-3 font-mono text-xs text-text-muted uppercase">Part #</th>
                <th className="text-left p-3 font-mono text-xs text-text-muted uppercase">Name</th>
                <th className="text-left p-3 font-mono text-xs text-text-muted uppercase">Cat</th>
                <th className="text-left p-3 font-mono text-xs text-text-muted uppercase hidden md:table-cell">Bin</th>
                <th className="text-right p-3 font-mono text-xs text-text-muted uppercase">Qty</th>
                <th className="text-right p-3 font-mono text-xs text-text-muted uppercase hidden lg:table-cell">Cost</th>
                <th className="text-center p-3 font-mono text-xs text-text-muted uppercase">Status</th>
                <th className="text-right p-3 font-mono text-xs text-text-muted uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const qty = getQtyOnHand(p.id)
                const status = getStockStatus(p.id)
                return (
                  <tr key={p.id} className={`border-b border-border last:border-0 hover:bg-bg-tertiary/50 ${selectedIds.has(p.id) ? 'bg-accent-amber/5' : ''}`}>
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={() => toggleSelect(p.id)}
                        className="accent-accent-amber"
                      />
                    </td>
                    <td className="p-3 font-mono text-xs text-accent-amber whitespace-nowrap">{p.partNumber}</td>
                    <td className="p-3">
                      <div className="text-text-primary text-sm truncate max-w-[280px]">{p.name}</div>
                      {p.brand && <div className="text-[11px] text-text-muted">{p.brand}</div>}
                    </td>
                    <td className="p-3 font-mono text-[10px] uppercase text-text-muted">{p.category}</td>
                    <td className="p-3 font-mono text-xs text-text-secondary hidden md:table-cell">{p.bin || '—'}</td>
                    <td className="p-3 text-right font-mono text-sm text-text-primary">{qty}</td>
                    <td className="p-3 text-right font-mono text-xs text-text-secondary hidden lg:table-cell">€{p.cost.toFixed(2)}</td>
                    <td className="p-3 text-center">
                      <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${STATUS_STYLE[status]}`}>
                        {status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleQuote(p)}
                          className={`p-1.5 rounded transition-all ${
                            justQuoted === p.id
                              ? 'bg-accent-green/20 text-accent-green'
                              : 'hover:bg-bg-tertiary text-text-muted hover:text-accent-amber'
                          }`}
                          title="Add to quote cart"
                        >
                          {justQuoted === p.id ? <span className="text-[10px] font-mono px-1">+1</span> : <FileText size={14} />}
                        </button>
                        <button
                          onClick={() => setLabeling(p)}
                          className="p-1.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-accent-amber"
                          title="Print label"
                        >
                          <QrCode size={14} />
                        </button>
                        <button
                          onClick={() => setEditing(p)}
                          className="p-1.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-accent-blue"
                          title="Edit"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => requestDelete(p.id)}
                          className="p-1.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-red-400"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <InventoryProductFormModal
          title="Add Product"
          onSave={(data, initialQty) => {
            const id = addProduct(data)
            if (initialQty && initialQty > 0) {
              addMovement({
                productId: id,
                type: 'IN',
                qty: initialQty,
                unitCost: data.cost,
                notes: 'Initial stock',
              })
            }
            setAdding(false)
          }}
          onClose={() => setAdding(false)}
        />
      )}

      {editing && (
        <InventoryProductFormModal
          title={`Edit ${editing.partNumber}`}
          initial={editing}
          onSave={(data) => { updateProduct(editing.id, data); setEditing(null) }}
          onClose={() => setEditing(null)}
        />
      )}

      {labeling && <InventoryLabelModal product={labeling} onClose={() => setLabeling(null)} />}

      {/* Delete confirmation — requires typing "delete" */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-bg-secondary border border-red-400/30 rounded-lg max-w-md w-full p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-red-400/10 flex items-center justify-center">
                  <AlertTriangle size={18} className="text-red-400" />
                </div>
                <div>
                  <h3 className="font-mono text-base font-bold text-text-primary">Confirm Delete</h3>
                  <p className="text-text-muted text-xs font-mono">This action cannot be undone</p>
                </div>
              </div>
              <button onClick={() => { setDeleteTarget(null); setDeleteConfirmText('') }} className="p-1 hover:bg-bg-tertiary rounded">
                <X size={18} className="text-text-muted" />
              </button>
            </div>

            <div className="bg-bg-tertiary rounded-lg p-3 mb-4 border-l-2 border-red-400">
              <p className="text-text-secondary text-sm">You are about to permanently delete:</p>
              <p className="font-mono text-sm text-text-primary mt-1 break-words">{deleteTarget.label}</p>
            </div>

            <label className="block font-mono text-xs text-text-muted uppercase mb-1.5">
              Type <span className="text-red-400 font-bold">delete</span> to confirm
            </label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && deleteConfirmText.trim().toLowerCase() === 'delete') confirmDeletion() }}
              placeholder="delete"
              autoFocus
              className="input-field text-sm font-mono mb-4"
            />

            <div className="flex gap-2">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteConfirmText('') }}
                className="btn-outline flex-1 text-sm py-2"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeletion}
                disabled={deleteConfirmText.trim().toLowerCase() !== 'delete'}
                className="flex-1 bg-red-400 text-bg-primary font-mono font-bold py-2 rounded-lg hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 text-sm"
              >
                <Trash2 size={14} /> Delete {deleteTarget.ids.length > 1 ? `(${deleteTarget.ids.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </InventoryLayout>
  )
}
