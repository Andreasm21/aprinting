// Modal for creating a new folder in the current directory.

import { useState } from 'react'
import { X, FolderPlus } from 'lucide-react'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { useAdminFilesStore } from '@/stores/adminFilesStore'

interface Props {
  parentId?: string
  onClose: () => void
}

export default function NewFolderModal({ parentId, onClose }: Props) {
  const currentUser = useAdminAuthStore((s) => s.currentUser)
  const createFolder = useAdminFilesStore((s) => s.createFolder)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!currentUser) return null

  const submit = async () => {
    setError('')
    const trimmed = name.trim()
    if (!trimmed) { setError('Name required'); return }
    if (trimmed.length > 80) { setError('Name too long (max 80 chars)'); return }
    setSubmitting(true)
    const folder = await createFolder(trimmed, parentId, currentUser.id)
    setSubmitting(false)
    if (folder) onClose()
    else setError('Failed to create folder')
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-sm card-base p-5 font-mono" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-text-primary font-bold text-sm flex items-center gap-2">
            <FolderPlus size={14} className="text-accent-amber" /> New folder
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-text-muted hover:text-text-primary">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] uppercase text-text-muted tracking-wider mb-1">Folder name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError('') }}
              onKeyDown={(e) => { if (e.key === 'Enter') void submit() }}
              placeholder="e.g. Designs"
              autoFocus
              maxLength={80}
              className="input-field text-xs"
            />
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
              {submitting ? 'Creating…' : 'Create folder'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
