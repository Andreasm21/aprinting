// Generic non-image, non-audio attachment row — file icon, name, size,
// download link.

import { File, FileText, FileImage, Archive, Download } from 'lucide-react'
import { formatBytes, type ChatAttachment } from '@/lib/chatStorage'

interface Props {
  attachment: ChatAttachment
}

function iconFor(mime: string) {
  if (mime === 'application/pdf') return FileText
  if (mime.startsWith('image/')) return FileImage
  if (mime.startsWith('text/') || mime === 'application/json') return FileText
  if (mime === 'application/zip' || mime.includes('compress')) return Archive
  return File
}

export default function AttachmentChip({ attachment }: Props) {
  const Icon = iconFor(attachment.mime)
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      download={attachment.name}
      className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-bg-tertiary border border-border hover:border-accent-amber transition-colors max-w-full"
    >
      <Icon size={14} className="text-accent-amber flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-text-primary text-[11px] truncate">{attachment.name}</p>
        <p className="text-text-muted text-[9px]">{formatBytes(attachment.size)}</p>
      </div>
      <Download size={11} className="text-text-muted flex-shrink-0" />
    </a>
  )
}
