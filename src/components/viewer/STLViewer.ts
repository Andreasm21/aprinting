// STLViewer — the framework-agnostic viewer engine.
//
// One class, three configurations:
//   - Catalog thumbnail   { enableControls: false, autoRotate: hover-toggled }
//   - Quick-view modal    { enableControls: rotate-only, autoRotate: true }
//   - Full product page   { enableControls: full, studioMode: true }
//   - Admin STL viewer    { enableControls: full, studioMode: capture-only }
//
// Lifecycle:
//   1. constructor(canvas, opts)   — sets up scene/camera/renderer/controls
//   2. setGeometry(geom)           — recenters, fits camera, swaps mesh in
//   3. start() / stop()            — render loop control (only run when needed)
//   4. setColor(hex)               — live material color updates
//   5. resize()                    — call on container size changes
//   6. dispose()                   — full cleanup on unmount
//
// The class deliberately avoids React; it's a plain TypeScript class so it
// can be tested without a DOM and reused elsewhere (e.g. a future quote-
// configurator). React lives in `useSTLViewer.ts`.

import * as THREE from 'three'
import { OrbitControls } from './orbitControls'
import { addRig, buildLiveRig, buildStudioRig, disposeRig, type LightingRig } from './studioLighting'

export interface STLViewerOptions {
  bgColor?: number
  modelColor?: number
  enableControls?: boolean
  enableRotate?: boolean
  enablePan?: boolean
  enableZoom?: boolean
  studioMode?: boolean
  autoRotate?: boolean
  rotateSpeed?: number   // radians per second
  cameraDistMul?: number // how far to pull back from the bounding sphere
  cameraTheta?: number
  cameraPhi?: number
  pixelRatioCap?: number // default min(devicePixelRatio, 2)
  // Optional shadow settings — studio mode enables them by default.
  shadows?: boolean
  /** Wireframe overlay on top of the solid model (admin viewer only) */
  wireframe?: boolean
}

const DEFAULT_OPTS: Required<Omit<STLViewerOptions, 'modelColor' | 'bgColor'>> = {
  enableControls: true,
  enableRotate: true,
  enablePan: true,
  enableZoom: true,
  studioMode: false,
  autoRotate: false,
  rotateSpeed: 0.5,
  cameraDistMul: 2.4,
  cameraTheta: Math.PI / 4,
  cameraPhi: Math.PI / 2.7,
  pixelRatioCap: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2),
  shadows: false,
  wireframe: false,
}

export class STLViewer {
  // Scene plumbing
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly renderer: THREE.WebGLRenderer
  readonly controls: OrbitControls

  // The single mesh + its material — swapped when geometry changes.
  private mesh: THREE.Mesh | null = null
  private material: THREE.MeshStandardMaterial
  private geometry: THREE.BufferGeometry | null = null
  private wireframeMesh: THREE.Mesh | null = null

  // Lighting rig currently mounted in the scene.
  private rig: LightingRig

  // Render loop bookkeeping
  private rafId = 0
  private lastTs = 0
  private running = false

  // Saved opts (for resize / color sync)
  private opts: Required<Omit<STLViewerOptions, 'modelColor' | 'bgColor'>> & { bgColor: number; modelColor: number }
  private autoRotate: boolean
  private rotateSpeed: number

  // Optional callback fired after every render — useful for capture pipelines.
  onRender: (() => void) | null = null

  constructor(canvas: HTMLCanvasElement, opts: STLViewerOptions = {}) {
    this.opts = {
      ...DEFAULT_OPTS,
      ...opts,
      bgColor: opts.bgColor ?? 0x0F0F0F,           // matches our bg-primary
      modelColor: opts.modelColor ?? 0xF59E0B,      // accent-amber
      shadows: opts.shadows ?? !!opts.studioMode,
    }
    this.autoRotate = this.opts.autoRotate
    this.rotateSpeed = this.opts.rotateSpeed

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
    this.renderer.setPixelRatio(this.opts.pixelRatioCap)
    if (this.opts.shadows) {
      this.renderer.shadowMap.enabled = true
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    }

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(this.opts.bgColor)

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000)
    this.camera.position.set(50, 50, 50)

    this.controls = new OrbitControls(this.camera, canvas, {
      enableRotate: this.opts.enableControls && this.opts.enableRotate,
      enablePan: this.opts.enableControls && this.opts.enablePan,
      enableZoom: this.opts.enableControls && this.opts.enableZoom,
    })
    this.controls.theta = this.opts.cameraTheta
    this.controls.phi = this.opts.cameraPhi
    this.controls.update()
    this.controls.onChange = () => this.renderOnce()

    this.material = new THREE.MeshStandardMaterial({
      color: this.opts.modelColor,
      roughness: 0.55,
      metalness: 0.15,
      flatShading: false,
    })

    // Initial rig — live by default, studio if requested in opts.
    this.rig = this.opts.studioMode ? buildStudioRig(0) : buildLiveRig()
    addRig(this.scene, this.rig)

    this.resize()
  }

  /**
   * Replace the geometry. Recenters the model on origin, fits the camera to
   * its bounding sphere, and swaps the mesh in/out cleanly.
   */
  setGeometry(geom: THREE.BufferGeometry): void {
    this.geometry = geom
    // Center on origin so rotation feels natural and shadow rig math is simpler.
    geom.computeBoundingBox()
    const box = geom.boundingBox!
    const center = new THREE.Vector3()
    box.getCenter(center)
    geom.translate(-center.x, -center.y, -center.z)
    geom.computeBoundingSphere()

    if (this.mesh) {
      this.scene.remove(this.mesh)
      this.mesh = null
    }
    if (this.wireframeMesh) {
      this.scene.remove(this.wireframeMesh)
      ;(this.wireframeMesh.material as THREE.Material).dispose()
      this.wireframeMesh = null
    }

    this.mesh = new THREE.Mesh(geom, this.material)
    this.mesh.castShadow = this.opts.shadows
    this.mesh.receiveShadow = false
    this.scene.add(this.mesh)

    if (this.opts.wireframe) this.setWireframe(true)

    // Reframe camera to cover the bounding sphere. STL files come in WILDLY
    // different scales — a tiny figurine may have radius 5, a building model
    // may have radius 5000. Scale the camera, near/far planes, and orbit
    // limits to the model so any size frames correctly.
    const radius = geom.boundingSphere?.radius ?? 50
    const fitDist = (radius * this.opts.cameraDistMul) / Math.tan((this.camera.fov * Math.PI) / 360)
    this.camera.near = Math.max(0.01, fitDist * 0.001)
    this.camera.far = fitDist * 50
    this.camera.updateProjectionMatrix()
    this.controls.setDistanceLimits(fitDist * 0.05, fitDist * 20)
    this.controls.dist = fitDist
    // Reset orientation to the configured defaults whenever a new model
    // loads (keeps consecutive uploads from inheriting an earlier rotation).
    this.controls.theta = this.opts.cameraTheta
    this.controls.phi = this.opts.cameraPhi
    this.controls.target.set(0, 0, 0)
    this.controls.update()

    // If studio mode is active, the floor needs to sit at the model's bottom.
    if (this.opts.studioMode) {
      this.applyStudioFloor(box.min.y - center.y)
    }

    // Re-apply current finish (geometry was just replaced — bake the gradient
    // attribute again if needed).
    this.setFinish(this.currentFinish)

    this.renderOnce()
  }

  /** Live color change — used by the color picker + product-page swatches. */
  setColor(hex: number | string): void {
    const c = typeof hex === 'string' ? hex : ('#' + hex.toString(16).padStart(6, '0'))
    this.material.color.set(c)
    if (this.wireframeMesh) {
      ;(this.wireframeMesh.material as THREE.LineBasicMaterial).color.set(c)
    }
    // If a gradient finish is active, regenerate the vertex colors against
    // the new base color so the gradient updates live.
    if (this.currentFinish === 'gradient') this.applyGradient()
    this.renderOnce()
  }

  /**
   * Material finish presets. Roughly map to real filament/print finishes:
   *   matte    — high roughness, no metalness  (typical PLA / PETG matte)
   *   glossy   — low roughness, slight metalness  (silk PLA, polished print)
   *   metallic — low roughness, high metalness  (silver/gold/copper PLA)
   *   gradient — vertex-coloured gradient from base color (top) to a darker
   *              tinted variant (bottom). Two-tone aesthetic; printable look.
   */
  setFinish(finish: 'matte' | 'glossy' | 'metallic' | 'gradient'): void {
    this.currentFinish = finish
    // Always reset roughness/metalness/vertexColors so finishes can flip cleanly.
    this.material.vertexColors = false
    if (this.geometry) this.geometry.deleteAttribute('color')

    switch (finish) {
      case 'matte':
        this.material.roughness = 0.9
        this.material.metalness = 0
        break
      case 'glossy':
        this.material.roughness = 0.18
        this.material.metalness = 0.05
        break
      case 'metallic':
        this.material.roughness = 0.32
        this.material.metalness = 0.85
        break
      case 'gradient':
        this.material.roughness = 0.55
        this.material.metalness = 0.15
        this.applyGradient()
        break
    }
    this.material.needsUpdate = true
    this.renderOnce()
  }

  private currentFinish: 'matte' | 'glossy' | 'metallic' | 'gradient' = 'matte'

  /** Bake a per-vertex color attribute that interpolates from the current
   *  base color (at the model's top) to a darker tint (at the bottom). */
  private applyGradient(): void {
    if (!this.geometry || !this.geometry.boundingBox) return
    const positions = this.geometry.getAttribute('position') as THREE.BufferAttribute
    const bbox = this.geometry.boundingBox
    const minY = bbox.min.y
    const maxY = bbox.max.y
    const span = Math.max(0.0001, maxY - minY)
    const top = this.material.color.clone()
    // Darker variant — multiply by 0.45 (HSL value drop) for the bottom anchor.
    const bottom = top.clone().multiplyScalar(0.45)
    const colors = new Float32Array(positions.count * 3)
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i)
      const t = (y - minY) / span // 0 at bottom → 1 at top
      const r = bottom.r + (top.r - bottom.r) * t
      const g = bottom.g + (top.g - bottom.g) * t
      const b = bottom.b + (top.b - bottom.b) * t
      const o = i * 3
      colors[o] = r; colors[o + 1] = g; colors[o + 2] = b
    }
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    this.material.vertexColors = true
    this.material.needsUpdate = true
  }

  /** Re-fit the camera to the current geometry — useful after the user has
   *  zoomed or panned far off and wants to recover, or after a model that
   *  was loaded with the wrong scale needs to be reframed. */
  refitCamera(): void {
    if (!this.geometry) return
    const radius = this.geometry.boundingSphere?.radius ?? 50
    const fitDist = (radius * this.opts.cameraDistMul) / Math.tan((this.camera.fov * Math.PI) / 360)
    this.camera.near = Math.max(0.01, fitDist * 0.001)
    this.camera.far = fitDist * 50
    this.camera.updateProjectionMatrix()
    this.controls.setDistanceLimits(fitDist * 0.05, fitDist * 20)
    this.controls.dist = fitDist
    this.controls.theta = this.opts.cameraTheta
    this.controls.phi = this.opts.cameraPhi
    this.controls.target.set(0, 0, 0)
    this.controls.update()
    this.renderOnce()
  }

  /** Snap the camera to one of the four cardinal angles (matches the
   *  capture pipeline so 'Front' here looks identical to the front shot). */
  snapToView(view: 'front' | 'side' | 'back' | 'top' | 'hero'): void {
    const angles = {
      front: { theta: Math.PI / 2,            phi: Math.PI / 2.2 },
      side:  { theta: 0,                       phi: Math.PI / 2.2 },
      back:  { theta: -3 * Math.PI / 4,        phi: Math.PI / 2.7 },
      top:   { theta: Math.PI / 4,             phi: Math.PI / 5   },
      hero:  { theta: Math.PI / 4,             phi: Math.PI / 2.7 },
    }
    const a = angles[view]
    this.controls.setView(a.theta, a.phi)
  }

  setWireframe(on: boolean): void {
    this.opts.wireframe = on
    if (on && this.geometry && !this.wireframeMesh) {
      const wireGeom = new THREE.WireframeGeometry(this.geometry)
      const wireMat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.18,
      })
      this.wireframeMesh = new THREE.LineSegments(wireGeom, wireMat) as unknown as THREE.Mesh
      this.scene.add(this.wireframeMesh)
    } else if (!on && this.wireframeMesh) {
      this.scene.remove(this.wireframeMesh)
      ;(this.wireframeMesh.material as THREE.Material).dispose()
      this.wireframeMesh = null
    }
    this.renderOnce()
  }

  /** Toggle the live grid in non-studio mode. Does nothing in studio mode. */
  setGrid(_on: boolean): void {
    // Live rig doesn't include a grid by default — caller can extend later.
    // Studio rig owns its own grid via the lighting rig and shouldn't be
    // toggled separately. Hook here for the admin viewer when needed.
  }

  setAutoRotate(on: boolean, speed?: number): void {
    this.autoRotate = on
    if (speed !== undefined) this.rotateSpeed = speed
    if (on) this.start()
    // If turning off, leave the loop running for the next frame so the user
    // sees the motion stop smoothly.
  }

  /** Switch between live and studio lighting at runtime (used by capture). */
  setStudioMode(on: boolean): void {
    if (on === this.opts.studioMode) return
    this.opts.studioMode = on
    disposeRig(this.scene, this.rig)
    if (on) {
      const floorY = this.geometry?.boundingBox?.min.y ?? 0
      this.rig = buildStudioRig(floorY)
      this.renderer.shadowMap.enabled = true
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
      if (this.mesh) this.mesh.castShadow = true
    } else {
      this.rig = buildLiveRig()
      this.renderer.shadowMap.enabled = false
      if (this.mesh) this.mesh.castShadow = false
    }
    addRig(this.scene, this.rig)
    this.renderOnce()
  }

  private applyStudioFloor(floorY: number): void {
    if (!this.opts.studioMode || !this.rig.floor) return
    this.rig.floor.position.y = floorY
    if (this.rig.grid) this.rig.grid.position.y = floorY + 0.05
  }

  // ──────── render loop ────────

  start(): void {
    if (this.running) return
    this.running = true
    this.lastTs = performance.now()
    const tick = (ts: number) => {
      if (!this.running) return
      const dt = (ts - this.lastTs) / 1000
      this.lastTs = ts
      if (this.autoRotate && this.mesh) {
        this.controls.theta += this.rotateSpeed * dt
        this.controls.update()
      }
      this.renderer.render(this.scene, this.camera)
      this.onRender?.()
      this.rafId = requestAnimationFrame(tick)
    }
    this.rafId = requestAnimationFrame(tick)
  }

  stop(): void {
    this.running = false
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.rafId = 0
  }

  /** Single render — useful when not animating but a state change happened. */
  renderOnce(): void {
    this.renderer.render(this.scene, this.camera)
    this.onRender?.()
  }

  resize(): void {
    const canvas = this.renderer.domElement
    const w = canvas.clientWidth || canvas.width || 1
    const h = canvas.clientHeight || canvas.height || 1
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderOnce()
  }

  dispose(): void {
    this.stop()
    this.controls.detach()
    if (this.mesh) {
      this.scene.remove(this.mesh)
      this.mesh = null
    }
    if (this.wireframeMesh) {
      this.scene.remove(this.wireframeMesh)
      ;(this.wireframeMesh.material as THREE.Material).dispose()
      this.wireframeMesh = null
    }
    this.material.dispose()
    // Geometry may be shared across viewer instances — DON'T dispose here.
    // Callers manage geometry lifetime via `loadGeometry`'s cache.
    disposeRig(this.scene, this.rig)
    this.renderer.dispose()
  }

  /** Direct access for capture pipelines that need to swap renderer settings. */
  getRenderer(): THREE.WebGLRenderer { return this.renderer }
  getMesh(): THREE.Mesh | null { return this.mesh }
  getMaterial(): THREE.MeshStandardMaterial { return this.material }
  getRig(): LightingRig { return this.rig }
  getModelRadius(): number { return this.geometry?.boundingSphere?.radius ?? 50 }
}
