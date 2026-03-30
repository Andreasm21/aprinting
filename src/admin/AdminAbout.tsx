import { useContentStore } from '@/stores/contentStore'

export default function AdminAbout() {
  const { content, updateContent } = useContentStore()
  const about = content.about

  const update = (field: string, value: string) => {
    updateContent('about', { [field]: value })
  }

  return (
    <div>
      <h1 className="font-mono text-2xl font-bold text-text-primary mb-2">About Section</h1>
      <p className="text-text-secondary text-sm mb-8">Edit the about section text and statistics.</p>

      <div className="space-y-6">
        <div className="card-base p-5">
          <h3 className="font-mono text-sm font-bold text-accent-amber uppercase tracking-wider mb-4">About Text</h3>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-xs text-text-muted uppercase mb-1">Paragraph 1 (EN)</label>
                <textarea value={about.p1} onChange={(e) => update('p1', e.target.value)} className="input-field resize-none" rows={4} />
              </div>
              <div>
                <label className="block font-mono text-xs text-text-muted uppercase mb-1">Paragraph 1 (GR)</label>
                <textarea value={about.p1Gr} onChange={(e) => update('p1Gr', e.target.value)} className="input-field resize-none" rows={4} />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-xs text-text-muted uppercase mb-1">Paragraph 2 (EN)</label>
                <textarea value={about.p2} onChange={(e) => update('p2', e.target.value)} className="input-field resize-none" rows={4} />
              </div>
              <div>
                <label className="block font-mono text-xs text-text-muted uppercase mb-1">Paragraph 2 (GR)</label>
                <textarea value={about.p2Gr} onChange={(e) => update('p2Gr', e.target.value)} className="input-field resize-none" rows={4} />
              </div>
            </div>
          </div>
        </div>

        <div className="card-base p-5">
          <h3 className="font-mono text-sm font-bold text-accent-amber uppercase tracking-wider mb-4">Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Prints</label>
              <input value={about.printsVal} onChange={(e) => update('printsVal', e.target.value)} className="input-field text-sm" placeholder="500+" />
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Customers</label>
              <input value={about.customersVal} onChange={(e) => update('customersVal', e.target.value)} className="input-field text-sm" placeholder="120+" />
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Years</label>
              <input value={about.yearsVal} onChange={(e) => update('yearsVal', e.target.value)} className="input-field text-sm" placeholder="3+" />
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Materials</label>
              <input value={about.materialsVal} onChange={(e) => update('materialsVal', e.target.value)} className="input-field text-sm" placeholder="8+" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
