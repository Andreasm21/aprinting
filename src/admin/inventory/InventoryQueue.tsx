import { useState } from 'react'
import {
  Printer, Plus, Play, Check, X as XIcon, Pause, Zap, Clock,
  AlertTriangle, Trash2, TrendingUp, Search,
} from 'lucide-react'
import {
  usePrintJobsStore,
  type PrintJob,
  type JobPriority,
} from '@/stores/printJobsStore'
import { useCustomersStore } from '@/stores/customersStore'
import { useContentStore } from '@/stores/contentStore'
import InventoryLayout from './InventoryLayout'
import DeleteConfirmModal from '../components/DeleteConfirmModal'

const PRIORITY_STYLE: Record<JobPriority, string> = {
  urgent: 'text-red-400 bg-red-400/10 border-red-400/30',
  high: 'text-accent-amber bg-accent-amber/10 border-accent-amber/30',
  normal: 'text-text-secondary bg-bg-tertiary border-border',
  low: 'text-text-muted bg-bg-tertiary border-border',
}

const PRIORITY_LABELS: Record<JobPriority, string> = {
  urgent: 'URGENT', high: 'HIGH', normal: 'NORMAL', low: 'LOW',
}

function formatDateTime(s?: string): string {
  if (!s) return '—'
  return new Date(s).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function formatDuration(hours?: number): string {
  if (!hours || hours === 0) return '—'
  if (hours < 1) return `${Math.round(hours * 60)}m`
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default function InventoryQueue() {
  const addJob = usePrintJobsStore((s) => s.addJob)
  const updateJob = usePrintJobsStore((s) => s.updateJob)
  const deleteJob = usePrintJobsStore((s) => s.deleteJob)
  const startJob = usePrintJobsStore((s) => s.startJob)
  const completeJob = usePrintJobsStore((s) => s.completeJob)
  const failJob = usePrintJobsStore((s) => s.failJob)
  const fastTrack = usePrintJobsStore((s) => s.fastTrack)

  const activeJob = usePrintJobsStore((s) => s.getActiveJob())
  const queuedJobs = usePrintJobsStore((s) => s.getQueuedJobs())
  const completedToday = usePrintJobsStore((s) => s.getCompletedTodayJobs())
  const quickWins = usePrintJobsStore((s) => s.getQuickWins())

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<PrintJob | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PrintJob | null>(null)
  const [search, setSearch] = useState('')

  const queuedFiltered = search
    ? queuedJobs.filter((j) => j.description.toLowerCase().includes(search.toLowerCase()))
    : queuedJobs

  const totalQueuedHours = queuedJobs.reduce((s, j) => s + (j.estimatedHours || 0) * j.quantity, 0)
  const completedTodayCount = completedToday.filter((j) => j.status === 'completed').length

  const customers = useCustomersStore((s) => s.customers)

  const stats = [
    { label: 'Currently Printing', value: activeJob ? '1' : '0', color: activeJob ? 'text-accent-amber' : 'text-text-muted' },
    { label: 'In Queue', value: queuedJobs.length.toString(), color: 'text-text-primary' },
    { label: 'Hours of Work', value: formatDuration(totalQueuedHours), color: 'text-accent-blue' },
    { label: 'Completed Today', value: completedTodayCount.toString(), color: 'text-accent-green' },
  ]

  return (
    <InventoryLayout>
      <div className="flex items-center justify-between mb-4">
        <p className="text-text-secondary text-sm">Print queue · 1 printer</p>
        <button onClick={() => setCreating(true)} className="btn-amber text-sm py-2 px-4 flex items-center gap-1.5">
          <Plus size={14} /> Add Print Job
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {stats.map((s) => (
          <div key={s.label} className="card-base p-3 text-center">
            <div className={`font-mono text-lg font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-text-muted uppercase font-mono">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Currently Printing card */}
      <div className="card-base p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Printer size={16} className="text-accent-amber" />
          <h3 className="font-mono text-sm font-bold text-text-primary uppercase tracking-wider">Now Printing</h3>
        </div>
        {activeJob ? (
          <div>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <p className="font-mono text-base text-accent-amber font-bold truncate">{activeJob.description}</p>
                <p className="text-text-muted text-xs mt-1">
                  {activeJob.material && `${activeJob.material} · `}
                  {activeJob.weightGrams ? `${activeJob.weightGrams}g · ` : ''}
                  {activeJob.estimatedHours ? `Est. ${formatDuration(activeJob.estimatedHours)} · ` : ''}
                  Started {formatDateTime(activeJob.startedAt)}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => completeJob(activeJob.id)} className="text-xs font-mono py-1.5 px-3 rounded bg-accent-green/10 text-accent-green hover:bg-accent-green/20 border border-accent-green/30 flex items-center gap-1">
                  <Check size={12} /> Complete
                </button>
                <button onClick={() => failJob(activeJob.id)} className="text-xs font-mono py-1.5 px-3 rounded bg-red-400/10 text-red-400 hover:bg-red-400/20 border border-red-400/30 flex items-center gap-1">
                  <XIcon size={12} /> Failed
                </button>
                <button onClick={() => updateJob(activeJob.id, { status: 'paused' })} className="text-xs font-mono py-1.5 px-3 rounded border border-border text-text-muted hover:text-accent-amber hover:border-accent-amber flex items-center gap-1">
                  <Pause size={12} /> Pause
                </button>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono text-text-muted uppercase">Progress</span>
                <span className="font-mono text-xs text-accent-amber">{activeJob.progress}%</span>
              </div>
              <div className="bg-bg-tertiary rounded-full h-2 overflow-hidden">
                <div className="bg-accent-amber h-full transition-all" style={{ width: `${activeJob.progress}%` }} />
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={activeJob.progress}
                onChange={(e) => updateJob(activeJob.id, { progress: parseInt(e.target.value) })}
                className="w-full mt-2 accent-accent-amber"
              />
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-text-muted text-sm font-mono mb-3">[ NO ACTIVE PRINT ]</p>
            {queuedJobs.length > 0 && (
              <button
                onClick={() => startJob(queuedJobs[0].id)}
                className="btn-amber text-sm py-2 px-4 inline-flex items-center gap-1.5"
              >
                <Play size={14} /> Start Next: {queuedJobs[0].description.substring(0, 40)}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Quick Wins */}
      {quickWins.length > 0 && (
        <div className="card-base p-4 mb-4 border-l-4 border-accent-amber bg-accent-amber/5">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={14} className="text-accent-amber" />
            <h3 className="font-mono text-xs font-bold text-accent-amber uppercase tracking-wider">Quick Wins</h3>
            <span className="text-[10px] font-mono text-text-muted">{quickWins.length} short jobs you could fast-track</span>
          </div>
          <div className="space-y-1.5">
            {quickWins.map((j) => (
              <div key={j.id} className="flex items-center gap-3 text-xs">
                <Clock size={12} className="text-accent-amber shrink-0" />
                <span className="text-text-secondary flex-1 truncate">{j.description}</span>
                <span className="font-mono text-text-muted">{formatDuration(j.estimatedHours)}</span>
                <button
                  onClick={() => fastTrack(j.id)}
                  className="text-[10px] font-mono py-1 px-2 rounded bg-accent-amber/20 text-accent-amber hover:bg-accent-amber/30"
                >
                  Fast-track ↑
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Queue */}
      <div className="card-base p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-mono text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
            <Clock size={14} className="text-accent-amber" /> Queue
          </h3>
          <div className="relative w-56">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search queue..."
              className="input-field text-xs py-1.5 pl-8"
            />
          </div>
        </div>

        {queuedFiltered.length === 0 ? (
          <p className="text-text-muted text-xs font-mono text-center py-8">[ QUEUE EMPTY ]</p>
        ) : (
          <div className="space-y-1.5">
            {queuedFiltered.map((j) => (
              <div key={j.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-bg-tertiary border border-border hover:border-accent-amber/30">
                <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border shrink-0 w-16 text-center ${PRIORITY_STYLE[j.priority]}`}>
                  {PRIORITY_LABELS[j.priority]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">{j.description}</p>
                  <p className="text-[10px] text-text-muted font-mono">
                    {j.material && `${j.material} · `}
                    {j.weightGrams ? `${j.weightGrams}g · ` : ''}
                    {j.estimatedHours ? `${formatDuration(j.estimatedHours)} · ` : ''}
                    qty {j.quantity}
                    {j.status === 'paused' && <span className="text-accent-amber"> · PAUSED</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!activeJob && (
                    <button onClick={() => startJob(j.id)} className="p-1.5 rounded bg-accent-green/10 text-accent-green hover:bg-accent-green/20" title="Start">
                      <Play size={12} />
                    </button>
                  )}
                  {j.priority !== 'urgent' && (
                    <button onClick={() => fastTrack(j.id)} className="p-1.5 rounded text-text-muted hover:text-accent-amber" title="Fast-track">
                      <TrendingUp size={12} />
                    </button>
                  )}
                  <button onClick={() => setEditing(j)} className="p-1.5 rounded text-text-muted hover:text-accent-blue" title="Edit">
                    <Pause size={12} className="rotate-90" />
                  </button>
                  <button onClick={() => setDeleteTarget(j)} className="p-1.5 rounded text-text-muted hover:text-red-400" title="Delete">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed today */}
      {completedToday.length > 0 && (
        <div className="card-base p-5 mt-4">
          <h3 className="font-mono text-sm font-bold text-text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
            <Check size={14} className="text-accent-green" /> Completed Today
          </h3>
          <div className="space-y-1">
            {completedToday.map((j) => (
              <div key={j.id} className="flex items-center gap-3 py-1 text-xs">
                {j.status === 'completed' ? (
                  <Check size={12} className="text-accent-green shrink-0" />
                ) : (
                  <AlertTriangle size={12} className="text-red-400 shrink-0" />
                )}
                <span className="text-text-secondary flex-1 truncate">{j.description}</span>
                <span className={`font-mono text-[10px] uppercase ${j.status === 'completed' ? 'text-accent-green' : 'text-red-400'}`}>
                  {j.status}
                </span>
                <span className="font-mono text-text-muted text-[10px]">{formatDateTime(j.completedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(creating || editing) && (
        <PrintJobFormModal
          initial={editing || undefined}
          customers={customers}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSave={(data) => {
            if (editing) {
              updateJob(editing.id, data)
            } else {
              addJob({
                source: 'manual',
                description: data.description || '',
                customerId: data.customerId,
                material: data.material,
                weightGrams: data.weightGrams,
                estimatedHours: data.estimatedHours,
                quantity: data.quantity ?? 1,
                priority: data.priority ?? 'normal',
                notes: data.notes,
              })
            }
            setCreating(false)
            setEditing(null)
          }}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          label={deleteTarget.description}
          onConfirm={() => { deleteJob(deleteTarget.id); setDeleteTarget(null) }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </InventoryLayout>
  )
}

// ────────────────── Form modal ──────────────────

interface CustomerOption { id: string; name: string; email: string }

function PrintJobFormModal({
  initial,
  customers,
  onClose,
  onSave,
}: {
  initial?: PrintJob
  customers: CustomerOption[]
  onClose: () => void
  onSave: (data: Partial<Omit<PrintJob, 'id' | 'createdAt' | 'position' | 'status' | 'progress'>>) => void
}) {
  const pricing = useContentStore((s) => s.content.pricing)
  const allMaterials = [...pricing.fdm.map((r) => r.material), ...pricing.resin.map((r) => r.type)]

  const [form, setForm] = useState({
    description: initial?.description || '',
    customerId: initial?.customerId || '',
    material: initial?.material || allMaterials[0] || '',
    weightGrams: initial?.weightGrams || 0,
    estimatedHours: initial?.estimatedHours || 0,
    quantity: initial?.quantity || 1,
    priority: initial?.priority || ('normal' as JobPriority),
    notes: initial?.notes || '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      description: form.description.trim(),
      customerId: form.customerId || undefined,
      material: form.material || undefined,
      weightGrams: form.weightGrams || undefined,
      estimatedHours: form.estimatedHours || undefined,
      quantity: form.quantity,
      priority: form.priority,
      notes: form.notes.trim() || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-bg-secondary border border-border rounded-lg max-w-lg w-full">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-mono text-base font-bold text-text-primary">{initial ? 'Edit Print Job' : 'Add Print Job'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-bg-tertiary rounded">
            <XIcon size={18} className="text-text-muted" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1">Description *</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
              autoFocus
              placeholder="e.g. Phone stand · Galaxy Black PLA"
              className="input-field text-sm"
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1">Customer (optional)</label>
            <select
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
              className="input-field text-sm"
            >
              <option value="">— None —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} · {c.email}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Material</label>
              <select
                value={form.material}
                onChange={(e) => setForm({ ...form, material: e.target.value })}
                className="input-field text-sm"
              >
                {allMaterials.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Weight (g)</label>
              <input
                type="number"
                step="1"
                min={0}
                value={form.weightGrams}
                onChange={(e) => setForm({ ...form, weightGrams: parseFloat(e.target.value) || 0 })}
                className="input-field text-sm font-mono"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Print Time (h)</label>
              <input
                type="number"
                step="0.25"
                min={0}
                value={form.estimatedHours}
                onChange={(e) => setForm({ ...form, estimatedHours: parseFloat(e.target.value) || 0 })}
                className="input-field text-sm font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Quantity</label>
              <input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
                className="input-field text-sm font-mono"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as JobPriority })}
                className="input-field text-sm"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="input-field text-sm resize-none"
              placeholder="Optional"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-border">
            <button type="button" onClick={onClose} className="btn-outline text-sm py-2 px-4">Cancel</button>
            <button type="submit" className="btn-amber text-sm py-2 px-4 flex items-center gap-1.5">
              <Plus size={14} /> {initial ? 'Save' : 'Add to Queue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
