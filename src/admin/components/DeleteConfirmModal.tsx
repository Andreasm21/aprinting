import { useState } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'

interface Props {
  label: string
  count?: number
  onConfirm: () => void
  onCancel: () => void
}

export default function DeleteConfirmModal({ label, count, onConfirm, onCancel }: Props) {
  const [text, setText] = useState('')
  const isValid = text.trim().toLowerCase() === 'delete'

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-bg-secondary border border-red-400/30 rounded-lg max-w-md w-full p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-400/10 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-red-400" />
          </div>
          <div>
            <h3 className="font-mono text-base font-bold text-text-primary">Confirm Delete</h3>
            <p className="text-text-muted text-xs font-mono">This action cannot be undone</p>
          </div>
        </div>
        <div className="bg-bg-tertiary rounded-lg p-3 mb-4 border-l-2 border-red-400">
          <p className="text-text-secondary text-sm">You are about to permanently delete:</p>
          <p className="font-mono text-sm text-text-primary mt-1 break-words">{label}</p>
        </div>
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
          className="input-field text-sm font-mono mb-4"
        />
        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-outline flex-1 text-sm py-2">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={!isValid}
            className="flex-1 bg-red-400 text-bg-primary font-mono font-bold py-2 rounded-lg hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 text-sm"
          >
            <Trash2 size={14} /> Delete {count && count > 1 ? `(${count})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
