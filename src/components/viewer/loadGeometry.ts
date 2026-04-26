// Geometry loader — fetches a model URL and dispatches to the right parser
// based on the file extension. Caches parsed geometries by URL so that
// reopening the same product (admin → catalog → quick-view → product page)
// only parses the file once.

import * as THREE from 'three'
import { parseSTL } from './parseSTL'
import { parseGLB } from './parseGLB'

const cache = new Map<string, Promise<THREE.BufferGeometry>>()

export type ModelFormat = 'stl' | 'glb' | 'gltf'

export function detectFormat(url: string): ModelFormat | null {
  const ext = url.toLowerCase().split('.').pop()?.split('?')[0]
  if (ext === 'stl') return 'stl'
  if (ext === 'glb') return 'glb'
  if (ext === 'gltf') return 'gltf'
  return null
}

export function loadGeometry(url: string): Promise<THREE.BufferGeometry> {
  const cached = cache.get(url)
  if (cached) return cached
  const promise = (async () => {
    const fmt = detectFormat(url)
    if (!fmt) throw new Error(`Unsupported model format: ${url}`)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to fetch model: HTTP ${res.status}`)
    const buf = await res.arrayBuffer()
    if (fmt === 'stl') return parseSTL(buf)
    return await parseGLB(buf)
  })()
  cache.set(url, promise)
  // If the load fails, evict so retries can succeed.
  promise.catch(() => cache.delete(url))
  return promise
}

/** Drop a specific URL from the cache (e.g. when a model has been re-uploaded). */
export function evictGeometry(url: string): void {
  cache.delete(url)
}

/** Clear everything — useful if memory pressure becomes a concern. */
export function clearGeometryCache(): void {
  cache.clear()
}
