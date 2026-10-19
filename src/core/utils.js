import * as THREE from 'three'

export const TAU = Math.PI * 2

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
export const lerp = (a, b, t) => a + (b - a) * t
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt))
export const rand = (a = 1, b = 0) => b + Math.random() * (a - b)
export const randInt = (a, b) => Math.floor(rand(b + 1, a))
export const pick = (arr) => arr[(Math.random() * arr.length) | 0]
export const chance = (p) => Math.random() < p

export function angleLerp(a, b, t) {
  let d = ((b - a + Math.PI) % TAU) - Math.PI
  if (d < -Math.PI) d += TAU
  return a + d * t
}

export function angleDelta(a, b) {
  let d = ((b - a + Math.PI) % TAU) - Math.PI
  if (d < -Math.PI) d += TAU
  return d
}

const tmpV = new THREE.Vector3()

export function flatDistance(a, b) {
  const dx = a.x - b.x
  const dz = a.z - b.z
  return Math.hypot(dx, dz)
}

export function towards(from, to, out = new THREE.Vector3()) {
  return out.copy(to).sub(from)
}

export function horizontalForward(yaw, out = new THREE.Vector3()) {
  return out.set(-Math.sin(yaw), 0, -Math.cos(yaw))
}

export function randomPointInCircle(radius, out = new THREE.Vector3()) {
  const a = Math.random() * TAU
  const r = Math.sqrt(Math.random()) * radius
  return out.set(Math.cos(a) * r, 0, Math.sin(a) * r)
}

export function disposeObject(obj) {
  obj.traverse?.((child) => {
    if (child.geometry) child.geometry.dispose()
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      for (const m of mats) m.dispose()
    }
  })
}

export { tmpV }
