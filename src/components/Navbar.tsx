import { useState, useEffect } from 'react'
import { ShoppingCart, Menu, X, Globe } from 'lucide-react'
import { useCartStore } from '@/stores/cartStore'
import { useAppStore } from '@/stores/appStore'
import { useTranslation } from '@/hooks/useTranslation'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const { toggleCart, getItemCount, badgeBounce } = useCartStore()
  const { toggleLanguage, language, mobileMenuOpen, setMobileMenuOpen } = useAppStore()
  const t = useTranslation()
  const count = getItemCount()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const navLinks = [
    { href: '#services', label: t.nav.services },
    { href: '#products', label: t.nav.products },
    { href: '#custom-part', label: language === 'gr' ? 'B2B Εξαρτήματα' : 'Custom Part' },
    { href: '#pricing', label: t.nav.pricing },
    { href: '#portfolio', label: t.nav.portfolio },
    { href: '#about', label: t.nav.about },
    { href: '#contact', label: t.nav.contact },
  ]

  const scrollTo = (href: string) => {
    setMobileMenuOpen(false)
    const el = document.querySelector(href)
    el?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-bg-primary/95 backdrop-blur-md border-b border-border shadow-lg'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <a href="#hero" onClick={() => scrollTo('#hero')} className="flex items-baseline gap-0 cursor-pointer">
              <span className="font-mono text-xl md:text-2xl font-bold text-accent-amber tracking-tight">
                A
              </span>
              <span className="font-mono text-xl md:text-2xl font-bold text-text-primary tracking-tight">
                Printing
              </span>
            </a>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <button
                  key={link.href}
                  onClick={() => scrollTo(link.href)}
                  className="font-mono text-sm text-text-secondary hover:text-accent-amber transition-colors duration-200 tracking-wide uppercase"
                >
                  {link.label}
                </button>
              ))}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              <button
                onClick={toggleLanguage}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border hover:border-accent-amber text-text-secondary hover:text-accent-amber transition-all duration-200"
                aria-label="Toggle language"
              >
                <Globe size={16} />
                <span className="font-mono text-xs font-bold">{language.toUpperCase()}</span>
              </button>

              <button
                onClick={toggleCart}
                className="relative p-2 rounded-md hover:bg-bg-tertiary transition-colors duration-200"
                aria-label="Shopping cart"
              >
                <ShoppingCart size={22} className="text-text-primary" />
                {count > 0 && (
                  <span
                    className={`absolute -top-1 -right-1 bg-accent-amber text-bg-primary text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center font-mono ${
                      badgeBounce ? 'animate-bounce-badge' : ''
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>

              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-md hover:bg-bg-tertiary transition-colors"
                aria-label="Menu"
              >
                {mobileMenuOpen ? (
                  <X size={22} className="text-text-primary" />
                ) : (
                  <Menu size={22} className="text-text-primary" />
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-40 md:hidden transition-all duration-300 ${
          mobileMenuOpen ? 'visible' : 'invisible'
        }`}
      >
        <div
          className={`absolute inset-0 bg-black/60 transition-opacity ${
            mobileMenuOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setMobileMenuOpen(false)}
        />
        <div
          className={`absolute right-0 top-0 h-full w-72 bg-bg-secondary border-l border-border transform transition-transform duration-300 ${
            mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="pt-20 px-6 flex flex-col gap-2">
            {navLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                className="font-mono text-base text-text-secondary hover:text-accent-amber py-3 border-b border-border text-left transition-colors uppercase tracking-wide"
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
