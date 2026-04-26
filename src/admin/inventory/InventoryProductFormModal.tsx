import { useState, useRef, useEffect } from 'react'
import { X, Check, Package, Plus } from 'lucide-react'
import {
  CATEGORIES,
  displayQtyToStorage,
  formatStockQty,
  getCustomCategories,
  getStockUnitLabel,
  saveCustomCategory,
  storageQtyToDisplay,
  useInventoryStore,
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
  // For ADD mode: initial stock to seed.
  // For EDIT mode: extra stock to add now (logged as a fresh IN movement).
  // Units: kg for filaments, pieces for everything else.
  qtyToAdd: number
  reorderLevel: number
}

// Generate a unique part number from brand + category + 4 random chars
function generatePartNumber(brand: string, category: string): string {
  const prefix = brand.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'AXM'
  const cat = category.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${prefix}-${cat}-${rand}`
}

function defaultPricingMode(category: string): PricingMode {
  return getStockUnitLabel(category) === 'kg' ? 'per_kg' : 'per_unit'
}

const ADD_NEW_VALUE = '__add_new__'

export default function InventoryProductFormModal({
  initial,
  onSave,
  onClose,
  title,
}: {
  initial?: InventoryProduct
  // qtyToAdd is in storage units: GRAMS for filaments, PIECES for the rest.
  // Always represents *new* stock to add (parent calls addMovement IN).
  onSave: (data: Omit<InventoryProduct, 'id' | 'createdAt' | 'updatedAt'>, qtyToAdd?: number) => void
  onClose: () => void
  title: string
}) {
  const [customCategories, setCustomCategories] = useState<string[]>(() => getCustomCategories())
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const newCategoryInputRef = useRef<HTMLInputElement>(null)

  const initialCategory = initial?.category || 'PLA'
  const initialMode = defaultPricingMode(initialCategory)
  const initialCost = initial?.cost ?? 0
  const initialReorderLevel = initial
    ? storageQtyToDisplay(initial, initial.reorderLevel)
    : getStockUnitLabel(initialCategory) === 'kg' ? 0.2 : 5

  const [form, setForm] = useState<FormData>({
    name: initial?.name || '',
    brand: initial?.brand || '',
    supplier: initial?.supplier || '',
    category: initialCategory,
    pricingMode: initial ? initialMode : defaultPricingMode(initialCategory),
    cost: initialCost,
    bin: initial?.bin || '',
    barcode: initial?.barcode || '',
    // Default: 1 (kg or piece) for new items, 0 for edits (don't accidentally add).
    qtyToAdd: initial ? 0 : 1,
    reorderLevel: initialReorderLevel,
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
      reorderLevel: getStockUnitLabel(value) === 'kg' ? 0.2 : 5,
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
      reorderLevel: 5,
    }))
    setAddingCategory(false)
    setNewCategoryName('')
  }

  // Show the current on-hand qty when editing so admin knows what's there.
  const currentQty = useInventoryStore((s) => initial ? s.getQtyOnHand(initial.id) : 0)

  const isKgMode = getStockUnitLabel(form.category) === 'kg'
  const inputUnit = getStockUnitLabel(form.category)
  const productForDisplay = {
    category: form.category as InventoryCategory,
    unitWeightGrams: isKgMode ? 1000 : undefined,
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const qtyInStorageUnits = displayQtyToStorage(form.category, Number(form.qtyToAdd) || 0)
    const reorderLevelInStorageUnits = displayQtyToStorage(form.category, Number(form.reorderLevel) || 0)

    onSave(
      {
        partNumber: initial?.partNumber || generatePartNumber(form.brand, form.category),
        name: form.name.trim(),
        category: form.category as InventoryCategory,
        brand: form.brand.trim() || undefined,
        cost: Number(form.cost),
        price: Number(form.cost),
        reorderLevel: reorderLevelInStorageUnits,
        bin: form.bin.trim() || undefined,
        barcode: form.barcode.trim() || undefined,
        supplier: form.supplier.trim() || undefined,
        unitWeightGrams: isKgMode ? 1000 : undefined,
        archived: initial?.archived || false,
      },
      qtyInStorageUnits > 0 ? qtyInStorageUnits : undefined,
    )
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
              {!addingCategory && isKgMode && (
                <p className="text-[10px] text-accent-cyan font-mono mt-1">Filament — priced per kg</p>
              )}
            </div>

            {/* Cost field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-mono text-xs text-text-muted uppercase">
                  {isKgMode ? 'Cost per kg (€)' : 'Cost per unit (€)'} *
                </label>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm font-mono">€</span>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={form.cost}
                  onChange={(e) =>
                    setForm({ ...form, cost: parseFloat(e.target.value) || 0 })
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

          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1">
              Low-stock threshold ({inputUnit})
            </label>
            <div className="relative max-w-[220px]">
              <input
                type="number"
                min={0}
                step={isKgMode ? '0.05' : '1'}
                value={form.reorderLevel}
                onChange={(e) => setForm({ ...form, reorderLevel: parseFloat(e.target.value) || 0 })}
                className="input-field text-sm font-mono pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs font-mono uppercase">{inputUnit}</span>
            </div>
            <p className="text-[10px] text-text-muted font-mono mt-1">
              Alerts use this unit. Filament thresholds are stored as grams internally.
            </p>
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

          {/* Stock — always shown. ADD mode = initial stock, EDIT mode = restock. */}
          <div className="bg-bg-tertiary/50 border border-border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="font-mono text-xs text-text-muted uppercase flex items-center gap-1.5">
                <Package size={12} className="text-accent-amber" />
                {initial ? 'Add to stock' : 'Quantity in stock'}
              </label>
              {initial && (
                <span className="text-[10px] font-mono text-text-muted">
                  Currently on hand: <span className="text-text-primary font-bold">{formatStockQty(initial, currentQty)}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  min={0}
                  step={isKgMode ? '0.1' : '1'}
                  value={form.qtyToAdd}
                  onChange={(e) => setForm({ ...form, qtyToAdd: parseFloat(e.target.value) || 0 })}
                  className="input-field text-sm font-mono pr-12"
                  placeholder={isKgMode ? '1' : '10'}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs font-mono uppercase">{inputUnit}</span>
              </div>
              {initial && form.qtyToAdd > 0 && (
                <span className="text-[11px] font-mono text-accent-green flex items-center gap-1 whitespace-nowrap">
                  <Plus size={11} /> {formatStockQty(productForDisplay, displayQtyToStorage(form.category, form.qtyToAdd))}
                </span>
              )}
            </div>
            <p className="text-[10px] text-text-muted font-mono">
              {initial
                ? `Adds an IN movement for the new stock — leave at 0 if you're only editing other fields.`
                : `Initial stock to seed when the product is created.`}
              {isKgMode && ' Filament is tracked in grams internally; enter kg here.'}
            </p>
            {initial && form.qtyToAdd > 0 && (
              <p className="text-[10px] text-accent-amber font-mono">
                After save → on hand will be {formatStockQty(productForDisplay, currentQty + displayQtyToStorage(form.category, form.qtyToAdd))}
              </p>
            )}
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
