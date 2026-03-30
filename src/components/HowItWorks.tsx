import { Upload, MessageSquare, Printer, Truck } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { useScrollReveal } from '@/hooks/useScrollReveal'

export default function HowItWorks() {
  const t = useTranslation()
  const ref = useScrollReveal<HTMLElement>()

  const steps = [
    { icon: Upload, ...t.howItWorks.step1, num: '01' },
    { icon: MessageSquare, ...t.howItWorks.step2, num: '02' },
    { icon: Printer, ...t.howItWorks.step3, num: '03' },
    { icon: Truck, ...t.howItWorks.step4, num: '04' },
  ]

  return (
    <section id="how-it-works" ref={ref} className="py-20 md:py-28 bg-bg-secondary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 reveal">
          <h2 className="section-title">
            <span className="section-title-amber">{t.howItWorks.title}</span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {/* Connecting dashed line (desktop) */}
          <div className="hidden lg:block absolute top-12 left-[12.5%] right-[12.5%] h-[2px] border-t-2 border-dashed border-border" />

          {steps.map((step, i) => (
            <div
              key={i}
              className="reveal relative flex flex-col items-center text-center"
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              {/* Number circle */}
              <div className="relative z-10 w-16 h-16 rounded-full bg-accent-amber/10 border-2 border-accent-amber flex items-center justify-center mb-5">
                <span className="font-mono text-lg font-bold text-accent-amber">{step.num}</span>
              </div>

              <step.icon size={24} className="text-accent-amber mb-3" />

              <h3 className="font-mono text-base font-bold text-text-primary mb-2 uppercase tracking-wider">
                {step.title}
              </h3>

              <p className="text-text-secondary text-sm leading-relaxed max-w-[220px]">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
