// GLB/GLTF parser — wraps Three.js GLTFLoader so storefront products that
// have a .glb model_url (legacy from the @google/model-viewer days) keep
// working alongside new STL uploads.
//
// We extract the first mesh's geometry from the loaded scene because
// the rest of the viewer pipeline (color picker, studio rig) operates on a
// single mesh+geometry. Multi-mesh scenes are rare for product models;
// composite models can be merged at upload time in a follow-up.

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export async function parseGLB(buffer: ArrayBuffer): Promise<THREE.BufferGeometry> {
  const loader = new GLTFLoader()
  return await new Promise<THREE.BufferGeometry>((resolve, reject) => {
    loader.parse(
      buffer,
      '',
      (gltf) => {
        const merged: THREE.BufferGeometry[] = []
        gltf.scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh
            const geom = (mesh.geometry as THREE.BufferGeometry).clone()
            // Bake the world transform into the geometry so the mesh can be
            // positioned independently downstream.
            mesh.updateWorldMatrix(true, false)
            geom.applyMatrix4(mesh.matrixWorld)
            merged.push(geom)
          }
        })
        if (merged.length === 0) {
          reject(new Error('GLB contained no meshes'))
          return
        }
        // For now: just take the first mesh. (THREE.BufferGeometryUtils.mergeGeometries
        // exists but requires identical attribute sets across meshes, which isn't
        // guaranteed for arbitrary GLBs.)
        const geom = merged[0]
        if (!geom.getAttribute('normal')) geom.computeVertexNormals()
        geom.computeBoundingBox()
        geom.computeBoundingSphere()
        resolve(geom)
      },
      (err) => reject(err),
    )
  })
}
