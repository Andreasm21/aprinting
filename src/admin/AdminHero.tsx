import { useContentStore } from '@/stores/contentStore'

export default function AdminHero() {
  const { content, updateContent } = useContentStore()
  const hero = content.hero

  const update = (field: string, value: string) => {
    updateContent('hero', { [field]: value })
  }

  return (
    <div>
      <h1 className="font-mono text-2xl font-bold text-text-primary mb-2">Hero Section</h1>
      <p className="text-text-secondary text-sm mb-8">Edit the hero section text and stats.</p>

      <div className="space-y-6">
        <div className="card-base p-5">
          <h3 className="font-mono text-sm font-bold text-accent-amber uppercase tracking-wider mb-4">Tagline</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">English</label>
              <input value={hero.tagline} onChange={(e) => update('tagline', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Greek</label>
              <input value={hero.taglineGr} onChange={(e) => update('taglineGr', e.target.value)} className="input-field" />
            </div>
          </div>
        </div>

        <div className="card-base p-5">
          <h3 className="font-mono text-sm font-bold text-accent-amber uppercase tracking-wider mb-4">Subtitle</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">English</label>
              <textarea value={hero.subtitle} onChange={(e) => update('subtitle', e.target.value)} className="input-field resize-none" rows={3} />
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Greek</label>
              <textarea value={hero.subtitleGr} onChange={(e) => update('subtitleGr', e.target.value)} className="input-field resize-none" rows={3} />
            </div>
          </div>
        </div>

        <div className="card-base p-5">
          <h3 className="font-mono text-sm font-bold text-accent-amber uppercase tracking-wider mb-4">Floating Stats</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Stat 1</label>
              <input value={hero.stat1} onChange={(e) => update('stat1', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Stat 2</label>
              <input value={hero.stat2} onChange={(e) => update('stat2', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Stat 3</label>
              <input value={hero.stat3} onChange={(e) => update('stat3', e.target.value)} className="input-field" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
