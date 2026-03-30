import { Plus, Trash2 } from 'lucide-react'
import { useContentStore } from '@/stores/contentStore'

export default function AdminPricing() {
  const { content, updatePricingRow, addPricingRow, deletePricingRow, updateContent } = useContentStore()
  const pricing = content.pricing

  return (
    <div>
      <h1 className="font-mono text-2xl font-bold text-text-primary mb-2">Pricing</h1>
      <p className="text-text-secondary text-sm mb-8">Edit pricing tables and additional fees.</p>

      <div className="space-y-6">
        {/* FDM Table */}
        <div className="card-base p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-mono text-sm font-bold text-accent-amber uppercase tracking-wider">FDM Pricing</h3>
            <button onClick={() => addPricingRow('fdm')} className="flex items-center gap-1 text-xs font-mono text-accent-amber hover:text-accent-amber/80 transition-colors">
              <Plus size={14} /> Add Row
            </button>
          </div>

          <div className="space-y-3">
            {pricing.fdm.map((row, i) => (
              <div key={i} className="grid grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block font-mono text-xs text-text-muted uppercase mb-1">Material</label>
                  <input value={row.material} onChange={(e) => updatePricingRow('fdm', i, { material: e.target.value })} className="input-field text-sm" />
                </div>
                <div>
                  <label className="block font-mono text-xs text-text-muted uppercase mb-1">Price/g</label>
                  <input value={row.price} onChange={(e) => updatePricingRow('fdm', i, { price: e.target.value })} className="input-field text-sm" />
                </div>
                <div>
                  <label className="block font-mono text-xs text-text-muted uppercase mb-1">Min Order</label>
                  <input value={row.min} onChange={(e) => updatePricingRow('fdm', i, { min: e.target.value })} className="input-field text-sm" />
                </div>
                <button onClick={() => deletePricingRow('fdm', i)} className="p-2 text-text-muted hover:text-red-400 hover:bg-bg-tertiary rounded transition-all mb-0.5">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Resin Table */}
        <div className="card-base p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-mono text-sm font-bold text-accent-blue uppercase tracking-wider">Resin Pricing</h3>
            <button onClick={() => addPricingRow('resin')} className="flex items-center gap-1 text-xs font-mono text-accent-blue hover:text-accent-blue/80 transition-colors">
              <Plus size={14} /> Add Row
            </button>
          </div>

          <div className="space-y-3">
            {pricing.resin.map((row, i) => (
              <div key={i} className="grid grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block font-mono text-xs text-text-muted uppercase mb-1">Type</label>
                  <input value={row.type} onChange={(e) => updatePricingRow('resin', i, { type: e.target.value })} className="input-field text-sm" />
                </div>
                <div>
                  <label className="block font-mono text-xs text-text-muted uppercase mb-1">Price/g</label>
                  <input value={row.price} onChange={(e) => updatePricingRow('resin', i, { price: e.target.value })} className="input-field text-sm" />
                </div>
                <div>
                  <label className="block font-mono text-xs text-text-muted uppercase mb-1">Min Order</label>
                  <input value={row.min} onChange={(e) => updatePricingRow('resin', i, { min: e.target.value })} className="input-field text-sm" />
                </div>
                <button onClick={() => deletePricingRow('resin', i)} className="p-2 text-text-muted hover:text-red-400 hover:bg-bg-tertiary rounded transition-all mb-0.5">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Design rate */}
        <div className="card-base p-5">
          <h3 className="font-mono text-sm font-bold text-text-primary uppercase tracking-wider mb-4">Additional Fees</h3>
          <div className="max-w-xs">
            <label className="block font-mono text-xs text-text-muted uppercase mb-1">Design Assistance Rate (per hour)</label>
            <input value={pricing.designRate} onChange={(e) => updateContent('pricing', { designRate: e.target.value })} className="input-field text-sm" />
          </div>
        </div>
      </div>
    </div>
  )
}
