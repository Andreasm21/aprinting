import { Layers, Diamond, Wrench } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import { useContentStore } from '@/stores/contentStore'
import { useAppStore } from '@/stores/appStore'

export default function Services() {
  const t = useTranslation()
  const ref = useScrollReveal<HTMLElement>()
  const c = useContentStore((s) => s.content.services)
  const lang = useAppStore((s) => s.language)

  const cards = [
    {
      icon: Layers,
      title: c.fdm.title,
      description: lang === 'gr' ? c.fdm.descriptionGr : c.fdm.description,
      badge: c.fdm.badge,
      color: 'amber',
    },
    {
      icon: Diamond,
      title: c.resin.title,
      description: lang === 'gr' ? c.resin.descriptionGr : c.resin.description,
      badge: c.resin.badge,
      color: 'blue',
    },
    {
      icon: Wrench,
      title: c.prototyping.title,
      description: lang === 'gr' ? c.prototyping.descriptionGr : c.prototyping.description,
      badge: c.prototyping.badge,
      color: 'amber',
    },
  ]

  return (
    <section id="services" ref={ref} className="py-20 md:py-28 bg-bg-primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 reveal">
          <h2 className="section-title">
            <span className="section-title-amber">{t.services.title}</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {cards.map((card, i) => (
            <div
              key={i}
              className="reveal card-base card-hover group"
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center mb-5 ${
                  card.color === 'blue'
                    ? 'bg-accent-blue/10 text-accent-blue'
                    : 'bg-accent-amber/10 text-accent-amber'
                }`}
              >
                <card.icon size={24} />
              </div>

              <h3 className="font-mono text-xl font-bold text-text-primary mb-3 tracking-wide">
                {card.title}
              </h3>

              <p className="text-text-secondary text-sm leading-relaxed mb-5">
                {card.description}
              </p>

              <span
                className={`inline-block font-accent text-xs px-3 py-1.5 rounded-full border ${
                  card.color === 'blue'
                    ? 'border-accent-blue/30 text-accent-blue bg-accent-blue/5'
                    : 'border-accent-amber/30 text-accent-amber bg-accent-amber/5'
                }`}
              >
                {card.badge}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
