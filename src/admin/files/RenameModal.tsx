// Modal for renaming a file or folder.

import { useState } from 'react'
import { X, Edit3 } from 'lucide-react'
import { useAdminFilesStore, type AdminFile } from '@/stores/adminFilesStore'

interface Props {
  item: AdminFile
  onClose: () => void
}

export default function RenameModal({ item, onClose }: Props) {
  const rename = useAdminFilesStore((s) => s.rename)
  const [name, setName] = useState(item.name)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    const trimmed = name.trim()
    if (!trimmed) { setError('Name required'); return }
    if (trimmed === item.name) { onClose(); return }
    setSubmitting(true)
    await rename(item.id, trimmed)
    setSubmitting(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-sm card-base p-5 font-mono" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-text-primary font-bold text-sm flex items-center gap-2">
            <Edit3 size={14} className="text-accent-amber" />
            Rename {item.isFolder ? 'folder' : 'file'}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-text-muted hover:text-text-primary">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError('') }}
            onKeyDown={(e) => { if (e.key === 'Enter') void submit() }}
            autoFocus
            maxLength={200}
            className="input-field text-xs"
          />
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
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
