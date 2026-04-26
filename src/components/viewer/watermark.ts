// Watermark compositor — overlays a tiled diagonal pattern on a captured
// canvas frame. The motif is an Axiom diamond + wordmark stamped at low
// opacity, rotated to make cropping out the watermark expensive in terms
// of model area lost.
//
// Returns a fresh data URL (image/png) of the watermarked image.

const AMBER = '#F59E0B' // accent-amber from our theme

export interface WatermarkOptions {
  /** Text shown next to the diamond. Default 'AXIOM'. Empty disables watermark. */
  text?: string
  /** Pattern opacity. Default 0.11 — visible but not overwhelming. */
  opacity?: number
  /** Pattern rotation. Default -π/7 (~-25.7°). */
  rotation?: number
}

/**
 * Composite a watermark onto a source canvas. Returns a new data URL.
 * Source canvas isn't modified.
 */
export function applyWatermark(source: HTMLCanvasElement, opts: WatermarkOptions = {}): string {
  const text = (opts.text ?? 'AXIOM').trim()
  if (!text) {
    // Empty watermark — return source unchanged.
    return source.toDataURL('image/png')
  }
  const opacity = opts.opacity ?? 0.11
  const rotation = opts.rotation ?? -Math.PI / 7

  // 1. Draw the WebGL canvas onto a fresh 2D canvas at the same dimensions.
  const out = document.createElement('canvas')
  out.width = source.width
  out.height = source.height
  const ctx = out.getContext('2d')!
  ctx.drawImage(source, 0, 0)

  // 2. Build the stamp tile — one diamond + wordmark unit.
  // Tile width scales with image width so the watermark looks right at any size.
  const tileW = Math.round(source.width * 0.18)
  const tileH = Math.round(source.height * 0.06)
  const tile = buildTile(tileW, tileH, text)

  // 3. Repeat-fill an oversized rectangle, rotated, centered on the canvas.
  // Hypotenuse * 1.25 ensures full coverage when rotated.
  const fillSize = Math.hypot(source.width, source.height) * 1.25
  const pattern = ctx.createPattern(tile, 'repeat')
  if (!pattern) return out.toDataURL('image/png')

  ctx.save()
  ctx.globalAlpha = opacity
  ctx.translate(source.width / 2, source.height / 2)
  ctx.rotate(rotation)
  ctx.fillStyle = pattern
  ctx.fillRect(-fillSize / 2, -fillSize / 2, fillSize, fillSize)
  ctx.restore()

  return out.toDataURL('image/png')
}

/** Build one tile = an amber diamond followed by uppercase letter-spaced wordmark. */
function buildTile(width: number, height: number, text: string): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const ctx = c.getContext('2d')!

  const diamondSize = Math.min(height * 0.55, width * 0.06)
  const cx = diamondSize / 2 + 6
  const cy = height / 2

  // Diamond (rotated square — clip-path equivalent in canvas).
  ctx.fillStyle = AMBER
  ctx.beginPath()
  ctx.moveTo(cx, cy - diamondSize / 2)
  ctx.lineTo(cx + diamondSize / 2, cy)
  ctx.lineTo(cx, cy + diamondSize / 2)
  ctx.lineTo(cx - diamondSize / 2, cy)
  ctx.closePath()
  ctx.fill()

  // Wordmark.
  const fontSize = Math.round(diamondSize * 0.85)
  ctx.fillStyle = AMBER
  ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "JetBrains Mono", "SF Mono", monospace`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  // Letter-spacing trick: draw each character with a manual advance so we
  // can simulate the spec's `letter-spacing: 1.5px` look.
  let x = cx + diamondSize / 2 + 8
  for (const ch of text.toUpperCase()) {
    ctx.fillText(ch, x, cy)
    x += ctx.measureText(ch).width + Math.max(1.5, fontSize * 0.08)
  }

  return c
}
