// Bottom-of-panel composer.
//
//   ┌────────────────────────────────────────────────────────┐
//   │ [Pending attachment chips, if any]                     │
//   ├────────────────────────────────────────────────────────┤
//   │ [📎] [textarea ........................] [🎤 hold] [➤] │
//   └────────────────────────────────────────────────────────┘
//
// Behaviour:
//   • Enter sends, Shift+Enter inserts newline.
//   • Drag-drop files anywhere over the panel queues them.
//   • Paperclip opens the OS file picker.
//   • Mic: press-and-hold to record a voice note (see Phase B); release to
//     upload + send. Tap (no hold) shows a hint.

import { useEffect, useRef, useState } from 'react'
import { Send, Paperclip, Mic, Square, X, Upload } from 'lucide-react'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { useAdminChatStore } from '@/stores/adminChatStore'
import { uploadChatAttachment, formatBytes, type ChatAttachment } from '@/lib/chatStorage'
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder'

interface Props {
  roomId: string
  onType?: () => void
}

const MAX_HEIGHT_PX = 96

export default function MessageComposer({ roomId, onType }: Props) {
  const currentUser = useAdminAuthStore((s) => s.currentUser)
  const allUsers = useAdminAuthStore((s) => s.users)
  const sendMessage = useAdminChatStore((s) => s.sendMessage)

  const [body, setBody] = useState('')
  const [pending, setPending] = useState<ChatAttachment[]>([])
  const [uploading, setUploading] = useState(0)            // # of in-flight uploads
  const [sending, setSending] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const recorder = useVoiceRecorder()

  // Auto-grow textarea
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_HEIGHT_PX)}px`
  }, [body])

  const enqueueFiles = async (files: FileList | File[]) => {
    setError('')
    const list = Array.from(files)
    if (list.length === 0) return
    setUploading((n) => n + list.length)
    const results = await Promise.allSettled(list.map((f) => uploadChatAttachment(f)))
    setUploading((n) => Math.max(0, n - list.length))
    const ok: ChatAttachment[] = []
    const errs: string[] = []
    for (const r of results) {
      if (r.status === 'fulfilled') ok.push(r.value)
      else errs.push(r.reason?.message ?? 'upload failed')
    }
    if (ok.length) setPending((p) => [...p, ...ok])
    if (errs.length) setError(errs.join('; '))
  }

  const removePending = (url: string) => {
    setPending((p) => p.filter((a) => a.url !== url))
  }

  const submit = async () => {
    if (!currentUser) return
    if (sending || uploading > 0) return
    const trimmed = body.trim()
    if (!trimmed && pending.length === 0) return

    // Mention parsing — Phase 5 keeps it simple regex
    const mentions: string[] = []
    const re = /@(\w+)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(trimmed)) !== null) {
      const username = m[1].toLowerCase()
      const u = allUsers.find((x) => x.username.toLowerCase() === username)
      if (u && !mentions.includes(u.id)) mentions.push(u.id)
    }

    setSending(true)
    const attachmentsToSend = pending
    setBody('')
    setPending([])
    try {
      await sendMessage(roomId, currentUser.id, trimmed, mentions, attachmentsToSend)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void submit()
    }
  }

  // ─── Drag-drop ───
  const handleDragEnter = (e: React.DragEvent) => {
    if (Array.from(e.dataTransfer.types).includes('Files')) {
      e.preventDefault()
      setDragOver(true)
    }
  }
  const handleDragOver = (e: React.DragEvent) => {
    if (Array.from(e.dataTransfer.types).includes('Files')) {
      e.preventDefault()
    }
  }
  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target) setDragOver(false)
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length) void enqueueFiles(e.dataTransfer.files)
  }

  // ─── Voice note: send when recorder finishes ───
  const recordingHandledRef = useRef<string | null>(null)
  useEffect(() => {
    if (!recorder.lastBlob || !currentUser) return
    // Process each blob exactly once
    const key = `${recorder.lastBlob.size}-${recorder.lastBlob.type}-${recorder.lastDurationMs}`
    if (recordingHandledRef.current === key) return
    recordingHandledRef.current = key

    void (async () => {
      setUploading((n) => n + 1)
      try {
        const ext = recorder.lastBlob!.type.includes('webm') ? 'webm' : 'audio'
        const att = await uploadChatAttachment(recorder.lastBlob!, {
          name: `voice-note-${Date.now()}.${ext}`,
          durationMs: recorder.lastDurationMs,
        })
        await sendMessage(roomId, currentUser.id, '', [], [att])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'voice upload failed')
      } finally {
        setUploading((n) => Math.max(0, n - 1))
      }
    })()
  }, [recorder.lastBlob, recorder.lastDurationMs, currentUser, sendMessage, roomId])

  if (!currentUser) return null

  return (
    <div
      className={`relative border-t border-border bg-bg-tertiary/30 p-2 ${dragOver ? 'ring-2 ring-accent-amber ring-inset' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragOver && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg-secondary/95 pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-accent-amber">
            <Upload size={28} />
            <p className="text-xs uppercase tracking-wider">Drop to upload</p>
          </div>
        </div>
      )}

      {/* Pending attachments preview */}
      {pending.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {pending.map((a) => (
            <div
              key={a.url}
              className="flex items-center gap-1.5 pl-2 pr-1 py-1 rounded bg-bg-tertiary border border-border text-[10px]"
            >
              <span className="text-text-secondary truncate max-w-[120px]">{a.name}</span>
              <span className="text-text-muted">{formatBytes(a.size)}</span>
              <button
                type="button"
                onClick={() => removePending(a.url)}
                aria-label="Remove attachment"
                className="text-text-muted hover:text-red-400 p-0.5"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="text-red-400 text-[10px] mb-1.5">{error}</p>
      )}

      {recorder.recording ? (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-red-400 text-xs font-mono flex-1">
            Recording · {Math.round(recorder.durationMs / 100) / 10}s
          </span>
          <button
            type="button"
            onClick={() => recorder.cancel()}
            className="text-text-muted hover:text-text-primary text-[10px] uppercase tracking-wider"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => recorder.stop()}
            aria-label="Stop and send"
            className="w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center hover:scale-105 transition-transform"
          >
            <Square size={11} />
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-1.5 bg-bg-tertiary rounded-lg border border-border focus-within:border-accent-amber transition-colors px-2 py-1.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading > 0 || sending}
            aria-label="Attach files"
            title="Attach files"
            className="text-text-muted hover:text-accent-amber disabled:opacity-40 p-1"
          >
            <Paperclip size={15} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void enqueueFiles(e.target.files)
              e.target.value = ''  // allow re-selecting the same file
            }}
          />

          <textarea
            ref={taRef}
            value={body}
            onChange={(e) => { setBody(e.target.value); onType?.() }}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={uploading > 0 ? `Uploading ${uploading}…` : 'Type a message…'}
            className="flex-1 bg-transparent resize-none outline-none text-text-primary text-xs leading-relaxed font-mono placeholder:text-text-muted/60 max-h-24 py-1"
          />

          <button
            type="button"
            onClick={() => void recorder.start()}
            disabled={sending}
            aria-label="Record voice note"
            title="Record voice note"
            className="text-text-muted hover:text-accent-amber disabled:opacity-40 p-1"
          >
            <Mic size={15} />
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={(!body.trim() && pending.length === 0) || sending || uploading > 0}
            aria-label="Send message"
            className="text-accent-amber disabled:text-text-muted/40 disabled:cursor-not-allowed hover:scale-110 transition-transform p-1"
          >
            <Send size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
