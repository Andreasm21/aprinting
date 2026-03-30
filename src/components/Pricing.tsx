import { useTranslation } from '@/hooks/useTranslation'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import { useContentStore } from '@/stores/contentStore'
import { Clock, Paintbrush, Truck, PenTool } from 'lucide-react'

export default function Pricing() {
  const t = useTranslation()
  const ref = useScrollReveal<HTMLElement>()
  const cp = useContentStore((s) => s.content.pricing)

  const fdmRows = cp.fdm
  const resinRows = cp.resin

  const additionalFees = [
    { icon: PenTool, label: t.pricing.designAssistance, value: cp.designRate + t.pricing.perHour },
    { icon: Clock, label: t.pricing.rushOrder, value: t.pricing.rushSurcharge },
    { icon: Paintbrush, label: t.pricing.postProcessing, value: t.pricing.quotedPerItem },
    { icon: Truck, label: t.pricing.delivery, value: t.pricing.deliveryNote },
  ]

  const scrollToContact = () => {
    document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section id="pricing" ref={ref} className="py-20 md:py-28 bg-bg-primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 reveal">
          <h2 className="section-title">
            <span className="section-title-amber">{t.pricing.title}</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* FDM table */}
          <div className="reveal card-base">
            <h3 className="font-mono text-lg font-bold text-accent-amber mb-4">{t.pricing.fdmTitle}</h3>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left font-mono text-xs text-text-muted py-2 uppercase tracking-wider">{t.pricing.material}</th>
                  <th className="text-left font-mono text-xs text-text-muted py-2 uppercase tracking-wider">{t.pricing.pricePerGram}</th>
                  <th className="text-left font-mono text-xs text-text-muted py-2 uppercase tracking-wider">{t.pricing.minOrder}</th>
                </tr>
              </thead>
              <tbody>
                {fdmRows.map((row) => (
                  <tr key={row.material} className="border-b border-border/50">
                    <td className="font-accent text-sm text-text-primary py-3">{row.material}</td>
                    <td className="font-accent text-sm text-accent-amber py-3">{row.price}</td>
                    <td className="font-accent text-sm text-text-secondary py-3">{row.min}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Resin table */}
          <div className="reveal card-base" style={{ transitionDelay: '100ms' }}>
            <h3 className="font-mono text-lg font-bold text-accent-blue mb-4">{t.pricing.resinTitle}</h3>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left font-mono text-xs text-text-muted py-2 uppercase tracking-wider">{t.pricing.type}</th>
                  <th className="text-left font-mono text-xs text-text-muted py-2 uppercase tracking-wider">{t.pricing.pricePerGram}</th>
                  <th className="text-left font-mono text-xs text-text-muted py-2 uppercase tracking-wider">{t.pricing.minOrder}</th>
                </tr>
              </thead>
              <tbody>
                {resinRows.map((row) => (
                  <tr key={row.type} className="border-b border-border/50">
                    <td className="font-accent text-sm text-text-primary py-3">{row.type}</td>
                    <td className="font-accent text-sm text-accent-blue py-3">{row.price}</td>
                    <td className="font-accent text-sm text-text-secondary py-3">{row.min}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Additional fees */}
        <div className="reveal card-base mb-10">
          <h3 className="font-mono text-lg font-bold text-text-primary mb-5">{t.pricing.additional}</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {additionalFees.map((fee, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <fee.icon size={18} className="text-accent-amber shrink-0" />
                <span className="text-text-secondary">{fee.label}</span>
                <span className="font-accent text-text-primary ml-auto">{fee.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="reveal text-center">
          <p className="text-text-secondary mb-4">{t.pricing.customQuote}</p>
          <button onClick={scrollToContact} className="btn-amber">
            {t.pricing.getQuote}
          </button>
        </div>
      </div>
    </section>
  )
}
