// Custom orbit controls — spherical-coordinate camera with mouse + touch.
//
// Why custom: pulling THREE.OrbitControls from the examples adds ~25KB to the
// bundle and brings keyboard/auto-rotate/damping baggage we don't need. The
// public API here is deliberately small: attach to a canvas + camera, choose
// a target, and the controls handle pointer events.
//
// Coordinate convention:
//   theta = horizontal angle around Y (azimuth)
//   phi   = vertical angle from Y (polar), clamped [0.05, π-0.05] to avoid gimbal flip
//   dist  = camera distance from target

import * as THREE from 'three'

export interface OrbitControlsOptions {
  enableRotate?: boolean
  enablePan?: boolean
  enableZoom?: boolean
  rotateSpeed?: number
  panSpeed?: number
  zoomSpeed?: number
  minDist?: number
  maxDist?: number
}

export class OrbitControls {
  private camera: THREE.PerspectiveCamera
  private el: HTMLElement
  private opts: Required<OrbitControlsOptions>

  target = new THREE.Vector3()
  theta = Math.PI / 4
  phi = Math.PI / 2.7
  dist = 100

  // Internal pointer state
  private dragging: 'rotate' | 'pan' | null = null
  private lastX = 0
  private lastY = 0
  // For pinch zoom on touch devices
  private pinchDist = 0

  // Set by the consumer (STLViewer) — called whenever the user interacts so
  // the next frame can be rendered.
  onChange: () => void = () => {}

  constructor(camera: THREE.PerspectiveCamera, el: HTMLElement, opts: OrbitControlsOptions = {}) {
    this.camera = camera
    this.el = el
    this.opts = {
      enableRotate: opts.enableRotate ?? true,
      enablePan: opts.enablePan ?? true,
      enableZoom: opts.enableZoom ?? true,
      rotateSpeed: opts.rotateSpeed ?? 1,
      panSpeed: opts.panSpeed ?? 1,
      zoomSpeed: opts.zoomSpeed ?? 1,
      minDist: opts.minDist ?? 1,
      maxDist: opts.maxDist ?? 10000,
    }
    this.attach()
  }

  /** Apply theta/phi/dist/target to the actual camera. Call after any change. */
  update(): void {
    const sinPhi = Math.sin(this.phi)
    const x = this.dist * sinPhi * Math.sin(this.theta)
    const y = this.dist * Math.cos(this.phi)
    const z = this.dist * sinPhi * Math.cos(this.theta)
    this.camera.position.set(
      this.target.x + x,
      this.target.y + y,
      this.target.z + z,
    )
    this.camera.lookAt(this.target)
  }

  /** Reset to a default framing. Call after loading new geometry. */
  reset(target: THREE.Vector3, distance: number): void {
    this.target.copy(target)
    this.dist = distance
    this.theta = Math.PI / 4
    this.phi = Math.PI / 2.7
    this.update()
    this.onChange()
  }

  /** Public setter so admin viewer's Reset View button can call it. */
  setView(theta: number, phi: number, dist?: number): void {
    this.theta = theta
    this.phi = clamp(phi, 0.05, Math.PI - 0.05)
    if (dist !== undefined) this.dist = clamp(dist, this.opts.minDist, this.opts.maxDist)
    this.update()
    this.onChange()
  }

  /** Adjust the zoom range to suit a newly-loaded model's scale. */
  setDistanceLimits(minDist: number, maxDist: number): void {
    this.opts.minDist = minDist
    this.opts.maxDist = maxDist
    this.dist = clamp(this.dist, minDist, maxDist)
  }

  /** Live-read of the current limits. */
  getDistanceLimits(): { minDist: number; maxDist: number } {
    return { minDist: this.opts.minDist, maxDist: this.opts.maxDist }
  }

  // ──────── pointer handling ────────

  private attach(): void {
    this.el.addEventListener('pointerdown', this.onPointerDown)
    this.el.addEventListener('pointermove', this.onPointerMove)
    this.el.addEventListener('pointerup', this.onPointerUp)
    this.el.addEventListener('pointercancel', this.onPointerUp)
    this.el.addEventListener('wheel', this.onWheel, { passive: false })
    this.el.addEventListener('contextmenu', this.onContextMenu)
    // Touch pinch zoom
    this.el.addEventListener('touchstart', this.onTouchStart, { passive: false })
    this.el.addEventListener('touchmove', this.onTouchMove, { passive: false })
    this.el.addEventListener('touchend', this.onTouchEnd)
  }

  detach(): void {
    this.el.removeEventListener('pointerdown', this.onPointerDown)
    this.el.removeEventListener('pointermove', this.onPointerMove)
    this.el.removeEventListener('pointerup', this.onPointerUp)
    this.el.removeEventListener('pointercancel', this.onPointerUp)
    this.el.removeEventListener('wheel', this.onWheel)
    this.el.removeEventListener('contextmenu', this.onContextMenu)
    this.el.removeEventListener('touchstart', this.onTouchStart)
    this.el.removeEventListener('touchmove', this.onTouchMove)
    this.el.removeEventListener('touchend', this.onTouchEnd)
  }

  private onContextMenu = (e: Event) => e.preventDefault()

  private onPointerDown = (e: PointerEvent) => {
    if (e.button === 0 && this.opts.enableRotate) this.dragging = 'rotate'
    else if (e.button === 2 && this.opts.enablePan) this.dragging = 'pan'
    else return
    this.lastX = e.clientX
    this.lastY = e.clientY
    this.el.setPointerCapture(e.pointerId)
  }

  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging) return
    const dx = e.clientX - this.lastX
    const dy = e.clientY - this.lastY
    this.lastX = e.clientX
    this.lastY = e.clientY

    if (this.dragging === 'rotate') {
      // 0.005 ≈ 1° per ~3.5px — feels natural.
      this.theta -= dx * 0.005 * this.opts.rotateSpeed
      this.phi -= dy * 0.005 * this.opts.rotateSpeed
      this.phi = clamp(this.phi, 0.05, Math.PI - 0.05)
    } else if (this.dragging === 'pan') {
      // Pan along camera-space right + up vectors, scaled by distance so the
      // model moves in screen-space at a constant speed.
      const right = new THREE.Vector3()
      const up = new THREE.Vector3()
      this.camera.matrix.extractBasis(right, up, new THREE.Vector3())
      const factor = this.dist * 0.0015 * this.opts.panSpeed
      this.target.addScaledVector(right, -dx * factor)
      this.target.addScaledVector(up, dy * factor)
    }
    this.update()
    this.onChange()
  }

  private onPointerUp = (e: PointerEvent) => {
    this.dragging = null
    if (this.el.hasPointerCapture(e.pointerId)) this.el.releasePointerCapture(e.pointerId)
  }

  private onWheel = (e: WheelEvent) => {
    if (!this.opts.enableZoom) return
    e.preventDefault()
    const factor = e.deltaY > 0 ? 1.1 : 1 / 1.1
    this.dist = clamp(this.dist * factor, this.opts.minDist, this.opts.maxDist)
    this.update()
    this.onChange()
  }

  private onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2 && this.opts.enableZoom) {
      e.preventDefault()
      this.pinchDist = touchDistance(e)
    }
  }

  private onTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 2 && this.opts.enableZoom && this.pinchDist > 0) {
      e.preventDefault()
      const newDist = touchDistance(e)
      const ratio = this.pinchDist / newDist
      this.dist = clamp(this.dist * ratio, this.opts.minDist, this.opts.maxDist)
      this.pinchDist = newDist
      this.update()
      this.onChange()
    }
  }

  private onTouchEnd = () => {
    this.pinchDist = 0
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function touchDistance(e: TouchEvent): number {
  const dx = e.touches[0].clientX - e.touches[1].clientX
  const dy = e.touches[0].clientY - e.touches[1].clientY
  return Math.hypot(dx, dy)
}
