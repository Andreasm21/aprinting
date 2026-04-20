import { useState } from 'react'
import { X, Check } from 'lucide-react'
import { CATEGORIES, type InventoryProduct, type InventoryCategory } from '@/stores/inventoryStore'

interface FormData {
  partNumber: string
  name: string
  category: InventoryCategory
  brand: string
  cost: number
  price: number
  reorderLevel: number
  bin: string
  barcode: string
  supplier: string
}

export default function InventoryProductFormModal({
  initial,
  onSave,
  onClose,
  title,
}: {
  initial?: InventoryProduct
  onSave: (data: Omit<InventoryProduct, 'id' | 'createdAt' | 'updatedAt'>) => void
  onClose: () => void
  title: string
}) {
  const [form, setForm] = useState<FormData>({
    partNumber: initial?.partNumber || '',
    name: initial?.name || '',
    category: initial?.category || 'PLA',
    brand: initial?.brand || '',
    cost: initial?.cost || 0,
    price: initial?.price || 0,
    reorderLevel: initial?.reorderLevel || 5,
    bin: initial?.bin || '',
    barcode: initial?.barcode || '',
    supplier: initial?.supplier || '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      partNumber: form.partNumber.trim(),
      name: form.name.trim(),
      category: form.category,
      brand: form.brand.trim() || undefined,
      cost: Number(form.cost),
      price: Number(form.price),
      reorderLevel: Number(form.reorderLevel),
      bin: form.bin.trim() || undefined,
      barcode: form.barcode.trim() || undefined,
      supplier: form.supplier.trim() || undefined,
      archived: initial?.archived || false,
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-bg-secondary border border-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-bg-secondary z-10">
          <h2 className="font-mono text-lg font-bold text-text-primary">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-bg-tertiary rounded">
            <X size={20} className="text-text-muted" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Part Number *</label>
              <input
                value={form.partNumber}
                onChange={(e) => setForm({ ...form, partNumber: e.target.value })}
                className="input-field font-mono text-sm"
                required
                placeholder="POLY-PLA-BLK-1KG"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Category *</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as InventoryCategory })}
                className="input-field text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1">Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-field text-sm"
              required
              placeholder="Polymaker PolyLite PLA Black 1kg"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Brand</label>
              <input
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Supplier</label>
              <input
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                className="input-field text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Cost (€)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: parseFloat(e.target.value) || 0 })}
                className="input-field text-sm font-mono"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Price (€)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                className="input-field text-sm font-mono"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Reorder Level</label>
              <input
                type="number"
                min={0}
                value={form.reorderLevel}
                onChange={(e) => setForm({ ...form, reorderLevel: parseInt(e.target.value) || 0 })}
                className="input-field text-sm font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Bin Location</label>
              <input
                value={form.bin}
                onChange={(e) => setForm({ ...form, bin: e.target.value })}
                className="input-field text-sm font-mono"
                placeholder="A-01-1"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Barcode</label>
              <input
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                className="input-field text-sm font-mono"
                placeholder="4710881830000"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-border">
            <button type="button" onClick={onClose} className="btn-outline text-sm py-2 px-4">Cancel</button>
            <button type="submit" className="btn-amber text-sm py-2 px-4 flex items-center gap-1.5">
              <Check size={14} /> Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
