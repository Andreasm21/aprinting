import { useState, useMemo } from 'react'
import { Truck, Plus, ExternalLink, Package, CheckCircle2, Clock, X, Trash2, ChevronDown, ChevronUp, Boxes, Search, Edit3 } from 'lucide-react'
import { usePurchaseOrdersStore, type PurchaseOrder, type POStatus, type POItem } from '@/stores/purchaseOrdersStore'
import { displayQtyToStorage, isFilamentCategory, useInventoryStore, CATEGORIES, type InventoryCategory } from '@/stores/inventoryStore'
import InventoryLayout from './InventoryLayout'
import DeleteConfirmModal from '../components/DeleteConfirmModal'

const STATUS_COLORS: Record<POStatus, string> = {
  ordered: 'text-accent-amber bg-accent-amber/10 border-accent-amber/30',
  shipped: 'text-accent-blue bg-accent-blue/10 border-accent-blue/30',
  received: 'text-accent-green bg-accent-green/10 border-accent-green/30',
  cancelled: 'text-text-muted bg-bg-tertiary border-border',
}

// Common Cyprus / international carriers + tracking URL templates
const CARRIERS = [
  { name: 'DHL', url: 'https://www.dhl.com/en/express/tracking.html?AWB=' },
  { name: 'FedEx', url: 'https://www.fedex.com/fedextrack/?tracknumbers=' },
  { name: 'UPS', url: 'https://www.ups.com/track?tracknum=' },
  { name: 'TNT', url: 'https://www.tnt.com/express/en_eu/site/shipping-tools/tracking.html?searchType=con&cons=' },
  { name: 'Cyprus Post', url: 'https://trackandtrace.cypruspost.gov.cy/?term=' },
  { name: 'ACS Courier', url: 'https://www.acscourier.net/en/track-trace?tracking_id=' },
  { name: 'Other', url: '' },
]

function formatDate(d?: string): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function buildTrackingUrl(carrier?: string, number?: string): string | null {
  if (!carrier || !number) return null
  const c = CARRIERS.find((x) => x.name === carrier)
  if (!c || !c.url) return null
  return c.url + encodeURIComponent(number)
}

export default function InventoryOrders() {
  const orders = usePurchaseOrdersStore((s) => s.orders)
  const addOrder = usePurchaseOrdersStore((s) => s.addOrder)
  const updateOrder = usePurchaseOrdersStore((s) => s.updateOrder)
  const deleteOrder = usePurchaseOrdersStore((s) => s.deleteOrder)
  const receiveItem = usePurchaseOrdersStore((s) => s.receiveItem)
  const addInventoryProduct = useInventoryStore((s) => s.addProduct)
  const inventoryProducts = useInventoryStore((s) => s.products)

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<PurchaseOrder | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | POStatus>('all')
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrder | null>(null)

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false
      if (!search) return true
      const q = search.toLowerCase()
      return o.poNumber.toLowerCase().includes(q) || o.supplier.toLowerCase().includes(q) || (o.trackingNumber || '').toLowerCase().includes(q)
    })
  }, [orders, search, statusFilter])

  const stats = useMemo(() => ({
    all: orders.length,
    ordered: orders.filter((o) => o.status === 'ordered').length,
    shipped: orders.filter((o) => o.status === 'shipped').length,
    received: orders.filter((o) => o.status === 'received').length,
  }), [orders])

  const generateBarcode = () => {
    const allBarcodes = inventoryProducts.map((p) => p.barcode).filter((b): b is string => !!b && /^\d+$/.test(b))
    const nums = allBarcodes.map((b) => parseInt(b))
    const max = nums.length > 0 ? Math.max(...nums) : 4710881830200
    return String(max + 1).padStart(13, '0')
  }

  const handleReceiveItem = (order: PurchaseOrder, item: POItem) => {
    // Check if part number already exists
    const existing = inventoryProducts.find((p) => p.partNumber === item.partNumber)
    if (existing) {
      // Already in inventory — just mark as received
      receiveItem(order.id, item.id, existing.id)
      return
    }
    // Create new inventory product
    const newId = addInventoryProduct({
      partNumber: item.partNumber,
      name: item.name,
      category: item.category as InventoryCategory,
      brand: order.supplier,
      cost: item.unitCost,
      price: item.unitCost * 2, // default markup 2x
      reorderLevel: isFilamentCategory(item.category) ? displayQtyToStorage(item.category, 0.2) : Math.ceil(item.quantity / 4),
      barcode: generateBarcode(),
      supplier: order.supplier,
      unitWeightGrams: isFilamentCategory(item.category) ? 1000 : undefined,
      archived: false,
    })
    receiveItem(order.id, item.id, newId)
  }

  return (
    <InventoryLayout>
      <div className="flex items-center justify-between mb-4">
        <p className="text-text-secondary text-sm">{filtered.length} order{filtered.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setCreating(true)} className="btn-amber text-sm py-2 px-4 flex items-center gap-1.5">
          <Plus size={14} /> New Purchase Order
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: 'All', value: stats.all, color: 'text-text-primary' },
          { label: 'Ordered', value: stats.ordered, color: 'text-accent-amber' },
          { label: 'Shipped', value: stats.shipped, color: 'text-accent-blue' },
          { label: 'Received', value: stats.received, color: 'text-accent-green' },
        ].map((s) => (
          <div key={s.label} className="card-base p-3 text-center">
            <div className={`font-mono text-lg font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-text-muted uppercase font-mono">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PO #, supplier, tracking..."
            className="input-field pl-9 text-sm py-2"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'ordered', 'shipped', 'received', 'cancelled'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs font-mono px-3 py-2 rounded-lg border transition-all uppercase ${
                statusFilter === s ? 'border-accent-amber text-accent-amber bg-accent-amber/5' : 'border-border text-text-muted hover:text-text-secondary'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card-base p-10 text-center">
          <Truck size={32} className="mx-auto text-text-muted/20 mb-3" />
          <p className="text-text-muted text-sm font-mono">[ NO PURCHASE ORDERS ]</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => {
            const isExpanded = expandedId === o.id
            const trackingUrl = buildTrackingUrl(o.carrier, o.trackingNumber)
            const receivedCount = o.items.filter((i) => i.received).length
            const totalValue = o.items.reduce((s, i) => s + i.unitCost * i.quantity, 0)

            return (
              <div key={o.id} className="card-base overflow-hidden">
                {/* Header row */}
                <div
                  className="p-4 flex items-center gap-3 cursor-pointer hover:bg-bg-tertiary/30"
                  onClick={() => setExpandedId(isExpanded ? null : o.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm text-accent-amber">{o.poNumber}</span>
                      <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${STATUS_COLORS[o.status]}`}>
                        {o.status}
                      </span>
                      {o.trackingNumber && (
                        <span className="text-[10px] font-mono text-text-muted flex items-center gap-1">
                          <Truck size={10} /> {o.carrier} · {o.trackingNumber}
                        </span>
                      )}
                    </div>
                    <p className="text-text-primary text-sm mt-1">{o.supplier}</p>
                    <p className="text-[11px] text-text-muted font-mono">
                      {o.items.length} items · €{totalValue.toFixed(2)} · Ordered {formatDate(o.orderedAt)}
                      {o.expectedAt && ` · Expected ${formatDate(o.expectedAt)}`}
                      · {receivedCount}/{o.items.length} received
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {trackingUrl && (
                      <a
                        href={trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs font-mono text-accent-blue hover:underline flex items-center gap-1 px-2 py-1 rounded border border-accent-blue/30 hover:bg-accent-blue/10"
                        title="Track shipment"
                      >
                        <ExternalLink size={12} /> Track
                      </a>
                    )}
                    {isExpanded ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
                  </div>
                </div>

                {/* Expanded — items + actions */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border">
                    {o.notes && (
                      <p className="text-text-muted text-xs italic mt-3">{o.notes}</p>
                    )}

                    {/* Items table */}
                    <div className="mt-3">
                      <h4 className="font-mono text-[10px] text-text-muted uppercase tracking-wider mb-2">Expected Items</h4>
                      <div className="space-y-1">
                        {o.items.map((it) => (
                          <div key={it.id} className={`flex items-center gap-3 p-2 rounded border ${it.received ? 'bg-accent-green/5 border-accent-green/30' : 'bg-bg-tertiary border-border'}`}>
                            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0">
                              {it.received ? <CheckCircle2 size={14} className="text-accent-green" /> : <Clock size={14} className="text-text-muted" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs text-accent-amber">{it.partNumber}</span>
                                <span className="text-[10px] font-mono uppercase text-text-muted">{it.category}</span>
                              </div>
                              <p className="text-sm text-text-primary truncate">{it.name}</p>
                            </div>
                            <div className="text-right text-xs font-mono text-text-muted shrink-0">
                              <p>{it.quantity} × €{it.unitCost.toFixed(2)}</p>
                              <p className="text-text-secondary">€{(it.quantity * it.unitCost).toFixed(2)}</p>
                            </div>
                            {!it.received && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleReceiveItem(o, it) }}
                                className="text-xs font-mono py-1.5 px-3 rounded bg-accent-green/10 text-accent-green hover:bg-accent-green/20 border border-accent-green/30 flex items-center gap-1 shrink-0"
                                title="Mark as received and add to inventory"
                              >
                                <Boxes size={12} /> Receive
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Order actions */}
                    <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-border">
                      {o.status === 'ordered' && (
                        <button
                          onClick={() => updateOrder(o.id, { status: 'shipped' })}
                          className="text-xs font-mono py-1.5 px-3 rounded border border-accent-blue/30 text-accent-blue hover:bg-accent-blue/10 flex items-center gap-1"
                        >
                          <Truck size={12} /> Mark Shipped
                        </button>
                      )}
                      <button
                        onClick={() => setEditing(o)}
                        className="text-xs font-mono py-1.5 px-3 rounded border border-border text-text-muted hover:text-accent-amber hover:border-accent-amber flex items-center gap-1"
                      >
                        <Edit3 size={12} /> Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(o)}
                        className="text-xs font-mono py-1.5 px-3 rounded border border-border text-text-muted hover:text-red-400 hover:border-red-400 flex items-center gap-1"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create / Edit modal */}
      {(creating || editing) && (
        <PurchaseOrderFormModal
          initial={editing || undefined}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSave={(data) => {
            if (editing) {
              updateOrder(editing.id, data)
            } else {
              addOrder(data)
            }
            setCreating(false)
            setEditing(null)
          }}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          label={`${deleteTarget.poNumber} — ${deleteTarget.supplier}`}
          onConfirm={() => { deleteOrder(deleteTarget.id); setDeleteTarget(null) }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </InventoryLayout>
  )
}

// ────────────────────── PO Form Modal ──────────────────────

function PurchaseOrderFormModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: PurchaseOrder
  onClose: () => void
  onSave: (data: Omit<PurchaseOrder, 'id' | 'createdAt'>) => void
}) {
  const getNextPONumber = usePurchaseOrdersStore((s) => s.getNextPONumber)

  const [form, setForm] = useState({
    poNumber: initial?.poNumber || getNextPONumber(),
    supplier: initial?.supplier || '',
    trackingNumber: initial?.trackingNumber || '',
    carrier: initial?.carrier || '',
    status: initial?.status || 'ordered' as POStatus,
    orderedAt: (initial?.orderedAt || new Date().toISOString()).split('T')[0],
    expectedAt: initial?.expectedAt ? initial.expectedAt.split('T')[0] : '',
    notes: initial?.notes || '',
  })
  const [items, setItems] = useState<POItem[]>(initial?.items || [])

  const addItem = () => {
    setItems([...items, { id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, partNumber: '', name: '', category: 'PLA', quantity: 1, unitCost: 0, received: false }])
  }
  const removeItem = (id: string) => setItems(items.filter((i) => i.id !== id))
  const updateItem = (id: string, patch: Partial<POItem>) => {
    setItems(items.map((i) => i.id === id ? { ...i, ...patch } : i))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      poNumber: form.poNumber,
      supplier: form.supplier.trim(),
      trackingNumber: form.trackingNumber.trim() || undefined,
      carrier: form.carrier || undefined,
      status: form.status,
      items,
      orderedAt: new Date(form.orderedAt).toISOString(),
      expectedAt: form.expectedAt ? new Date(form.expectedAt).toISOString() : undefined,
      receivedAt: initial?.receivedAt,
      notes: form.notes.trim() || undefined,
    })
  }

  const total = items.reduce((s, i) => s + i.quantity * i.unitCost, 0)

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-bg-secondary border border-border rounded-lg max-w-3xl w-full max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-bg-secondary z-10">
          <h2 className="font-mono text-lg font-bold text-text-primary">{initial ? 'Edit Purchase Order' : 'New Purchase Order'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-bg-tertiary rounded">
            <X size={18} className="text-text-muted" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">PO Number</label>
              <input value={form.poNumber} onChange={(e) => setForm({ ...form, poNumber: e.target.value })} className="input-field font-mono text-sm" />
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as POStatus })} className="input-field text-sm">
                <option value="ordered">Ordered</option>
                <option value="shipped">Shipped</option>
                <option value="received">Received</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1">Supplier *</label>
            <input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="input-field text-sm" required placeholder="Polymaker EU" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Carrier</label>
              <select value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value })} className="input-field text-sm">
                <option value="">— Select —</option>
                {CARRIERS.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Tracking Number</label>
              <input value={form.trackingNumber} onChange={(e) => setForm({ ...form, trackingNumber: e.target.value })} className="input-field text-sm font-mono" placeholder="e.g. 1Z999AA10123456784" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Ordered Date</label>
              <input type="date" value={form.orderedAt} onChange={(e) => setForm({ ...form, orderedAt: e.target.value })} className="input-field text-sm" />
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Expected Delivery</label>
              <input type="date" value={form.expectedAt} onChange={(e) => setForm({ ...form, expectedAt: e.target.value })} className="input-field text-sm" />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block font-mono text-xs text-text-muted uppercase">Items ({items.length})</label>
              <button type="button" onClick={addItem} className="text-xs font-mono text-accent-amber hover:underline flex items-center gap-1">
                <Plus size={12} /> Add Item
              </button>
            </div>
            {items.length === 0 ? (
              <p className="text-text-muted text-xs font-mono text-center py-4 border border-dashed border-border rounded">[ ADD AT LEAST ONE ITEM ]</p>
            ) : (
              <div className="space-y-2">
                {items.map((it) => (
                  <div key={it.id} className="bg-bg-tertiary rounded-lg p-3 border border-border">
                    <div className="grid grid-cols-12 gap-2 mb-2">
                      <input
                        value={it.partNumber}
                        onChange={(e) => updateItem(it.id, { partNumber: e.target.value })}
                        placeholder="Part #"
                        className="input-field text-xs py-1.5 font-mono col-span-3"
                      />
                      <input
                        value={it.name}
                        onChange={(e) => updateItem(it.id, { name: e.target.value })}
                        placeholder="Product name"
                        className="input-field text-xs py-1.5 col-span-6"
                      />
                      <select
                        value={it.category}
                        onChange={(e) => updateItem(it.id, { category: e.target.value })}
                        className="input-field text-xs py-1.5 col-span-3"
                      >
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <input
                        type="number"
                        min={1}
                        value={it.quantity}
                        onChange={(e) => updateItem(it.id, { quantity: parseInt(e.target.value) || 1 })}
                        placeholder="Qty"
                        className="input-field text-xs py-1.5 font-mono col-span-3"
                      />
                      <div className="col-span-3 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">€</span>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={it.unitCost}
                          onChange={(e) => updateItem(it.id, { unitCost: parseFloat(e.target.value) || 0 })}
                          placeholder="Unit cost"
                          className="input-field text-xs py-1.5 pl-6 font-mono"
                        />
                      </div>
                      <span className="col-span-5 font-mono text-xs text-text-secondary text-right">
                        Total: €{(it.quantity * it.unitCost).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItem(it.id)}
                        className="col-span-1 p-1.5 rounded text-text-muted hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                <p className="text-right font-mono text-sm text-accent-amber font-bold">Order Total: €{total.toFixed(2)}</p>
              </div>
            )}
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="input-field text-sm resize-none" />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-border">
            <button type="button" onClick={onClose} className="btn-outline text-sm py-2 px-4">Cancel</button>
            <button type="submit" disabled={items.length === 0 || !form.supplier.trim()} className="btn-amber text-sm py-2 px-4 flex items-center gap-1.5 disabled:opacity-50">
              <Package size={14} /> {initial ? 'Save Changes' : 'Create Purchase Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
