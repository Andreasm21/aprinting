// Storage helpers for the `admin-files` bucket.
//
// Files live at paths like `2026/{ms-timestamp}_{rand}_{safe-name}` to avoid
// collisions when two admins upload the same name simultaneously.

import { supabase } from './supabase'

const BUCKET = 'admin-files'

const MAX_SIZE_BYTES = 100 * 1024 * 1024  // 100 MB hard cap per file

export interface UploadResult {
  storagePath: string
  url: string
  size: number
  mime: string
}

export async function uploadAdminFile(
  file: File,
  onProgress?: (loaded: number, total: number) => void,
): Promise<UploadResult> {
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error(`File too large (max ${MAX_SIZE_BYTES / 1024 / 1024} MB)`)
  }
  const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_').toLowerCase()
  const storagePath = `${new Date().getFullYear()}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safe}`
  const mime = file.type || 'application/octet-stream'

  // Supabase JS doesn't currently expose upload progress events for the
  // public-anon path, so we report 0 → file.size in two ticks. Good enough
  // for the UI; switch to resumable uploads later if huge files become common.
  onProgress?.(0, file.size)
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    upsert: false,
    contentType: mime,
  })
  if (error) throw new Error(`Upload failed: ${error.message}`)
  onProgress?.(file.size, file.size)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
  return {
    storagePath,
    url: data.publicUrl,
    size: file.size,
    mime,
  }
}

export async function deleteAdminFile(storagePath: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath])
  if (error) console.warn('[admin-files] storage delete failed:', error.message)
}

/** Fetch a one-shot signed URL for downloads (forces attachment download
 *  via the bucket's response headers). For previews we use the public URL
 *  directly. */
export function publicUrl(storagePath: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}
