import { Camera, ThumbsUp } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'

export default function Footer() {
  const t = useTranslation()

  const navLinks = [
    { href: '#services', label: t.nav.services },
    { href: '#products', label: t.nav.products },
    { href: '#pricing', label: t.nav.pricing },
    { href: '#portfolio', label: t.nav.portfolio },
    { href: '#about', label: t.nav.about },
    { href: '#contact', label: t.nav.contact },
  ]

  const scrollTo = (href: string) => {
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <footer className="bg-bg-primary border-t border-border py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-3 gap-8 mb-10">
          {/* Logo + tagline */}
          <div>
            <div className="flex items-baseline gap-0 mb-2">
              <span className="font-mono text-xl font-bold text-accent-amber">A</span>
              <span className="font-mono text-xl font-bold text-text-primary">xiom</span>
            </div>
            <p className="text-text-secondary text-sm">{t.footer.tagline}</p>
          </div>

          {/* Quick links */}
          <div>
            <p className="font-mono text-xs text-text-muted uppercase tracking-wider mb-3">Quick Links</p>
            <div className="grid grid-cols-2 gap-1.5">
              {navLinks.map((link) => (
                <button
                  key={link.href}
                  onClick={() => scrollTo(link.href)}
                  className="text-text-secondary text-sm hover:text-accent-amber transition-colors text-left"
                >
                  {link.label}
                </button>
              ))}
            </div>
          </div>

          {/* Social */}
          <div>
            <p className="font-mono text-xs text-text-muted uppercase tracking-wider mb-3">{t.contact.social}</p>
            <div className="flex gap-2">
              {[Camera, ThumbsUp].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-9 h-9 rounded-lg bg-bg-secondary border border-border flex items-center justify-center hover:border-accent-amber hover:text-accent-amber text-text-secondary transition-all"
                >
                  <Icon size={16} />
                </a>
              ))}
              <a
                href="#"
                className="w-9 h-9 rounded-lg bg-bg-secondary border border-border flex items-center justify-center hover:border-accent-amber hover:text-accent-amber text-text-secondary transition-all font-mono text-xs font-bold"
              >
                TT
              </a>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="layer-line-divider mb-6" />

        {/* Bottom */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-muted">
          <p>{t.footer.rights}</p>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-accent-amber transition-colors">{t.footer.privacy}</a>
            <a href="#" className="hover:text-accent-amber transition-colors">{t.footer.terms}</a>
            <span className="text-accent-amber">{t.footer.madeIn}</span>
            <a href="/portal" className="hover:text-text-secondary transition-colors">Customer Portal</a>
            {/* Admin login is intentionally not linked from the public site —
                the route still works for direct navigation (/admin). */}
          </div>
        </div>
      </div>
    </footer>
  )
}
