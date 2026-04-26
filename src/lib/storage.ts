// Supabase Storage helpers for the `product-models` bucket.
//
// Why a dedicated module: STL files are 1–20 MB. Stuffing them into a column
// as a data URL bloats every storefront_products row read by ~30% per byte.
// Storage gives us CDN-cached URLs and lets the row stay tiny (just the URL).

import { supabase } from './supabase'

const BUCKET = 'product-models'

/** Upload a file to the bucket and return a public URL. Generates a slugified
 *  path from the file name + a timestamp suffix so re-uploads don't clash. */
export async function uploadProductModel(file: File): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_').toLowerCase()
  const path = `${Date.now()}_${safeName}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || guessContentType(file.name),
  })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/** Delete a previously-uploaded model by its public URL. Best-effort —
 *  caller should treat failures as non-fatal so the product update still
 *  succeeds even if cleanup fails. */
export async function deleteProductModel(publicUrl: string): Promise<void> {
  const path = extractPath(publicUrl)
  if (!path) return
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) console.warn('[storage] cleanup failed:', error.message)
}

/** Pull the relative path out of a public URL we previously generated. */
function extractPath(publicUrl: string): string | null {
  // Supabase public URL format:
  //   https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const idx = publicUrl.indexOf(marker)
  if (idx === -1) return null
  return publicUrl.slice(idx + marker.length)
}

function guessContentType(name: string): string {
  const ext = name.toLowerCase().split('.').pop()
  if (ext === 'stl') return 'model/stl'
  if (ext === 'glb') return 'model/gltf-binary'
  if (ext === 'gltf') return 'model/gltf+json'
  return 'application/octet-stream'
}
