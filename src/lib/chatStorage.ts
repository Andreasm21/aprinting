// Chat attachment uploads → Supabase Storage `chat-attachments` bucket.
//
// Returns a normalised attachment descriptor that's safe to embed in the
// admin_chat_messages.attachments JSONB column.

import { supabase } from './supabase'

const BUCKET = 'chat-attachments'

export type AttachmentKind = 'image' | 'audio' | 'file'

export interface ChatAttachment {
  name: string          // original filename
  url: string           // public CDN url
  mime: string          // 'image/png', 'audio/webm', etc.
  size: number          // bytes
  kind: AttachmentKind  // dictates how it's rendered
  durationMs?: number   // audio only — captured client-side from MediaRecorder
}

const MAX_SIZE_BYTES = 25 * 1024 * 1024  // 25 MB hard cap

/** Upload a single file. Throws if the file is too large or upload fails. */
export async function uploadChatAttachment(
  file: File | Blob,
  options?: { name?: string; durationMs?: number },
): Promise<ChatAttachment> {
  const fileName = options?.name ?? (file instanceof File ? file.name : 'voice-note')
  const size = file.size
  if (size > MAX_SIZE_BYTES) {
    throw new Error(`File too large (max ${MAX_SIZE_BYTES / 1024 / 1024} MB)`)
  }

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, '_').toLowerCase()
  const path = `${new Date().getFullYear()}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${safeName}`
  const mime = file.type || guessMime(fileName)

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: mime,
  })
  if (error) throw new Error(`Upload failed: ${error.message}`)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return {
    name: fileName,
    url: data.publicUrl,
    mime,
    size,
    kind: classify(mime),
    durationMs: options?.durationMs,
  }
}

export function classify(mime: string): AttachmentKind {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('audio/')) return 'audio'
  return 'file'
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function guessMime(name: string): string {
  const ext = name.toLowerCase().split('.').pop() ?? ''
  const map: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
    gif: 'image/gif', svg: 'image/svg+xml',
    pdf: 'application/pdf', zip: 'application/zip',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', webm: 'audio/webm',
    mp4: 'video/mp4', mov: 'video/quicktime',
    txt: 'text/plain', csv: 'text/csv', json: 'application/json',
  }
  return map[ext] ?? 'application/octet-stream'
}
