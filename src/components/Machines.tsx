import { Box } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { useScrollReveal } from '@/hooks/useScrollReveal'

export default function Machines() {
  const t = useTranslation()
  const ref = useScrollReveal<HTMLElement>()

  const fdmSpecs = t.machines.fdm.specs
  const resinSpecs = t.machines.resin.specs

  return (
    <section id="machines" ref={ref} className="py-20 md:py-28 bg-bg-primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 reveal">
          <h2 className="section-title">
            <span className="section-title-amber">{t.machines.title}</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* FDM */}
          <div className="reveal card-base card-hover">
            <div className="bg-bg-tertiary rounded-md h-48 flex items-center justify-center mb-5">
              <Box size={56} className="text-accent-amber/20" />
            </div>

            <h3 className="font-mono text-xl font-bold text-accent-amber mb-4">{t.machines.fdm.title}</h3>

            <div className="space-y-3 mb-5">
              {[
                [fdmSpecs.buildVolume, fdmSpecs.buildVolumeVal],
                [fdmSpecs.layerRes, fdmSpecs.layerResVal],
                [fdmSpecs.materials, fdmSpecs.materialsVal],
                [fdmSpecs.nozzle, fdmSpecs.nozzleVal],
              ].map(([label, val], i) => (
                <div key={i} className="flex justify-between text-sm border-b border-border/50 pb-2">
                  <span className="text-text-secondary">{label}</span>
                  <span className="font-accent text-text-primary">{val}</span>
                </div>
              ))}
            </div>

            <p className="text-sm text-accent-amber/80 font-accent">{t.machines.fdm.bestFor}</p>
          </div>

          {/* Resin */}
          <div className="reveal card-base card-hover" style={{ transitionDelay: '100ms' }}>
            <div className="bg-bg-tertiary rounded-md h-48 flex items-center justify-center mb-5">
              <Box size={56} className="text-accent-blue/20" />
            </div>

            <h3 className="font-mono text-xl font-bold text-accent-blue mb-4">{t.machines.resin.title}</h3>

            <div className="space-y-3 mb-5">
              {[
                [resinSpecs.xyRes, resinSpecs.xyResVal],
                [resinSpecs.zRes, resinSpecs.zResVal],
                [resinSpecs.buildVolume, resinSpecs.buildVolumeVal],
                [resinSpecs.resinTypes, resinSpecs.resinTypesVal],
              ].map(([label, val], i) => (
                <div key={i} className="flex justify-between text-sm border-b border-border/50 pb-2">
                  <span className="text-text-secondary">{label}</span>
                  <span className="font-accent text-text-primary">{val}</span>
                </div>
              ))}
            </div>

            <p className="text-sm text-accent-blue/80 font-accent">{t.machines.resin.bestFor}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
