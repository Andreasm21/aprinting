import { Calculator, Zap, Wrench, TrendingUp, Settings2, AlertTriangle, Info } from 'lucide-react'
import { useContentStore } from '@/stores/contentStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import { useMemo } from 'react'

const FILAMENT_CATS = ['PLA', 'PETG', 'ABS', 'TPU', 'Resin', 'Nylon']

export default function AdminPricing() {
  const { content, updateContent } = useContentStore()
  const pp = content.printPricing
  const inventoryProducts = useInventoryStore((s) => s.products)

  // Sample numbers used for the live example below the formula. Same
  // values as in the reference spreadsheet so admin can sanity-check
  // any rate change against a known result.
  const example = {
    weightG: 500,
    pricePerKg: 23.99,
    printH: 33,
    labourH: 1,
  }

  const calc = useMemo(() => {
    const material = (example.weightG / 1000) * example.pricePerKg
    const electricity = example.printH * pp.defaultPowerDraw * pp.electricityRate
    const labour = example.labourH * pp.labourRate
    const depreciation = example.printH * pp.depreciationRate
    const cogs = material + electricity + labour + depreciation
    const sell = cogs * (1 + pp.profitMarkup / 100)
    return { material, electricity, labour, depreciation, cogs, sell }
  }, [pp])

  const filamentItems = useMemo(
    () => inventoryProducts.filter((p) => !p.archived && FILAMENT_CATS.includes(p.category)),
    [inventoryProducts],
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-mono text-2xl font-bold text-text-primary mb-2 flex items-center gap-2">
          <Calculator size={24} className="text-accent-amber" /> Pricing Engine
        </h1>
        <p className="text-text-secondary text-sm">
          The single place that drives every price across quotations, invoices and the print queue. Material cost flows from your inventory; everything else (electricity, labour, depreciation, markup) is set here.
        </p>
      </div>

      {/* Formula explanation */}
      <div className="card-base bg-accent-amber/5 border-accent-amber/30 p-5 mb-6">
        <h3 className="font-mono text-xs uppercase text-accent-amber font-bold flex items-center gap-1.5 mb-3">
          <Info size={14} /> How the formula works
        </h3>
        <div className="font-mono text-xs text-text-secondary leading-relaxed space-y-1">
          <div>Material      = weight (g) × inventory cost €/g</div>
          <div>Electricity   = print hours × power (kW) × electricity €/kWh</div>
          <div>Labour        = labour hours × labour €/hr</div>
          <div>Depreciation  = print hours × depreciation €/hr</div>
          <div className="pt-1 border-t border-accent-amber/20 mt-2">COGS          = sum of the above</div>
          <div className="text-accent-amber font-bold">Price to sell = COGS × (1 + markup%)</div>
        </div>
      </div>

      {/* The configurable rates — grouped */}
      <div className="space-y-6">
        {/* Operational rates */}
        <div className="card-base p-5">
          <h3 className="font-mono text-xs uppercase text-text-muted font-bold flex items-center gap-1.5 mb-4">
            <Zap size={12} /> Operational rates
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Electricity (€/kWh)</label>
              <input
                type="number"
                step="0.01"
                value={pp.electricityRate}
                onChange={(e) => updateContent('printPricing', { electricityRate: parseFloat(e.target.value) || 0 })}
                className="input-field text-sm font-mono"
              />
              <p className="text-[10px] text-text-muted mt-1">EAC retail rate.</p>
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Labour (€/hr)</label>
              <input
                type="number"
                step="0.5"
                value={pp.labourRate}
                onChange={(e) => updateContent('printPricing', { labourRate: parseFloat(e.target.value) || 0 })}
                className="input-field text-sm font-mono"
              />
              <p className="text-[10px] text-text-muted mt-1">Setup, post-processing, packaging time.</p>
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Depreciation (€/hr)</label>
              <input
                type="number"
                step="0.05"
                value={pp.depreciationRate}
                onChange={(e) => updateContent('printPricing', { depreciationRate: parseFloat(e.target.value) || 0 })}
                className="input-field text-sm font-mono"
              />
              <p className="text-[10px] text-text-muted mt-1">Printer wear-and-tear per print hour.</p>
            </div>
          </div>
        </div>

        {/* Defaults */}
        <div className="card-base p-5">
          <h3 className="font-mono text-xs uppercase text-text-muted font-bold flex items-center gap-1.5 mb-4">
            <Settings2 size={12} /> Defaults applied to every line item
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Power draw (kW)</label>
              <input
                type="number"
                step="0.05"
                value={pp.defaultPowerDraw}
                onChange={(e) => updateContent('printPricing', { defaultPowerDraw: parseFloat(e.target.value) || 0 })}
                className="input-field text-sm font-mono"
              />
              <p className="text-[10px] text-text-muted mt-1">Avg printer consumption.</p>
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Default labour (hours)</label>
              <input
                type="number"
                step="0.25"
                value={pp.defaultLabourHours}
                onChange={(e) => updateContent('printPricing', { defaultLabourHours: parseFloat(e.target.value) || 0 })}
                className="input-field text-sm font-mono"
              />
              <p className="text-[10px] text-text-muted mt-1">Pre-filled per line; admin overrides per job.</p>
            </div>
          </div>
        </div>

        {/* Markup */}
        <div className="card-base p-5 border-accent-amber/30 bg-accent-amber/[0.03]">
          <h3 className="font-mono text-xs uppercase text-accent-amber font-bold flex items-center gap-1.5 mb-4">
            <TrendingUp size={12} /> Profit markup
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-end">
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Markup % (added on top of COGS)</label>
              <input
                type="number"
                step="1"
                value={pp.profitMarkup}
                onChange={(e) => updateContent('printPricing', { profitMarkup: parseFloat(e.target.value) || 0 })}
                className="input-field text-sm font-mono text-lg"
              />
            </div>
            <p className="text-xs text-text-muted">
              Markup ≠ margin. <span className="text-text-secondary">€10 COGS at 30% markup = €13 sell price (margin = 23%).</span>
            </p>
          </div>
        </div>

        {/* Live example */}
        <div className="card-base p-5">
          <h3 className="font-mono text-xs uppercase text-text-muted font-bold flex items-center gap-1.5 mb-4">
            <Calculator size={12} /> Live example — verify your config
          </h3>
          <p className="text-text-secondary text-xs mb-4">
            Reference job: <span className="text-text-primary font-mono">{example.weightG}g</span> of filament at <span className="text-text-primary font-mono">€{example.pricePerKg}/kg</span>, <span className="text-text-primary font-mono">{example.printH}h</span> print + <span className="text-text-primary font-mono">{example.labourH}h</span> labour. Adjust any rate above and watch the bottom line update.
          </p>
          <div className="font-mono text-sm space-y-1.5 bg-bg-tertiary border border-border rounded-lg p-4">
            <Row label={`Material  (${example.weightG}g × €${(example.pricePerKg / 1000).toFixed(4)}/g)`} value={calc.material} />
            <Row label={`Electricity  (${example.printH}h × ${pp.defaultPowerDraw}kW × €${pp.electricityRate.toFixed(2)})`} value={calc.electricity} />
            <Row label={`Labour  (${example.labourH}h × €${pp.labourRate.toFixed(2)})`} value={calc.labour} />
            <Row label={`Depreciation  (${example.printH}h × €${pp.depreciationRate.toFixed(2)})`} value={calc.depreciation} />
            <div className="border-t border-border pt-1.5 mt-1.5"><Row label="COGS" value={calc.cogs} bold /></div>
            <Row label={`Markup  (× ${(1 + pp.profitMarkup / 100).toFixed(2)})`} value={null} accent={`+${pp.profitMarkup}%`} />
            <div className="border-t-2 border-accent-amber pt-2 mt-1"><Row label="Price to sell" value={calc.sell} bold accent="amber" /></div>
          </div>
        </div>

        {/* Inventory-derived per-gram rates (read-only summary) */}
        <div className="card-base p-5">
          <h3 className="font-mono text-xs uppercase text-text-muted font-bold flex items-center gap-1.5 mb-4">
            <Settings2 size={12} /> Filament rates from inventory
          </h3>
          {filamentItems.length === 0 ? (
            <p className="text-text-muted text-xs">No filament spools in inventory yet. Add them in <span className="text-accent-amber">Inventory → Products</span>.</p>
          ) : (
            <>
              <p className="text-text-muted text-xs mb-3">These are calculated from each spool's cost and unit weight in the Inventory page. Edit costs there — they flow into every quote automatically.</p>
              <div className="space-y-1">
                {filamentItems.map((p) => {
                  const unit = p.unitWeightGrams || 1000
                  const perKg = p.cost * (1000 / unit)
                  const perG = unit > 0 ? p.cost / unit : 0
                  return (
                    <div key={p.id} className="grid grid-cols-12 gap-2 items-center py-1.5 border-b border-border/50 last:border-0 text-xs">
                      <div className="col-span-3 font-mono text-accent-amber">{p.partNumber}</div>
                      <div className="col-span-5 text-text-primary truncate">{p.name}</div>
                      <div className="col-span-2 text-text-muted text-[10px] uppercase font-mono">{p.category}</div>
                      <div className="col-span-2 text-right font-mono text-text-primary">€{perKg.toFixed(2)}/kg <span className="text-text-muted text-[10px]">· €{perG.toFixed(4)}/g</span></div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Stock alerting */}
        <div className="card-base p-5">
          <h3 className="font-mono text-xs uppercase text-text-muted font-bold flex items-center gap-1.5 mb-4">
            <AlertTriangle size={12} /> Inventory low-stock alert
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Threshold % (used when no per-product reorder level)</label>
              <input
                type="number"
                step="1"
                min={1}
                max={100}
                value={pp.lowStockPercent ?? 20}
                onChange={(e) => updateContent('printPricing', { lowStockPercent: parseFloat(e.target.value) || 0 })}
                className="input-field text-sm font-mono"
              />
            </div>
            <p className="text-text-muted text-xs">
              When a quote consumes stock and the on-hand qty crosses this threshold, the team gets an in-app notification AND an email. Fires only on the crossing — no spam while already low.
            </p>
          </div>
        </div>

        {/* Legacy tables note */}
        <div className="card-base p-4 border-dashed text-xs text-text-muted">
          <Wrench size={12} className="inline mr-1" />
          The old per-material rate tables are gone — quote pricing now derives material cost directly from each inventory product's cost ÷ unit weight, then applies the formula above. Edit your filament costs in Inventory, not here.
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, bold, accent }: { label: string; value: number | null; bold?: boolean; accent?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-text-secondary ${bold ? 'font-bold text-text-primary' : ''}`}>{label}</span>
      {value !== null ? (
        <span className={`font-mono ${bold ? 'font-bold' : ''} ${accent === 'amber' ? 'text-accent-amber text-base' : 'text-text-primary'}`}>
          €{value.toFixed(4)}
        </span>
      ) : (
        <span className="font-mono text-accent-amber text-xs">{accent}</span>
      )}
    </div>
  )
}
