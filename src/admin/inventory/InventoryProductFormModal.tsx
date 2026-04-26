import { useState, useRef, useEffect } from 'react'
import { X, Check } from 'lucide-react'
import {
  CATEGORIES,
  FILAMENT_CATEGORIES,
  getCustomCategories,
  saveCustomCategory,
  type InventoryProduct,
  type InventoryCategory,
} from '@/stores/inventoryStore'

type PricingMode = 'per_kg' | 'per_unit'

interface FormData {
  name: string
  brand: string
  supplier: string
  category: string
  pricingMode: PricingMode
  cost: number
  bin: string
  barcode: string
  initialQty: number
}

// Generate a unique part number from brand + category + 4 random chars
function generatePartNumber(brand: string, category: string): string {
  const prefix = brand.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'AXM'
  const cat = category.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${prefix}-${cat}-${rand}`
}

function isFilament(category: string): boolean {
  return (FILAMENT_CATEGORIES as readonly string[]).includes(category)
}

function defaultPricingMode(category: string): PricingMode {
  return isFilament(category) ? 'per_kg' : 'per_unit'
}

const ADD_NEW_VALUE = '__add_new__'

export default function InventoryProductFormModal({
  initial,
  onSave,
  onClose,
  title,
}: {
  initial?: InventoryProduct
  onSave: (data: Omit<InventoryProduct, 'id' | 'createdAt' | 'updatedAt'>, initialQty?: number) => void
  onClose: () => void
  title: string
}) {
  const [customCategories, setCustomCategories] = useState<string[]>(() => getCustomCategories())
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const newCategoryInputRef = useRef<HTMLInputElement>(null)

  // Determine initial pricing mode
  const initialCategory = initial?.category || 'PLA'
  const initialMode: PricingMode =
    initial && initial.unitWeightGrams && initial.unitWeightGrams > 0 ? 'per_kg' : 'per_unit'

  // Convert existing item's per-spool cost back to per-kg for editing
  const initialCost =
    initial && initial.unitWeightGrams && initial.unitWeightGrams > 0
      ? (initial.cost * 1000) / initial.unitWeightGrams
      : initial?.cost ?? 0

  const [form, setForm] = useState<FormData>({
    name: initial?.name || '',
    brand: initial?.brand || '',
    supplier: initial?.supplier || '',
    category: initialCategory,
    pricingMode: initial ? initialMode : defaultPricingMode(initialCategory),
    cost: initialCost,
    bin: initial?.bin || '',
    barcode: initial?.barcode || '',
    initialQty: 1,
  })

  useEffect(() => {
    if (addingCategory) {
      newCategoryInputRef.current?.focus()
    }
  }, [addingCategory])

  const allCategories = [...CATEGORIES, ...customCategories]

  function handleCategoryChange(value: string) {
    if (value === ADD_NEW_VALUE) {
      setAddingCategory(true)
      return
    }
    setForm((f) => ({
      ...f,
      category: value,
      pricingMode: defaultPricingMode(value),
    }))
  }

  function confirmNewCategory() {
    const trimmed = newCategoryName.trim()
    if (!trimmed) {
      setAddingCategory(false)
      setNewCategoryName('')
      return
    }
    saveCustomCategory(trimmed)
    const updated = getCustomCategories()
    setCustomCategories(updated)
    setForm((f) => ({
      ...f,
      category: trimmed,
      pricingMode: 'per_unit',
    }))
    setAddingCategory(false)
    setNewCategoryName('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const isKg = form.pricingMode === 'per_kg'

    onSave(
      {
        partNumber: initial?.partNumber || generatePartNumber(form.brand, form.category),
        name: form.name.trim(),
        category: form.category as InventoryCategory,
        brand: form.brand.trim() || undefined,
        cost: Number(form.cost),
        price: Number(form.cost),
        reorderLevel: initial?.reorderLevel ?? 5,
        bin: form.bin.trim() || undefined,
        barcode: form.barcode.trim() || undefined,
        supplier: form.supplier.trim() || undefined,
        unitWeightGrams: isKg ? 1000 : undefined,
        archived: initial?.archived || false,
      },
      initial ? undefined : Number(form.initialQty) || 0,
    )
  }

  const isKgMode = form.pricingMode === 'per_kg'

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

          {/* Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Category *</label>
              {addingCategory ? (
                <div className="flex gap-1.5">
                  <input
                    ref={newCategoryInputRef}
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); confirmNewCategory() }
                      if (e.key === 'Escape') { setAddingCategory(false); setNewCategoryName('') }
                    }}
                    className="input-field text-sm flex-1 min-w-0"
                    placeholder="New category name"
                  />
                  <button
                    type="button"
                    onClick={confirmNewCategory}
                    className="btn-amber px-2.5 py-1.5 text-xs flex items-center gap-1 shrink-0"
                  >
                    <Check size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAddingCategory(false); setNewCategoryName('') }}
                    className="btn-outline px-2 py-1.5 text-xs shrink-0"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <select
                  value={form.category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="input-field text-sm"
                >
                  {allCategories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option disabled>──────────</option>
                  <option value={ADD_NEW_VALUE}>+ Add new category…</option>
                </select>
              )}
              {!addingCategory && isFilament(form.category) && (
                <p className="text-[10px] text-accent-cyan font-mono mt-1">Filament — priced per kg</p>
              )}
            </div>

            {/* Cost field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-mono text-xs text-text-muted uppercase">
                  {isKgMode ? 'Cost per kg (€)' : 'Cost per unit (€)'} *
                </label>
                {/* Only show toggle for non-filament categories */}
                {!isFilament(form.category) && (
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        pricingMode: f.pricingMode === 'per_kg' ? 'per_unit' : 'per_kg',
                      }))
                    }
                    className="text-[10px] font-mono text-accent-amber hover:underline leading-none"
                  >
                    {isKgMode ? '→ unit' : '→ /kg'}
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm font-mono">€</span>
                <input
                  type="number"
                  step={isKgMode ? '0.01' : '1'}
                  min={0}
                  value={form.cost}
                  onChange={(e) =>
                    setForm({ ...form, cost: isKgMode ? parseFloat(e.target.value) || 0 : parseInt(e.target.value) || 0 })
                  }
                  className="input-field text-sm font-mono pl-7"
                  required
                  placeholder={isKgMode ? '23.99' : '5'}
                />
              </div>
              {isKgMode && form.cost > 0 && (
                <p className="text-[10px] text-accent-amber font-mono mt-1">
                  = €{(form.cost / 1000).toFixed(4)}/g
                </p>
              )}
              {!isKgMode && (
                <p className="text-[10px] text-text-muted font-mono mt-1">Price per item / piece</p>
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

          {!initial && (
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Quantity in Stock</label>
              <input
                type="number"
                min={0}
                step={1}
                value={form.initialQty}
                onChange={(e) => setForm({ ...form, initialQty: parseInt(e.target.value) || 0 })}
                className="input-field text-sm font-mono"
                placeholder="1"
              />
              <p className="text-[10px] text-text-muted font-mono mt-1">
                Number of {isKgMode ? 'spools' : 'units'} to add as starting stock. Logged as IN movement.
              </p>
            </div>
          )}

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
