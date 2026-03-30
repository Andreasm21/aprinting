import { useTranslation } from '@/hooks/useTranslation'
import { useContentStore } from '@/stores/contentStore'
import { useAppStore } from '@/stores/appStore'
import { Printer, Zap, Truck } from 'lucide-react'

function PrinterAnimation() {
  return (
    <div className="relative w-64 h-72 md:w-80 md:h-96 mx-auto">
      {/* Printer frame */}
      <svg viewBox="0 0 300 350" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        {/* Frame legs */}
        <rect x="40" y="40" width="8" height="270" rx="2" fill="#2A2A2E" />
        <rect x="252" y="40" width="8" height="270" rx="2" fill="#2A2A2E" />

        {/* Top bar */}
        <rect x="38" y="35" width="224" height="12" rx="3" fill="#3A3A3E" />

        {/* Build plate */}
        <rect x="60" y="300" width="180" height="8" rx="2" fill="#3A3A3E" />
        <rect x="55" y="305" width="190" height="6" rx="1" fill="#252529" />

        {/* Print head rail */}
        <rect x="50" y="80" width="200" height="6" rx="2" fill="#4A4A4E" />

        {/* Print head - animated */}
        <g className="animate-print-head" style={{ transformOrigin: '150px 90px' }}>
          <rect x="130" y="72" width="40" height="28" rx="4" fill="#4A4A4E" />
          {/* Nozzle */}
          <rect x="146" y="100" width="8" height="10" rx="1" fill="#71717A" />
          {/* Nozzle glow */}
          <circle cx="150" cy="112" r="4" className="animate-nozzle" fill="#F59E0B" />
          <circle cx="150" cy="112" r="8" fill="rgba(245,158,11,0.2)" className="animate-nozzle" />
        </g>

        {/* Printed object layers */}
        {Array.from({ length: 12 }).map((_, i) => (
          <rect
            key={i}
            x={90 + Math.sin(i * 0.3) * 3}
            y={290 - i * 10}
            width={120 - Math.abs(i - 6) * 4}
            height={8}
            rx="1"
            fill={i < 6 ? '#F59E0B' : '#D97706'}
            opacity={0.6 + (i / 12) * 0.4}
            style={{
              animation: `fadeIn 0.3s ease ${i * 0.15}s both`,
            }}
          />
        ))}

        {/* Spool */}
        <circle cx="270" cy="60" r="18" fill="none" stroke="#F59E0B" strokeWidth="6" opacity="0.5" />
        <circle cx="270" cy="60" r="6" fill="#2A2A2E" />

        {/* Filament line */}
        <path d="M 270 78 Q 260 85 200 85 L 160 85" stroke="#F59E0B" strokeWidth="1.5" fill="none" opacity="0.6" />
      </svg>

      {/* Glow effect under printer */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-48 h-3 bg-accent-amber/20 blur-xl rounded-full" />
    </div>
  )
}

export default function Hero() {
  const t = useTranslation()
  const c = useContentStore((s) => s.content.hero)
  const lang = useAppStore((s) => s.language)

  const scrollTo = (id: string) => {
    document.querySelector(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Grid background */}
      <div className="absolute inset-0 grid-bg opacity-50" />

      {/* Radial gradient */}
      <div className="absolute inset-0 bg-radial-amber" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left — text */}
          <div className="text-center lg:text-left">
            <h1 className="font-mono text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-4">
              <span className="text-text-primary">{t.hero.headline}</span>
              <span className="text-gradient-amber">{t.hero.headlineAccent}</span>
            </h1>

            <p className="font-mono text-lg md:text-xl text-accent-amber mb-4 tracking-wider">
              {lang === 'gr' ? c.taglineGr : c.tagline}
            </p>

            <p className="text-text-secondary text-base md:text-lg max-w-lg mx-auto lg:mx-0 mb-8 leading-relaxed">
              {lang === 'gr' ? c.subtitleGr : c.subtitle}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <button onClick={() => scrollTo('#contact')} className="btn-amber text-base">
                {t.hero.ctaPrimary}
              </button>
              <button onClick={() => scrollTo('#products')} className="btn-outline text-base">
                {t.hero.ctaSecondary}
              </button>
            </div>

            {/* Floating stats */}
            <div className="flex flex-wrap gap-6 mt-12 justify-center lg:justify-start">
              {[
                { icon: Printer, text: c.stat1 },
                { icon: Zap, text: c.stat2 },
                { icon: Truck, text: c.stat3 },
              ].map((stat, i) => (
                <div key={i} className="flex items-center gap-2 text-text-secondary text-sm">
                  <stat.icon size={16} className="text-accent-amber" />
                  <span className="font-accent">{stat.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — printer animation */}
          <div className="hidden lg:block">
            <PrinterAnimation />
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-50">
        <div className="w-5 h-8 border-2 border-text-muted rounded-full flex justify-center">
          <div className="w-1 h-2.5 bg-text-muted rounded-full mt-1.5 animate-bounce" />
        </div>
      </div>
    </section>
  )
}
