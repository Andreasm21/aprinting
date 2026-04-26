// Capture pipeline — saves viewer state, switches to studio mode at 1600×1600,
// renders 5 fixed angles, applies the watermark to each, restores everything,
// returns the PNG data URLs.
//
// The 5 angles match the spec exactly so the studio operator gets a
// consistent set of marketing photos for every product.

import { STLViewer } from './STLViewer'
import { applyWatermark } from './watermark'

export interface CaptureShot {
  name: string
  dataUrl: string
}

export interface CaptureOptions {
  watermarkText?: string
  size?: number // square edge length, default 1600
}

interface ShotAngle {
  name: string
  theta: number
  phi: number
  distMul: number
}

const SHOT_ANGLES: ShotAngle[] = [
  { name: 'hero',   theta: Math.PI / 4,            phi: Math.PI / 2.7, distMul: 2.4 },
  { name: 'front',  theta: Math.PI / 2,            phi: Math.PI / 2.2, distMul: 2.4 },
  { name: 'side',   theta: 0,                       phi: Math.PI / 2.2, distMul: 2.4 },
  { name: 'back34', theta: -3 * Math.PI / 4,        phi: Math.PI / 2.7, distMul: 2.4 },
  { name: 'top',    theta: Math.PI / 4,             phi: Math.PI / 5,   distMul: 2.7 },
]

export async function captureFiveShots(
  viewer: STLViewer,
  opts: CaptureOptions = {},
): Promise<CaptureShot[]> {
  const size = opts.size ?? 1600
  const renderer = viewer.getRenderer()

  // ── 1. Save viewer state so we can restore it after capture. ──
  const saved = {
    pixelRatio: renderer.getPixelRatio(),
    width: renderer.domElement.width,
    height: renderer.domElement.height,
    aspect: viewer.camera.aspect,
    theta: viewer.controls.theta,
    phi: viewer.controls.phi,
    dist: viewer.controls.dist,
    target: viewer.controls.target.clone(),
    studioMode: !!viewer.getMaterial(), // we always have a material; flag is implicit via opts in caller
  }
  // Snapshot of whether studio mode was already on so we know whether to flip back.
  const wasStudio = renderer.shadowMap.enabled

  try {
    // ── 2. Switch to studio mode + force consistent output dimensions. ──
    if (!wasStudio) viewer.setStudioMode(true)
    renderer.setPixelRatio(1)
    renderer.setSize(size, size, false)
    viewer.camera.aspect = 1
    viewer.camera.updateProjectionMatrix()

    const radius = viewer.getModelRadius()
    const shots: CaptureShot[] = []

    // ── 3. Loop angles, capture, watermark. ──
    for (const angle of SHOT_ANGLES) {
      const fitDist = (radius * angle.distMul) / Math.tan((viewer.camera.fov * Math.PI) / 360)
      viewer.controls.setView(angle.theta, angle.phi, fitDist)
      // Wait one paint so the new camera + lighting actually render.
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
      viewer.renderOnce()
      const dataUrl = applyWatermark(renderer.domElement, { text: opts.watermarkText })
      shots.push({ name: angle.name, dataUrl })
    }

    return shots
  } finally {
    // ── 4. Restore everything. ──
    renderer.setPixelRatio(saved.pixelRatio)
    renderer.setSize(saved.width, saved.height, false)
    viewer.camera.aspect = saved.aspect
    viewer.camera.updateProjectionMatrix()
    viewer.controls.setView(saved.theta, saved.phi, saved.dist)
    viewer.controls.target.copy(saved.target)
    viewer.controls.update()
    if (!wasStudio) viewer.setStudioMode(false)
    viewer.renderOnce()
  }
}

/** Trigger 5 sequential downloads with a small stagger (browsers block
 *  bulk simultaneous downloads). Filenames slot into the spec format
 *  `{base}_{NN}_{angle}.png`.  */
export function downloadShots(shots: CaptureShot[], baseFilename: string, staggerMs = 200): void {
  const safe = baseFilename.replace(/[^a-zA-Z0-9_-]+/g, '_').toLowerCase() || 'axiom'
  shots.forEach((shot, i) => {
    setTimeout(() => {
      const a = document.createElement('a')
      a.href = shot.dataUrl
      a.download = `${safe}_${String(i + 1).padStart(2, '0')}_${shot.name}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }, i * staggerMs)
  })
}
