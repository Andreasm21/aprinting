import { useState } from 'react'
import { X, Check, Eye, EyeOff, Copy, Shield, AlertTriangle } from 'lucide-react'
import type { AdminUser } from '@/stores/adminAuthStore'

interface FormData {
  username: string
  displayName: string
  email: string
  password: string
}

export default function AdminUserFormModal({
  initial,
  onSave,
  onClose,
  title,
}: {
  initial?: AdminUser
  onSave: (data: FormData) => Promise<{ success: boolean; error?: string; generatedPassword?: string }>
  onClose: () => void
  title: string
}) {
  const isEdit = !!initial
  const [form, setForm] = useState<FormData>({
    username: initial?.username || '',
    displayName: initial?.displayName || '',
    email: initial?.email || '',
    password: '',
  })
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [createdPassword, setCreatedPassword] = useState('')
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (form.username.trim().length < 3) {
      setError('Username must be at least 3 characters')
      return
    }
    if (!form.displayName.trim()) {
      setError('Display name is required')
      return
    }
    if (isEdit && form.password.length > 0 && form.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setSubmitting(true)
    const result = await onSave(form)
    setSubmitting(false)
    if (!result.success && result.error) {
      setError(result.error)
      return
    }
    // For new account creation, show the generated password
    if (!isEdit && result.generatedPassword) {
      setCreatedPassword(result.generatedPassword)
    }
  }

  const copyPassword = () => {
    navigator.clipboard.writeText(createdPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // After creation, show the generated password screen
  if (createdPassword) {
    return (
      <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-bg-secondary border border-accent-green/40 rounded-lg max-w-md w-full p-6">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-accent-green/10 flex items-center justify-center">
              <Check size={24} className="text-accent-green" />
            </div>
          </div>
          <h2 className="font-mono text-lg font-bold text-text-primary text-center mb-2">Account Created</h2>
          <p className="text-text-secondary text-sm text-center mb-5">
            <span className="font-mono text-accent-amber">@{form.username.trim().toLowerCase()}</span> has been added to the team.
          </p>

          <div className="bg-bg-tertiary rounded-lg p-4 mb-4 border border-accent-amber/30">
            <label className="block font-mono text-[10px] text-text-muted uppercase tracking-wider mb-2">
              Temporary Password
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={createdPassword}
                className="input-field text-base font-mono flex-1 font-bold text-accent-amber"
              />
              <button
                type="button"
                onClick={copyPassword}
                className="btn-outline text-xs py-2 px-3 flex items-center gap-1"
              >
                <Copy size={12} /> {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-accent-amber text-[11px] font-mono mt-3 flex items-start gap-1.5">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              <span>Send this password to the team member. They'll be required to change it on first login.</span>
            </p>
          </div>

          <button onClick={onClose} className="btn-amber w-full text-sm py-2.5 flex items-center justify-center gap-1.5">
            <Shield size={14} /> Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-bg-secondary border border-border rounded-lg max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-mono text-base font-bold text-text-primary">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-bg-tertiary rounded">
            <X size={18} className="text-text-muted" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1">Username *</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              disabled={isEdit}
              autoFocus={!isEdit}
              required
              minLength={3}
              className="input-field text-sm font-mono lowercase"
              placeholder="andreas"
            />
            {isEdit && <p className="text-text-muted text-[10px] mt-1 font-mono">Username cannot be changed</p>}
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1">Display Name *</label>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              required
              className="input-field text-sm"
              placeholder="Andreas Michaelides"
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1">Email (optional)</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input-field text-sm"
              placeholder="andreas@axiom3d.cy"
            />
          </div>

          {/* Password input only shown when editing — new accounts get auto-generated */}
          {isEdit ? (
            <div>
              <label className="block font-mono text-xs text-text-muted uppercase mb-1">
                Password (leave blank to keep current)
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input-field text-sm font-mono pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-accent-amber"
                >
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-bg-tertiary rounded-lg p-3 border border-border flex items-start gap-2">
              <Shield size={14} className="text-accent-amber shrink-0 mt-0.5" />
              <p className="text-text-secondary text-xs">
                A secure temporary password will be auto-generated. The team member will be required to change it on first login.
              </p>
            </div>
          )}

          {error && (
            <p className="text-red-400 text-xs font-mono">[ {error.toUpperCase()} ]</p>
          )}

          <div className="flex gap-3 pt-3 border-t border-border">
            <button type="button" onClick={onClose} className="btn-outline text-sm py-2 px-4 flex-1">Cancel</button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-amber text-sm py-2 px-4 flex-1 flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Check size={14} /> {submitting ? 'Saving...' : isEdit ? 'Save' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
