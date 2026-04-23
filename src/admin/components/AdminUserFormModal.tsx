import { useState } from 'react'
import { X, Check, Eye, EyeOff } from 'lucide-react'
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
  onSave: (data: FormData) => Promise<{ success: boolean; error?: string }>
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
    if (!isEdit && form.password.length < 6) {
      setError('Password must be at least 6 characters')
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
    }
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

          <div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1">
              Password {isEdit ? '(leave blank to keep current)' : '*'}
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required={!isEdit}
                minLength={isEdit ? undefined : 6}
                className="input-field text-sm font-mono pr-10"
                placeholder={isEdit ? '••••••••' : 'min 6 characters'}
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
              <Check size={14} /> {submitting ? 'Saving...' : isEdit ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
