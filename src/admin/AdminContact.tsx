import { useContentStore } from '@/stores/contentStore'

export default function AdminContact() {
  const { content, updateContent } = useContentStore()
  const contact = content.contact

  const update = (field: string, value: string) => {
    updateContent('contact', { [field]: value })
  }

  return (
    <div>
      <h1 className="font-mono text-2xl font-bold text-text-primary mb-2">Contact Info</h1>
      <p className="text-text-secondary text-sm mb-8">Edit your contact details shown on the site.</p>

      <div className="card-base p-5 space-y-5">
        <div>
          <label className="block font-mono text-xs text-text-muted uppercase mb-1">WhatsApp Number</label>
          <input value={contact.whatsappNumber} onChange={(e) => update('whatsappNumber', e.target.value)} className="input-field max-w-sm" placeholder="+357 99 000 000" />
          <p className="text-text-muted text-xs mt-1">Include country code. Shown on WhatsApp button and used for wa.me link.</p>
        </div>

        <div>
          <label className="block font-mono text-xs text-text-muted uppercase mb-1">Email Address</label>
          <input value={contact.email} onChange={(e) => update('email', e.target.value)} className="input-field max-w-sm" placeholder="team@axiomcreate.com" />
        </div>

        <div>
          <label className="block font-mono text-xs text-text-muted uppercase mb-1">Location</label>
          <input value={contact.location} onChange={(e) => update('location', e.target.value)} className="input-field max-w-sm" placeholder="Cyprus" />
        </div>

        <div>
          <label className="block font-mono text-xs text-text-muted uppercase mb-1">Business Hours</label>
          <input value={contact.hours} onChange={(e) => update('hours', e.target.value)} className="input-field max-w-sm" placeholder="Mon – Sat: 9:00 – 19:00" />
        </div>
      </div>
    </div>
  )
}
