import { useState, useRef } from 'react'
import { X, Check, User, Building2, Shield, Copy, RefreshCw, AlertTriangle, Clock } from 'lucide-react'
import bcrypt from 'bcryptjs'
import type { Customer, AccountType, PaymentTerms, DiscountTier } from '@/stores/customersStore'

export const TAG_PRESETS = ['VIP', 'B2B', 'Wholesale', 'Recurring', 'Car Parts', 'Prototype', 'New']

interface CustomerFormData {
  accountType: AccountType
  name: string
  email: string
  phone: string
  company: string
  vatNumber: string
  address: string
  city: string
  postalCode: string
  billingAddress: string
  billingCity: string
  billingPostalCode: string
  paymentTerms: PaymentTerms
  discountTier: DiscountTier
  notes: string
  tags: string[]
}

export default function CustomerFormModal({
  initial,
  onSave,
  onClose,
  title,
}: {
  initial: Partial<Customer>
  onSave: (data: Omit<Customer, 'id' | 'createdAt' | 'totalOrders' | 'totalSpent'>) => void
  onClose: () => void
  title: string
}) {
  const [form, setForm] = useState<CustomerFormData>({
    accountType: initial.accountType || 'individual',
    name: initial.name || '',
    email: initial.email || '',
    phone: initial.phone || '',
    company: initial.company || '',
    vatNumber: initial.vatNumber || '',
    address: initial.address || '',
    city: initial.city || '',
    postalCode: initial.postalCode || '',
    billingAddress: initial.billingAddress || '',
    billingCity: initial.billingCity || '',
    billingPostalCode: initial.billingPostalCode || '',
    paymentTerms: initial.paymentTerms || 'immediate',
    discountTier: initial.discountTier || 'none',
    notes: initial.notes || '',
    tags: initial.tags || [],
  })

  const [portalEnabled, setPortalEnabled] = useState(initial.portalEnabled || false)
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [passwordHash, setPasswordHash] = useState(initial.passwordHash || '')
  const [copied, setCopied] = useState(false)
  const [showVatWarning, setShowVatWarning] = useState(false)
  const vatInputRef = useRef<HTMLInputElement>(null)

  const generatePassword = async () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    let pw = ''
    for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)]
    setGeneratedPassword(pw)
    const hash = await bcrypt.hash(pw, 10)
    setPasswordHash(hash)
    setCopied(false)
  }

  const copyPassword = () => {
    navigator.clipboard.writeText(generatedPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isBusiness = form.accountType === 'business'

  const toggleTag = (tag: string) => {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }))
  }

  const performSave = () => {
    onSave({
      accountType: form.accountType,
      name: form.name,
      email: form.email,
      phone: form.phone,
      company: form.company || undefined,
      vatNumber: form.vatNumber || undefined,
      address: form.address || undefined,
      city: form.city || undefined,
      postalCode: form.postalCode || undefined,
      billingAddress: form.billingAddress || undefined,
      billingCity: form.billingCity || undefined,
      billingPostalCode: form.billingPostalCode || undefined,
      paymentTerms: isBusiness ? form.paymentTerms : undefined,
      discountTier: isBusiness ? form.discountTier : undefined,
      notes: form.notes || undefined,
      tags: form.tags,
      portalEnabled,
      passwordHash: passwordHash || undefined,
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Warn if business account has no VAT number — show inline modal
    if (form.accountType === 'business' && form.company.trim() && !form.vatNumber.trim()) {
      setShowVatWarning(true)
      return
    }
    performSave()
  }

  const handleVatStay = () => {
    setShowVatWarning(false)
    setTimeout(() => vatInputRef.current?.focus(), 100)
  }

  const handleVatLater = () => {
    setShowVatWarning(false)
    performSave()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-bg-secondary border border-border rounded-lg max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-bg-secondary z-10">
          <h2 className="font-mono text-lg font-bold text-text-primary">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-bg-tertiary rounded">
            <X size={20} className="text-text-muted" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Account Type Toggle */}
          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-2">Account Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, accountType: 'individual' })}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border font-mono text-sm transition-all ${
                  !isBusiness
                    ? 'border-accent-amber text-accent-amber bg-accent-amber/5'
                    : 'border-border text-text-secondary hover:border-text-muted'
                }`}
              >
                <User size={16} /> Individual
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, accountType: 'business', tags: form.tags.includes('B2B') ? form.tags : [...form.tags, 'B2B'] })}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border font-mono text-sm transition-all ${
                  isBusiness
                    ? 'border-accent-blue text-accent-blue bg-accent-blue/5'
                    : 'border-border text-text-secondary hover:border-text-muted'
                }`}
              >
                <Building2 size={16} /> Business
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Full Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" required />
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Email *</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" required />
            </div>
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1">Phone</label>
            <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" />
          </div>

          {/* Company & VAT — always visible, required for business */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">
                Company {isBusiness && <span className="text-accent-amber">*</span>}
              </label>
              <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="input-field" required={isBusiness} />
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">
                VAT Number {isBusiness && <span className="text-accent-amber">*</span>}
              </label>
              <input ref={vatInputRef} value={form.vatNumber} onChange={(e) => setForm({ ...form, vatNumber: e.target.value })} className="input-field" placeholder="CY12345678X" />
            </div>
          </div>

          {/* Delivery Address */}
          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1">Delivery Address</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">City</label>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">Postal Code</label>
              <input value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} className="input-field" />
            </div>
          </div>

          {/* Business-only fields */}
          {isBusiness && (
            <>
              <div className="border-t border-border pt-4">
                <h3 className="font-mono text-xs text-accent-blue uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Building2 size={12} /> Business Details
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block font-mono text-xs text-text-muted uppercase mb-1">Billing Address</label>
                    <input value={form.billingAddress} onChange={(e) => setForm({ ...form, billingAddress: e.target.value })} className="input-field" placeholder="Leave empty to use delivery address" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-mono text-xs text-text-muted uppercase mb-1">Billing City</label>
                      <input value={form.billingCity} onChange={(e) => setForm({ ...form, billingCity: e.target.value })} className="input-field" />
                    </div>
                    <div>
                      <label className="block font-mono text-xs text-text-muted uppercase mb-1">Billing Postal Code</label>
                      <input value={form.billingPostalCode} onChange={(e) => setForm({ ...form, billingPostalCode: e.target.value })} className="input-field" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-mono text-xs text-text-muted uppercase mb-1">Payment Terms</label>
                      <select value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value as PaymentTerms })} className="input-field">
                        <option value="immediate">Immediate</option>
                        <option value="net15">Net 15 days</option>
                        <option value="net30">Net 30 days</option>
                        <option value="net60">Net 60 days</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-mono text-xs text-text-muted uppercase mb-1">Discount Tier</label>
                      <select value={form.discountTier} onChange={(e) => setForm({ ...form, discountTier: e.target.value as DiscountTier })} className="input-field">
                        <option value="none">None (0%)</option>
                        <option value="silver">Silver (5%)</option>
                        <option value="gold">Gold (10%)</option>
                        <option value="platinum">Platinum (15%)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Tags */}
          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-2">Tags</label>
            <div className="flex flex-wrap gap-2">
              {TAG_PRESETS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`text-xs font-mono px-2.5 py-1 rounded-full border transition-all ${
                    form.tags.includes(tag)
                      ? 'bg-accent-amber/10 text-accent-amber border-accent-amber/30'
                      : 'border-border text-text-muted hover:border-text-secondary hover:text-text-secondary'
                  }`}
                >
                  {form.tags.includes(tag) && <Check size={10} className="inline mr-1" />}
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Portal Access */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-mono text-xs text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                <Shield size={12} /> Customer Portal Access
              </h3>
              <button
                type="button"
                onClick={() => setPortalEnabled(!portalEnabled)}
                className={`relative w-10 h-5 rounded-full transition-colors ${portalEnabled ? 'bg-accent-green' : 'bg-bg-tertiary border border-border'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${portalEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {portalEnabled && (
              <div className="space-y-3 bg-bg-tertiary rounded-lg p-3">
                <p className="text-text-muted text-xs">
                  {passwordHash && !generatedPassword ? 'Portal access is active. Generate a new password to reset.' : 'Generate a password for this customer to access the portal.'}
                </p>
                {generatedPassword ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={generatedPassword}
                        className="input-field text-sm font-mono flex-1"
                      />
                      <button type="button" onClick={copyPassword} className="btn-outline text-xs py-2 px-3 flex items-center gap-1">
                        <Copy size={12} /> {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-accent-amber text-[11px] font-mono">
                      Copy this password now — it won't be shown again after saving.
                    </p>
                    <button type="button" onClick={generatePassword} className="text-xs font-mono text-text-muted hover:text-accent-amber flex items-center gap-1">
                      <RefreshCw size={10} /> Regenerate
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={generatePassword} className="btn-amber text-xs py-1.5 px-3 flex items-center gap-1.5">
                    <Shield size={12} /> Generate Password
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input-field resize-none" rows={2} placeholder="Internal notes about this customer..." />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-border">
            <button type="button" onClick={onClose} className="btn-outline text-sm py-2 px-4">Cancel</button>
            <button type="submit" className="btn-amber text-sm py-2 px-4 flex items-center gap-1.5">
              <Check size={14} /> Save
            </button>
          </div>
        </form>
      </div>

      {/* VAT Warning Modal — appears when business has no VAT number */}
      {showVatWarning && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-bg-secondary border border-accent-amber/40 rounded-lg max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent-amber/10 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-accent-amber" />
              </div>
              <div className="flex-1">
                <h3 className="font-mono text-base font-bold text-text-primary mb-1">VAT Number Required</h3>
                <p className="text-text-secondary text-sm">
                  A VAT number is <span className="text-accent-amber font-bold">mandatory</span> for business accounts.
                </p>
              </div>
            </div>

            <div className="bg-bg-tertiary rounded-lg p-3 mb-5 border-l-2 border-accent-amber">
              <p className="text-text-secondary text-xs">
                <span className="font-mono text-text-primary">{form.company || 'This business'}</span> has no VAT number.
                You can add it now, or save without it — the account will be flagged as <span className="font-mono text-accent-amber">PENDING VAT</span> until you add it later.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleVatLater}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm font-mono py-2.5 px-4 rounded-lg border border-border text-text-muted hover:text-text-secondary"
              >
                <Clock size={14} /> Do It Later
              </button>
              <button
                onClick={handleVatStay}
                className="btn-amber flex-1 text-sm py-2.5 px-4 flex items-center justify-center gap-1.5"
              >
                <Check size={14} /> Stay & Add VAT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
