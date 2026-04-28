// Inline image preview — clickable to open in a fullscreen lightbox.
// Lightbox closes on backdrop click or Esc.

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { ChatAttachment } from '@/lib/chatStorage'

interface Props {
  attachment: ChatAttachment
}

export default function ImageAttachment({ attachment }: Props) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block max-w-[260px] max-h-[200px] rounded-lg overflow-hidden border border-border hover:border-accent-amber transition-colors"
      >
        <img
          src={attachment.url}
          alt={attachment.name}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(false) }}
            aria-label="Close"
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
          >
            <X size={20} />
          </button>
          <img
            src={attachment.url}
            alt={attachment.name}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
