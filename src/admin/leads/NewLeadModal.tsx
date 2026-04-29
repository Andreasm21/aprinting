// Manual lead entry — for offline sources (phone calls, in-person meetings,
// emails, networking events).

import { useState } from 'react'
import { X, UserPlus, Package } from 'lucide-react'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { useLeadsStore, type LeadSource } from '@/stores/leadsStore'

const URGENCY_OPTIONS: { value: string; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'express',  label: 'Express' },
  { value: 'rush',     label: 'Rush' },
]

const MATERIAL_OPTIONS: { value: string; label: string }[] = [
  { value: '',          label: 'Not sure yet' },
  { value: 'fdm-pla',   label: 'FDM · PLA' },
  { value: 'fdm-petg',  label: 'FDM · PETG' },
  { value: 'fdm-abs',   label: 'FDM · ABS' },
  { value: 'fdm-asa',   label: 'FDM · ASA' },
  { value: 'fdm-tpu',   label: 'FDM · TPU' },
  { value: 'resin',     label: 'Resin' },
  { value: 'other',     label: 'Other / mixed' },
]

interface Props {
  onClose: () => void
  onCreated?: (id: string) => void
}

const MANUAL_SOURCES: { value: LeadSource; label: string }[] = [
  { value: 'phone', label: 'Phone call' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'In-person meeting' },
  { value: 'manual', label: 'Other / manual' },
]

export default function NewLeadModal({ onClose, onCreated }: Props) {
  const currentUser = useAdminAuthStore((s) => s.currentUser)
  const create = useLeadsStore((s) => s.create)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [source, setSource] = useState<LeadSource>('phone')
  const [notes, setNotes] = useState('')
  // Rough scope — feeds the eventual quote
  const [scopeDescription, setScopeDescription] = useState('')
  const [scopeQuantity, setScopeQuantity] = useState('')
  const [scopeMaterial, setScopeMaterial] = useState('')
  const [scopeUrgency, setScopeUrgency] = useState('standard')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!currentUser) return null

  const submit = async () => {
    setError('')
    if (!name.trim()) { setError('Name is required'); return }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Invalid email')
      return
    }
    setSubmitting(true)
    const qty = scopeQuantity ? parseInt(scopeQuantity, 10) : undefined
    const lead = await create({
      name,
      email: email || undefined,
      phone: phone || undefined,
      company: company || undefined,
      source,
      sourceLabel: scopeDescription ? scopeDescription.slice(0, 120) : (notes ? notes.slice(0, 120) : undefined),
      notes: notes || undefined,
      status: 'potential',
      assignedAdminId: currentUser.id,
      tags: [],
      scopeDescription: scopeDescription || undefined,
      scopeQuantity: qty && Number.isFinite(qty) ? qty : undefined,
      scopeMaterial: scopeMaterial || undefined,
      scopeUrgency: scopeUrgency || undefined,
    }, currentUser.id)
    setSubmitting(false)
    if (lead) {
      onCreated?.(lead.id)
      onClose()
    } else {
      setError('Failed to create lead — see console')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="w-full max-w-md card-base p-5 font-mono" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-text-primary font-bold text-sm flex items-center gap-2">
            <UserPlus size={14} className="text-accent-amber" /> New lead
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-text-muted hover:text-text-primary">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-[10px] uppercase text-text-muted tracking-wider mb-1">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Full name" className="input-field text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase text-text-muted tracking-wider mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="optional" className="input-field text-xs" />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-text-muted tracking-wider mb-1">Phone</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="optional" className="input-field text-xs" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase text-text-muted tracking-wider mb-1">Company (optional)</label>
            <input value={company} onChange={(e) => setCompany(e.target.value)} className="input-field text-xs" />
          </div>
          <div>
            <label className="block text-[10px] uppercase text-text-muted tracking-wider mb-1">Source</label>
            <div className="grid grid-cols-2 gap-1">
              {MANUAL_SOURCES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSource(s.value)}
                  className={`px-2 py-1.5 rounded text-[10px] uppercase tracking-wider border transition-colors ${
                    source === s.value
                      ? 'bg-accent-amber/10 border-accent-amber text-accent-amber'
                      : 'border-border text-text-secondary hover:border-accent-amber/50'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase text-text-muted tracking-wider mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Next step? Internal context?" rows={2} className="input-field text-xs resize-y" />
          </div>

          {/* Rough scope — pre-fills the quotation later */}
          <div className="border-t border-border pt-3">
            <p className="text-[10px] uppercase text-text-muted tracking-wider mb-2 flex items-center gap-1">
              <Package size={10} /> What they want (rough)
            </p>
            <p className="text-[10px] text-text-muted/80 mb-2 italic">
              No prices yet — just enough to fast-fill a quote later. e.g. "10 parts of label boxes".
            </p>
            <div className="space-y-2">
              <textarea
                value={scopeDescription}
                onChange={(e) => setScopeDescription(e.target.value)}
                placeholder="Description (one item is fine; admin can split into multiple line items in the quote)"
                rows={2}
                className="input-field text-xs resize-y"
              />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[9px] uppercase text-text-muted tracking-wider mb-1">Qty</label>
                  <input
                    type="number"
                    min={1}
                    value={scopeQuantity}
                    onChange={(e) => setScopeQuantity(e.target.value)}
                    placeholder="—"
                    className="input-field text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[9px] uppercase text-text-muted tracking-wider mb-1">Material</label>
                  <select
                    value={scopeMaterial}
                    onChange={(e) => setScopeMaterial(e.target.value)}
                    className="input-field text-xs"
                  >
                    {MATERIAL_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] uppercase text-text-muted tracking-wider mb-1">Urgency</label>
                  <select
                    value={scopeUrgency}
                    onChange={(e) => setScopeUrgency(e.target.value)}
                    className="input-field text-xs"
                  >
                    {URGENCY_OPTIONS.map((u) => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {error && <p className="text-red-400 text-[11px]">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="text-text-muted hover:text-text-primary text-xs px-3 py-1.5">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting || !name.trim()}
              className="bg-accent-amber text-bg-primary font-bold text-xs px-4 py-1.5 rounded disabled:opacity-50 hover:bg-accent-amber/90"
            >
              {submitting ? 'Creating…' : 'Create lead'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
