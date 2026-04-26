// Lighting rigs for the viewer.
//
// `live` — gentle ambient + warm key + cool fill + warm rim. Used for the
//   admin viewer's normal mode and any non-studio storefront viewer
//   (catalog thumbnails, quick-view modal). Friendly daylight feel.
//
// `studio` — dark studio with low ambient, warm directional key, cool fill,
//   amber rim (axiom brand), cyan counter-rim, and a hair light. Used by
//   the admin Capture 5 pipeline AND the full product page (so customers
//   see a marketing-grade render). Casts soft shadows onto a dark concrete
//   floor + a subtle GridHelper.
//
// Both rigs return a list of light objects + an optional floor mesh so
// callers can `scene.add(...lights)` and dispose them cleanly when
// switching modes.

import * as THREE from 'three'

export interface LightingRig {
  lights: THREE.Light[]
  floor?: THREE.Mesh
  grid?: THREE.GridHelper
  ambientIntensity: number
}

export function buildLiveRig(): LightingRig {
  const ambient = new THREE.AmbientLight(0xffffff, 0.45)
  const key = new THREE.DirectionalLight(0xffffff, 0.8)
  key.position.set(1, 1.2, 0.8).normalize().multiplyScalar(50)
  const fill = new THREE.DirectionalLight(0xc4ddff, 0.35)
  fill.position.set(-1, -0.4, -0.8).normalize().multiplyScalar(50)
  const rim = new THREE.DirectionalLight(0xffd9b3, 0.35)
  rim.position.set(0, -1, 0.5).normalize().multiplyScalar(50)
  return { lights: [ambient, key, fill, rim], ambientIntensity: 0.45 }
}

/**
 * Dark studio rig used for hero shots + the product page.
 * Floor sits at `floorY` (the model's bottom). Floor + grid are returned
 * separately so the admin viewer can position them under the loaded model
 * before adding to the scene.
 */
export function buildStudioRig(floorY: number, floorSize = 800): LightingRig {
  const ambient = new THREE.AmbientLight(0xffffff, 0.18)

  const key = new THREE.DirectionalLight(0xfff0dd, 1.05)
  key.position.set(40, 65, 30)
  key.castShadow = true
  // PCFSoftShadowMap parameters tuned for our typical 50–200mm prints.
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.bias = -0.0003
  key.shadow.radius = 5
  key.shadow.camera.near = 0.5
  key.shadow.camera.far = 500
  key.shadow.camera.left = -100
  key.shadow.camera.right = 100
  key.shadow.camera.top = 100
  key.shadow.camera.bottom = -100

  const fill = new THREE.DirectionalLight(0x6688aa, 0.28)
  fill.position.set(-50, 22, -10)

  // Brand-amber warm rim — gives the silhouette the Axiom orange edge highlight.
  const warmRim = new THREE.DirectionalLight(0xff8c42, 0.7)
  warmRim.position.set(35, 25, -55)

  // Cool cyan counter-rim — that "tech product" feel.
  const coolRim = new THREE.DirectionalLight(0x6acdff, 0.45)
  coolRim.position.set(-45, 18, -50)

  // Hair light — separates the model from the dark background.
  const hair = new THREE.DirectionalLight(0xffffff, 0.25)
  hair.position.set(0, 90, 5)

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(floorSize, floorSize),
    new THREE.MeshStandardMaterial({ color: 0x141519, roughness: 0.65, metalness: 0.08 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = floorY
  floor.receiveShadow = true

  const grid = new THREE.GridHelper(floorSize, 40, 0x6e727b, 0x44464d)
  ;(grid.material as THREE.Material).transparent = true
  ;(grid.material as THREE.Material).opacity = 0.55
  grid.position.y = floorY + 0.05 // sit just above the floor to avoid z-fighting

  return {
    lights: [ambient, key, fill, warmRim, coolRim, hair],
    floor,
    grid,
    ambientIntensity: 0.18,
  }
}

/** Helpers for swapping rigs. Disposes of materials/geometries cleanly. */
export function disposeRig(scene: THREE.Scene, rig: LightingRig): void {
  for (const light of rig.lights) scene.remove(light)
  if (rig.floor) {
    scene.remove(rig.floor)
    rig.floor.geometry.dispose()
    ;(rig.floor.material as THREE.Material).dispose()
  }
  if (rig.grid) {
    scene.remove(rig.grid)
    rig.grid.geometry.dispose()
    const mat = rig.grid.material as THREE.Material | THREE.Material[]
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
    else mat.dispose()
  }
}

export function addRig(scene: THREE.Scene, rig: LightingRig): void {
  for (const light of rig.lights) scene.add(light)
  if (rig.floor) scene.add(rig.floor)
  if (rig.grid) scene.add(rig.grid)
}
