import { useState } from 'react'
import { X, Box } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import { portfolioItems } from '@/data/products'

export default function Portfolio() {
  const t = useTranslation()
  const ref = useScrollReveal<HTMLElement>()
  const [selected, setSelected] = useState<number | null>(null)
  const selectedItem = selected !== null ? portfolioItems.find((p) => p.id === selected) : null

  return (
    <section id="portfolio" ref={ref} className="py-20 md:py-28 bg-bg-secondary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 reveal">
          <h2 className="section-title">
            <span className="section-title-amber">{t.portfolio.title}</span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {portfolioItems.map((item, i) => (
            <div
              key={item.id}
              className="reveal card-base card-hover cursor-pointer group"
              style={{ transitionDelay: `${i * 60}ms` }}
              onClick={() => setSelected(item.id)}
            >
              <div className="bg-bg-tertiary rounded-md h-44 flex items-center justify-center mb-4 overflow-hidden">
                <Box size={40} className="text-text-muted/20 group-hover:text-accent-amber/30 transition-colors" />
              </div>

              <h3 className="font-mono text-sm font-bold text-text-primary mb-1">{item.title}</h3>
              <p className="text-text-secondary text-xs mb-3 leading-relaxed">{item.description}</p>

              <div className="flex flex-wrap gap-1.5">
                <span className={`font-accent text-xs px-2 py-0.5 rounded border ${
                  item.technology === 'FDM'
                    ? 'border-accent-amber/30 text-accent-amber'
                    : 'border-accent-blue/30 text-accent-blue'
                }`}>
                  {item.technology}
                </span>
                <span className="font-accent text-xs px-2 py-0.5 rounded border border-border text-text-muted">
                  {item.material}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-bg-secondary border border-border rounded-lg max-w-lg w-full p-6 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-mono text-xl font-bold text-text-primary">{selectedItem.title}</h3>
              <button
                onClick={() => setSelected(null)}
                className="p-1 hover:bg-bg-tertiary rounded transition-colors"
              >
                <X size={20} className="text-text-muted" />
              </button>
            </div>

            <div className="bg-bg-tertiary rounded-md h-56 flex items-center justify-center mb-4">
              <Box size={64} className="text-text-muted/20" />
            </div>

            <p className="text-text-secondary text-sm mb-4">{selectedItem.description}</p>

            <div className="flex flex-wrap gap-2">
              <span className={`font-accent text-xs px-2 py-1 rounded border ${
                selectedItem.technology === 'FDM'
                  ? 'border-accent-amber/30 text-accent-amber'
                  : 'border-accent-blue/30 text-accent-blue'
              }`}>
                {selectedItem.technology}
              </span>
              <span className="font-accent text-xs px-2 py-1 rounded border border-border text-text-muted">
                {selectedItem.material}
              </span>
              {selectedItem.tags.map((tag) => (
                <span key={tag} className="font-accent text-xs px-2 py-1 rounded border border-border text-text-muted">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
