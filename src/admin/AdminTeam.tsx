import { useState } from 'react'
import { UserCog, Plus, Edit3, Key, Trash2, X, AlertTriangle, Mail, Clock } from 'lucide-react'
import { useAdminAuthStore, type AdminUser } from '@/stores/adminAuthStore'
import AdminUserFormModal from './components/AdminUserFormModal'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(dateStr)
}

export default function AdminTeam() {
  const users = useAdminAuthStore((s) => s.users)
  const currentUser = useAdminAuthStore((s) => s.currentUser)
  const addAdmin = useAdminAuthStore((s) => s.addAdmin)
  const updateAdmin = useAdminAuthStore((s) => s.updateAdmin)
  const changePassword = useAdminAuthStore((s) => s.changePassword)
  const resetPassword = useAdminAuthStore((s) => s.resetPassword)
  const deleteAdmin = useAdminAuthStore((s) => s.deleteAdmin)

  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [changingPw, setChangingPw] = useState<AdminUser | null>(null)
  const [newPw, setNewPw] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const confirmDeletion = () => {
    if (!deleteTarget) return
    if (deleteConfirmText.trim().toLowerCase() !== 'delete') return
    const result = deleteAdmin(deleteTarget.id)
    if (!result.success && result.error) {
      showToast(result.error)
    }
    setDeleteTarget(null)
    setDeleteConfirmText('')
  }

  const handleChangePassword = async () => {
    if (!changingPw || newPw.length < 6) return
    // Admin manually setting a new password — also force the user to change it on next login
    await changePassword(changingPw.id, newPw, false)
    setPwSuccess(true)
    setTimeout(() => {
      setChangingPw(null)
      setNewPw('')
      setPwSuccess(false)
    }, 1500)
  }

  const handleResetPassword = async (user: AdminUser) => {
    const result = await resetPassword(user.id)
    if (result.password) {
      // Show in the same modal flow
      setChangingPw(user)
      setNewPw(result.password)
      setPwSuccess(true)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="font-mono text-2xl font-bold text-text-primary flex items-center gap-2">
            <UserCog size={24} className="text-accent-amber" /> Team
          </h1>
          <p className="text-text-secondary text-sm">Manage admin accounts and access</p>
        </div>
        <button onClick={() => setAdding(true)} className="btn-amber text-sm py-2 px-4 flex items-center gap-1.5">
          <Plus size={14} /> Add Team Member
        </button>
      </div>

      <p className="text-text-muted text-xs font-mono mb-6">
        {users.length} admin{users.length !== 1 ? 's' : ''} · all admins have full access
      </p>

      {/* Team list */}
      <div className="space-y-2">
        {users.map((u) => {
          const isMe = currentUser?.id === u.id
          const isLast = users.length === 1
          const cantDelete = isMe || isLast
          const initials = u.displayName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)

          return (
            <div key={u.id} className="card-base p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-accent-amber/10 flex items-center justify-center shrink-0">
                <span className="font-mono text-sm font-bold text-accent-amber">{initials}</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-mono text-sm text-text-primary font-medium">{u.displayName}</p>
                  <span className="text-[10px] font-mono text-accent-amber">@{u.username}</span>
                  {isMe && <span className="text-[10px] font-mono uppercase text-accent-green bg-accent-green/10 px-1.5 py-0.5 rounded border border-accent-green/30">You</span>}
                </div>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-text-muted font-mono">
                  {u.email && (
                    <span className="flex items-center gap-1"><Mail size={10} /> {u.email}</span>
                  )}
                  <span className="flex items-center gap-1"><Clock size={10} /> Last login: {timeAgo(u.lastLoginAt)}</span>
                  <span>· Created {formatDate(u.createdAt)}</span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setEditing(u)}
                  className="p-1.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-accent-blue"
                  title="Edit"
                >
                  <Edit3 size={14} />
                </button>
                <button
                  onClick={() => handleResetPassword(u)}
                  className="p-1.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-accent-amber"
                  title="Reset password (auto-generate)"
                >
                  <Key size={14} />
                </button>
                <button
                  onClick={() => { setDeleteTarget(u); setDeleteConfirmText('') }}
                  disabled={cantDelete}
                  className="p-1.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
                  title={isMe ? 'Cannot delete yourself' : isLast ? 'Cannot delete the last admin' : 'Delete'}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add modal */}
      {adding && (
        <AdminUserFormModal
          title="Add Team Member"
          onClose={() => setAdding(false)}
          onSave={async (data) => {
            const result = await addAdmin(data)
            if (result.success) setAdding(false)
            return result
          }}
        />
      )}

      {/* Edit modal */}
      {editing && (
        <AdminUserFormModal
          title={`Edit @${editing.username}`}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={async (data) => {
            await updateAdmin(editing.id, { displayName: data.displayName, email: data.email })
            if (data.password) await changePassword(editing.id, data.password)
            setEditing(null)
            return { success: true }
          }}
        />
      )}

      {/* Change password modal */}
      {changingPw && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-bg-secondary border border-accent-amber/30 rounded-lg max-w-sm w-full p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-mono text-base font-bold text-text-primary flex items-center gap-2">
                <Key size={16} className="text-accent-amber" /> {pwSuccess ? 'New Password Generated' : 'Reset Password'}
              </h3>
              <button onClick={() => { setChangingPw(null); setNewPw(''); setPwSuccess(false) }} className="p-1 hover:bg-bg-tertiary rounded">
                <X size={16} className="text-text-muted" />
              </button>
            </div>
            {pwSuccess ? (
              <>
                <p className="text-text-secondary text-xs mb-3">
                  New temporary password for <span className="font-mono text-accent-amber">@{changingPw.username}</span>:
                </p>
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="text"
                    readOnly
                    value={newPw}
                    className="input-field text-base font-mono font-bold text-accent-amber flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(newPw) }}
                    className="btn-outline text-xs py-2 px-3"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-accent-amber text-[11px] font-mono mb-3">
                  Send this to the team member. They'll be required to change it on next login.
                </p>
                <button onClick={() => { setChangingPw(null); setNewPw(''); setPwSuccess(false) }} className="btn-amber w-full text-sm py-2">
                  Done
                </button>
              </>
            ) : (
              <>
                <p className="text-text-secondary text-xs mb-3">
                  Set a custom password for <span className="font-mono text-accent-amber">@{changingPw.username}</span>:
                </p>
                <input
                  type="text"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  autoFocus
                  className="input-field text-sm font-mono mb-3"
                  placeholder="min 6 characters"
                  minLength={6}
                />
                <div className="flex gap-2">
                  <button onClick={() => { setChangingPw(null); setNewPw('') }} className="btn-outline flex-1 text-sm py-2">Cancel</button>
                  <button
                    onClick={handleChangePassword}
                    disabled={newPw.length < 6}
                    className="btn-amber flex-1 text-sm py-2 disabled:opacity-50"
                  >
                    Update
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-bg-secondary border border-red-400/30 rounded-lg max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-400/10 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="font-mono text-base font-bold text-text-primary">Confirm Delete</h3>
                <p className="text-text-muted text-xs font-mono">This action cannot be undone</p>
              </div>
            </div>
            <div className="bg-bg-tertiary rounded-lg p-3 mb-4 border-l-2 border-red-400">
              <p className="text-text-secondary text-sm">Permanently remove admin account:</p>
              <p className="font-mono text-sm text-text-primary mt-1">{deleteTarget.displayName} <span className="text-text-muted">· @{deleteTarget.username}</span></p>
            </div>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1.5">
              Type <span className="text-red-400 font-bold">delete</span> to confirm
            </label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && deleteConfirmText.trim().toLowerCase() === 'delete') confirmDeletion() }}
              placeholder="delete"
              autoFocus
              className="input-field text-sm font-mono mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => { setDeleteTarget(null); setDeleteConfirmText('') }} className="btn-outline flex-1 text-sm py-2">Cancel</button>
              <button
                onClick={confirmDeletion}
                disabled={deleteConfirmText.trim().toLowerCase() !== 'delete'}
                className="flex-1 bg-red-400 text-bg-primary font-mono font-bold py-2 rounded-lg hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 text-sm"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-bg-secondary border-l-4 border-red-400 px-5 py-3 rounded-r-lg shadow-xl">
          <p className="font-mono text-sm text-red-400 uppercase tracking-wider">[ {toast.toUpperCase()} ]</p>
        </div>
      )}
    </div>
  )
}
