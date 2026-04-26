import { useState, useEffect } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'

const BYPASS_KEY = 'axiom_skip_delete_confirm'

interface Props {
  label: string
  count?: number
  onConfirm: () => void
  onCancel: () => void
  // Quick mode: shows just Yes/No buttons, no 'type delete' requirement.
  // Used for low-risk archive operations like cancelling a public quote link.
  quick?: boolean
  // Verb shown in the title and confirm button. Defaults to 'Delete'.
  verb?: string
}

export default function DeleteConfirmModal({ label, count, onConfirm, onCancel, quick, verb = 'Delete' }: Props) {
  // Persistent bypass — once admin checks 'don't ask again' it skips the
  // type-to-confirm requirement on all future confirms (per browser).
  const [text, setText] = useState('')
  const [bypass, setBypass] = useState(() => localStorage.getItem(BYPASS_KEY) === '1')

  useEffect(() => {
    if (bypass) localStorage.setItem(BYPASS_KEY, '1')
    else localStorage.removeItem(BYPASS_KEY)
  }, [bypass])

  const requiresType = !quick && !bypass
  const isValid = !requiresType || text.trim().toLowerCase() === 'delete'

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-bg-secondary border border-red-400/30 rounded-lg max-w-md w-full p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-400/10 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-red-400" />
          </div>
          <div>
            <h3 className="font-mono text-base font-bold text-text-primary">Confirm {verb}</h3>
            <p className="text-text-muted text-xs font-mono">{quick ? 'Are you sure?' : 'This action cannot be undone'}</p>
          </div>
        </div>
        <div className="bg-bg-tertiary rounded-lg p-3 mb-4 border-l-2 border-red-400">
          <p className="text-text-secondary text-sm">You are about to {verb.toLowerCase()}:</p>
          <p className="font-mono text-sm text-text-primary mt-1 break-words">{label}</p>
        </div>
        {requiresType && (
          <>
            <label className="block font-mono text-xs text-text-muted uppercase mb-1.5">
              Type <span className="text-red-400 font-bold">delete</span> to confirm
            </label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && isValid) onConfirm() }}
              placeholder="delete"
              autoFocus
              className="input-field text-sm font-mono mb-3"
            />
          </>
        )}
        {!quick && (
          <label className="flex items-center gap-2 text-[11px] font-mono text-text-muted mb-4 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={bypass}
              onChange={(e) => setBypass(e.target.checked)}
              className="accent-red-400"
            />
            Don't ask me to type 'delete' next time (this browser)
          </label>
        )}
        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-outline flex-1 text-sm py-2">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={!isValid}
            className="flex-1 bg-red-400 text-bg-primary font-mono font-bold py-2 rounded-lg hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 text-sm"
          >
            <Trash2 size={14} /> {verb} {count && count > 1 ? `(${count})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
