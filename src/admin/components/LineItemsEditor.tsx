import { Plus, Trash2, Lock } from 'lucide-react'
import type { InvoiceLineItem } from '@/stores/invoicesStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import { useContentStore } from '@/stores/contentStore'

interface Props {
  items: InvoiceLineItem[]
  onChange: (items: InvoiceLineItem[]) => void
  showMaterialFields?: boolean
}

const MATERIAL_CATEGORIES = ['PLA', 'PETG', 'ABS', 'TPU', 'Resin', 'Nylon']

export default function LineItemsEditor({ items, onChange, showMaterialFields = false }: Props) {
  const inventoryProducts = useInventoryStore((s) => s.products)
  const printPricing = useContentStore((s) => s.content.printPricing)

  const { electricityRate, labourRate, depreciationRate, profitMarkup, defaultPowerDraw, defaultLabourHours } = printPricing

  // Build material list from inventory: only material spools (not Hardware/Finished)
  const materials = inventoryProducts
    .filter((p) => !p.archived && MATERIAL_CATEGORIES.includes(p.category))
    .map((p) => {
      const unitWeight = p.unitWeightGrams || 1000
      const ratePerGram = unitWeight > 0 ? p.cost / unitWeight : 0
      const label = `${p.brand ? p.brand + ' ' : ''}${p.category}${p.name && p.name !== p.partNumber ? ' · ' + p.name.slice(0, 25) : ''}`
      return {
        label,
        rate: ratePerGram,
        partNumber: p.partNumber,
        kgPrice: p.cost * (1000 / unitWeight),
      }
    })

  /**
   * COGS formula (matches the spreadsheet):
   *   Material      = weightGrams × ratePerGram
   *   Electricity   = printHours × powerDraw(kW) × electricityRate(€/kWh)
   *   Labour        = labourHours × labourRate(€/hr)
   *   Depreciation  = printHours × depreciationRate(€/hr)
   *   COGS = sum
   *   Price to Sell = COGS × (1 + markup%)
   */
  const calcUnitPrice = (weightGrams: number, ratePerGram: number, printHours: number, labourHours: number) => {
    const material = weightGrams * ratePerGram
    const electricity = printHours * defaultPowerDraw * electricityRate
    const labour = labourHours * labourRate
    const depreciation = printHours * depreciationRate
    const cogs = material + electricity + labour + depreciation
    return cogs * (1 + profitMarkup / 100)
  }

  // Read print/labour hours, falling back to legacy `hours` field, then defaults.
  const getPrintHours = (it: InvoiceLineItem) => it.printHours ?? it.hours ?? 0
  const getLabourHours = (it: InvoiceLineItem) => it.labourHours ?? defaultLabourHours

  const update = (index: number, field: keyof InvoiceLineItem, value: string | number) => {
    const next = [...items]
    const item = { ...next[index], [field]: value }

    // Recalc unit price using the formula whenever a formula input changes.
    if (showMaterialFields && (field === 'weightGrams' || field === 'ratePerGram' || field === 'printHours' || field === 'labourHours')) {
      const w = Number(item.weightGrams) || 0
      const r = Number(item.ratePerGram) || 0
      const ph = Number(getPrintHours(item)) || 0
      const lh = Number(getLabourHours(item)) || 0
      item.unitPrice = calcUnitPrice(w, r, ph, lh)
    }
    item.total = item.unitPrice * item.quantity

    next[index] = item
    onChange(next)
  }

  const addRow = () => {
    onChange([
      ...items,
      {
        description: '',
        unitPrice: 0,
        quantity: 1,
        total: 0,
        printHours: 0,
        labourHours: defaultLabourHours,
      },
    ])
  }

  const removeRow = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }

  const setMaterial = (index: number, materialLabel: string) => {
    const mat = materials.find((m) => m.label === materialLabel)
    if (!mat) return
    const next = [...items]
    const item = { ...next[index], material: materialLabel, materialPartNumber: mat.partNumber, ratePerGram: mat.rate }
    if (item.weightGrams) {
      const ph = Number(getPrintHours(item)) || 0
      const lh = Number(getLabourHours(item)) || 0
      item.unitPrice = calcUnitPrice(item.weightGrams, mat.rate, ph, lh)
      item.total = item.unitPrice * item.quantity
    }
    next[index] = item
    onChange(next)
  }

  // Columns: Description | Material | Weight | Print h | Labour h | Unit € | Qty | Total | ✕  (9 cols)
  const gridCols = showMaterialFields
    ? 'grid-cols-[minmax(0,1fr)_120px_70px_60px_60px_80px_50px_80px_30px]'
    : 'grid-cols-[minmax(0,1fr)_90px_60px_80px_30px]'

  return (
    <div className="space-y-2">
      {/* Locked-pricing bar — shows the formula inputs the admin has set */}
      {showMaterialFields && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-mono text-text-muted bg-bg-tertiary/50 border border-border rounded px-3 py-2">
          <span className="flex items-center gap-1 text-accent-amber">
            <Lock size={10} /> FORMULA (editable in Admin → Pricing)
          </span>
          <span>Power: <strong className="text-text-primary">{(defaultPowerDraw * 1000).toFixed(0)} W</strong></span>
          <span>Electricity: <strong className="text-text-primary">€{electricityRate.toFixed(2)}/kWh</strong></span>
          <span>Labour: <strong className="text-text-primary">€{labourRate.toFixed(2)}/hr</strong></span>
          <span>Depreciation: <strong className="text-text-primary">€{depreciationRate.toFixed(2)}/hr</strong></span>
          <span>Markup: <strong className="text-accent-amber">+{profitMarkup}%</strong></span>
        </div>
      )}

      {/* Header */}
      <div className={`grid gap-2 text-[10px] font-mono uppercase text-text-muted ${gridCols}`}>
        <span>Description</span>
        {showMaterialFields && <span>Material</span>}
        {showMaterialFields && <span className="text-right">Weight (g)</span>}
        {showMaterialFields && <span className="text-right" title="Printer running time — drives electricity + depreciation">Print h</span>}
        {showMaterialFields && <span className="text-right" title="Human work time — drives labour cost">Labour h</span>}
        <span className="text-right">Unit € <span className="text-accent-amber">*</span></span>
        <span className="text-right">Qty</span>
        <span className="text-right">Total €</span>
        <span />
      </div>

      {items.map((item, i) => (
        <div key={i} className={`grid gap-2 items-center ${gridCols}`}>
          <input
            value={item.description}
            onChange={(e) => update(i, 'description', e.target.value)}
            placeholder="Item description"
            className="bg-bg-tertiary border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:border-accent-amber focus:outline-none"
          />
          {showMaterialFields && (
            <select
              value={item.material || ''}
              onChange={(e) => setMaterial(i, e.target.value)}
              className="bg-bg-tertiary border border-border rounded px-1 py-1.5 text-xs text-text-primary focus:border-accent-amber focus:outline-none"
            >
              <option value="">— pick from inventory —</option>
              {materials.length === 0 ? (
                <option disabled>No materials in inventory</option>
              ) : (
                materials.map((m) => (
                  <option key={m.label} value={m.label}>
                    {m.label} (€{m.kgPrice.toFixed(2)}/kg)
                  </option>
                ))
              )}
            </select>
          )}
          {showMaterialFields && (
            <input
              type="number"
              min={0}
              value={item.weightGrams || ''}
              onChange={(e) => update(i, 'weightGrams', parseFloat(e.target.value) || 0)}
              className="bg-bg-tertiary border border-border rounded px-2 py-1.5 text-xs text-text-primary text-right focus:border-accent-amber focus:outline-none"
            />
          )}
          {showMaterialFields && (
            <input
              type="number"
              step="0.5"
              min={0}
              value={getPrintHours(item) || ''}
              onChange={(e) => update(i, 'printHours', parseFloat(e.target.value) || 0)}
              className="bg-bg-tertiary border border-border rounded px-2 py-1.5 text-xs text-text-primary text-right focus:border-accent-amber focus:outline-none"
              title="Printer running time (hours)"
            />
          )}
          {showMaterialFields && (
            <input
              type="number"
              step="0.25"
              min={0}
              value={getLabourHours(item) ?? ''}
              onChange={(e) => update(i, 'labourHours', parseFloat(e.target.value) || 0)}
              className="bg-bg-tertiary border border-border rounded px-2 py-1.5 text-xs text-text-primary text-right focus:border-accent-amber focus:outline-none"
              title="Human work time (hours)"
            />
          )}
          <input
            type="number"
            step="0.01"
            min={0}
            value={item.unitPrice}
            onChange={(e) => update(i, 'unitPrice', parseFloat(e.target.value) || 0)}
            className="bg-bg-tertiary border border-border rounded px-2 py-1.5 text-xs text-text-primary text-right focus:border-accent-amber focus:outline-none"
            title={showMaterialFields ? 'Auto-calculated from formula. Override if needed.' : undefined}
          />
          <input
            type="number"
            min={1}
            value={item.quantity}
            onChange={(e) => update(i, 'quantity', parseInt(e.target.value) || 1)}
            className="bg-bg-tertiary border border-border rounded px-2 py-1.5 text-xs text-text-primary text-right focus:border-accent-amber focus:outline-none"
          />
          <span className="text-xs font-mono text-text-primary text-right">{item.total.toFixed(2)}</span>
          <button type="button" onClick={() => removeRow(i)} className="p-1 hover:bg-red-500/10 rounded text-text-muted hover:text-red-400">
            <Trash2 size={12} />
          </button>
        </div>
      ))}

      {showMaterialFields && (
        <p className="text-[10px] font-mono text-text-muted">
          <span className="text-accent-amber">*</span> Unit € auto-fills from the formula: (material + electricity + labour + depreciation) × markup. Editable for manual overrides.
        </p>
      )}

      <button type="button" onClick={addRow} className="flex items-center gap-1.5 text-xs font-mono text-accent-amber hover:text-accent-amber/80 mt-2">
        <Plus size={12} /> Add Line Item
      </button>
    </div>
  )
}
