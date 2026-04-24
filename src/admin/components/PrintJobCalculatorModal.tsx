import { useState, useMemo } from 'react'
import { X, Calculator, Plus, Zap, User, Wrench, Coins } from 'lucide-react'
import { useContentStore } from '@/stores/contentStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import { useQuoteCartStore } from '@/stores/quoteCartStore'

interface MaterialOption {
  group: string
  name: string
  pricePerKg: number
}

const MATERIAL_CATEGORIES = ['PLA', 'PETG', 'ABS', 'TPU', 'Resin', 'Nylon']

export default function PrintJobCalculatorModal({ onClose }: { onClose: () => void }) {
  const pp = useContentStore((s) => s.content.printPricing)
  const inventoryProducts = useInventoryStore((s) => s.products)
  const addToCart = useQuoteCartStore((s) => s.addItem)

  // Build material options from real inventory (filament spools)
  const materials: MaterialOption[] = useMemo(() => {
    return inventoryProducts
      .filter((p) => !p.archived && MATERIAL_CATEGORIES.includes(p.category))
      .map((p) => {
        const unitWeight = p.unitWeightGrams || 1000
        const pricePerKg = p.cost * (1000 / unitWeight)
        return {
          group: p.category,
          name: `${p.brand ? p.brand + ' ' : ''}${p.category}${p.name && p.name !== p.partNumber ? ' · ' + p.name.slice(0, 30) : ''}`,
          pricePerKg,
        }
      })
  }, [inventoryProducts])

  // Form state
  const [materialIdx, setMaterialIdx] = useState(0)
  const [materialPriceOverride, setMaterialPriceOverride] = useState<number | null>(null)
  const [weightKg, setWeightKg] = useState(0.5)
  const [printHours, setPrintHours] = useState(33)
  const [labourHours, setLabourHours] = useState(pp.defaultLabourHours)
  const [powerDraw, setPowerDraw] = useState(pp.defaultPowerDraw)
  const [quantity, setQuantity] = useState(1)
  const [profitMarkup, setProfitMarkup] = useState(pp.profitMarkup)
  const [extraDescription, setExtraDescription] = useState('')

  const currentMaterial = materials[materialIdx]
  const materialPricePerKg = materialPriceOverride ?? currentMaterial?.pricePerKg ?? 0

  // Calculations (single print first, then multiply by quantity for cart)
  const consumption = printHours * powerDraw // kWh
  const materialCost = weightKg * materialPricePerKg
  const electricityCost = consumption * pp.electricityRate
  const labourCost = labourHours * pp.labourRate
  const depreciationCost = printHours * pp.depreciationRate
  const cogs = materialCost + electricityCost + labourCost + depreciationCost
  const priceToSell = cogs * (1 + profitMarkup / 100)
  const totalForQuantity = priceToSell * quantity

  const handleAddToCart = () => {
    const desc = `Print Job · ${currentMaterial?.name || 'Material'} · ${weightKg}kg · ${printHours}h${extraDescription ? ' · ' + extraDescription : ''}`
    addToCart({
      source: 'inventory',
      productId: `printjob-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      description: desc,
      unitPrice: priceToSell,
      material: currentMaterial?.name || undefined,
      quantity,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-bg-secondary border border-border rounded-lg max-w-3xl w-full max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-bg-secondary z-10">
          <h2 className="font-mono text-base font-bold text-text-primary flex items-center gap-2">
            <Calculator size={16} className="text-accent-amber" /> Print Job Calculator
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-bg-tertiary rounded">
            <X size={18} className="text-text-muted" />
          </button>
        </div>

        <div className="p-5 grid lg:grid-cols-2 gap-5">
          {/* INPUTS */}
          <div className="space-y-4">
            {/* Material selector */}
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1.5">Material</label>
              <select
                value={materialIdx}
                onChange={(e) => { setMaterialIdx(parseInt(e.target.value)); setMaterialPriceOverride(null) }}
                className="input-field text-sm"
              >
                {materials.map((m, i) => (
                  <option key={i} value={i}>{m.group} · {m.name} (€{m.pricePerKg.toFixed(2)}/kg)</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-mono text-xs text-text-muted uppercase mb-1.5">Material Price /kg (override)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm font-mono">€</span>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={materialPricePerKg}
                    onChange={(e) => setMaterialPriceOverride(parseFloat(e.target.value) || 0)}
                    className="input-field text-sm font-mono pl-7"
                  />
                </div>
              </div>
              <div>
                <label className="block font-mono text-xs text-text-muted uppercase mb-1.5">Weight (kg)</label>
                <input
                  type="number"
                  step="0.001"
                  min={0}
                  value={weightKg}
                  onChange={(e) => setWeightKg(parseFloat(e.target.value) || 0)}
                  className="input-field text-sm font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-mono text-xs text-text-muted uppercase mb-1.5">Print Time (h)</label>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  value={printHours}
                  onChange={(e) => setPrintHours(parseFloat(e.target.value) || 0)}
                  className="input-field text-sm font-mono"
                />
              </div>
              <div>
                <label className="block font-mono text-xs text-text-muted uppercase mb-1.5">Labour (h)</label>
                <input
                  type="number"
                  step="0.25"
                  min={0}
                  value={labourHours}
                  onChange={(e) => setLabourHours(parseFloat(e.target.value) || 0)}
                  className="input-field text-sm font-mono"
                />
              </div>
              <div>
                <label className="block font-mono text-xs text-text-muted uppercase mb-1.5">Power (kW)</label>
                <input
                  type="number"
                  step="0.05"
                  min={0}
                  value={powerDraw}
                  onChange={(e) => setPowerDraw(parseFloat(e.target.value) || 0)}
                  className="input-field text-sm font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-mono text-xs text-text-muted uppercase mb-1.5">Quantity of prints</label>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  className="input-field text-sm font-mono"
                />
              </div>
              <div>
                <label className="block font-mono text-xs text-text-muted uppercase mb-1.5">Markup %</label>
                <input
                  type="number"
                  step="1"
                  min={0}
                  max={500}
                  value={profitMarkup}
                  onChange={(e) => setProfitMarkup(parseFloat(e.target.value) || 0)}
                  className="input-field text-sm font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1.5">Extra description (optional)</label>
              <input
                value={extraDescription}
                onChange={(e) => setExtraDescription(e.target.value)}
                placeholder="e.g. Galaxy Black, supports, sanded..."
                className="input-field text-sm"
              />
            </div>

            <div className="bg-bg-tertiary rounded-lg p-3 text-[11px] font-mono text-text-muted space-y-1">
              <p className="text-accent-amber uppercase tracking-wider">Defaults from /admin/pricing</p>
              <div className="flex justify-between"><span>Electricity</span><span>€{pp.electricityRate}/kWh</span></div>
              <div className="flex justify-between"><span>Labour rate</span><span>€{pp.labourRate}/hr</span></div>
              <div className="flex justify-between"><span>Depreciation</span><span>€{pp.depreciationRate}/hr</span></div>
            </div>
          </div>

          {/* BREAKDOWN — matches your spreadsheet */}
          <div className="bg-bg-tertiary rounded-lg p-5 self-start">
            <h3 className="font-mono text-xs text-text-muted uppercase tracking-wider mb-4">Cost Breakdown (per print)</h3>

            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-text-muted">
                  <th className="text-left py-1"></th>
                  <th className="text-right py-1">Hours</th>
                  <th className="text-right py-1">Qty</th>
                  <th className="text-right py-1">Rate</th>
                  <th className="text-right py-1">Cost</th>
                </tr>
              </thead>
              <tbody className="text-text-primary">
                <tr className="border-t border-border">
                  <td className="py-1.5 flex items-center gap-1.5"><Coins size={11} className="text-accent-amber" /> Material</td>
                  <td className="text-right">—</td>
                  <td className="text-right">{weightKg} kg</td>
                  <td className="text-right">€{materialPricePerKg.toFixed(2)}</td>
                  <td className="text-right font-bold">€{materialCost.toFixed(3)}</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="py-1.5 flex items-center gap-1.5"><Zap size={11} className="text-accent-blue" /> Electricity</td>
                  <td className="text-right">{printHours}</td>
                  <td className="text-right">{consumption.toFixed(2)} kWh</td>
                  <td className="text-right">€{pp.electricityRate}</td>
                  <td className="text-right font-bold">€{electricityCost.toFixed(3)}</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="py-1.5 flex items-center gap-1.5"><User size={11} className="text-accent-green" /> Labour</td>
                  <td className="text-right">{labourHours}</td>
                  <td className="text-right">—</td>
                  <td className="text-right">€{pp.labourRate}</td>
                  <td className="text-right font-bold">€{labourCost.toFixed(3)}</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="py-1.5 flex items-center gap-1.5"><Wrench size={11} className="text-text-muted" /> Depreciation</td>
                  <td className="text-right">{printHours}</td>
                  <td className="text-right">—</td>
                  <td className="text-right">€{pp.depreciationRate}</td>
                  <td className="text-right font-bold">€{depreciationCost.toFixed(3)}</td>
                </tr>
                <tr className="border-t-2 border-border">
                  <td className="py-2 font-bold text-text-secondary uppercase">COGS</td>
                  <td colSpan={3}></td>
                  <td className="text-right font-bold text-text-primary">€{cogs.toFixed(3)}</td>
                </tr>
                <tr>
                  <td className="py-1 text-text-muted">Profit Markup</td>
                  <td colSpan={3}></td>
                  <td className="text-right text-accent-green">+{profitMarkup}%</td>
                </tr>
                <tr className="border-t-2 border-accent-amber">
                  <td className="py-2 font-bold text-accent-amber uppercase tracking-wider">Price to Sell</td>
                  <td colSpan={3}></td>
                  <td className="text-right text-accent-amber font-bold text-base">€{priceToSell.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            {quantity > 1 && (
              <div className="mt-4 pt-3 border-t-2 border-accent-amber bg-accent-amber/5 -mx-5 -mb-5 px-5 py-3 rounded-b-lg">
                <div className="flex justify-between items-center text-sm font-mono">
                  <span className="text-text-secondary uppercase tracking-wider">{quantity} prints total</span>
                  <span className="font-bold text-accent-amber text-lg">€{totalForQuantity.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <button onClick={onClose} className="btn-outline flex-1 text-sm py-2">Cancel</button>
              <button onClick={handleAddToCart} className="btn-amber flex-1 text-sm py-2 flex items-center justify-center gap-1.5">
                <Plus size={14} /> Add to Quote
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
