// STL parser — handles both binary and ASCII formats with auto-detection.
// Returns a Three.js BufferGeometry with `position` + `normal` attributes set.
//
// Auto-detect rule:
//   Binary STL is exactly `80 + 4 + 50 * triangleCount` bytes. We compute the
//   expected size from the triangle count at offset 80; if it matches, parse
//   as binary. Otherwise fall back to ASCII (some files claim binary in the
//   header but are actually ASCII — the byte count check is the only reliable
//   discriminator).

import * as THREE from 'three'

export function parseSTL(buffer: ArrayBuffer): THREE.BufferGeometry {
  // Binary detection: read triangle count at offset 80 (little-endian uint32).
  // Expected file size = 80 (header) + 4 (count) + 50 * count (per-triangle).
  if (buffer.byteLength >= 84) {
    const view = new DataView(buffer)
    const triCount = view.getUint32(80, true)
    const expected = 80 + 4 + 50 * triCount
    if (expected === buffer.byteLength) {
      return parseBinary(buffer, triCount)
    }
  }
  // Fallback — try ASCII.
  return parseAscii(buffer)
}

function parseBinary(buffer: ArrayBuffer, triCount: number): THREE.BufferGeometry {
  const view = new DataView(buffer)
  const positions = new Float32Array(triCount * 9)
  const normals = new Float32Array(triCount * 9)
  let offset = 84 // skip 80-byte header + 4-byte triangle count

  for (let i = 0; i < triCount; i++) {
    // Per-triangle layout: 12 bytes normal + 36 bytes vertices (3×12) + 2 attr bytes.
    const nx = view.getFloat32(offset, true)
    const ny = view.getFloat32(offset + 4, true)
    const nz = view.getFloat32(offset + 8, true)
    offset += 12

    const baseIdx = i * 9
    for (let v = 0; v < 3; v++) {
      const p = baseIdx + v * 3
      positions[p] = view.getFloat32(offset, true)
      positions[p + 1] = view.getFloat32(offset + 4, true)
      positions[p + 2] = view.getFloat32(offset + 8, true)
      // Replicate the face normal across all three vertices of this triangle.
      normals[p] = nx
      normals[p + 1] = ny
      normals[p + 2] = nz
      offset += 12
    }
    offset += 2 // skip attribute byte count (2 bytes, almost always 0)
  }

  return buildGeometry(positions, normals)
}

function parseAscii(buffer: ArrayBuffer): THREE.BufferGeometry {
  const text = new TextDecoder().decode(buffer)
  const positions: number[] = []
  const normals: number[] = []
  let currentNormal: [number, number, number] = [0, 0, 1]

  // Cheap line-by-line scan. STL ASCII grammar is permissive about whitespace;
  // we tokenise each non-empty line by splitting on whitespace and pattern-match
  // the leading keyword.
  const lines = text.split(/\r?\n/)
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('facet normal')) {
      const parts = line.split(/\s+/)
      // 'facet normal NX NY NZ'
      currentNormal = [parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4])]
    } else if (line.startsWith('vertex')) {
      const parts = line.split(/\s+/)
      // 'vertex X Y Z'
      positions.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]))
      normals.push(...currentNormal)
    }
  }

  return buildGeometry(new Float32Array(positions), new Float32Array(normals))
}

function buildGeometry(positions: Float32Array, normals: Float32Array): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geom.computeBoundingBox()
  geom.computeBoundingSphere()
  return geom
}
