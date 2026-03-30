import { useEffect, useState, useRef } from 'react'
import { Box } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import { useContentStore } from '@/stores/contentStore'
import { useAppStore } from '@/stores/appStore'

function AnimatedCounter({ end, label, suffix = '' }: { end: number; label: string; suffix?: string }) {
  const [count, setCount] = useState(0)
  const [started, setStarted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started) {
          setStarted(true)
        }
      },
      { threshold: 0.5 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [started])

  useEffect(() => {
    if (!started) return
    let current = 0
    const step = Math.ceil(end / 30)
    const interval = setInterval(() => {
      current += step
      if (current >= end) {
        setCount(end)
        clearInterval(interval)
      } else {
        setCount(current)
      }
    }, 30)
    return () => clearInterval(interval)
  }, [started, end])

  return (
    <div ref={ref} className="text-center">
      <div className="font-mono text-3xl md:text-4xl font-bold text-accent-amber mb-1">
        {count}{suffix}
      </div>
      <div className="text-text-secondary text-sm font-accent">{label}</div>
    </div>
  )
}

export default function About() {
  const t = useTranslation()
  const ref = useScrollReveal<HTMLElement>()
  const c = useContentStore((s) => s.content.about)
  const lang = useAppStore((s) => s.language)

  return (
    <section id="about" ref={ref} className="py-20 md:py-28 bg-bg-primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 reveal">
          <h2 className="section-title">
            <span className="section-title-amber">{t.about.title}</span>
          </h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
          {/* Text */}
          <div className="reveal">
            <p className="text-text-secondary text-base leading-relaxed mb-5">{lang === 'gr' ? c.p1Gr : c.p1}</p>
            <p className="text-text-secondary text-base leading-relaxed">{lang === 'gr' ? c.p2Gr : c.p2}</p>
          </div>

          {/* Visual */}
          <div className="reveal flex items-center justify-center" style={{ transitionDelay: '150ms' }}>
            <div className="bg-bg-secondary border border-border rounded-lg w-full h-64 flex items-center justify-center">
              <Box size={72} className="text-accent-amber/15" />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="reveal grid grid-cols-2 md:grid-cols-4 gap-8">
          <AnimatedCounter end={parseInt(c.printsVal) || 500} suffix="+" label={t.about.stats.prints} />
          <AnimatedCounter end={parseInt(c.customersVal) || 120} suffix="+" label={t.about.stats.customers} />
          <AnimatedCounter end={parseInt(c.yearsVal) || 3} suffix="+" label={t.about.stats.years} />
          <AnimatedCounter end={parseInt(c.materialsVal) || 8} suffix="+" label={t.about.stats.materials} />
        </div>
      </div>
    </section>
  )
}
