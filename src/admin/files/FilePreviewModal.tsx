// In-page preview for the most common file types.
//
// Supports:
//   • image/* → <img>
//   • video/* → native <video controls>
//   • audio/* → native <audio controls>
//   • application/pdf → <iframe> at full size
//   • text/* + application/json → fetch + render in <pre>
//   • everything else → file icon + download link
//
// Closes on backdrop click or Esc.

import { useEffect, useState } from 'react'
import { X, Download, ExternalLink, FileText } from 'lucide-react'
import type { AdminFile } from '@/stores/adminFilesStore'
import { formatFileSize } from '@/lib/adminFilesStorage'

interface Props {
  file: AdminFile
  url: string
  onClose: () => void
}

export default function FilePreviewModal({ file, url, onClose }: Props) {
  const [textContent, setTextContent] = useState<string | null>(null)
  const [textError, setTextError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const isImage = file.mime.startsWith('image/')
  const isVideo = file.mime.startsWith('video/')
  const isAudio = file.mime.startsWith('audio/')
  const isPdf = file.mime === 'application/pdf'
  const isText = file.mime.startsWith('text/') || file.mime === 'application/json'

  // Lazy-fetch text content (under 200 KB)
  useEffect(() => {
    if (!isText) return
    if (file.size > 200 * 1024) {
      setTextError('Too large to preview inline (download to view)')
      return
    }
    void (async () => {
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const text = await res.text()
        setTextContent(text)
      } catch (err) {
        setTextError(err instanceof Error ? err.message : 'fetch failed')
      }
    })()
  }, [isText, url, file.size])

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-sm flex flex-col items-stretch p-3"
      onClick={onClose}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 mb-2 rounded-lg bg-bg-secondary/80 border border-border font-mono text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0 flex-1">
          <p className="text-text-primary truncate">{file.name}</p>
          <p className="text-text-muted text-[10px]">{file.mime || '—'} · {formatFileSize(file.size)}</p>
        </div>
        <div className="flex items-center gap-1 ml-3">
          <a
            href={url}
            download={file.name}
            className="px-2 py-1.5 rounded text-text-secondary hover:text-accent-amber hover:bg-bg-tertiary/60 flex items-center gap-1.5"
            title="Download"
          >
            <Download size={13} /><span className="hidden sm:inline">Download</span>
          </a>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2 py-1.5 rounded text-text-secondary hover:text-accent-amber hover:bg-bg-tertiary/60"
            title="Open in new tab"
          >
            <ExternalLink size={13} />
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="px-2 py-1.5 rounded text-text-muted hover:text-text-primary"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div
        className="flex-1 min-h-0 flex items-center justify-center overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {isImage && (
          <img src={url} alt={file.name} className="max-w-full max-h-full object-contain rounded" />
        )}
        {isVideo && (
          <video src={url} controls className="max-w-full max-h-full rounded" />
        )}
        {isAudio && (
          <audio src={url} controls className="w-full max-w-md" />
        )}
        {isPdf && (
          <iframe src={url} title={file.name} className="w-full h-full bg-white rounded" />
        )}
        {isText && (
          <pre className="w-full h-full max-w-4xl bg-bg-secondary border border-border rounded p-4 overflow-auto text-xs font-mono text-text-secondary whitespace-pre-wrap">
            {textError ? `Could not preview: ${textError}` : textContent ?? 'Loading…'}
          </pre>
        )}
        {!isImage && !isVideo && !isAudio && !isPdf && !isText && (
          <div className="text-center text-text-muted">
            <FileText size={36} className="mx-auto mb-3 text-text-muted/60" />
            <p className="font-mono text-sm">No inline preview for this file type.</p>
            <p className="font-mono text-xs mt-1">Use Download or Open in new tab above.</p>
          </div>
        )}
      </div>
    </div>
  )
}
