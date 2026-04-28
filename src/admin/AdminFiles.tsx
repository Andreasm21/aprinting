// /admin/files — shared file manager for the studio team.
//
// Features:
//   • Hierarchical folders (rows with is_folder=true; nesting via parent_id)
//   • Drag-drop file upload anywhere on the page
//   • Per-file metadata: uploader avatar, size, relative timestamp
//   • Right-click → Download / Copy link / Open in new tab / Rename / Delete
//   • Click folder → enter; breadcrumb at top to climb back up
//   • Click file → preview modal (image / video / audio / pdf / text)
//   • Realtime sync via the adminFilesStore subscription

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Folder, FolderPlus, Upload, ChevronRight, Home, Download,
  Edit3, Trash2, Link as LinkIcon, ExternalLink, Search, X,
} from 'lucide-react'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { useAdminFilesStore, publicUrl, type AdminFile } from '@/stores/adminFilesStore'
import { formatFileSize } from '@/lib/adminFilesStorage'
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu'
import FileItem from './files/FileItem'
import NewFolderModal from './files/NewFolderModal'
import RenameModal from './files/RenameModal'
import FilePreviewModal from './files/FilePreviewModal'

export default function AdminFiles() {
  const currentUser = useAdminAuthStore((s) => s.currentUser)
  const items = useAdminFilesStore((s) => s.items)
  const load = useAdminFilesStore((s) => s.load)
  const hasLoaded = useAdminFilesStore((s) => s.hasLoaded)
  const schemaMissing = useAdminFilesStore((s) => s.schemaMissing)
  const childrenOf = useAdminFilesStore((s) => s.childrenOf)
  const pathTo = useAdminFilesStore((s) => s.pathTo)
  const uploads = useAdminFilesStore((s) => s.uploads)
  const uploadFiles = useAdminFilesStore((s) => s.uploadFiles)
  const remove = useAdminFilesStore((s) => s.remove)

  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [renaming, setRenaming] = useState<AdminFile | null>(null)
  const [previewing, setPreviewing] = useState<AdminFile | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (!hasLoaded) void load() }, [hasLoaded, load])

  // If the current folder gets deleted from under us, jump to root
  useEffect(() => {
    if (currentFolderId && hasLoaded && !items.some((x) => x.id === currentFolderId)) {
      setCurrentFolderId(undefined)
    }
  }, [items, currentFolderId, hasLoaded])

  const childrenInCurrent = childrenOf(currentFolderId)
  const breadcrumb = currentFolderId ? pathTo(currentFolderId) : []

  const filtered = useMemo(() => {
    if (!search.trim()) return childrenInCurrent
    const q = search.trim().toLowerCase()
    // Search within everything when filtering (cross-folder)
    return items.filter((x) => x.name.toLowerCase().includes(q))
  }, [childrenInCurrent, search, items])

  if (!currentUser) return null

  // ─── Handlers ───
  const handleOpen = (item: AdminFile) => {
    if (item.isFolder) {
      setCurrentFolderId(item.id)
      setSearch('')
    } else {
      setPreviewing(item)
    }
  }

  const handleContextMenu = (item: AdminFile, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const itemsForMenu: ContextMenuItem[] = []
    if (!item.isFolder && item.storagePath) {
      const url = publicUrl(item.storagePath)
      itemsForMenu.push(
        { label: 'Open preview', icon: ExternalLink, onClick: () => setPreviewing(item) },
        { label: 'Download', icon: Download, onClick: () => {
          const a = document.createElement('a')
          a.href = url
          a.download = item.name
          a.click()
        } },
        { label: 'Copy link', icon: LinkIcon, onClick: () => { void navigator.clipboard.writeText(url) } },
      )
    }
    if (item.isFolder) {
      itemsForMenu.push({ label: 'Open', icon: Folder, onClick: () => handleOpen(item) })
    }
    itemsForMenu.push(
      { label: 'Rename', icon: Edit3, onClick: () => setRenaming(item) },
      { label: 'Delete', icon: Trash2, destructive: true, onClick: () => {
        const what = item.isFolder ? `folder "${item.name}" and all its contents` : `"${item.name}"`
        if (confirm(`Delete ${what}? This can't be undone.`)) {
          void remove(item.id)
        }
      } },
    )
    setContextMenu({ x: e.clientX, y: e.clientY, items: itemsForMenu })
  }

  const handleFileInput = (files: FileList | null) => {
    if (!files || files.length === 0) return
    void uploadFiles(Array.from(files), currentFolderId, currentUser.id)
  }

  // ─── Drag-drop ───
  const dragRef = useRef(0)
  const handleDragEnter = (e: React.DragEvent) => {
    if (Array.from(e.dataTransfer.types).includes('Files')) {
      e.preventDefault()
      dragRef.current += 1
      setDragOver(true)
    }
  }
  const handleDragOver = (e: React.DragEvent) => {
    if (Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault()
  }
  const handleDragLeave = () => {
    dragRef.current = Math.max(0, dragRef.current - 1)
    if (dragRef.current === 0) setDragOver(false)
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragRef.current = 0
    setDragOver(false)
    if (e.dataTransfer.files.length) {
      void uploadFiles(Array.from(e.dataTransfer.files), currentFolderId, currentUser.id)
    }
  }

  if (schemaMissing) {
    return (
      <div className="card-base p-6 max-w-xl">
        <h1 className="font-mono text-lg font-bold text-text-primary mb-2 flex items-center gap-2">
          <Folder size={18} className="text-accent-amber" /> Files
        </h1>
        <p className="text-text-secondary text-sm mb-3">The files schema isn't installed yet.</p>
        <code className="block bg-bg-tertiary border border-border rounded px-3 py-2 text-xs text-accent-amber select-all">
          supabase/migrations/20260428_admin_files.sql
        </code>
        <p className="text-text-muted text-xs mt-3">Apply that migration in the Supabase SQL Editor and refresh.</p>
      </div>
    )
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div>
          <h1 className="font-mono text-2xl font-bold text-text-primary flex items-center gap-2">
            <Folder size={24} className="text-accent-amber" /> Files
          </h1>
          <p className="text-text-secondary text-sm">Shared internal drive for the studio team</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowNewFolder(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono text-text-secondary hover:text-accent-amber border border-border hover:border-accent-amber rounded-lg transition-colors"
          >
            <FolderPlus size={13} /> New folder
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono bg-accent-amber text-bg-primary font-bold rounded-lg hover:bg-accent-amber/90 transition-colors"
          >
            <Upload size={13} /> Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => { handleFileInput(e.target.files); e.target.value = '' }}
          />
        </div>
      </div>

      {/* Breadcrumb + search */}
      <div className="flex items-center justify-between gap-3 mt-4 mb-4 flex-wrap">
        <div className="flex items-center gap-1 text-xs font-mono">
          <button
            type="button"
            onClick={() => { setCurrentFolderId(undefined); setSearch('') }}
            className={`flex items-center gap-1 px-2 py-1 rounded hover:bg-bg-tertiary/60 ${
              !currentFolderId ? 'text-accent-amber' : 'text-text-secondary'
            }`}
          >
            <Home size={12} /> Root
          </button>
          {breadcrumb.map((node) => (
            <div key={node.id} className="flex items-center gap-1">
              <ChevronRight size={11} className="text-text-muted" />
              <button
                type="button"
                onClick={() => setCurrentFolderId(node.id)}
                className={`px-2 py-1 rounded hover:bg-bg-tertiary/60 ${
                  node.id === currentFolderId ? 'text-accent-amber' : 'text-text-secondary'
                }`}
              >
                {node.name}
              </button>
            </div>
          ))}
        </div>

        <div className="relative w-full max-w-xs">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search all files…"
            className="input-field text-xs pl-7 pr-7"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Upload progress (if any) */}
      {uploads.length > 0 && (
        <div className="card-base p-3 mb-4 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-text-muted">
            Uploading · {uploads.length}
          </p>
          {uploads.map((u) => (
            <div key={u.id} className="font-mono text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-text-secondary truncate flex-1">{u.name}</span>
                <span className={u.error ? 'text-red-400' : 'text-text-muted'}>
                  {u.error ? u.error : `${formatFileSize(u.loaded)} / ${formatFileSize(u.total)}`}
                </span>
              </div>
              <div className="h-1 bg-bg-primary rounded-full overflow-hidden">
                <div
                  className={`h-full transition-[width] ${u.error ? 'bg-red-500' : 'bg-accent-amber'}`}
                  style={{ width: `${u.total > 0 ? (u.loaded / u.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* File grid / empty state */}
      {!hasLoaded ? (
        <div className="card-base p-10 text-center text-text-muted text-xs font-mono">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card-base p-10 text-center text-text-muted">
          <Upload size={28} className="mx-auto mb-3 text-text-muted/60" />
          <p className="font-mono text-sm">{search ? 'No files match your search.' : 'This folder is empty.'}</p>
          {!search && (
            <p className="font-mono text-xs mt-2 opacity-70">Drag files anywhere to upload, or use the buttons above.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {filtered.map((item) => (
            <FileItem
              key={item.id}
              item={item}
              onOpen={() => handleOpen(item)}
              onContextMenu={(e) => handleContextMenu(item, e)}
            />
          ))}
        </div>
      )}

      {/* Drag-drop overlay */}
      {dragOver && (
        <div className="fixed inset-0 z-[60] bg-accent-amber/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="text-center text-accent-amber font-mono">
            <Upload size={48} className="mx-auto mb-3 animate-bounce" />
            <p className="text-lg font-bold">Drop to upload</p>
            <p className="text-xs opacity-80 mt-1">
              {currentFolderId ? `into "${breadcrumb[breadcrumb.length - 1]?.name}"` : 'into root'}
            </p>
          </div>
        </div>
      )}

      {/* Modals + context menu */}
      {showNewFolder && (
        <NewFolderModal parentId={currentFolderId} onClose={() => setShowNewFolder(false)} />
      )}
      {renaming && (
        <RenameModal item={renaming} onClose={() => setRenaming(null)} />
      )}
      {previewing && previewing.storagePath && (
        <FilePreviewModal
          file={previewing}
          url={publicUrl(previewing.storagePath)}
          onClose={() => setPreviewing(null)}
        />
      )}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
