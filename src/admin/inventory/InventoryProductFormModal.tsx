import { useState } from 'react'
import { X, Check } from 'lucide-react'
import { CATEGORIES, type InventoryProduct, type InventoryCategory } from '@/stores/inventoryStore'

interface FormData {
  name: string
  brand: string
  supplier: string
  category: InventoryCategory
  costPerKg: number
  bin: string
  barcode: string
}

// Generate a unique part number from brand + category + 4 random chars
function generatePartNumber(brand: string, category: string): string {
  const prefix = brand.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'AXM'
  const cat = category.toUpperCase().slice(0, 4)
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${prefix}-${cat}-${rand}`
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
  // Convert existing item's per-spool cost back to per-kg for editing
  const initialCostPerKg = initial && initial.unitWeightGrams && initial.unitWeightGrams > 0
    ? (initial.cost * 1000) / initial.unitWeightGrams
    : initial?.cost ?? 0

  const [form, setForm] = useState<FormData>({
    name: initial?.name || '',
    brand: initial?.brand || '',
    supplier: initial?.supplier || '',
    category: initial?.category || 'PLA',
    costPerKg: initialCostPerKg,
    bin: initial?.bin || '',
    barcode: initial?.barcode || '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // We standardize on cost per kg. Store as cost (per kg) with unitWeightGrams=1000
    // so the calculator math (cost / unitWeightGrams = cost/g) works correctly.
    onSave({
      partNumber: initial?.partNumber || generatePartNumber(form.brand, form.category),
      name: form.name.trim(),
      category: form.category,
      brand: form.brand.trim() || undefined,
      cost: Number(form.costPerKg),
      price: Number(form.costPerKg), // sensible default; unused for materials
      reorderLevel: initial?.reorderLevel ?? 5,
      bin: form.bin.trim() || undefined,
      barcode: form.barcode.trim() || undefined,
      supplier: form.supplier.trim() || undefined,
      unitWeightGrams: 1000, // standardized: cost is per kg = per 1000g
      archived: initial?.archived || false,
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-bg-secondary border border-border rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-bg-secondary z-10">
          <h2 className="font-mono text-lg font-bold text-text-primary">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-bg-tertiary rounded">
            <X size={20} className="text-text-muted" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1">Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-field text-sm"
              required
              autoFocus
              placeholder="Creality ABS White"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Brand</label>
              <input
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                className="input-field text-sm"
                placeholder="Creality"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Supplier</label>
              <input
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                className="input-field text-sm"
                placeholder="3D Print World"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Cost per kg (€) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm font-mono">€</span>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.costPerKg}
                  onChange={(e) => setForm({ ...form, costPerKg: parseFloat(e.target.value) || 0 })}
                  className="input-field text-sm font-mono pl-7"
                  required
                  placeholder="23.99"
                />
              </div>
              {form.costPerKg > 0 && (
                <p className="text-[10px] text-accent-amber font-mono mt-1">
                  = €{(form.costPerKg / 1000).toFixed(4)}/g
                </p>
              )}
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
                placeholder="optional"
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
