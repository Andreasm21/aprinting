// One row in the file browser — works for both files and folders.

import { Folder, FileText, FileImage, Music, Video, Archive, FileCode, File } from 'lucide-react'
import type { AdminFile } from '@/stores/adminFilesStore'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { formatFileSize } from '@/lib/adminFilesStorage'

interface Props {
  item: AdminFile
  onOpen: () => void
  onContextMenu: (e: React.MouseEvent) => void
}

function iconFor(item: AdminFile) {
  if (item.isFolder) return Folder
  const m = item.mime
  if (m.startsWith('image/')) return FileImage
  if (m.startsWith('audio/')) return Music
  if (m.startsWith('video/')) return Video
  if (m === 'application/pdf') return FileText
  if (m.startsWith('text/') || m === 'application/json') return FileCode
  if (m === 'application/zip' || m.includes('compress') || m.includes('archive')) return Archive
  return File
}

function relativeTime(iso: string): string {
  const date = new Date(iso)
  const diff = Date.now() - date.getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.floor(hr / 24)
  if (d < 7) return `${d}d ago`
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: date.getFullYear() === new Date().getFullYear() ? undefined : '2-digit' })
}

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 2)
}

export default function FileItem({ item, onOpen, onContextMenu }: Props) {
  const allUsers = useAdminAuthStore((s) => s.users)
  const uploader = allUsers.find((u) => u.id === item.uploadedBy)
  const Icon = iconFor(item)

  return (
    <button
      type="button"
      onDoubleClick={onOpen}
      onClick={onOpen}
      onContextMenu={onContextMenu}
      className="text-left p-3 rounded-lg border border-border hover:border-accent-amber hover:bg-bg-tertiary/40 transition-colors flex items-center gap-3 group"
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
        item.isFolder ? 'bg-accent-amber/10 text-accent-amber' : 'bg-bg-tertiary text-text-secondary'
      }`}>
        <Icon size={18} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-text-primary text-xs font-medium truncate">
          {item.name}
        </p>
        <div className="flex items-center gap-2 text-[10px] text-text-muted mt-0.5">
          {!item.isFolder && <span>{formatFileSize(item.size)}</span>}
          {!item.isFolder && <span>·</span>}
          <span>{relativeTime(item.uploadedAt)}</span>
          {uploader && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-accent-amber/10 text-accent-amber font-bold text-[7px] flex items-center justify-center">
                  {initials(uploader.displayName)}
                </span>
                {uploader.displayName}
              </span>
            </>
          )}
        </div>
      </div>
    </button>
  )
}
