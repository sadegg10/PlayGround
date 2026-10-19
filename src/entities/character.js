import * as THREE from 'three'
import { clamp, lerp } from '../core/utils.js'

export function createHumanoid(opts = {}) {
  const {
    color = 0x3b2a72,
    accent = 0xf5c542,
    skin = 0xd9a06b,
    hair = 0x181820,
    emissive = 0x000000,
    emissiveIntensity = 0.5,
    opacity = 1,
    bulk = 1,
    scale = 1,
    cape = false,
    glow = false
  } = opts

  const transparent = opacity < 1
  const bodyMat = new THREE.MeshStandardMaterial({
    color, roughness: 0.55, metalness: 0.35,
    emissive, emissiveIntensity, transparent, opacity,
    depthWrite: !transparent
  })
  const accentMat = new THREE.MeshStandardMaterial({
    color: accent, roughness: 0.35, metalness: 0.6,
    emissive: glow ? accent : 0x000000, emissiveIntensity: glow ? 0.9 : 0.15,
    transparent, opacity: Math.min(1, opacity + 0.1), depthWrite: !transparent
  })
  const skinMat = new THREE.MeshStandardMaterial({
    color: skin, roughness: 0.7, metalness: 0.1, transparent, opacity,
    emissive: glow ? skin : 0x000000, emissiveIntensity: glow ? 0.35 : 0, depthWrite: !transparent
  })
  const hairMat = new THREE.MeshStandardMaterial({
    color: hair, roughness: 0.8, metalness: 0.1, transparent, opacity, depthWrite: !transparent
  })

  const root = new THREE.Group()
  const body = new THREE.Group()
  root.add(body)

  const b = bulk
  const hipsY = 0.95 * scale
  const torsoLen = 0.62 * scale
  const shoulderY = hipsY + torsoLen * 0.92
  const shoulderW = 0.34 * scale * b
  const hipW = 0.2 * scale

  // ---- hips ----
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.42 * scale * b, 0.28 * scale, 0.28 * scale), bodyMat)
  hips.position.y = hipsY
  hips.castShadow = true
  body.add(hips)

  // ---- torso ----
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5 * scale * b, torsoLen, 0.3 * scale), bodyMat)
  torso.position.y = hipsY + torsoLen / 2 + 0.1
  torso.castShadow = true
  body.add(torso)

  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.28 * scale * b, 16, 12), accentMat)
  chest.scale.set(1.1, 0.9, 0.7)
  chest.position.y = hipsY + torsoLen * 0.85
  body.add(chest)

  // ---- head ----
  const headPivot = new THREE.Group()
  headPivot.position.y = shoulderY + 0.22 * scale
  body.add(headPivot)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19 * scale, 20, 16), skinMat)
  head.scale.set(0.95, 1.05, 0.95)
  head.castShadow = true
  headPivot.add(head)
  const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.2 * scale, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat)
  hairMesh.position.y = 0.03 * scale
  hairMesh.castShadow = true
  headPivot.add(hairMesh)
  // dramatic hair spikes
  for (let i = 0; i < 5; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06 * scale, 0.26 * scale, 6), hairMat)
    const a = -0.8 + i * 0.4
    spike.position.set(Math.sin(a) * 0.12 * scale, 0.2 * scale, Math.cos(a) * 0.08 * scale)
    spike.rotation.set(-0.5 + Math.abs(a) * 0.2, a, a * 0.5)
    headPivot.add(spike)
  }

  // ---- arms ----
  const armLen = 0.62 * scale
  function makeArm(side) {
    const pivot = new THREE.Group()
    pivot.position.set(side * shoulderW, shoulderY, 0)
    body.add(pivot)
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.17 * scale * b, armLen * 0.52, 0.17 * scale * b), bodyMat)
    upper.position.y = -armLen * 0.26
    upper.castShadow = true
    pivot.add(upper)
    const elbow = new THREE.Group()
    elbow.position.y = -armLen * 0.5
    pivot.add(elbow)
    const lower = new THREE.Mesh(new THREE.BoxGeometry(0.14 * scale * b, armLen * 0.44, 0.14 * scale * b), skinMat)
    lower.position.y = -armLen * 0.22
    lower.castShadow = true
    elbow.add(lower)
    const fist = new THREE.Mesh(new THREE.SphereGeometry(0.12 * scale * b, 12, 10), accentMat)
    fist.position.y = -armLen * 0.46
    fist.castShadow = true
    elbow.add(fist)
    return { pivot, elbow, fist }
  }
  const leftArm = makeArm(-1)
  const rightArm = makeArm(1)

  // ---- legs ----
  const legLen = 0.95 * scale
  function makeLeg(side) {
    const pivot = new THREE.Group()
    pivot.position.set(side * hipW, hipsY - 0.05 * scale, 0)
    body.add(pivot)
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.19 * scale * b, legLen * 0.52, 0.19 * scale * b), bodyMat)
    thigh.position.y = -legLen * 0.26
    thigh.castShadow = true
    pivot.add(thigh)
    const knee = new THREE.Group()
    knee.position.y = -legLen * 0.5
    pivot.add(knee)
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.16 * scale * b, legLen * 0.46, 0.16 * scale * b), bodyMat)
    shin.position.y = -legLen * 0.24
    shin.castShadow = true
    knee.add(shin)
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.18 * scale * b, 0.1 * scale, 0.3 * scale), accentMat)
    foot.position.set(0, -legLen * 0.49, 0.06 * scale)
    foot.castShadow = true
    knee.add(foot)
    return { pivot, knee }
  }
  const leftLeg = makeLeg(-1)
  const rightLeg = makeLeg(1)

  if (cape) {
    const capeGeo = new THREE.PlaneGeometry(0.8 * scale * b, 1.1 * scale, 6, 8)
    const capeMesh = new THREE.Mesh(capeGeo, new THREE.MeshStandardMaterial({
      color: accent, roughness: 0.9, metalness: 0.05, side: THREE.DoubleSide,
      transparent, opacity: Math.min(1, opacity + 0.15), depthWrite: !transparent
    }))
    capeMesh.position.set(0, hipsY + torsoLen * 0.4, -0.2 * scale)
    body.add(capeMesh)
    root.userData.cape = capeMesh
  }

  rigSetup(root, { body, headPivot, leftArm, rightArm, leftLeg, rightLeg, hipsY, shoulderY })
  return { root, body, headPivot, leftArm, rightArm, leftLeg, rightLeg, hipsY, shoulderY, scale, materials: { bodyMat, accentMat, skinMat, hairMat } }
}

function rigSetup(root, parts) {
  root.userData.rig = parts
}

/** Sets a nice pose given movement/attack state. `time` is seconds. */
export function poseHumanoid(rig, state = {}) {
  const {
    time = 0, speed = 0, attack = 0, hurt = 0, guard = 0,
    running = false, jump = null
  } = state
  const s = clamp(speed, 0, 1)
  const phase = time * (7 + s * 4)
  const stride = (running ? 1.1 : 0.85) * s

  rig.leftLeg.pivot.rotation.x = Math.sin(phase) * 0.7 * stride
  rig.rightLeg.pivot.rotation.x = -Math.sin(phase) * 0.7 * stride
  rig.leftLeg.knee.rotation.x = Math.max(0, -Math.sin(phase)) * 0.8 * stride
  rig.rightLeg.knee.rotation.x = Math.max(0, Math.sin(phase)) * 0.8 * stride

  const swing = Math.sin(phase) * 0.5 * s
  rig.leftArm.pivot.rotation.x = -swing
  rig.rightArm.pivot.rotation.x = swing
  rig.leftArm.pivot.rotation.z = 0.12
  rig.rightArm.pivot.rotation.z = -0.12
  rig.leftArm.elbow.rotation.x = -0.25 - Math.abs(swing) * 0.5
  rig.rightArm.elbow.rotation.x = -0.25 - Math.abs(swing) * 0.5

  // idle breathing
  const breath = Math.sin(time * 2.2) * 0.012
  let bob = Math.abs(Math.sin(phase)) * 0.06 * s + breath
  let lean = s * 0.16

  if (jump !== null) {
    rig.leftLeg.pivot.rotation.x = lerp(rig.leftLeg.pivot.rotation.x, -0.6, 0.5)
    rig.rightLeg.pivot.rotation.x = lerp(rig.rightLeg.pivot.rotation.x, 0.35, 0.5)
    rig.leftLeg.knee.rotation.x = lerp(rig.leftLeg.knee.rotation.x, 0.9, 0.5)
    rig.rightArm.pivot.rotation.x = lerp(rig.rightArm.pivot.rotation.x, -1.4, 0.4)
  }

  if (guard > 0) {
    rig.leftArm.pivot.rotation.x = lerp(rig.leftArm.pivot.rotation.x, -1.6, guard)
    rig.rightArm.pivot.rotation.x = lerp(rig.rightArm.pivot.rotation.x, -1.6, guard)
    rig.leftArm.elbow.rotation.x = lerp(rig.leftArm.elbow.rotation.x, -1.5, guard)
    rig.rightArm.elbow.rotation.x = lerp(rig.rightArm.elbow.rotation.x, -1.5, guard)
  }

  if (attack > 0) {
    rig.rightArm.pivot.rotation.x = lerp(rig.rightArm.pivot.rotation.x, -1.7, attack)
    rig.rightArm.pivot.rotation.z = lerp(rig.rightArm.pivot.rotation.z, -0.25, attack)
    rig.rightArm.elbow.rotation.x = lerp(rig.rightArm.elbow.rotation.x, 0.1, attack)
    lean += attack * 0.16
    bob += attack * 0.02
  }

  if (hurt > 0) {
    lean = -hurt * 0.5
    rig.leftArm.pivot.rotation.x = lerp(rig.leftArm.pivot.rotation.x, -2.2, hurt)
    rig.rightArm.pivot.rotation.x = lerp(rig.rightArm.pivot.rotation.x, -2.2, hurt)
    rig.headPivot.rotation.x = lerp(rig.headPivot.rotation.x, -0.5, hurt)
  } else {
    rig.headPivot.rotation.x = lerp(rig.headPivot.rotation.x, -lean * 0.3, 0.3)
  }

  rig.body.position.y = bob
  rig.body.rotation.x = lean

  const cape = rig.root?.userData?.cape
  if (cape) {
    cape.rotation.x = 0.25 + Math.sin(time * 3) * 0.08 + s * 0.5
  }
}

/** Blends a whole rig toward a "defeated" slump. */
export function applyDefeat(rig, t) {
  rig.root.rotation.x = -Math.PI / 2.2 * clamp(t, 0, 1)
  rig.root.position.y = -0.15 * clamp(t, 0, 1)
  rig.body.rotation.x = 0
}
