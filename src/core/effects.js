import * as THREE from 'three'
import { rand, clamp } from './utils.js'

const circleTexture = (() => {
  let tex = null
  return () => {
    if (tex) return tex
    const size = 64
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.4, 'rgba(255,255,255,0.65)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }
})()

/** GPU point-sprite particle system with a fixed pool. */
class Particles {
  constructor(scene, max = 1500) {
    this.max = max
    this.count = 0
    this.positions = new Float32Array(max * 3)
    this.colors = new Float32Array(max * 3)
    this.sizes = new Float32Array(max)
    this.alphas = new Float32Array(max)
    this.vel = new Float32Array(max * 3)
    this.life = new Float32Array(max)
    this.maxLife = new Float32Array(max)
    this.gravity = new Float32Array(max)
    this.drag = new Float32Array(max)

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1))
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1))
    geo.setDrawRange(0, 0)

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uMap: { value: circleTexture() } },
      vertexShader: `
        attribute vec3 aColor; attribute float aSize; attribute float aAlpha;
        varying vec3 vColor; varying float vAlpha;
        void main() {
          vColor = aColor; vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (300.0 / max(0.001, -mv.z));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D uMap; varying vec3 vColor; varying float vAlpha;
        void main() {
          vec4 t = texture2D(uMap, gl_PointCoord);
          float a = t.a * vAlpha;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor * t.rgb, a);
        }`
    })

    this.points = new THREE.Points(geo, mat)
    this.points.frustumCulled = false
    this.geo = geo
    this.mesh = this.points
    this.active = new Set()
    scene.add(this.points)
  }

  emit(pos, opts = {}) {
    const {
      count = 10, color = new THREE.Color(0xffcc55), speed = 4, spread = 0.4,
      life = 0.6, size = 0.6, gravity = 6, drag = 2, dir = null, cone = Math.PI
    } = opts
    for (let i = 0; i < count; i++) {
      if (this.active.size >= this.max) break
      const idx = this._alloc()
      if (idx < 0) break
      const a = Math.random() * Math.PI * 2
      const up = Math.random() * cone
      let dx = Math.cos(a) * Math.sin(up)
      let dz = Math.sin(a) * Math.sin(up)
      let dy = Math.cos(up)
      if (dir) {
        const t = new THREE.Vector3(dx, dy, dz).multiplyScalar(0.5).add(dir).normalize()
        dx = t.x; dy = t.y; dz = t.z
      }
      const sp = speed * (0.5 + Math.random())
      this.vel[idx * 3] = dx * sp
      this.vel[idx * 3 + 1] = dy * sp + (dir ? 1 : 2)
      this.vel[idx * 3 + 2] = dz * sp
      const cc = color.clone().offsetHSL(rand(0.05, -0.05), 0, rand(0.15, -0.15))
      this.colors[idx * 3] = cc.r
      this.colors[idx * 3 + 1] = cc.g
      this.colors[idx * 3 + 2] = cc.b
      this.positions[idx * 3] = pos.x + rand(spread, -spread)
      this.positions[idx * 3 + 1] = pos.y + rand(spread, -spread)
      this.positions[idx * 3 + 2] = pos.z + rand(spread, -spread)
      this.sizes[idx] = size * (0.6 + Math.random() * 0.9)
      this.alphas[idx] = 1
      this.maxLife[idx] = this.life[idx] = life * (0.7 + Math.random() * 0.6)
      this.gravity[idx] = gravity
      this.drag[idx] = drag
      this.active.add(idx)
    }
  }

  _alloc() {
    for (let i = 0; i < this.max; i++) if (!this.active.has(i)) return i
    return -1
  }

  update(dt) {
    if (this.active.size === 0) {
      this.geo.setDrawRange(0, 0)
      return
    }
    for (const idx of Array.from(this.active)) {
      this.life[idx] -= dt
      if (this.life[idx] <= 0) {
        this.active.delete(idx)
        this.alphas[idx] = 0
        continue
      }
      const d = Math.exp(-this.drag[idx] * dt)
      this.vel[idx * 3] *= d
      this.vel[idx * 3 + 1] = this.vel[idx * 3 + 1] * d - this.gravity[idx] * dt
      this.vel[idx * 3 + 2] *= d
      this.positions[idx * 3] += this.vel[idx * 3] * dt
      this.positions[idx * 3 + 1] += this.vel[idx * 3 + 1] * dt
      this.positions[idx * 3 + 2] += this.vel[idx * 3 + 2] * dt
      if (this.positions[idx * 3 + 1] < 0.05) {
        this.positions[idx * 3 + 1] = 0.05
        this.vel[idx * 3 + 1] *= -0.28
      }
      this.alphas[idx] = clamp(this.life[idx] / this.maxLife[idx], 0, 1)
    }
    this.geo.setDrawRange(0, this.max)
    this.geo.attributes.position.needsUpdate = true
    this.geo.attributes.aColor.needsUpdate = true
    this.geo.attributes.aSize.needsUpdate = true
    this.geo.attributes.aAlpha.needsUpdate = true
  }
}

/** Pooled additive meshes for rings, shockwaves and slash arcs. */
class MeshFxPool {
  constructor(scene) {
    this.scene = scene
    this.items = []
    this.geometries = {
      ring: new THREE.RingGeometry(0.72, 1, 48),
      flatRing: new THREE.RingGeometry(0.55, 1, 64),
      slash: new THREE.RingGeometry(0.55, 1, 32, 1, -0.9, 1.8),
      sphere: new THREE.SphereGeometry(1, 16, 12)
    }
  }

  spawn(kind, opts = {}) {
    const geo = this.geometries[kind] || this.geometries.ring
    const mat = new THREE.MeshBasicMaterial({
      color: opts.color ?? 0xffffff,
      transparent: true,
      opacity: opts.opacity ?? 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      wireframe: !!opts.wireframe
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(opts.position || new THREE.Vector3())
    if (opts.rotation) mesh.rotation.set(opts.rotation.x, opts.rotation.y, opts.rotation.z)
    if (opts.quaternion) mesh.quaternion.copy(opts.quaternion)
    if (opts.flat) mesh.rotation.x = -Math.PI / 2
    mesh.scale.setScalar(opts.startScale ?? 0.2)
    this.scene.add(mesh)
    this.items.push({
      mesh,
      life: 0,
      ttl: opts.ttl ?? 0.5,
      startScale: opts.startScale ?? 0.2,
      endScale: opts.endScale ?? 2.5,
      startOpacity: opts.opacity ?? 0.9,
      grow: opts.grow ?? 1,
      spin: opts.spin ?? 0,
      fade: opts.fade ?? 1
    })
    return mesh
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]
      it.life += dt
      const t = clamp(it.life / it.ttl, 0, 1)
      const s = it.startScale + (it.endScale - it.startScale) * Math.pow(t, it.grow)
      it.mesh.scale.setScalar(s)
      it.mesh.material.opacity = it.startOpacity * Math.pow(1 - t, it.fade)
      if (it.spin) it.mesh.rotation.z += it.spin * dt
      if (t >= 1) {
        this.scene.remove(it.mesh)
        it.mesh.material.dispose()
        this.items.splice(i, 1)
      }
    }
  }
}

export class Effects {
  constructor(scene) {
    this.scene = scene
    this.particles = new Particles(scene, 1800)
    this.meshFx = new MeshFxPool(scene)
    this.flashes = []
  }

  burst(position, opts) { this.particles.emit(position, opts) }

  ring(position, opts = {}) {
    return this.meshFx.spawn(opts.flat ? 'flatRing' : 'ring', { position, ...opts })
  }

  slash(position, quaternion, opts = {}) {
    return this.meshFx.spawn('slash', { position, quaternion, startScale: opts.startScale ?? 0.6, endScale: opts.endScale ?? 1.4, ttl: opts.ttl ?? 0.22, color: opts.color ?? 0xffffff, grow: 0.6, spin: opts.spin ?? 6 })
  }

  shockwave(position, color = 0xffffff, ttl = 0.5, endScale = 6) {
    return this.meshFx.spawn('flatRing', { position, color, flat: true, startScale: 0.4, endScale, ttl, grow: 0.5, opacity: 0.8 })
  }

  flash(position, color = 0xffffff, size = 2, ttl = 0.24) {
    return this.meshFx.spawn('sphere', { position, color, startScale: size * 0.4, endScale: size, ttl, grow: 0.7, opacity: 0.7 })
  }

  hitSpark(position, color = 0xfff2a8) {
    this.burst(position, { count: 12, color: new THREE.Color(color), speed: 7, life: 0.4, size: 0.55, gravity: 10, drag: 3 })
    this.flash(position.clone(), color, 1.3, 0.16)
  }

  update(dt) {
    this.particles.update(dt)
    this.meshFx.update(dt)
  }
}
