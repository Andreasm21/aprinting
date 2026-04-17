import { useState } from 'react'
import { Mail, Phone, MapPin, Building2, CreditCard, Tag, Check, Lock } from 'lucide-react'
import bcrypt from 'bcryptjs'
import { usePortalAuthStore } from '@/stores/portalAuthStore'
import { useCustomersStore, DISCOUNT_RATES } from '@/stores/customersStore'

export default function PortalProfile() {
  const customer = usePortalAuthStore((s) => s.customer)
  const updateCustomer = useCustomersStore((s) => s.updateCustomer)

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)

  if (!customer) return null

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError('')
    setPwSuccess(false)

    if (newPw.length < 6) {
      setPwError('New password must be at least 6 characters')
      return
    }
    if (newPw !== confirmPw) {
      setPwError('Passwords do not match')
      return
    }

    setPwLoading(true)

    // Verify current password
    if (customer.passwordHash) {
      const valid = await bcrypt.compare(currentPw, customer.passwordHash)
      if (!valid) {
        setPwError('Current password is incorrect')
        setPwLoading(false)
        return
      }
    }

    // Hash new password and update
    const hash = await bcrypt.hash(newPw, 10)
    updateCustomer(customer.id, { passwordHash: hash })
    setPwSuccess(true)
    setCurrentPw('')
    setNewPw('')
    setConfirmPw('')
    setPwLoading(false)
    setTimeout(() => setPwSuccess(false), 3000)
  }

  return (
    <div>
      <h1 className="font-mono text-2xl font-bold text-text-primary mb-1">Profile</h1>
      <p className="text-text-secondary text-sm mb-6">Your account information.</p>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        {/* Contact Info */}
        <div className="card-base p-5 space-y-3">
          <h3 className="font-mono text-xs text-text-muted uppercase tracking-wider mb-3">Contact</h3>
          <div className="space-y-2.5 text-sm">
            <p className="flex items-center gap-2.5 text-text-primary">
              <Mail size={14} className="text-accent-amber shrink-0" /> {customer.email}
            </p>
            <p className="flex items-center gap-2.5 text-text-primary">
              <Phone size={14} className="text-accent-amber shrink-0" /> {customer.phone || '—'}
            </p>
            {customer.address && (
              <p className="flex items-start gap-2.5 text-text-secondary">
                <MapPin size={14} className="text-text-muted shrink-0 mt-0.5" />
                <span>{customer.address}{customer.city ? `, ${customer.city}` : ''}{customer.postalCode ? ` ${customer.postalCode}` : ''}</span>
              </p>
            )}
          </div>
        </div>

        {/* Business Info */}
        <div className="card-base p-5 space-y-3">
          <h3 className="font-mono text-xs text-text-muted uppercase tracking-wider mb-3">Business</h3>
          <div className="space-y-2.5 text-sm">
            {customer.company && (
              <p className="flex items-center gap-2.5 text-text-primary">
                <Building2 size={14} className="text-accent-amber shrink-0" /> {customer.company}
              </p>
            )}
            {customer.vatNumber && (
              <p className="flex items-center gap-2.5 text-text-secondary">
                <CreditCard size={14} className="text-text-muted shrink-0" /> VAT: {customer.vatNumber}
              </p>
            )}
            <div className="flex justify-between text-xs pt-2 border-t border-border">
              <span className="text-text-muted">Payment Terms</span>
              <span className="text-text-primary">
                {customer.paymentTerms === 'net15' ? 'Net 15' : customer.paymentTerms === 'net30' ? 'Net 30' : customer.paymentTerms === 'net60' ? 'Net 60' : 'Immediate'}
              </span>
            </div>
            {customer.discountTier && customer.discountTier !== 'none' && (
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Discount Tier</span>
                <span className="text-accent-amber font-bold capitalize">{customer.discountTier} ({DISCOUNT_RATES[customer.discountTier]}%)</span>
              </div>
            )}
          </div>
        </div>

        {/* Tags */}
        {customer.tags.length > 0 && (
          <div className="card-base p-5">
            <h3 className="font-mono text-xs text-text-muted uppercase tracking-wider mb-3">Tags</h3>
            <div className="flex flex-wrap gap-1.5">
              {customer.tags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-full bg-accent-amber/10 text-accent-amber border border-accent-amber/20">
                  <Tag size={10} /> {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Change Password */}
      <div className="card-base p-5 max-w-md">
        <h3 className="font-mono text-xs text-text-muted uppercase tracking-wider mb-4 flex items-center gap-1.5">
          <Lock size={12} /> Change Password
        </h3>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <label className="block text-text-muted text-xs font-mono uppercase mb-1">Current Password</label>
            <input
              type="password"
              value={currentPw}
              onChange={(e) => { setCurrentPw(e.target.value); setPwError('') }}
              className="input-field text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-text-muted text-xs font-mono uppercase mb-1">New Password</label>
            <input
              type="password"
              value={newPw}
              onChange={(e) => { setNewPw(e.target.value); setPwError('') }}
              className="input-field text-sm"
              required
              minLength={6}
            />
          </div>
          <div>
            <label className="block text-text-muted text-xs font-mono uppercase mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => { setConfirmPw(e.target.value); setPwError('') }}
              className={`input-field text-sm ${pwError ? 'border-red-500' : ''}`}
              required
            />
            {pwError && <p className="text-red-400 text-xs font-mono mt-1">{pwError}</p>}
            {pwSuccess && <p className="text-accent-green text-xs font-mono mt-1 flex items-center gap-1"><Check size={12} /> Password changed successfully</p>}
          </div>
          <button
            type="submit"
            disabled={pwLoading}
            className="btn-amber text-xs py-2 px-4 disabled:opacity-50"
          >
            {pwLoading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>

      <p className="text-text-muted text-xs font-mono mt-6">
        To update your company info, payment terms, or billing address, please contact your Axiom admin.
      </p>
    </div>
  )
}
