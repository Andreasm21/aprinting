import { useContentStore } from '@/stores/contentStore'
import type { SiteContent } from '@/stores/contentStore'

type ServiceKey = keyof SiteContent['services']

export default function AdminServices() {
  const { content, updateContent } = useContentStore()
  const services = content.services

  const updateService = (key: ServiceKey, field: string, value: string) => {
    updateContent('services', {
      [key]: { ...services[key], [field]: value },
    })
  }

  const serviceCards: { key: ServiceKey; label: string; color: string }[] = [
    { key: 'fdm', label: 'FDM Printing', color: 'amber' },
    { key: 'resin', label: 'Resin Printing', color: 'blue' },
    { key: 'prototyping', label: 'Prototyping', color: 'amber' },
  ]

  return (
    <div>
      <h1 className="font-mono text-2xl font-bold text-text-primary mb-2">Services</h1>
      <p className="text-text-secondary text-sm mb-8">Edit your service card descriptions.</p>

      <div className="space-y-6">
        {serviceCards.map((card) => (
          <div key={card.key} className="card-base p-5">
            <h3 className={`font-mono text-sm font-bold uppercase tracking-wider mb-4 ${
              card.color === 'blue' ? 'text-accent-blue' : 'text-accent-amber'
            }`}>
              {card.label}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block font-mono text-xs text-text-muted uppercase mb-1">Title</label>
                <input value={services[card.key].title} onChange={(e) => updateService(card.key, 'title', e.target.value)} className="input-field" />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-xs text-text-muted uppercase mb-1">Description (EN)</label>
                  <textarea value={services[card.key].description} onChange={(e) => updateService(card.key, 'description', e.target.value)} className="input-field resize-none" rows={3} />
                </div>
                <div>
                  <label className="block font-mono text-xs text-text-muted uppercase mb-1">Description (GR)</label>
                  <textarea value={services[card.key].descriptionGr} onChange={(e) => updateService(card.key, 'descriptionGr', e.target.value)} className="input-field resize-none" rows={3} />
                </div>
              </div>

              <div>
                <label className="block font-mono text-xs text-text-muted uppercase mb-1">Badge Text</label>
                <input value={services[card.key].badge} onChange={(e) => updateService(card.key, 'badge', e.target.value)} className="input-field max-w-xs" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
