import { useState } from 'react'
import { Send, MessageCircle, Mail, MapPin, Upload, Camera, ThumbsUp } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import { useContentStore } from '@/stores/contentStore'
import { useNotificationsStore } from '@/stores/notificationsStore'

export default function Contact() {
  const t = useTranslation()
  const ref = useScrollReveal<HTMLElement>()
  const cc = useContentStore((s) => s.content.contact)
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    service: '',
    message: '',
  })
  const addContact = useNotificationsStore((s) => s.addContact)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    addContact({
      name: formState.name,
      email: formState.email,
      service: formState.service,
      message: formState.message,
    })
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 3000)
    setFormState({ name: '', email: '', service: '', message: '' })
  }

  return (
    <section id="contact" ref={ref} className="py-20 md:py-28 bg-bg-secondary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 reveal">
          <h2 className="section-title">
            <span className="section-title-amber">{t.contact.title}</span>
          </h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-10">
          {/* Left — form */}
          <div className="reveal">
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="text"
                placeholder={t.contact.name}
                required
                value={formState.name}
                onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                className="input-field"
              />

              <input
                type="email"
                placeholder={t.contact.email}
                required
                value={formState.email}
                onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                className="input-field"
              />

              <select
                value={formState.service}
                onChange={(e) => setFormState({ ...formState, service: e.target.value })}
                className="input-field appearance-none"
                required
              >
                <option value="" disabled>{t.contact.service}</option>
                <option value="fdm">{t.contact.serviceOptions.fdm}</option>
                <option value="resin">{t.contact.serviceOptions.resin}</option>
                <option value="prototype">{t.contact.serviceOptions.prototype}</option>
                <option value="custom">{t.contact.serviceOptions.custom}</option>
                <option value="general">{t.contact.serviceOptions.general}</option>
              </select>

              <textarea
                placeholder={t.contact.message}
                rows={4}
                value={formState.message}
                onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                className="input-field resize-none"
              />

              {/* File upload area */}
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-accent-amber/50 transition-colors cursor-pointer">
                <Upload size={28} className="mx-auto text-text-muted mb-2" />
                <p className="text-text-secondary text-sm">{t.contact.upload}</p>
                <p className="text-text-muted text-xs mt-1">{t.contact.uploadHint}</p>
              </div>

              <button
                type="submit"
                className="btn-amber w-full flex items-center justify-center gap-2"
              >
                <Send size={16} />
                {submitted ? '✓' : t.contact.send}
              </button>
            </form>
          </div>

          {/* Right — quick contact */}
          <div className="reveal flex flex-col gap-5" style={{ transitionDelay: '150ms' }}>
            {/* WhatsApp — temporarily hidden until we have a dedicated number */}
            {false && (
              <a
                href={`https://wa.me/${cc.whatsappNumber.replace(/[^0-9+]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-accent-green/10 border border-accent-green/30 rounded-lg p-4 hover:bg-accent-green/20 transition-colors group"
              >
                <div className="w-12 h-12 bg-accent-green rounded-full flex items-center justify-center shrink-0">
                  <MessageCircle size={24} className="text-white" />
                </div>
                <div>
                  <p className="font-mono text-base font-bold text-text-primary group-hover:text-accent-green transition-colors">
                    {t.contact.whatsapp}
                  </p>
                  <p className="text-text-secondary text-sm">{cc.whatsappNumber}</p>
                </div>
              </a>
            )}

            {/* Contact details */}
            <div className="card-base space-y-5">
              <div className="flex items-center gap-3">
                <Mail size={18} className="text-accent-amber shrink-0" />
                <div>
                  <p className="text-text-muted text-xs font-mono uppercase">{t.contact.emailLabel}</p>
                  <p className="text-text-primary text-sm">{cc.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <MapPin size={18} className="text-accent-amber shrink-0" />
                <div>
                  <p className="text-text-muted text-xs font-mono uppercase">{t.contact.location}</p>
                  <p className="text-text-primary text-sm">{cc.location}</p>
                </div>
              </div>

              {/* Business Hours — temporarily hidden until we set fixed hours */}
            </div>

            {/* Social */}
            <div className="card-base">
              <p className="font-mono text-xs text-text-muted uppercase tracking-wider mb-3">{t.contact.social}</p>
              <div className="flex gap-3">
                {[Camera, ThumbsUp].map((Icon, i) => (
                  <a
                    key={i}
                    href="#"
                    className="w-10 h-10 rounded-lg bg-bg-tertiary border border-border flex items-center justify-center hover:border-accent-amber hover:text-accent-amber text-text-secondary transition-all"
                  >
                    <Icon size={18} />
                  </a>
                ))}
                {/* TikTok (no lucide icon, use text) */}
                <a
                  href="#"
                  className="w-10 h-10 rounded-lg bg-bg-tertiary border border-border flex items-center justify-center hover:border-accent-amber hover:text-accent-amber text-text-secondary transition-all font-mono text-xs font-bold"
                >
                  TT
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
